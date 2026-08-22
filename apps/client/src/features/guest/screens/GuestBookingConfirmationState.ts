import type { Booking } from '@minical/api-client';

import { toBookingView } from '@/features/guest/model/mappers';
import type { BookingView } from '@/features/guest/model/types';

/**
 * Состояние экрана `guest.booking-confirmation` (спека 15). Имена `kind` — из
 * `generated/GuestBookingConfirmation.types.generated.ts`; бронь внутри состояния хранится
 * view-model'ю `BookingView`, а не контрактным DTO (MANUAL §6.5).
 */
export type GuestBookingConfirmationState =
  | { kind: 'content'; booking: BookingView }
  | { kind: 'error'; message: string };

/**
 * Текст состояния `error`. Экран может быть открыт без данных брони — deep-link или
 * восстановление стека после выгрузки процесса, — и показывать пустое подтверждение нельзя.
 */
export const MISSING_BOOKING_MESSAGE =
  'Данные встречи не пришли на этот экран. Откройте каталог и запишитесь заново.';

/** Обязательные строковые поля контрактной `Booking`. */
const REQUIRED_BOOKING_FIELDS = [
  'id',
  'eventTypeId',
  'eventTypeName',
  'startAtUtc',
  'endAtUtc',
  'guestName',
  'guestEmail',
  'createdAtUtc',
] as const;

/**
 * Guard контейнера: состояние выводится из фактического параметра route, а не из действия —
 * действия, переводящего экран в `error`, спека не содержит и содержать не должна.
 *
 * Типы `GuestStackParamList` объявляют `booking` обязательным, но при восстановлении стека и
 * по deep-link в рантайм приходит что угодно, поэтому параметр принимается как `unknown`.
 */
export function confirmationStateFrom(params: unknown): GuestBookingConfirmationState {
  const booking = bookingParam(params);
  if (booking === null) {
    return { kind: 'error', message: MISSING_BOOKING_MESSAGE };
  }
  return { kind: 'content', booking: toBookingView(booking) };
}

function bookingParam(params: unknown): Booking | null {
  if (typeof params !== 'object' || params === null || !('booking' in params)) {
    return null;
  }
  return isBooking(params.booking) ? params.booking : null;
}

function isBooking(value: unknown): value is Booking {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return REQUIRED_BOOKING_FIELDS.every((field) => typeof candidate[field] === 'string');
}
