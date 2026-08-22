// Прикладной слой гостевого сценария. Сетку слотов считает domain/slots.ts — один и
// тот же код для GET /slots и POST /bookings, поэтому коды ошибок не могут разойтись
// с тем, что отдаётся в списке слотов (Р5).

import { randomUUID } from 'node:crypto';

import { DomainError } from '../domain/errors.ts';
import type { Booking, EventType, OwnerRecord, TimeInterval } from '../domain/model.ts';
import { bookingWindowDates, candidateSlots, includesLocalDate, isBusy } from '../domain/slots.ts';
import type { SlotGridInput } from '../domain/slots.ts';
import { localPartsOf } from '../domain/timezone.ts';
import type { Store } from '../store/repositories.ts';
import { requireConfiguredOwner } from './owner.ts';

export interface ListSlotsCommand {
  eventTypeId: string;
}

/**
 * Свободные слоты = кандидаты минус занятость. Побочных эффектов нет: запрос ничего
 * не резервирует (I10).
 */
export async function getPublicSlots(
  store: Store,
  command: ListSlotsCommand,
): Promise<TimeInterval[]> {
  const owner = await requireConfiguredOwner(store);
  const eventType = await requireEventType(store, command.eventTypeId);

  const candidates = candidateSlots(gridInput(owner, eventType, new Date()));
  if (candidates.length === 0) return [];

  const busy = await store.bookings.listBusyIntervals(
    candidates[0].startAtUtc,
    candidates[candidates.length - 1].endAtUtc,
  );
  return candidates.filter((slot) => !isBusy(slot, busy));
}

export interface CreateBookingCommand {
  /** Ключ идемпотентности; без него id генерирует сервер. */
  id?: string;
  eventTypeId: string;
  startAtUtc: Date;
  guestName: string;
  guestEmail: string;
  guestNote?: string;
}

export interface CreateBookingResult {
  booking: Booking;
  /** `true` — идемпотентный повтор: отдана ранее созданная бронь, ничего не создано. */
  replayed: boolean;
}

/**
 * Порядок шагов значим — каждый отвечает своим кодом (Р5):
 *
 * 1. transport Zod (в обработчике)                → VALIDATION_ERROR
 * 2. guestName / guestEmail непусты (I12)         → GUEST_NAME_REQUIRED / GUEST_EMAIL_REQUIRED
 * 3. onboarding завершён                          → CALENDAR_NOT_CONFIGURED
 * 4. тип встречи существует                       → EVENT_TYPE_NOT_FOUND
 * 5. переданный id уже известен: нагрузка та же    → ранний успешный выход (200)
 *                               нагрузка другая    → DUPLICATE_BOOKING_ID
 * 6. прошлое или дата вне окна (I6, I9)           → SLOT_OUTSIDE_WINDOW
 * 7. начало не совпадает с кандидатом (I7, I8)    → SLOT_NOT_ALIGNED
 * 8. пересечение с существующей бронью (I2, I3)   → SLOT_UNAVAILABLE
 * 9. запись: endAtUtc сервером (I4), eventTypeName snapshot'ом (I15)
 */
export async function createPublicBooking(
  store: Store,
  command: CreateBookingCommand,
): Promise<CreateBookingResult> {
  // Шаг 2 через HTTP недостижим — zGuestDetails требует непустые name/email раньше.
  // Код существует для полноты доменного слоя и покрыт прямым вызовом use-case.
  if (command.guestName.trim() === '') {
    throw new DomainError('GUEST_NAME_REQUIRED', 'Guest name is required');
  }
  if (command.guestEmail.trim() === '') {
    throw new DomainError('GUEST_EMAIL_REQUIRED', 'Guest email is required');
  }

  const owner = await requireConfiguredOwner(store);
  const eventType = await requireEventType(store, command.eventTypeId);

  if (command.id !== undefined) {
    const existing = await store.bookings.findById(command.id);
    if (existing !== null) {
      // Успешный повтор — не ошибка, поэтому механику DomainError он не использует.
      if (isEquivalentPayload(existing, command)) return { booking: existing, replayed: true };
      throw new DomainError(
        'DUPLICATE_BOOKING_ID',
        `Booking id "${command.id}" already exists with a different payload`,
      );
    }
  }

  const nowUtc = new Date();
  const startMs = command.startAtUtc.getTime();
  const timeZone = owner.settings.timeZone;
  const inWindow =
    startMs >= nowUtc.getTime() &&
    includesLocalDate(
      bookingWindowDates(timeZone, nowUtc),
      localPartsOf(command.startAtUtc, timeZone),
    );
  if (!inWindow) {
    throw new DomainError(
      'SLOT_OUTSIDE_WINDOW',
      'Requested start is in the past or outside the 14-day booking window',
    );
  }

  // Выравнивание — принадлежность множеству кандидатов, а не обратная арифметика по
  // сетке: тот же код, что отдаёт GET /slots, поэтому разойтись они не могут.
  const slot = candidateSlots(gridInput(owner, eventType, nowUtc)).find(
    (candidate) => candidate.startAtUtc.getTime() === startMs,
  );
  if (slot === undefined) {
    throw new DomainError(
      'SLOT_NOT_ALIGNED',
      'Requested start does not match any available slot of this event type',
    );
  }

  const busy = await store.bookings.listBusyIntervals(slot.startAtUtc, slot.endAtUtc);
  if (isBusy(slot, busy)) {
    throw new DomainError('SLOT_UNAVAILABLE', 'Requested slot conflicts with an existing booking');
  }

  const booking: Booking = {
    id: command.id ?? randomUUID(),
    eventTypeId: eventType.id,
    eventTypeName: eventType.name,
    startAtUtc: slot.startAtUtc,
    endAtUtc: slot.endAtUtc,
    guestName: command.guestName,
    guestEmail: command.guestEmail,
    guestNote: command.guestNote,
    createdAtUtc: nowUtc,
  };
  // Повторная проверка занятости и уникальности живёт внутри create и выполняется
  // без внутренних `await` — это и есть защита от гонки на in-memory (Р4.2).
  await store.bookings.create(booking);
  return { booking, replayed: false };
}

/**
 * Нагрузки эквивалентны, когда совпадают разобранные значения, а не исходные строки:
 * один и тот же instant, записанный `…Z` и `….000Z`, — одна и та же нагрузка. Поле
 * `id` в сравнении не участвует, оно и есть ключ.
 */
function isEquivalentPayload(existing: Booking, command: CreateBookingCommand): boolean {
  return (
    existing.eventTypeId === command.eventTypeId &&
    existing.startAtUtc.getTime() === command.startAtUtc.getTime() &&
    existing.guestName === command.guestName &&
    existing.guestEmail === command.guestEmail &&
    existing.guestNote === command.guestNote
  );
}

async function requireEventType(store: Store, eventTypeId: string): Promise<EventType> {
  const eventType = await store.eventTypes.findById(eventTypeId);
  if (eventType === null) {
    throw new DomainError('EVENT_TYPE_NOT_FOUND', `Event type "${eventTypeId}" does not exist`);
  }
  return eventType;
}

function gridInput(owner: OwnerRecord, eventType: EventType, nowUtc: Date): SlotGridInput {
  return {
    timeZone: owner.settings.timeZone,
    availabilityRules: owner.settings.availabilityRules,
    slotIntervalMinutes: owner.settings.slotIntervalMinutes,
    durationMinutes: eventType.durationMinutes,
    nowUtc,
  };
}
