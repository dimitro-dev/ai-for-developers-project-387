// In-memory реализация репозиториев (Р4). Фабрика с замыканием, а не модуль-синглтон:
// каждый тест получает чистое хранилище без сброса глобального состояния.
// При переходе на PostgreSQL заменяется ровно этот файл плюс сборка deps в server.ts.

import { DomainError } from '../domain/errors.ts';
import type { AvailabilityRule, Booking, EventType, OwnerRecord, TimeInterval } from '../domain/model.ts';
import { overlaps } from '../domain/slots.ts';
import type { Store } from './repositories.ts';

// Копии на входе и на выходе: PG всегда отдаёт свежие объекты, а `Date` мутабелен —
// без копий мутация ответа портила бы хранилище, и ловушка не воспроизвелась бы
// после миграции.
function copyRules(rules: AvailabilityRule[]): AvailabilityRule[] {
  return rules.map((rule) => ({ ...rule, daysOfWeek: [...rule.daysOfWeek] }));
}

function copyOwner(owner: OwnerRecord): OwnerRecord {
  return {
    ...owner,
    settings: {
      ...owner.settings,
      availabilityRules: copyRules(owner.settings.availabilityRules),
    },
  };
}

function copyBooking(booking: Booking): Booking {
  return {
    ...booking,
    startAtUtc: new Date(booking.startAtUtc.getTime()),
    endAtUtc: new Date(booking.endAtUtc.getTime()),
    createdAtUtc: new Date(booking.createdAtUtc.getTime()),
  };
}

export function createMemoryStore(): Store {
  // Владелец — переменная, а не коллекция: I1 нарушить структурно невозможно.
  let owner: OwnerRecord | null = null;
  const eventTypes = new Map<string, EventType>();
  const bookings = new Map<string, Booking>();

  return {
    owner: {
      async get(): Promise<OwnerRecord | null> {
        return owner === null ? null : copyOwner(owner);
      },
      async save(record: OwnerRecord): Promise<void> {
        owner = copyOwner(record);
      },
    },

    eventTypes: {
      async list(): Promise<EventType[]> {
        return [...eventTypes.values()].map((eventType) => ({ ...eventType }));
      },
      async findById(id: string): Promise<EventType | null> {
        const found = eventTypes.get(id);
        return found === undefined ? null : { ...found };
      },
      async create(eventType: EventType): Promise<void> {
        if (eventTypes.has(eventType.id)) {
          throw new DomainError(
            'DUPLICATE_EVENT_TYPE_ID',
            `Event type "${eventType.id}" already exists`,
          );
        }
        eventTypes.set(eventType.id, { ...eventType });
      },
    },

    bookings: {
      async findById(id: string): Promise<Booking | null> {
        const found = bookings.get(id);
        return found === undefined ? null : copyBooking(found);
      },
      async listNotEndedBefore(instant: Date): Promise<Booking[]> {
        return [...bookings.values()]
          .filter((booking) => booking.endAtUtc.getTime() > instant.getTime())
          .map(copyBooking);
      },
      async listBusyIntervals(fromUtc: Date, toUtc: Date): Promise<TimeInterval[]> {
        const window: TimeInterval = { startAtUtc: fromUtc, endAtUtc: toUtc };
        return [...bookings.values()]
          .filter((booking) => overlaps(booking, window))
          .map((booking) => ({
            startAtUtc: new Date(booking.startAtUtc.getTime()),
            endAtUtc: new Date(booking.endAtUtc.getTime()),
          }));
      },
      async create(booking: Booking): Promise<void> {
        // Ни одного `await` ниже: тело исполняется целиком, поэтому «проверить и
        // вставить» неделимо для любого числа параллельных запросов в этом процессе.
        if (bookings.has(booking.id)) {
          throw new DomainError('DUPLICATE_BOOKING_ID', `Booking id "${booking.id}" already exists`);
        }
        for (const existing of bookings.values()) {
          if (overlaps(existing, booking)) {
            throw new DomainError(
              'SLOT_UNAVAILABLE',
              'Requested slot conflicts with an existing booking',
            );
          }
        }
        bookings.set(booking.id, copyBooking(booking));
      },
    },
  };
}
