// PostgreSQL-реализация репозиториев (Р1, Р5). SQL написан руками, по одному запросу на метод:
// многошаговых транзакций нет, поэтому у метода не бывает наполовину применённого состояния.
// Здесь же проходит последняя линия защиты от двойного бронирования (I2): use-case проверяет
// занятость первым и отвечает понятной ошибкой, но при гонке двух запросов решает exclusion
// constraint — его отказ этот файл переводит обратно в доменный код, а не отдаёт наружу как 500.

import { BOOKINGS_NO_OVERLAP_CONSTRAINT } from '@minical/database';
import type { Pool } from 'pg';

import { DomainError } from '../domain/errors.ts';
import type { AvailabilityRule, Booking, EventType, OwnerRecord, TimeInterval } from '../domain/model.ts';
import type { Store } from './repositories.ts';

// SQLSTATE, которые для домена значат не сбой, а отказ по правилу.
const UNIQUE_VIOLATION = '23505';
const EXCLUSION_VIOLATION = '23P01';
const DEADLOCK_DETECTED = '40P01';

const EVENT_TYPE_COLUMNS = 'id, name, description, duration_minutes';
const BOOKING_COLUMNS = `id, event_type_id, event_type_name, start_at_utc, end_at_utc,
                         guest_name, guest_email, guest_note, created_at_utc`;

interface OwnerRow {
  display_name: string;
  time_zone: string;
  // jsonb драйвер отдаёт уже разобранным. Форму гарантирует то, что писал её этот же файл:
  // колонка хранит ровно VO настроек, чужих писателей у неё нет.
  availability_rules: AvailabilityRule[];
  slot_interval_minutes: number;
  onboarding_completed: boolean;
}

interface EventTypeRow {
  id: string;
  name: string;
  description: string | null;
  duration_minutes: number;
}

interface BookingRow {
  id: string;
  event_type_id: string;
  event_type_name: string;
  start_at_utc: Date;
  end_at_utc: Date;
  guest_name: string;
  guest_email: string;
  guest_note: string | null;
  created_at_utc: Date;
}

interface IntervalRow {
  start_at_utc: Date;
  end_at_utc: Date;
}

function toOwner(row: OwnerRow): OwnerRecord {
  return {
    displayName: row.display_name,
    onboardingCompleted: row.onboarding_completed,
    settings: {
      timeZone: row.time_zone,
      availabilityRules: row.availability_rules,
      slotIntervalMinutes: row.slot_interval_minutes,
    },
  };
}

// `null` в колонке и отсутствующее поле домена — одно и то же: доменные типы объявляют
// описание и заметку необязательными, а не nullable, и второй способ «нет значения» породил бы
// разное поведение сериализации у двух реализаций Store.
function toEventType(row: EventTypeRow): EventType {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    durationMinutes: row.duration_minutes,
  };
}

function toBooking(row: BookingRow): Booking {
  return {
    id: row.id,
    eventTypeId: row.event_type_id,
    eventTypeName: row.event_type_name,
    startAtUtc: row.start_at_utc,
    endAtUtc: row.end_at_utc,
    guestName: row.guest_name,
    guestEmail: row.guest_email,
    guestNote: row.guest_note ?? undefined,
    createdAtUtc: row.created_at_utc,
  };
}

// Ошибки драйвера приходят экземплярами `DatabaseError`, но импортировать класс ради двух полей
// значило бы завязать разбор на внутреннее устройство pg: достаточно проверить форму.
function isPgFailure(error: unknown): error is { code: string; constraint?: string } {
  return (
    typeof error === 'object' && error !== null && typeof (error as { code?: unknown }).code === 'string'
  );
}

// Различать отказы по имени констрейнта, а не только по SQLSTATE: пересечение и повторный id
// обязаны стать разными ответами, а незнакомый отказ — остаться собой, а не превратиться
// в выдуманный доменный код.
function bookingFailure(error: unknown, booking: Booking): unknown {
  if (!isPgFailure(error)) return error;
  if (error.code === EXCLUSION_VIOLATION && error.constraint === BOOKINGS_NO_OVERLAP_CONSTRAINT) {
    return new DomainError('SLOT_UNAVAILABLE', 'Requested slot conflicts with an existing booking');
  }
  // Дедлок здесь — тот же исход гонки, а не сбой: exclusion-проверка идёт после вставки индексной
  // записи, поэтому два конкурентных INSERT успевают дождаться друг друга, и детектор прерывает
  // одного из них. Для гостя это «слот только что заняли», а не 500. Имени констрейнта у такого
  // отказа нет, поэтому решает один SQLSTATE — вставок в этом методе ровно одна.
  if (error.code === DEADLOCK_DETECTED) {
    return new DomainError('SLOT_UNAVAILABLE', 'Requested slot conflicts with an existing booking');
  }
  if (error.code === UNIQUE_VIOLATION) {
    return new DomainError('DUPLICATE_BOOKING_ID', `Booking id "${booking.id}" already exists`);
  }
  return error;
}

