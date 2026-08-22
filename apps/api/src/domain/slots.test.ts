import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { AvailabilityRule, DayOfWeek } from './model.ts';
import {
  bookingWindowDates,
  candidateSlots,
  includesLocalDate,
  isBusy,
  overlaps,
} from './slots.ts';
import { instantOfLocal, isValidTimeZone, localPartsOf } from './timezone.ts';

const EVERY_DAY: DayOfWeek[] = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

function rule(startLocal: string, endLocal: string): AvailabilityRule {
  return { daysOfWeek: EVERY_DAY, startLocal, endLocal };
}

function interval(startIso: string, endIso: string) {
  return { startAtUtc: new Date(startIso), endAtUtc: new Date(endIso) };
}

// --- domain/timezone.ts (Р6) ---------------------------------------------------

test('instantOfLocal: зимнее и летнее смещение America/New_York', () => {
  assert.equal(
    instantOfLocal({ year: 2026, month: 1, day: 15, hour: 9, minute: 0 }, 'America/New_York')?.toISOString(),
    '2026-01-15T14:00:00.000Z',
  );
  assert.equal(
    instantOfLocal({ year: 2026, month: 7, day: 15, hour: 9, minute: 0 }, 'America/New_York')?.toISOString(),
    '2026-07-15T13:00:00.000Z',
  );
});

test('instantOfLocal: смещение не в целых часах (Asia/Kathmandu, +05:45)', () => {
  assert.equal(
    instantOfLocal({ year: 2026, month: 7, day: 15, hour: 9, minute: 0 }, 'Asia/Kathmandu')?.toISOString(),
    '2026-07-15T03:15:00.000Z',
  );
});

test('instantOfLocal: несуществующее локальное время весеннего перехода → null', () => {
  assert.equal(
    instantOfLocal({ year: 2026, month: 3, day: 8, hour: 2, minute: 30 }, 'America/New_York'),
    null,
  );
});

test('instantOfLocal: неоднозначное локальное время осеннего перехода → раннее смещение', () => {
  assert.equal(
    instantOfLocal({ year: 2026, month: 11, day: 1, hour: 1, minute: 30 }, 'America/New_York')?.toISOString(),
    '2026-11-01T05:30:00.000Z',
  );
});

test('localPartsOf: instant → локальные части владельца', () => {
  assert.deepEqual(localPartsOf(new Date('2026-01-15T14:00:00.000Z'), 'America/New_York'), {
    year: 2026,
    month: 1,
    day: 15,
    hour: 9,
    minute: 0,
  });
  assert.deepEqual(localPartsOf(new Date('2026-01-15T23:30:00.000Z'), 'Asia/Kathmandu'), {
    year: 2026,
    month: 1,
    day: 16,
    hour: 5,
    minute: 15,
  });
});

test('isValidTimeZone (V4): структурно верная, но несуществующая зона отвергается', () => {
  assert.equal(isValidTimeZone('Europe/Moscow'), true);
  assert.equal(isValidTimeZone('UTC'), true);
  assert.equal(isValidTimeZone('Foo/Bar'), false);
  assert.equal(isValidTimeZone('nonsense'), false);
});

// --- окно записи (I6) ---------------------------------------------------------

test('bookingWindowDates: ровно 14 локальных дат [today, today+13] с переходом через месяц', () => {
  const dates = bookingWindowDates('UTC', new Date('2026-03-01T10:00:00.000Z'));
  assert.equal(dates.length, 14);
  assert.deepEqual(dates[0], { year: 2026, month: 3, day: 1 });
  assert.deepEqual(dates[13], { year: 2026, month: 3, day: 14 });

  const acrossMonth = bookingWindowDates('UTC', new Date('2026-02-25T00:00:00.000Z'));
  assert.deepEqual(acrossMonth[0], { year: 2026, month: 2, day: 25 });
  assert.deepEqual(acrossMonth[3], { year: 2026, month: 2, day: 28 });
  assert.deepEqual(acrossMonth[4], { year: 2026, month: 3, day: 1 });
  assert.deepEqual(acrossMonth[13], { year: 2026, month: 3, day: 10 });
});

test('bookingWindowDates: today берётся в зоне владельца, а не в UTC', () => {
  const dates = bookingWindowDates('America/New_York', new Date('2026-03-02T02:00:00.000Z'));
  assert.deepEqual(dates[0], { year: 2026, month: 3, day: 1 });
  assert.equal(includesLocalDate(dates, { year: 2026, month: 3, day: 14 }), true);
  assert.equal(includesLocalDate(dates, { year: 2026, month: 3, day: 15 }), false);
});

// --- сетка слотов (I3, I7, I8, I9) -------------------------------------------

test('candidateSlots: сетка кратна slotIntervalMinutes и слот целиком внутри рабочего интервала', () => {
  const slots = candidateSlots({
    timeZone: 'UTC',
    availabilityRules: [rule('09:00', '12:00')],
    slotIntervalMinutes: 30,
    durationMinutes: 30,
    nowUtc: new Date('2026-03-02T00:00:00.000Z'),
  });

  assert.equal(slots.length, 14 * 6);
  const firstDay = slots.filter((slot) => localPartsOf(slot.startAtUtc, 'UTC').day === 2);
  assert.deepEqual(
    firstDay.map((slot) => slot.startAtUtc.toISOString()),
    [
      '2026-03-02T09:00:00.000Z',
      '2026-03-02T09:30:00.000Z',
      '2026-03-02T10:00:00.000Z',
      '2026-03-02T10:30:00.000Z',
      '2026-03-02T11:00:00.000Z',
      '2026-03-02T11:30:00.000Z',
    ],
  );

  for (const slot of slots) {
    const start = localPartsOf(slot.startAtUtc, 'UTC');
    const startMinutes = start.hour * 60 + start.minute;
    // I8: кратность относительно начала рабочего интервала (09:00) и, поскольку он
    // приходится на целый час, относительно полуночи тоже.
    assert.equal((startMinutes - 9 * 60) % 30, 0);
    assert.equal(startMinutes % 30, 0);
    // I7: слот целиком внутри [09:00, 12:00)
    assert.ok(startMinutes >= 9 * 60);
    const end = localPartsOf(slot.endAtUtc, 'UTC');
    assert.ok(end.hour * 60 + end.minute <= 12 * 60);
    // I4: длительность — абсолютный сдвиг
    assert.equal(slot.endAtUtc.getTime() - slot.startAtUtc.getTime(), 30 * 60_000);
  }
});

