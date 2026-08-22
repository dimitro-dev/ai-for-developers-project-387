// Интерфейсы хранилища (FR5, Р4). Все методы асинхронные: переход на PostgreSQL не
// должен переписывать прикладной слой. Предикаты живут здесь, а не в use-case, —
// это ровно то, что PG выразит диапазонным запросом и exclusion constraint.

import type { Booking, EventType, OwnerRecord, TimeInterval } from '../domain/model.ts';

export interface OwnerRepository {
  /** `null`, пока onboarding не выполнялся. Владелец один по конструкции (I1). */
  get(): Promise<OwnerRecord | null>;
  save(owner: OwnerRecord): Promise<void>;
}

export interface EventTypeRepository {
  list(): Promise<EventType[]>;
  findById(id: string): Promise<EventType | null>;
  /** Отказывает `DomainError('DUPLICATE_EVENT_TYPE_ID')` (I11). */
  create(eventType: EventType): Promise<void>;
}

export interface BookingRepository {
  findById(id: string): Promise<Booking | null>;
  /** Предстоящие: `endAtUtc > instant` (решение Q4). */
  listNotEndedBefore(instant: Date): Promise<Booking[]>;
  /** Занятость владельца глобальна и не фильтруется по `eventTypeId` (Р7). */
  listBusyIntervals(fromUtc: Date, toUtc: Date): Promise<TimeInterval[]>;
  /**
   * Последняя линия защиты, а не наивный insert: проверка пересечения и уникальности
   * id выполняется внутри без внутренних `await` (Р4.2), поэтому «проверить и
   * вставить» неделимо. Отказывает `DomainError('SLOT_UNAVAILABLE')` либо
   * `DomainError('DUPLICATE_BOOKING_ID')`.
   */
  create(booking: Booking): Promise<void>;
}

export interface Store {
  owner: OwnerRepository;
  eventTypes: EventTypeRepository;
  bookings: BookingRepository;
}
