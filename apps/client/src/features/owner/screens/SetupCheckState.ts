import { errorMessage } from '@/features/owner/model/errors';
import type { UseCaseResult } from '@/features/owner/usecases/result';

import {
  SetupCheckErrorDefaults,
  type SetupCheckState,
  type SetupState,
} from './generated/SetupCheck.types.generated';

/**
 * Состояние экрана `owner.setup-check` (кадр 1) — форма и имя `kind` в точности как в
 * `generated/SetupCheck.types.generated.ts`. Спека не объявляет `content`-состояние: успешная
 * проверка не рендерит этот экран вовсе, она сразу маршрутизирует на другой route
 * (`onSuccessWhen` спеки), поэтому единственное «стабильное» состояние без исхода — `checking`.
 */
export const initialSetupCheckState: SetupCheckState = { kind: 'checking', progress: 0 };

/** Route id из `navigation.uispec.xml`, на который ветвится `onSuccessWhen` действия `checkSetup`. */
export type SetupCheckRoute = 'OwnerMeetings' | 'OnboardingProfile';

/**
 * Исход действия `checkSetup`: либо навигация (успех), либо следующее состояние экрана (ошибка).
 * Отдельного `content`-state нет — см. комментарий у `initialSetupCheckState`.
 */
export type SetupCheckOutcome =
  | { kind: 'route'; route: SetupCheckRoute }
  | { kind: 'state'; next: SetupCheckState };

/**
 * Чистая функция перехода — `onSuccessWhen`/`onErrorState` действия `checkSetup` спеки:
 * `onboardingCompleted == true` → `OwnerMeetings`, `== false` → `OnboardingProfile`, ошибка любого
 * рода → state `error` с текстом из owner-словаря `$error` (серверный `message` не показывается).
 */
export function resolveSetupCheck(result: UseCaseResult<SetupState>): SetupCheckOutcome {
  if (result.ok) {
    return {
      kind: 'route',
      route: result.data.onboardingCompleted ? 'OwnerMeetings' : 'OnboardingProfile',
    };
  }

  return {
    kind: 'state',
    next: {
      kind: 'error',
      message: errorMessage(result.error),
      canRetry: SetupCheckErrorDefaults.canRetry,
    },
  };
}
