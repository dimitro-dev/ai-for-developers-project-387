import {
  completeAdminSetup,
  createAdminEventType,
  getAdminEventTypes,
  getAdminSettings,
  getAdminSetup,
  getAdminUpcomingBookings,
  updateAdminSettings,
  type CreateEventTypeRequest,
  type EventType,
  type SetupRequest,
  type SetupStateResponse,
} from '@minical/api-client';

import { toAppError } from '@/api/errors';

import { toBookingViews, toOwnerSettingsView } from '../model/mappers';
import type { BookingView, OwnerSettingsView } from '../model/types';
import type { UseCaseResult } from './result';

/**
 * Форма ответа generated SDK при `throwOnError: false` — тот же признак transport-ошибки, что
 * и в `features/guest/usecases/guest.ts`: `response` отсутствует, только если ответа от сервера
 * не было вовсе.
 */
type SdkCallResult<TDto> = {
  data: TDto | undefined;
  error: unknown;
  response?: Response;
};

async function runOperation<TDto, TView>(
  call: () => Promise<SdkCallResult<TDto>>,
  toView: (dto: TDto) => TView,
): Promise<UseCaseResult<TView>> {
  try {
    const result = await call();
    if (result.data === undefined) {
      return { ok: false, error: toAppError({ error: result.error, response: result.response }) };
    }
    return { ok: true, data: toView(result.data) };
  } catch (thrown) {
    // Сюда попадает только то, что упало до отправки (сборка запроса, сериализация тела):
    // сетевые сбои SDK уже вернул в `error`. Ответа не было — значит transport.
    return { ok: false, error: toAppError({ error: thrown }) };
  }
}

/**
 * `owner.setup-check` → binding `checkSetup` (`getAdminSetup`). Модель экрана объявлена
 * `source="api"` — контракт возвращается как есть, без мапинга.
 */
export function checkSetup(): Promise<UseCaseResult<SetupStateResponse>> {
  return runOperation(() => getAdminSetup(), (dto) => dto);
}

/** `owner.onboarding-working-hours` → binding `completeSetup` (`completeAdminSetup`). */
export function completeSetup(request: SetupRequest): Promise<UseCaseResult<OwnerSettingsView>> {
  return runOperation(() => completeAdminSetup({ body: request }), toOwnerSettingsView);
}

/**
 * `owner.upcoming-meetings` → bindings `loadUpcomingMeetings` и `refreshUpcomingMeetings`: обе
 * ссылаются на `getAdminUpcomingBookings`, поэтому второго use-case нет (тот же приём, что у
 * `loadPublicSlots` в `features/guest/usecases/guest.ts`).
 */
export function loadUpcomingBookings(): Promise<UseCaseResult<BookingView[]>> {
  return runOperation(() => getAdminUpcomingBookings(), toBookingViews);
}

/**
 * `getAdminSettings` — один use-case на четыре биндинга (`loadMeetingsSettings` экрана 05,
 * `loadSettingsSummary` экрана 08, `loadWorkingHoursSettings` экрана 07, `loadProfileSettings`
 * экрана 09): каждый экран сам проецирует из общего `OwnerSettingsView` нужную ему часть.
 */
export function loadOwnerSettings(): Promise<UseCaseResult<OwnerSettingsView>> {
  return runOperation(() => getAdminSettings(), toOwnerSettingsView);
}

/**
 * `owner.event-types` → binding `loadEventTypes` (`getAdminEventTypes`). Модель экрана объявлена
 * `source="api"` — список типов событий возвращается как есть.
 */
export function loadEventTypes(): Promise<UseCaseResult<EventType[]>> {
  return runOperation(() => getAdminEventTypes(), (dtos) => dtos);
}

/** `owner.create-event-type` → binding `submitEventType` (`createAdminEventType`). */
export function createEventType(
  request: CreateEventTypeRequest,
): Promise<UseCaseResult<EventType>> {
  return runOperation(() => createAdminEventType({ body: request }), (dto) => dto);
}

/**
 * `updateAdminSettings` — один use-case на два биндинга (`saveOwnerSettings` экрана 07,
 * `saveProfileSettings` экрана 09): оба отправляют read-modify-write `SetupRequest`, собранный
 * `toSetupRequest` из `../model/mappers`.
 */
export function saveOwnerSettings(request: SetupRequest): Promise<UseCaseResult<OwnerSettingsView>> {
  return runOperation(() => updateAdminSettings({ body: request }), toOwnerSettingsView);
}
