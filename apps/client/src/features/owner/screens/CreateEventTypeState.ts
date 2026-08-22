import { generatePublicId } from '@/features/owner/lib';
import type { FieldError } from '@/shared/forms';

/**
 * Черновик формы — `description` всегда строка (для управляемого поля), в отличие от
 * генератора-типа `CreateEventTypeDraft` (`generated/CreateEventType.types.generated.ts`), где
 * поле необязательно как в контрактном `CreateEventTypeRequest`. Тот же приём, что у `GuestDraft`
 * (`features/guest/state/reducer.ts`): пустая строка не уходит в payload (см. контейнер).
 */
export interface CreateEventTypeForm {
  name: string;
  description: string;
  durationMinutes: number;
  id: string;
}

/** Начальное значение длительности — 30 минут (кадр 5, `default="30"` спеки). */
export const DEFAULT_DURATION_MINUTES = 30;

const emptyForm: CreateEventTypeForm = {
  name: '',
  description: '',
  durationMinutes: DEFAULT_DURATION_MINUTES,
  id: '',
};

/**
 * Состояние экрана `owner.create-event-type` (спека 10). Набор `kind` — как в
 * `generated/CreateEventType.types.generated.ts` (`editing`/`submitting`/`error`, оба последних
 * `extends editing`).
 */
export type CreateEventTypeState =
  | { kind: 'editing'; form: CreateEventTypeForm; publicIdTouched: boolean; fieldErrors: FieldError[] }
  | { kind: 'submitting'; form: CreateEventTypeForm; publicIdTouched: boolean; fieldErrors: FieldError[] }
  | {
      kind: 'error';
      form: CreateEventTypeForm;
      publicIdTouched: boolean;
      fieldErrors: FieldError[];
      message: string;
    };

export const initialCreateEventTypeState: CreateEventTypeState = {
  kind: 'editing',
  form: emptyForm,
  publicIdTouched: false,
  fieldErrors: [],
};

export type CreateEventTypeAction =
  | { type: 'changeName'; value: string }
  | { type: 'changeDescription'; value: string }
  | { type: 'changeDuration'; value: number }
  | { type: 'changePublicId'; value: string }
  | { type: 'submit/started' }
  | { type: 'submit/failed'; fieldErrors: FieldError[]; message: string };

const PUBLIC_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * `$validation.invalid` спеки — вычисляется из текущей формы, а не хранится отдельным полем
 * состояния: `submitEventType` спеки `disabledWhen="$validation.invalid || $state == submitting"`
 * не заводит промежуточное состояние вроде гостевого `validationError` (кнопка просто
 * недоступна, пока форма не готова), поэтому правила `<Validation>` реализуются здесь как чистая
 * функция, а не действие редьюсера.
 */
export function isCreateEventTypeFormValid(form: CreateEventTypeForm): boolean {
  return (
    form.name.trim().length > 0 &&
    form.durationMinutes > 0 &&
    PUBLIC_ID_PATTERN.test(form.id)
  );
}

function withForm(
  state: CreateEventTypeState,
  form: CreateEventTypeForm,
  publicIdTouched: boolean = state.publicIdTouched,
): CreateEventTypeState {
  switch (state.kind) {
    case 'editing':
      return { ...state, form, publicIdTouched };
    case 'submitting':
      return { ...state, form, publicIdTouched };
    case 'error':
      return { ...state, form, publicIdTouched };
  }
}

/**
 * Правки полей не сбрасывают `kind` из `error` в `editing` — баннер и полевая ошибка остаются
 * видимы до следующего исхода `submitEventType`. Тот же приём, что у гостевой формы (экран 14,
 * UX rule спеки 10): там `changeName`/`changeEmail`/`changeNote` тоже не меняют состояние экрана.
 */
export function createEventTypeReducer(
  state: CreateEventTypeState,
  action: CreateEventTypeAction,
): CreateEventTypeState {
  switch (action.type) {
    case 'changeName': {
      // `afterWhen="!$state.publicIdTouched:generatePublicId"` — пока владелец не тронул id вручную.
      const id = state.publicIdTouched ? state.form.id : generatePublicId(action.value);
      return withForm(state, { ...state.form, name: action.value, id });
    }

    case 'changeDescription':
      return withForm(state, { ...state.form, description: action.value });

    case 'changeDuration':
      return withForm(state, { ...state.form, durationMinutes: action.value });

    case 'changePublicId':
      // `after="markPublicIdTouched"` — дальнейшие правки названия больше не перегенерируют id.
      return withForm(state, { ...state.form, id: action.value }, true);

    case 'submit/started':
      return {
        kind: 'submitting',
        form: state.form,
        publicIdTouched: state.publicIdTouched,
        fieldErrors: [],
      };

    case 'submit/failed':
      return {
        kind: 'error',
        form: state.form,
        publicIdTouched: state.publicIdTouched,
        fieldErrors: action.fieldErrors,
        message: action.message,
      };
  }
}
