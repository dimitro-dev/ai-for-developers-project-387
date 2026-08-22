/**
 * View-model owner-ветки. Тот же принцип, что и в `features/guest/model/types.ts`
 * (`docs/ui-spec-kit/MANUAL.md` §6.5): usecases и экраны не получают контрактные DTO напрямую,
 * а идут через явный view-model слой.
 *
 * Owner-спеки после `front/ui/003` уже прогнаны через `generate_scaffold.py` (пункт плана P06):
 * там, где сгенерированный `features/owner/screens/generated/*.types.generated.ts` экрана уже
 * содержит готовый view-model — `BookingView`/`GuestView` (мапинг `from=`, экран
 * `owner.upcoming-meetings`) или прямое переиспользование контрактной схемы (`EventType`,
 * `source="api"`, экран `owner.event-types`) — модель переиспользует именно эти типы, а не
 * заводит второй такой же.
 *
 * `getAdminSettings` / `updateAdminSettings` / `completeAdminSetup` возвращают один и тот же
 * `CalendarSettingsResponse`, но ни один экранный generated-тип не описывает его целиком:
 * экраны 05/07/08/09 берут своим `from=` только часть полей (сводка `OwnerSettingsSummary`,
 * черновик `OwnerSettingsDraft` с client-only `id` у интервалов, разделённые
 * `OwnerProfileSettingsDraft`/`CalendarSettingsSnapshot`). `OwnerSettingsView` — недостающий
 * канонический вид этой операции, а не дубликат ни одного из них: экраны сами проецируют из
 * него свою часть (пункты плана P16/P19).
 */

import type { AvailabilityRule, EventType, SetupStateResponse } from '@minical/api-client';

export type { EventType };
export type {
  BookingView,
  GuestView,
  UpcomingMeetingsData,
} from '../screens/generated/OwnerMeetings.types.generated';

/** `getAdminSetup` → экран `owner.setup-check` объявляет модель `source="api"`: 1:1 с контрактом. */
export type SetupState = SetupStateResponse;

/** Канонический результат `getAdminSettings` / `updateAdminSettings` / `completeAdminSetup`. */
export type OwnerSettingsView = {
  displayName: string;
  timeZone: string;
  availabilityRules: AvailabilityRule[];
  slotIntervalMinutes: number;
  publicUrl: string;
};
