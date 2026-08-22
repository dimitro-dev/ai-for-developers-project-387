import type { Booking } from '@minical/api-client';

/**
 * Типы параметров гостевого стека — ручной перенос `<Stack id="GuestStack">` из
 * `docs/ui-spec-kit/specs/ui/navigation/navigation.uispec.xml` 1:1.
 * Генератор кита route-типы не выдаёт (roadmap AUDIT.md), поэтому файл ручной,
 * и правится он только вслед за navigation.uispec.xml.
 *
 * Соответствие типов UISpec → TypeScript: `string` → string, `int32` → number,
 * `utcDateTime` → string (ISO-8601 UTC, как в контрактных DTO), `Booking` → контрактный DTO.
 */
export type GuestStackParamList = {
  GuestEventTypes: undefined;
  GuestSlots: {
    eventTypeId: string;
    eventTypeName: string;
    durationMinutes: number;
    eventTypeDescription?: string;
  };
  GuestBookingForm: {
    eventTypeId: string;
    eventTypeName: string;
    startAtUtc: string;
    endAtUtc: string;
  };
  GuestBookingConfirmation: {
    booking: Booking;
  };
};

export const guestStackInitialRoute = 'GuestEventTypes' satisfies keyof GuestStackParamList;
