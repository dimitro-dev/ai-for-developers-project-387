// Контракт `Store` на настоящей PostgreSQL (Р8). Сценарии зеркалят `memory.test.ts`: у двух
// реализаций одного интерфейса обязано совпадать поведение, а не только сигнатуры. Проверки
// копирования записей заменены проверками свежести чтения — у PG каждая строка и так новый
// объект, зато появляется то, чего в памяти нет: маппинг колонок и отказы констрейнтов в гонке.

import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, beforeEach, describe, test } from 'node:test';

import { runMigrations } from '@minical/database';
import pg from 'pg';
import type { Pool as PgPool } from 'pg';

import { DomainError } from '../domain/errors.ts';
import type { Booking, OwnerRecord } from '../domain/model.ts';
import { createPgStore } from './postgres.ts';
import type { Store } from './repositories.ts';

const { Pool } = pg;

// Без адреса тестовой базы набор пропускается с причиной, а не падает: `make gates` из чистого
// чекаута без Docker остаётся зелёным, обязательный прогон обеспечивают `make db-test` и CI (Р8).
const connectionString = process.env.TEST_DATABASE_URL;
const skip = connectionString
  ? false
  : 'TEST_DATABASE_URL не задана: поднимите контур (make db-up) и запускайте через make db-test';

const at = (time: string): Date => new Date(`2026-03-02T${time}:00.000Z`);

// id брони — uuid по схеме, поэтому по умолчанию генерируется, а не берётся коротким литералом,
// как в наборе in-memory.
function booking(overrides: Partial<Booking> & Pick<Booking, 'startAtUtc' | 'endAtUtc'>): Booking {
  return {
    id: randomUUID(),
    eventTypeId: 'intro',
    eventTypeName: 'Intro call',
    guestName: 'Guest',
    guestEmail: 'guest@example.com',
    createdAtUtc: new Date('2026-03-01T00:00:00.000Z'),
    ...overrides,
  };
}

function ownerRecord(): OwnerRecord {
  return {
    displayName: 'Owner',
    onboardingCompleted: true,
    settings: {
      timeZone: 'Europe/Moscow',
      availabilityRules: [
        { daysOfWeek: ['Monday', 'Wednesday'], startLocal: '09:00', endLocal: '17:00' },
        { daysOfWeek: ['Saturday'], startLocal: '10:00', endLocal: '12:00' },
      ],
      slotIntervalMinutes: 30,
    },
  };
}

async function expectDomainError(code: string, action: () => Promise<unknown>): Promise<void> {
  await assert.rejects(action, (error: unknown) => {
    assert.ok(error instanceof DomainError, `expected DomainError, got ${String(error)}`);
    assert.equal(error.code, code);
    return true;
  });
}