test('candidateSlots (I7): слот, не влезающий в рабочий интервал целиком, не выдаётся', () => {
  const slots = candidateSlots({
    timeZone: 'UTC',
    availabilityRules: [rule('09:00', '12:00')],
    slotIntervalMinutes: 30,
    durationMinutes: 45,
    nowUtc: new Date('2026-03-02T00:00:00.000Z'),
  });

  const firstDay = slots
    .filter((slot) => localPartsOf(slot.startAtUtc, 'UTC').day === 2)
    .map((slot) => slot.startAtUtc.toISOString());
  assert.deepEqual(firstDay, [
    '2026-03-02T09:00:00.000Z',
    '2026-03-02T09:30:00.000Z',
    '2026-03-02T10:00:00.000Z',
    '2026-03-02T10:30:00.000Z',
    '2026-03-02T11:00:00.000Z',
  ]);
});

test('candidateSlots (I9): слоты, начавшиеся в прошлом, исключаются', () => {
  const slots = candidateSlots({
    timeZone: 'UTC',
    availabilityRules: [rule('09:00', '12:00')],
    slotIntervalMinutes: 30,
    durationMinutes: 30,
    nowUtc: new Date('2026-03-02T10:15:00.000Z'),
  });

  assert.equal(slots[0].startAtUtc.toISOString(), '2026-03-02T10:30:00.000Z');
  for (const slot of slots) {
    assert.ok(slot.startAtUtc.getTime() >= new Date('2026-03-02T10:15:00.000Z').getTime());
  }
});

test('candidateSlots: несуществующие часы весеннего перехода не дают слотов (принятая политика DST)', () => {
  const slots = candidateSlots({
    timeZone: 'America/New_York',
    availabilityRules: [rule('00:00', '06:00')],
    slotIntervalMinutes: 30,
    durationMinutes: 30,
    nowUtc: new Date('2026-03-08T05:00:00.000Z'), // 2026-03-08 00:00 EST
  });

  const transitionDay = slots.filter((slot) => {
    const local = localPartsOf(slot.startAtUtc, 'America/New_York');
    return local.month === 3 && local.day === 8;
  });
  assert.equal(transitionDay.length, 10); // 12 позиций сетки минус два несуществующих часа
  for (const slot of transitionDay) {
    assert.notEqual(localPartsOf(slot.startAtUtc, 'America/New_York').hour, 2);
  }
});

test('candidateSlots: пересекающиеся правила одного дня не дают дублей', () => {
  const slots = candidateSlots({
    timeZone: 'UTC',
    availabilityRules: [rule('09:00', '11:00'), rule('10:00', '12:00')],
    slotIntervalMinutes: 60,
    durationMinutes: 60,
    nowUtc: new Date('2026-03-02T00:00:00.000Z'),
  });

  const starts = slots.map((slot) => slot.startAtUtc.toISOString());
  assert.equal(new Set(starts).size, starts.length);
  assert.deepEqual(starts.slice(0, 3), [
    '2026-03-02T09:00:00.000Z',
    '2026-03-02T10:00:00.000Z',
    '2026-03-02T11:00:00.000Z',
  ]);
});

// --- пересечение (I2, I3) -----------------------------------------------------

test('overlaps (I3): соседние интервалы не пересекаются, вложенные и частичные — пересекаются', () => {
  const base = interval('2026-03-02T10:00:00.000Z', '2026-03-02T11:00:00.000Z');

  assert.equal(overlaps(base, interval('2026-03-02T11:00:00.000Z', '2026-03-02T11:30:00.000Z')), false);
  assert.equal(overlaps(base, interval('2026-03-02T09:00:00.000Z', '2026-03-02T10:00:00.000Z')), false);
  assert.equal(overlaps(base, interval('2026-03-02T10:30:00.000Z', '2026-03-02T11:00:00.000Z')), true);
  assert.equal(overlaps(base, interval('2026-03-02T09:30:00.000Z', '2026-03-02T10:30:00.000Z')), true);
  assert.equal(overlaps(base, interval('2026-03-02T10:15:00.000Z', '2026-03-02T10:45:00.000Z')), true);
  assert.equal(overlaps(base, interval('2026-03-02T09:00:00.000Z', '2026-03-02T12:00:00.000Z')), true);
});

test('isBusy: занятость проверяется по всему списку интервалов', () => {
  const slot = interval('2026-03-02T10:00:00.000Z', '2026-03-02T10:30:00.000Z');
  assert.equal(
    isBusy(slot, [interval('2026-03-02T09:00:00.000Z', '2026-03-02T10:00:00.000Z')]),
    false,
  );
  assert.equal(
    isBusy(slot, [
      interval('2026-03-02T09:00:00.000Z', '2026-03-02T10:00:00.000Z'),
      interval('2026-03-02T10:15:00.000Z', '2026-03-02T11:15:00.000Z'),
    ]),
    true,
  );
  assert.equal(isBusy(slot, []), false);
});
