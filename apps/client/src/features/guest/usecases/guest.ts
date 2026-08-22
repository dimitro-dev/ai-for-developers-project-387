import {
  createPublicBooking,
  getPublicCalendar,
  getPublicEventTypes,
  getPublicSlots,
  type CreateBookingRequest,
} from '@minical/api-client';

import { toAppError } from '@/api/errors';

import {
  toBookingView,
  toCalendarView,
  toEventTypeViews,
  toSlotViews,
} from '../model/mappers';
import type { BookingView, CalendarView, EventTypeView, SlotView } from '../model/types';
import type { UseCaseResult } from './result';

/**
 * Форма ответа generated SDK при `throwOnError: false`. `response` отсутствует только тогда,
 * когда ответа от сервера не было вовсе — по этому признаку маппер и ставит `transport`.
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

/** `guest.event-types` → binding `loadPublicCalendar` (`getPublicCalendar`). */
export function loadPublicCalendar(): Promise<UseCaseResult<CalendarView>> {
  return runOperation(() => getPublicCalendar(), toCalendarView);
}

/** `guest.event-types` → binding `loadPublicEventTypes` (`getPublicEventTypes`). */
export function loadPublicEventTypes(): Promise<UseCaseResult<EventTypeView[]>> {
  return runOperation(() => getPublicEventTypes(), toEventTypeViews);
}

/**
 * `guest.slots` → bindings `loadPublicSlots` и `refreshPublicSlots`: обе ссылаются
 * на `getPublicSlots`, поэтому второго use-case нет (`brief.md` FR4).
 */
export function loadPublicSlots(eventTypeId: string): Promise<UseCaseResult<SlotView[]>> {
  return runOperation(() => getPublicSlots({ query: { eventTypeId } }), toSlotViews);
}

/** `guest.booking-form` → binding `createBooking` (`createPublicBooking`). */
export function createBooking(request: CreateBookingRequest): Promise<UseCaseResult<BookingView>> {
  return runOperation(() => createPublicBooking({ body: request }), toBookingView);
}
