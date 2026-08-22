import type { Booking, EventType, PublicCalendarResponse, Slot } from '@minical/api-client';

import type { BookingView, CalendarView, EventTypeView, SlotView } from './types';

export function toCalendarView(dto: PublicCalendarResponse): CalendarView {
  return { displayName: dto.displayName };
}

export function toEventTypeView(dto: EventType): EventTypeView {
  return {
    id: dto.id,
    name: dto.name,
    description: dto.description ?? null,
    durationMinutes: dto.durationMinutes,
  };
}

export function toEventTypeViews(dtos: ReadonlyArray<EventType>): EventTypeView[] {
  return dtos.map(toEventTypeView);
}

export function toSlotView(dto: Slot): SlotView {
  return {
    startAtUtc: dto.startAtUtc,
    endAtUtc: dto.endAtUtc,
    eventTypeId: dto.eventTypeId,
  };
}

export function toSlotViews(dtos: ReadonlyArray<Slot>): SlotView[] {
  return dtos.map(toSlotView);
}

export function toBookingView(dto: Booking): BookingView {
  return {
    id: dto.id,
    eventTypeId: dto.eventTypeId,
    eventTypeName: dto.eventTypeName,
    startAtUtc: dto.startAtUtc,
    endAtUtc: dto.endAtUtc,
    guestName: dto.guestName,
    guestEmail: dto.guestEmail,
    guestNote: dto.guestNote ?? null,
    createdAtUtc: dto.createdAtUtc,
  };
}

/**
 * Обратный маппинг view-model → DTO для параметра route `booking`: он типизирован контрактным
 * `Booking` (ручной перенос `navigation.uispec.xml`), а use-case отдаёт `BookingView`.
 * Единственное различие форм — нормализованный `guestNote`.
 */
export function toBookingDto(view: BookingView): Booking {
  const { guestNote, ...rest } = view;
  return guestNote === null ? rest : { ...rest, guestNote };
}
