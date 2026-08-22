import type { FieldError } from '@/shared/forms';

import type { OwnerProfileDraft } from './generated/OnboardingProfile.types.generated';

/**
 * StateMachine экрана `owner.onboarding-profile` (спека 02). Единственные события — правка двух
 * полей: `continueOnboarding` не меняет состояние экрана, а навигирует (обрабатывается контейнером
 * напрямую, не редьюсером). Состояние `submitting` из `screens/generated/OnboardingProfile.types.generated`
 * сюда намеренно не перенесено: на этом экране нет ни одного `api.command`, а `continueOnboarding` —
 * синхронный `navigation.push`, поэтому в него нечему перевести машину состояний.
 */
export interface OnboardingProfileState {
  form: OwnerProfileDraft;
}

export type OnboardingProfileEvent =
  | { type: 'changeDisplayName'; value: string }
  | { type: 'changeTimezone'; value: string };

export function onboardingProfileReducer(
  state: OnboardingProfileState,
  event: OnboardingProfileEvent,
): OnboardingProfileState {
  switch (event.type) {
    case 'changeDisplayName':
      return { form: { ...state.form, displayName: event.value } };

    case 'changeTimezone':
      return { form: { ...state.form, timeZone: event.value } };
  }
}

/**
 * Правила `display-name-required`/`timezone-required` спеки 02. Считается на каждый рендер от
 * текущего черновика (а не только на попытку submit): кнопка «Продолжить» дизейблится по
 * `$validation.invalid` напрямую, поэтому подсказки полей обязаны быть видны сразу, а не только
 * после недостижимого нажатия по заблокированной кнопке.
 */
export function validateOwnerProfileDraft(form: OwnerProfileDraft): FieldError[] {
  const errors: FieldError[] = [];
  if (form.displayName.trim().length === 0) {
    errors.push({ field: 'display-name', message: 'Введите отображаемое имя' });
  }
  if (form.timeZone.length === 0) {
    errors.push({ field: 'timezone', message: 'Выберите timezone' });
  }
  return errors;
}
