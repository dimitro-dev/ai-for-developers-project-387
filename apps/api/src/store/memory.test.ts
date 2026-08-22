import assert from 'node:assert/strict';
import { test } from 'node:test';

import { DomainError } from '../domain/errors.ts';
import type { Booking, OwnerRecord } from '../domain/model.ts';
import { createMemoryStore } from './memory.ts';

function booking(overrides: Partial<Booking> & Pick<Booking, 'id' | 'startAtUtc' | 'endAtUtc'>): Booking {
  return {
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
      timeZone: 'UTC',
      availabilityRules: [{ daysOfWeek: ['Monday'], startLocal: '09:00', endLocal: '17:00' }],
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

test('bookings.create (I2): пересечение с бронированием другого EventType отклонено внутри create', async () => {
  const store = createMemoryStore();
  await store.bookings.create(
    booking({
      id: 'a',
      startAtUtc: new Date('2026-03-02T10:00:00.000Z'),
      endAtUtc: new Date('2026-03-02T11:00:00.000Z'),
    }),
  );

  await expectDomainError('SLOT_UNAVAILABLE', () =>
    store.bookings.create(
      booking({
        id: 'b',
        eventTypeId: 'other',
        eventTypeName: 'Other',
        startAtUtc: new Date('2026-03-02T10:30:00.000Z'),
        endAtUtc: new Date('2026-03-02T11:30:00.000Z'),
      }),
    ),
  );
  assert.equal((await store.bookings.listNotEndedBefore(new Date(0))).length, 1);
});

test('bookings.create (I3): соседний интервал принят', async () => {
  const store = createMemoryStore();
  await store.bookings.create(
    booking({
      id: 'a',
      startAtUtc: new Date('2026-03-02T10:00:00.000Z'),
      endAtUtc: new Date('2026-03-02T11:00:00.000Z'),
    }),
  );
  await store.bookings.create(
    booking({
      id: 'b',
      startAtUtc: new Date('2026-03-02T11:00:00.000Z'),
      endAtUtc: new Date('2026-03-02T11:30:00.000Z'),
    }),
  );

  assert.equal((await store.bookings.listNotEndedBefore(new Date(0))).length, 2);
});

test('bookings.create: повторный id отклонён как DUPLICATE_BOOKING_ID', async () => {
  const store = createMemoryStore();
  const first = booking({
    id: 'same',
    startAtUtc: new Date('2026-03-02T10:00:00.000Z'),
    endAtUtc: new Date('2026-03-02T11:00:00.000Z'),
  });
  await store.bookings.create(first);

  await expectDomainError('DUPLICATE_BOOKING_ID', () => store.bookings.create(first));
});

test('bookings.listNotEndedBefore: критерий endAtUtc > instant', async () => {
  const store = createMemoryStore();
  await store.bookings.create(
    booking({
      id: 'past',
      startAtUtc: new Date('2026-03-02T08:00:00.000Z'),
      endAtUtc: new Date('2026-03-02T09:00:00.000Z'),
    }),
  );
  await store.bookings.create(
    booking({
      id: 'running',
      startAtUtc: new Date('2026-03-02T09:30:00.000Z'),
      endAtUtc: new Date('2026-03-02T10:30:00.000Z'),
    }),
  );

  const upcoming = await store.bookings.listNotEndedBefore(new Date('2026-03-02T10:00:00.000Z'));
  assert.deepEqual(
    upcoming.map((item) => item.id),
    ['running'],
  );
});

test('bookings.listBusyIntervals: отдаёт только пересекающие окно интервалы, без ссылки на EventType', async () => {
  const store = createMemoryStore();
  await store.bookings.create(
    booking({
      id: 'inside',
      startAtUtc: new Date('2026-03-02T10:00:00.000Z'),
      endAtUtc: new Date('2026-03-02T11:00:00.000Z'),
    }),
  );
  await store.bookings.create(
    booking({
      id: 'outside',
      startAtUtc: new Date('2026-03-05T10:00:00.000Z'),
      endAtUtc: new Date('2026-03-05T11:00:00.000Z'),
    }),
  );

  const busy = await store.bookings.listBusyIntervals(
    new Date('2026-03-02T00:00:00.000Z'),
    new Date('2026-03-03T00:00:00.000Z'),
  );
  assert.equal(busy.length, 1);
  assert.equal(busy[0].startAtUtc.toISOString(), '2026-03-02T10:00:00.000Z');
  assert.deepEqual(Object.keys(busy[0]).sort(), ['endAtUtc', 'startAtUtc']);
});

test('eventTypes.create (I11): повторный id отклонён как DUPLICATE_EVENT_TYPE_ID', async () => {
  const store = createMemoryStore();
  await store.eventTypes.create({ id: 'intro', name: 'Intro call', durationMinutes: 30 });

  await expectDomainError('DUPLICATE_EVENT_TYPE_ID', () =>
    store.eventTypes.create({ id: 'intro', name: 'Другое имя', durationMinutes: 60 }),
  );
  const stored = await store.eventTypes.findById('intro');
  assert.equal(stored?.name, 'Intro call');
});

test('mutation-safety: изменение возвращённой записи не портит хранилище', async () => {
  const store = createMemoryStore();
  await store.owner.save(ownerRecord());
  await store.eventTypes.create({ id: 'intro', name: 'Intro call', durationMinutes: 30 });
  await store.bookings.create(
    booking({
      id: 'a',
      startAtUtc: new Date('2026-03-02T10:00:00.000Z'),
      endAtUtc: new Date('2026-03-02T11:00:00.000Z'),
    }),
  );

  const owner = await store.owner.get();
  assert.ok(owner !== null);
  owner.displayName = 'Взломан';
  owner.settings.slotIntervalMinutes = 15;
  owner.settings.availabilityRules[0].startLocal = '00:00';
  owner.settings.availabilityRules[0].daysOfWeek.push('Sunday');

  const eventType = await store.eventTypes.findById('intro');
  assert.ok(eventType !== null);
  eventType.name = 'Взломан';

  const stored = await store.bookings.findById('a');
  assert.ok(stored !== null);
  stored.guestName = 'Взломан';
  stored.startAtUtc.setUTCFullYear(2000);

  const freshOwner = await store.owner.get();
  assert.equal(freshOwner?.displayName, 'Owner');
  assert.equal(freshOwner?.settings.slotIntervalMinutes, 30);
  assert.equal(freshOwner?.settings.availabilityRules[0].startLocal, '09:00');
  assert.deepEqual(freshOwner?.settings.availabilityRules[0].daysOfWeek, ['Monday']);
  assert.equal((await store.eventTypes.findById('intro'))?.name, 'Intro call');
  const freshBooking = await store.bookings.findById('a');
  assert.equal(freshBooking?.guestName, 'Guest');
  assert.equal(freshBooking?.startAtUtc.toISOString(), '2026-03-02T10:00:00.000Z');
});

test('mutation-safety: изменение переданной на запись структуры не портит хранилище', async () => {
  const store = createMemoryStore();
  const record = ownerRecord();
  await store.owner.save(record);
  record.settings.availabilityRules[0].endLocal = '23:00';

  assert.equal((await store.owner.get())?.settings.availabilityRules[0].endLocal, '17:00');
});

test('Booking.eventTypeName (I15) — snapshot записи, а не join с текущим EventType', async () => {
  // Переименование EventType через HTTP невозможно: контракт не описывает операцию
  // обновления типа встречи. Snapshot-семантика проверяется на уровне хранилища:
  // сохранённое имя не совпадает с именем существующего EventType и остаётся своим.
  const store = createMemoryStore();
  await store.eventTypes.create({ id: 'intro', name: 'Новое имя', durationMinutes: 30 });
  await store.bookings.create(
    booking({
      id: 'a',
      eventTypeId: 'intro',
      eventTypeName: 'Имя на момент брони',
      startAtUtc: new Date('2026-03-02T10:00:00.000Z'),
      endAtUtc: new Date('2026-03-02T10:30:00.000Z'),
    }),
  );

  const [stored] = await store.bookings.listNotEndedBefore(new Date('2026-03-02T00:00:00.000Z'));
  assert.equal(stored.eventTypeName, 'Имя на момент брони');
  assert.equal((await store.eventTypes.findById('intro'))?.name, 'Новое имя');
});