describe('контракт Store на реальной PostgreSQL', { skip }, () => {
  let pool: PgPool;
  let store: Store;

  before(async () => {
    pool = new Pool({ connectionString });
    // Чистка до миграций, а не после: упавший прогон не должен уносить с собой возможность
    // запустить следующий.
    await pool.query('DROP TABLE IF EXISTS bookings, event_types, owner, schema_migrations CASCADE');
    await runMigrations(pool);
    store = createPgStore(pool);
  });

  beforeEach(async () => {
    await pool.query('TRUNCATE bookings, event_types, owner');
    // Брони ссылаются на тип встречи внешним ключом, поэтому базовый тип есть в каждом тесте.
    await store.eventTypes.create({ id: 'intro', name: 'Intro call', durationMinutes: 30 });
  });

  after(async () => {
    await pool.end();
  });

  test('bookings.create (I2): пересечение с бронированием другого EventType отклонено', async () => {
    await store.eventTypes.create({ id: 'other', name: 'Other', durationMinutes: 60 });
    await store.bookings.create(booking({ startAtUtc: at('10:00'), endAtUtc: at('11:00') }));

    await expectDomainError('SLOT_UNAVAILABLE', () =>
      store.bookings.create(
        booking({
          eventTypeId: 'other',
          eventTypeName: 'Other',
          startAtUtc: at('10:30'),
          endAtUtc: at('11:30'),
        }),
      ),
    );
    assert.equal((await store.bookings.listNotEndedBefore(new Date(0))).length, 1);
  });

  test('bookings.create (I3): соседний интервал принят', async () => {
    await store.bookings.create(booking({ startAtUtc: at('10:00'), endAtUtc: at('11:00') }));
    await store.bookings.create(booking({ startAtUtc: at('11:00'), endAtUtc: at('11:30') }));

    assert.equal((await store.bookings.listNotEndedBefore(new Date(0))).length, 2);
  });

  test('bookings.create: повторный id отклонён как DUPLICATE_BOOKING_ID', async () => {
    const first = booking({ startAtUtc: at('10:00'), endAtUtc: at('11:00') });
    await store.bookings.create(first);

    // Интервал у второй попытки другой: сработать обязан именно дубль ключа, а не запрет
    // пересечений — иначе тест не отличил бы один констрейнт от другого.
    await expectDomainError('DUPLICATE_BOOKING_ID', () =>
      store.bookings.create({ ...first, startAtUtc: at('14:00'), endAtUtc: at('14:30') }),
    );
  });

  test('bookings.create: гонку двух пересекающихся броней разрешает СУБД, а не порядок вызовов', async () => {
    // Оба запроса уходят до того, как любой из них завершится: проверить занятость заранее
    // здесь было бы нечем, и отказ приходит только из exclusion constraint.
    const results = await Promise.allSettled([
      store.bookings.create(booking({ startAtUtc: at('10:00'), endAtUtc: at('11:00') })),
      store.bookings.create(booking({ startAtUtc: at('10:30'), endAtUtc: at('11:30') })),
    ]);

    const rejected = results.filter((result) => result.status === 'rejected');
    assert.equal(rejected.length, 1, `ожидался ровно один отказ, получено ${rejected.length}`);
    const error = rejected[0].reason as unknown;
    assert.ok(error instanceof DomainError, `expected DomainError, got ${String(error)}`);
    assert.equal(error.code, 'SLOT_UNAVAILABLE');
    assert.equal((await store.bookings.listNotEndedBefore(new Date(0))).length, 1);
  });

  test('bookings.listNotEndedBefore: критерий endAtUtc > instant, порядок по началу', async () => {
    await store.bookings.create(booking({ startAtUtc: at('08:00'), endAtUtc: at('09:00') }));
    const running = booking({ startAtUtc: at('09:30'), endAtUtc: at('10:30') });
    const later = booking({ startAtUtc: at('12:00'), endAtUtc: at('12:30') });
    // Записаны в обратном порядке: сортировку обязан давать запрос, а не порядок вставки.
    await store.bookings.create(later);
    await store.bookings.create(running);

    const upcoming = await store.bookings.listNotEndedBefore(at('10:00'));
    assert.deepEqual(
      upcoming.map((item) => item.id),
      [running.id, later.id],
    );
  });

  test('bookings.listBusyIntervals: только пересечения окна, без ссылки на EventType', async () => {
    await store.bookings.create(booking({ startAtUtc: at('10:00'), endAtUtc: at('11:00') }));
    await store.bookings.create(
      booking({
        startAtUtc: new Date('2026-03-05T10:00:00.000Z'),
        endAtUtc: new Date('2026-03-05T11:00:00.000Z'),
      }),
    );

    const busy = await store.bookings.listBusyIntervals(at('00:00'), new Date('2026-03-03T00:00:00.000Z'));
    assert.equal(busy.length, 1);
    assert.equal(busy[0].startAtUtc.toISOString(), '2026-03-02T10:00:00.000Z');
    assert.deepEqual(Object.keys(busy[0]).sort(), ['endAtUtc', 'startAtUtc']);
  });

  test('bookings.listBusyIntervals (I3): встык идущая бронь в окно не попадает', async () => {
    await store.bookings.create(booking({ startAtUtc: at('11:00'), endAtUtc: at('12:00') }));

    // Окно кончается ровно там, где бронь начинается: оба интервала полуоткрытые,
    // общих точек у них нет.
    assert.deepEqual(await store.bookings.listBusyIntervals(at('10:00'), at('11:00')), []);
    assert.equal((await store.bookings.listBusyIntervals(at('10:00'), at('11:01'))).length, 1);
  });

  test('bookings: неизвестный id — null, поля брони переживают round-trip', async () => {
    assert.equal(await store.bookings.findById(randomUUID()), null);

    const created = booking({
      startAtUtc: at('10:00'),
      endAtUtc: at('10:30'),
      guestName: 'Гость',
      guestEmail: 'guest@example.com',
      guestNote: 'Позвоните заранее',
    });
    await store.bookings.create(created);

    assert.deepEqual(await store.bookings.findById(created.id), created);
  });

  test('bookings: отсутствующая заметка гостя читается как undefined, а не null', async () => {
    const created = booking({ startAtUtc: at('10:00'), endAtUtc: at('10:30') });
    await store.bookings.create(created);

    const stored = await store.bookings.findById(created.id);
    assert.equal(stored?.guestNote, undefined);
  });

  test('eventTypes.create (I11): повторный id отклонён как DUPLICATE_EVENT_TYPE_ID', async () => {
    await expectDomainError('DUPLICATE_EVENT_TYPE_ID', () =>
      store.eventTypes.create({ id: 'intro', name: 'Другое имя', durationMinutes: 60 }),
    );

    const stored = await store.eventTypes.findById('intro');
    assert.equal(stored?.name, 'Intro call');
    assert.equal(stored?.durationMinutes, 30);
  });

  test('eventTypes: список отсортирован по id, описание переживает round-trip', async () => {
    await store.eventTypes.create({
      id: 'audit',
      name: 'Аудит',
      description: 'Разбор кодовой базы',
      durationMinutes: 60,
    });

    assert.deepEqual(await store.eventTypes.list(), [
      { id: 'audit', name: 'Аудит', description: 'Разбор кодовой базы', durationMinutes: 60 },
      { id: 'intro', name: 'Intro call', description: undefined, durationMinutes: 30 },
    ]);
    assert.equal(await store.eventTypes.findById('missing'), null);
  });

  test('owner: пустая база отдаёт null, save → get возвращает те же настройки', async () => {
    assert.equal(await store.owner.get(), null);

    const record = ownerRecord();
    await store.owner.save(record);

    assert.deepEqual(await store.owner.get(), record);
  });

  test('owner.save: повторное сохранение замещает настройки целиком, строка остаётся одна (I1)', async () => {
    await store.owner.save(ownerRecord());
    await store.owner.save({
      displayName: 'Новое имя',
      onboardingCompleted: true,
      settings: {
        timeZone: 'UTC',
        availabilityRules: [{ daysOfWeek: ['Friday'], startLocal: '08:00', endLocal: '09:00' }],
        slotIntervalMinutes: 15,
      },
    });

    const stored = await store.owner.get();
    assert.equal(stored?.displayName, 'Новое имя');
    assert.equal(stored?.settings.timeZone, 'UTC');
    assert.equal(stored?.settings.slotIntervalMinutes, 15);
    assert.deepEqual(stored?.settings.availabilityRules, [
      { daysOfWeek: ['Friday'], startLocal: '08:00', endLocal: '09:00' },
    ]);

    const { rows } = await pool.query<{ count: number }>('SELECT count(*)::int AS count FROM owner');
    assert.equal(rows[0].count, 1);
  });

  test('чтение всегда свежее: правка возвращённой записи не доезжает до базы', async () => {
    await store.owner.save(ownerRecord());
    const created = booking({ startAtUtc: at('10:00'), endAtUtc: at('11:00') });
    await store.bookings.create(created);

    const owner = await store.owner.get();
    assert.ok(owner !== null);
    owner.displayName = 'Взломан';
    owner.settings.availabilityRules[0].startLocal = '00:00';

    const stored = await store.bookings.findById(created.id);
    assert.ok(stored !== null);
    stored.guestName = 'Взломан';
    stored.startAtUtc.setUTCFullYear(2000);

    const freshOwner = await store.owner.get();
    assert.equal(freshOwner?.displayName, 'Owner');
    assert.equal(freshOwner?.settings.availabilityRules[0].startLocal, '09:00');
    const freshBooking = await store.bookings.findById(created.id);
    assert.equal(freshBooking?.guestName, 'Guest');
    assert.equal(freshBooking?.startAtUtc.toISOString(), '2026-03-02T10:00:00.000Z');
  });

  test('Booking.eventTypeName (I15) — snapshot записи, а не join с текущим EventType', async () => {
    const created = booking({
      eventTypeName: 'Имя на момент брони',
      startAtUtc: at('10:00'),
      endAtUtc: at('10:30'),
    });
    await store.bookings.create(created);

    const [stored] = await store.bookings.listNotEndedBefore(at('00:00'));
    assert.equal(stored.eventTypeName, 'Имя на момент брони');
    assert.equal((await store.eventTypes.findById('intro'))?.name, 'Intro call');
  });
});
