// Чистый slot engine (Р5): считает сетку и пересечения, ничего не знает о
// репозиториях, DomainError и transport. Кандидаты и занятость намеренно разделены —
// иначе занятый слот при POST /bookings получил бы SLOT_NOT_ALIGNED вместо
// SLOT_UNAVAILABLE.

import type { AvailabilityRule, DayOfWeek, LocalDate, TimeInterval } from './model.ts';
import { instantOfLocal, localPartsOf } from './timezone.ts';

const WINDOW_DAYS = 14;
const MS_PER_MINUTE = 60_000;
const MS_PER_DAY = 86_400_000;

/** Индекс — результат `Date.prototype.getUTCDay()`. */
const DAY_NAMES: DayOfWeek[] = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

export interface SlotGridInput {
  timeZone: string;
  availabilityRules: AvailabilityRule[];
  slotIntervalMinutes: number;
  durationMinutes: number;
  nowUtc: Date;
}

/**
 * Окно записи (I6): ровно 14 локальных дат владельца `[today, today+13]`.
 * Арифметика — чистая календарная над тройкой Y-M-D через `Date.UTC`, зона участвует
 * только в вычислении `today`.
 */
export function bookingWindowDates(timeZone: string, nowUtc: Date): LocalDate[] {
  const today = localPartsOf(nowUtc, timeZone);
  const base = Date.UTC(today.year, today.month - 1, today.day);
  const dates: LocalDate[] = [];
  for (let offset = 0; offset < WINDOW_DAYS; offset += 1) {
    const date = new Date(base + offset * MS_PER_DAY);
    dates.push({
      year: date.getUTCFullYear(),
      month: date.getUTCMonth() + 1,
      day: date.getUTCDate(),
    });
  }
  return dates;
}

export function includesLocalDate(dates: readonly LocalDate[], date: LocalDate): boolean {
  return dates.some(
    (candidate) =>
      candidate.year === date.year && candidate.month === date.month && candidate.day === date.day,
  );
}

function dayOfWeekOf(date: LocalDate): DayOfWeek {
  return DAY_NAMES[new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay()];
}

function minutesOfLocalTime(localTime: string): number {
  const [hours, minutes] = localTime.split(':');
  return Number(hours) * 60 + Number(minutes);
}

/**
 * Сетка слотов окна для одной длительности (I3, I6, I7, I8, I9). Занятость здесь не
 * учитывается — это работа `isBusy`.
 *
 * Начало слота кратно `slotIntervalMinutes` относительно начала рабочего интервала
 * (`docs/domain-model.md` §6, правило 2); слот целиком лежит внутри
 * `[startLocal, endLocal)`; несуществующее локальное время весеннего перехода слота не
 * даёт; `endAtUtc` — абсолютный сдвиг на `durationMinutes` (I4).
 */
export function candidateSlots(input: SlotGridInput): TimeInterval[] {
  const { timeZone, availabilityRules, slotIntervalMinutes, durationMinutes, nowUtc } = input;
  const nowMs = nowUtc.getTime();
  // Ключ — epoch начала: пересекающиеся правила одного дня не дают дубля слота.
  const byStart = new Map<number, TimeInterval>();

  for (const date of bookingWindowDates(timeZone, nowUtc)) {
    const dayOfWeek = dayOfWeekOf(date);
    for (const rule of availabilityRules) {
      if (!rule.daysOfWeek.includes(dayOfWeek)) continue;

      const endMinute = minutesOfLocalTime(rule.endLocal);
      for (
        let minute = minutesOfLocalTime(rule.startLocal);
        minute + durationMinutes <= endMinute;
        minute += slotIntervalMinutes
      ) {
        const startAtUtc = instantOfLocal(
          { ...date, hour: Math.floor(minute / 60), minute: minute % 60 },
          timeZone,
        );
        if (startAtUtc === null) continue;
        if (startAtUtc.getTime() < nowMs) continue;

        byStart.set(startAtUtc.getTime(), {
          startAtUtc,
          endAtUtc: new Date(startAtUtc.getTime() + durationMinutes * MS_PER_MINUTE),
        });
      }
    }
  }

  return [...byStart.values()].sort((a, b) => a.startAtUtc.getTime() - b.startAtUtc.getTime());
}

/**
 * Пересечение интервалов (I2, I3): сравнения строгие, поэтому соседние
 * `10:00–11:00` и `11:00–11:30` пересечением не считаются.
 */
export function overlaps(a: TimeInterval, b: TimeInterval): boolean {
  return (
    a.startAtUtc.getTime() < b.endAtUtc.getTime() && b.startAtUtc.getTime() < a.endAtUtc.getTime()
  );
}

export function isBusy(slot: TimeInterval, busy: readonly TimeInterval[]): boolean {
  return busy.some((interval) => overlaps(slot, interval));
}
