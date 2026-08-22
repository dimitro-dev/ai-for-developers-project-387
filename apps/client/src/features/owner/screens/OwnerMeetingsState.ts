/**
 * StateMachine экрана `owner.upcoming-meetings` (спека 05) и её чистый редьюсер.
 *
 * `OwnerMeetingsData` — не реэкспорт сгенерированного `UpcomingMeetingsData`
 * (`screens/generated/OwnerMeetings.types.generated.ts`): у сгенерированного типа `publicUrl`
 * брендирован (`Url`), а `OwnerSettingsView.publicUrl` (`features/owner/model/types.ts`), из
 * которого это поле приходит, — обычный `string`. Повторять бренд ради 1:1 совпадения с
 * генератором смысла не имеет (тот же приём, что `selectedSlot` в `GuestSlotsState.ts`).
 *
 * `selectedBooking` спеки объявлен `required="false"` на состояниях `content`/`refreshing` —
 * генератор это теряет (см. тот же файл: там он обязательный на всех трёх состояниях). Здесь
 * поле есть только там, где оно действительно нужно — на `bookingDetails`, куда его кладёт
 * `openBooking`; `content`/`refreshing` его не несут вовсе.
 */

import type { AppError } from '@/api/errors';
import { errorMessage } from '@/features/owner/model/errors';
import type { BookingView } from '@/features/owner/model/types';

export interface OwnerMeetingsData {
  timezone: string;
  publicUrl: string;
  bookings: BookingView[];
}

export type OwnerMeetingsState =
  | { kind: 'loading' }
  | { kind: 'empty'; data: OwnerMeetingsData }
  | { kind: 'content'; data: OwnerMeetingsData }
  | { kind: 'refreshing'; data: OwnerMeetingsData }
  | { kind: 'bookingDetails'; data: OwnerMeetingsData; selectedBooking: BookingView }
  | { kind: 'error'; message: string; canRetry: boolean };

export type OwnerMeetingsAction =
  | { type: 'load/started' }
  | { type: 'load/succeeded'; data: OwnerMeetingsData }
  | { type: 'load/failed'; error: AppError }
  | { type: 'refresh/started' }
  | { type: 'refresh/succeeded'; bookings: BookingView[] }
  | { type: 'refresh/failed' }
  | { type: 'openBooking'; booking: BookingView }
  | { type: 'closeBooking' };

export const initialOwnerMeetingsState: OwnerMeetingsState = { kind: 'loading' };

/** Данные состояния, если у текущего состояния они есть (все, кроме `loading`/`error`). */
export function dataOf(state: OwnerMeetingsState): OwnerMeetingsData | null {
  switch (state.kind) {
    case 'empty':
    case 'content':
    case 'refreshing':
    case 'bookingDetails':
      return state.data;
    default:
      return null;
  }
}

function withBookings(data: OwnerMeetingsData, bookings: BookingView[]): OwnerMeetingsState {
  const updated: OwnerMeetingsData = { ...data, bookings };
  return updated.bookings.length === 0
    ? { kind: 'empty', data: updated }
    : { kind: 'content', data: updated };
}

export function ownerMeetingsReducer(
  state: OwnerMeetingsState,
  action: OwnerMeetingsAction,
): OwnerMeetingsState {
  switch (action.type) {
    case 'load/started':
      return initialOwnerMeetingsState;

    case 'load/succeeded':
      // `onSuccessWhen` спеки: пустой список — `empty`, иначе `content`.
      return withBookings(action.data, action.data.bookings);

    case 'load/failed':
      return { kind: 'error', message: errorMessage(action.error), canRetry: true };

    case 'refresh/started': {
      // `preserveContent="true"`: список остаётся видимым, меняется только `kind`.
      const data = dataOf(state);
      return data === null ? state : { kind: 'refreshing', data };
    }

    case 'refresh/succeeded': {
      const data = dataOf(state);
      return data === null ? state : withBookings(data, action.bookings);
    }

    // Без `onErrorState` у `refreshUpcomingMeetings`: неудачный фоновый refresh состояние
    // не меняет, кроме возврата из `refreshing` обратно к видимому списку.
    case 'refresh/failed': {
      const data = dataOf(state);
      return data === null ? state : { kind: 'content', data };
    }

    case 'openBooking': {
      const data = dataOf(state);
      return data === null ? state : { kind: 'bookingDetails', data, selectedBooking: action.booking };
    }

    case 'closeBooking': {
      const data = dataOf(state);
      return data === null ? state : { kind: 'content', data };
    }
  }
}
