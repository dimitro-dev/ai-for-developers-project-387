/**
 * DTO → view-model owner-ветки. Как и в `features/guest/model/mappers.ts`, отличия от
 * контрактных DTO целенаправленные и точно по атрибутам `from=` спек: `Booking.eventTypeName`
 * переименовывается в `BookingView.eventTypeTitle`, а `guestName`/`guestEmail`/`guestNote`
 * группируются в `GuestView` (спека `05-upcoming-meetings.screen.md`). `startAt`/`endAt`
 * получают брендированный `UtcDateTime` генератора (`screens/generated/uispec-runtime.ts`) —
 * значение остаётся исходной UTC-строкой сервера, арифметику по-прежнему делает backend.
 */

import type { Booking, CalendarSettingsResponse, SetupRequest } from '@minical/api-client';

import type { BookingView, GuestView } from '../screens/generated/OwnerMeetings.types.generated';
import type { UtcDateTime } from '../screens/generated/uispec-runtime';
import type { OwnerSettingsView } from './types';

export function toBookingView(dto: Booking): BookingView {
  const guest: GuestView = { name: dto.guestName, email: dto.guestEmail, comment: dto.guestNote };
  return {
    id: dto.id,
    eventTypeTitle: dto.eventTypeName,
    startAt: dto.startAtUtc as UtcDateTime,
    endAt: dto.endAtUtc as UtcDateTime,
    guest,
  };
}

export function toBookingViews(dtos: ReadonlyArray<Booking>): BookingView[] {
  return dtos.map(toBookingView);
}

export function toOwnerSettingsView(dto: CalendarSettingsResponse): OwnerSettingsView {
  return {
    displayName: dto.displayName,
    timeZone: dto.timeZone,
    availabilityRules: dto.availabilityRules,
    slotIntervalMinutes: dto.slotIntervalMinutes,
    publicUrl: dto.publicUrl,
  };
}

/**
 * Read-modify-write сборка полного `SetupRequest` (brief FR6, ADR §6, GAP-003): контракт
 * поддерживает только full-replace PUT, поэтому экраны 07 и 09 правят каждый только свою часть
 * настроек и обязаны прислать остальные поля нетронутыми. `patch` — только то, что экран
 * реально изменил; всё остальное берётся из `base` — снимка, загруженного `loadOwnerSettings()`
 * перед правкой. `availabilityRules` в `patch` уже в контрактной форме: приведение
 * `WorkingInterval[]` (client-only `id`, `Weekday`) к `AvailabilityRule[]` делает `toAvailabilityRules`
 * из `@/features/availability/lib` на стороне экрана, а не здесь.
 */
export function toSetupRequest(
  base: OwnerSettingsView,
  patch: Partial<
    Pick<SetupRequest, 'displayName' | 'timeZone' | 'availabilityRules' | 'slotIntervalMinutes'>
  > = {},
): SetupRequest {
  return {
    displayName: patch.displayName ?? base.displayName,
    timeZone: patch.timeZone ?? base.timeZone,
    availabilityRules: patch.availabilityRules ?? base.availabilityRules,
    slotIntervalMinutes: patch.slotIntervalMinutes ?? base.slotIntervalMinutes,
  };
}
