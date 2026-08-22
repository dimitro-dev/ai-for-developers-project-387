import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';

import { checkSetup } from '@/features/owner/usecases/owner';
import type { OwnerRootStackParamList } from '@/navigation/OwnerRootStackParamList';

import { initialSetupCheckState, resolveSetupCheck } from './SetupCheckState';
import { SetupCheckView } from './SetupCheckView';

type Props = NativeStackScreenProps<OwnerRootStackParamList, 'SetupCheck'>;

/**
 * Контейнер экрана `owner.setup-check` (кадр 1) — точка входа owner-режима (`ownerRootInitialRoute`).
 *
 * Действие `checkSetup` (`api.query` → `getAdminSetup`) диспатчится при монтировании — грамматика
 * UISpec триггеров жизненного цикла не описывает, тот же приём, что у `GuestEventTypesScreen`.
 * Успех не рендерит этот экран: `onSuccessWhen` спеки — чистая маршрутизация, поэтому вместо
 * `setState` вызывается `navigation.replace` — экран проверки не должен оставаться в стеке под
 * `OwnerTabs`/`OnboardingStack` (иначе системная кнопка «Назад» вернула бы на loading-заглушку,
 * которая тут же перезапустит проверку). Ошибка — `onErrorState="error"`.
 * Действие `retrySetup` (`local.dispatch target="checkSetup"`) — тот же вызов, перезапущенный
 * счётчиком попыток, как «Повторить» у `GuestEventTypesScreen`.
 */
export function SetupCheckScreen({ navigation }: Props) {
  const [state, setState] = useState(initialSetupCheckState);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState(initialSetupCheckState);

    void checkSetup().then((result) => {
      if (cancelled) {
        return;
      }

      const outcome = resolveSetupCheck(result);
      if (outcome.kind === 'state') {
        setState(outcome.next);
        return;
      }

      if (outcome.route === 'OwnerMeetings') {
        navigation.replace('OwnerTabs', { screen: 'MeetingsTab' });
      } else {
        navigation.replace('OnboardingStack', { screen: 'OnboardingProfile' });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [attempt, navigation]);

  const retrySetup = useCallback(() => {
    setAttempt((value) => value + 1);
  }, []);

  return <SetupCheckView state={state} onRetry={retrySetup} />;
}

export default SetupCheckScreen;
