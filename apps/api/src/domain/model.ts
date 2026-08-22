// Доменные типы MiniCal. Слой не знает ни express, ни transport-схем, ни хранилища
// (правила границ Р1 adr.md): условие дешёвого выноса slot-логики в packages/slot-engine.

export type DayOfWeek =
  | 'Monday'
  | 'Tuesday'
  | 'Wednesday'
  | 'Thursday'
  | 'Friday'
  | 'Saturday'
  | 'Sunday';

/** Локальная календарная дата владельца, без привязки к instant'у. */
export interface LocalDate {
  year: number;
  /** 1–12, а не 0-based, как у Date. */
  month: number;
  day: number;
}

/** Локальные дата и время владельца; instant получается через domain/timezone.ts. */
export interface LocalDateTime extends LocalDate {
  hour: number;
  minute: number;
}

/** Полуоткрытый интервал `[startAtUtc, endAtUtc)` (I3). */
export interface TimeInterval {
  startAtUtc: Date;
  endAtUtc: Date;
}

/** Один повторяющийся рабочий интервал: дни недели и локальное время. */
export interface AvailabilityRule {
  daysOfWeek: DayOfWeek[];
  /** `HH:mm`, включительно. */
  startLocal: string;
  /** `HH:mm`, исключительно. */
  endLocal: string;
}

export interface CalendarSettings {
  timeZone: string;
  availabilityRules: AvailabilityRule[];
  /** Делитель 60, ≥ 15 (проверка V1). */
  slotIntervalMinutes: number;
}

export interface CalendarOwner {
  displayName: string;
  settings: CalendarSettings;
}

/** Хранимая запись единственного владельца (I1). */
export interface OwnerRecord extends CalendarOwner {
  onboardingCompleted: boolean;
}

export interface EventType {
  id: string;
  name: string;
  description?: string;
  durationMinutes: number;
}

/**
 * Подтверждённая встреча — единственный источник занятости (I14).
 * Данные гостя лежат плоским snapshot'ом внутри записи (I13), `eventTypeName` —
 * snapshot названия типа встречи на момент создания (I15).
 */
export interface Booking extends TimeInterval {
  id: string;
  eventTypeId: string;
  eventTypeName: string;
  guestName: string;
  guestEmail: string;
  guestNote?: string;
  createdAtUtc: Date;
}
