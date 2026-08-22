/**
 * View-model гостевой ветки: то, что доходит до экранов и компонентов.
 * DTO контракта в UI не передаются (`docs/ui-spec-kit/MANUAL.md` §6.5), и отличие
 * от DTO ровно одно и осознанное — опциональные поля нормализованы в `| null`,
 * чтобы разметка ветвилась по `!= null`, а не по `undefined`.
 */

export type CalendarView = {
  displayName: string;
};

export type EventTypeView = {
  id: string;
  name: string;
  description: string | null;
  durationMinutes: number;
};

export type SlotView = {
  startAtUtc: string;
  endAtUtc: string;
  eventTypeId: string;
};

export type BookingView = {
  id: string;
  eventTypeId: string;
  eventTypeName: string;
  startAtUtc: string;
  endAtUtc: string;
  guestName: string;
  guestEmail: string;
  guestNote: string | null;
  createdAtUtc: string;
};
