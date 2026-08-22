/**
 * Helpers `@/features/slots/lib` из `components.registry.xml`.
 *
 * Доступность слотов и `endAtUtc` считает сервер: здесь только группировка уже полученного
 * набора по календарным датам гостя и сравнение наборов между загрузками (UX rules спеки 13).
 */

import type { SlotView } from '@/features/guest/model/types';
import { calendarDate, dayNumberLabel, weekdayShortLabel } from '@/shared/datetime';

/**
 * View-model `AvailableDate` спеки 13: календарная дата и её подписи для чипа.
 * В контракте такой сущности нет — она целиком выводится из `Slot[]` на клиенте.
 */
export interface AvailableDate {
  date: string;
  weekdayLabel: string;
  dayLabel: string;
}

/**
 * Календарные даты (в timezone гостя), у которых есть хотя бы один слот, по возрастанию.
 * Даты без слотов в результат не попадают: пропуск в ряду чисел — это отсутствие свободного
 * времени, а не отключённый чип.
 */
export function availableDates(slots: readonly SlotView[], timeZone: string): AvailableDate[] {
  const dates = new Set<string>();
  for (const slot of slots) {
    dates.add(calendarDate(slot.startAtUtc, timeZone));
  }

  return [...dates].sort().map((date) => ({
    date,
    weekdayLabel: weekdayShortLabel(date),
    dayLabel: dayNumberLabel(date),
  }));
}

/** Слоты календарной даты `date` в timezone гостя, хронологически по `startAtUtc`. */
export function slotsOnDate(
  slots: readonly SlotView[],
  date: string,
  timeZone: string,
): SlotView[] {
  return slots
    .filter((slot) => calendarDate(slot.startAtUtc, timeZone) === date)
    .sort((left, right) => (left.startAtUtc < right.startAtUtc ? -1 : 1));
}

/**
 * `true`, если ранее выбранного слота больше нет в перезагруженном наборе (слот заняли).
 * Слот опознаётся по моменту начала — тем же признаком, каким сетка помечает выбранный элемент.
 */
export function selectedSlotMissing(
  slots: readonly SlotView[],
  selected: SlotView | null,
): boolean {
  if (selected === null) {
    return false;
  }
  return !slots.some((slot) => slot.startAtUtc === selected.startAtUtc);
}
