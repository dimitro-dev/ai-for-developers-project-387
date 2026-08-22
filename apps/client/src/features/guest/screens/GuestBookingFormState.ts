import type { FieldError } from '@/shared/forms';

/**
 * Состояние экрана `guest.booking-form` (спека 14).
 *
 * Набор `kind` и имена свойств повторяют `generated/GuestBookingForm.types.generated.ts`;
 * поля формы (`form`) и ключ идемпотентности (`bookingKey`) в локальный state не входят —
 * они живут в `GuestFlowProvider` (ADR §2 и §5), иначе черновик не пережил бы возврат к слотам
 * и обрыв сети. Здесь остаются только машина, ошибки полей и текст серверной ошибки.
 */
export type GuestBookingFormState =
  | { kind: 'editing'; fieldErrors: FieldError[] }
  | { kind: 'validationError'; fieldErrors: FieldError[] }
  | { kind: 'submitting'; fieldErrors: FieldError[] }
  | { kind: 'serverValidationError'; fieldErrors: FieldError[]; message: string }
  | { kind: 'networkError'; fieldErrors: FieldError[] };

export type GuestBookingFormEvent =
  /** `before="validateGuestForm"` сообщил о конфликте → `onConflict="validationError"`. */
  | { type: 'validation/failed'; fieldErrors: FieldError[] }
  /** Диспатч `createBooking` — in-flight состояние `api.command`. */
  | { type: 'submit/started' }
  /** Ветвь `$error.transport == true:networkError` (кадр 9). */
  | { type: 'submit/transportFailed' }
  /** `onErrorState="serverValidationError"` — ошибка сервера, не покрытая ветвями. */
  | { type: 'submit/serverFailed'; message: string };

export const initialGuestBookingFormState: GuestBookingFormState = {
  kind: 'editing',
  fieldErrors: [],
};

/**
 * Переходы ровно по таблице путей входа спеки. Действий `changeName`/`changeEmail`/`changeNote`
 * здесь нет: они `local.update` над черновиком провайдера и состояние экрана не меняют —
 * редактирование после ошибки безопасно, 400 брони не создаёт.
 */
export function guestBookingFormReducer(
  state: GuestBookingFormState,
  event: GuestBookingFormEvent,
): GuestBookingFormState {
  switch (event.type) {
    case 'validation/failed':
      return { kind: 'validationError', fieldErrors: event.fieldErrors };

    // Валидация прошла — прежние подсказки полей больше не актуальны.
    case 'submit/started':
      return { kind: 'submitting', fieldErrors: [] };

    case 'submit/transportFailed':
      return { kind: 'networkError', fieldErrors: state.fieldErrors };

    case 'submit/serverFailed':
      return {
        kind: 'serverValidationError',
        fieldErrors: state.fieldErrors,
        message: event.message,
      };
  }
}
