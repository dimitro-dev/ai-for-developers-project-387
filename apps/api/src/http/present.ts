// domain → transport (Р1). Единственное место, где instant превращается в ISO-строку
// и где в ответ подставляется publicUrl из конфигурации.

import type {
  Booking as BookingResponse,
  CalendarSettingsResponse,
  EventType as EventTypeResponse,
  PublicCalendarResponse,
  SetupStateResponse,
  Slot as SlotResponse,
} from '@minical/backend-contract';

import type { Booking, EventType, OwnerRecord, TimeInterval } from '../domain/model.ts';

export const present = {
  eventType(entity: EventType): EventTypeResponse {
    return {
      id: entity.id,
      name: entity.name,
      description: entity.description,
      durationMinutes: entity.durationMinutes,
    };
  },

  slot(interval: TimeInterval, eventTypeId: string): SlotResponse {
    return {
      startAtUtc: interval.startAtUtc.toISOString(),
      endAtUtc: interval.endAtUtc.toISOString(),
      eventTypeId,
    };
  },

  /** `eventTypeName` — из сохранённого snapshot'а записи, а не join'ом с типами (I15). */
  booking(entity: Booking): BookingResponse {
    return {
      id: entity.id,
      eventTypeId: entity.eventTypeId,
      eventTypeName: entity.eventTypeName,
      startAtUtc: entity.startAtUtc.toISOString(),
      endAtUtc: entity.endAtUtc.toISOString(),
      guestName: entity.guestName,
      guestEmail: entity.guestEmail,
      guestNote: entity.guestNote,
      createdAtUtc: entity.createdAtUtc.toISOString(),
    };
  },

  settings(owner: OwnerRecord, publicWebUrl: string): CalendarSettingsResponse {
    return {
      displayName: owner.displayName,
      timeZone: owner.settings.timeZone,
      availabilityRules: owner.settings.availabilityRules.map((rule) => ({
        daysOfWeek: [...rule.daysOfWeek],
        startLocal: rule.startLocal,
        endLocal: rule.endLocal,
      })),
      slotIntervalMinutes: owner.settings.slotIntervalMinutes,
      publicUrl: publicWebUrl,
    };
  },

  /**
   * Публичная проекция узкая по построению — отдельная функция, а не усечение
   * `settings`: иначе будущее поле настроек протекло бы гостю.
   */
  publicCalendar(owner: OwnerRecord): PublicCalendarResponse {
    return { displayName: owner.displayName };
  },

  setupState(owner: OwnerRecord | null): SetupStateResponse {
    if (owner === null || !owner.onboardingCompleted) {
      return { onboardingCompleted: false };
    }
    return { onboardingCompleted: true, displayName: owner.displayName };
  },
};