export function createPgStore(pool: Pool): Store {
  return {
    owner: {
      async get(): Promise<OwnerRecord | null> {
        // Строка единственна по конструкции схемы (I1) — выбирать по ключу нечего.
        const { rows } = await pool.query<OwnerRow>(
          `SELECT display_name, time_zone, availability_rules, slot_interval_minutes,
                  onboarding_completed
             FROM owner`,
        );
        return rows.length === 0 ? null : toOwner(rows[0]);
      },

      async save(record: OwnerRecord): Promise<void> {
        // Upsert по ключу-константе: onboarding пишет первую строку, изменение настроек — ту же
        // самую. Перечислены все колонки: VO настроек замещается целиком, частичного обновления
        // у него нет.
        await pool.query(
          `INSERT INTO owner (id, display_name, time_zone, availability_rules,
                              slot_interval_minutes, onboarding_completed)
                VALUES (true, $1, $2, $3, $4, $5)
           ON CONFLICT (id) DO UPDATE
                   SET display_name = EXCLUDED.display_name,
                       time_zone = EXCLUDED.time_zone,
                       availability_rules = EXCLUDED.availability_rules,
                       slot_interval_minutes = EXCLUDED.slot_interval_minutes,
                       onboarding_completed = EXCLUDED.onboarding_completed`,
          [
            record.displayName,
            record.settings.timeZone,
            // JSON руками: массив драйвер иначе отправил бы литералом массива PostgreSQL,
            // а не значением jsonb.
            JSON.stringify(record.settings.availabilityRules),
            record.settings.slotIntervalMinutes,
            record.onboardingCompleted,
          ],
        );
      },
    },

    eventTypes: {
      async list(): Promise<EventType[]> {
        // Порядок контрактом не задан, но без ORDER BY он зависит от физического
        // расположения строк — сортировка по ключу делает выдачу воспроизводимой.
        const { rows } = await pool.query<EventTypeRow>(
          `SELECT ${EVENT_TYPE_COLUMNS} FROM event_types ORDER BY id`,
        );
        return rows.map(toEventType);
      },

      async findById(id: string): Promise<EventType | null> {
        const { rows } = await pool.query<EventTypeRow>(
          `SELECT ${EVENT_TYPE_COLUMNS} FROM event_types WHERE id = $1`,
          [id],
        );
        return rows.length === 0 ? null : toEventType(rows[0]);
      },

      async create(eventType: EventType): Promise<void> {
        try {
          await pool.query(
            `INSERT INTO event_types (id, name, description, duration_minutes)
                  VALUES ($1, $2, $3, $4)`,
            [eventType.id, eventType.name, eventType.description ?? null, eventType.durationMinutes],
          );
        } catch (error) {
          if (isPgFailure(error) && error.code === UNIQUE_VIOLATION) {
            throw new DomainError(
              'DUPLICATE_EVENT_TYPE_ID',
              `Event type "${eventType.id}" already exists`,
            );
          }
          throw error;
        }
      },
    },

    bookings: {
      async findById(id: string): Promise<Booking | null> {
        const { rows } = await pool.query<BookingRow>(
          `SELECT ${BOOKING_COLUMNS} FROM bookings WHERE id = $1`,
          [id],
        );
        return rows.length === 0 ? null : toBooking(rows[0]);
      },

      async listNotEndedBefore(instant: Date): Promise<Booking[]> {
        const { rows } = await pool.query<BookingRow>(
          `SELECT ${BOOKING_COLUMNS} FROM bookings WHERE end_at_utc > $1 ORDER BY start_at_utc`,
          [instant],
        );
        return rows.map(toBooking);
      },

      async listBusyIntervals(fromUtc: Date, toUtc: Date): Promise<TimeInterval[]> {
        // Тот же tstzrange, что в exclusion constraint: критерий занятости и критерий запрета
        // обязаны совпадать, иначе клиенту показывался бы слот, который база не примет.
        // Фильтра по event_type_id нет — занятость владельца глобальна (Р7).
        const { rows } = await pool.query<IntervalRow>(
          `SELECT start_at_utc, end_at_utc
             FROM bookings
            WHERE tstzrange(start_at_utc, end_at_utc) && tstzrange($1, $2)
            ORDER BY start_at_utc`,
          [fromUtc, toUtc],
        );
        return rows.map((row) => ({ startAtUtc: row.start_at_utc, endAtUtc: row.end_at_utc }));
      },

      async create(booking: Booking): Promise<void> {
        // Одиночный INSERT без предварительного SELECT: проверка занятости отдельным запросом
        // оставила бы окно между ответом и записью, и защита от гонки была бы мнимой (запрет
        // зоны). Неделимость даёт СУБД, а этот метод только читает её вердикт.
        try {
          await pool.query(
            `INSERT INTO bookings (id, event_type_id, event_type_name, start_at_utc, end_at_utc,
                                   guest_name, guest_email, guest_note, created_at_utc)
                  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [
              booking.id,
              booking.eventTypeId,
              booking.eventTypeName,
              booking.startAtUtc,
              booking.endAtUtc,
              booking.guestName,
              booking.guestEmail,
              booking.guestNote ?? null,
              booking.createdAtUtc,
            ],
          );
        } catch (error) {
          throw bookingFailure(error, booking);
        }
      },
    },
  };
}
