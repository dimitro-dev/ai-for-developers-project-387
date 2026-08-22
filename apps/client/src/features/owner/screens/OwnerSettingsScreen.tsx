import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useRef, useState } from 'react';

import { loadOwnerSettings } from '@/features/owner/usecases/owner';
import type { OwnerSettingsStackParamList } from '@/navigation/OwnerSettingsStackParamList';

import { initialOwnerSettingsState, loaded, refreshed, type OwnerSettingsState } from './OwnerSettingsState';
import { OwnerSettingsView } from './OwnerSettingsView';

type Props = NativeStackScreenProps<OwnerSettingsStackParamList, 'OwnerSettings'>;

/**
 * Контейнер экрана `owner.settings` (спека 08) — корень вкладки «Настройки».
 *
 * Жизненный цикл — конвенция `EventTypesScreen`/`OwnerMeetingsScreen` (ADR, тот же приём для
 * root-экранов таба): первый фокус показывает `loading` и грузит сводку, каждый следующий
 * (в т.ч. возврат с экранов 07/09 после сохранения) диспатчит фоновый refresh без `loading`;
 * неудачный фоновый refresh уже показанную сводку не портит. «Повторить» состояния `error` —
 * та же операция `loadSettingsSummary`, что и первый показ.
 */
export function OwnerSettingsScreen({ navigation }: Props) {
  const [state, setState] = useState<OwnerSettingsState>(initialOwnerSettingsState);
  const focusedBefore = useRef(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      if (focusedBefore.current) {
        void loadOwnerSettings().then((result) => {
          if (!cancelled) {
            setState((current) => refreshed(current, result));
          }
        });
      } else {
        focusedBefore.current = true;
        setState(initialOwnerSettingsState);
        void loadOwnerSettings().then((result) => {
          if (!cancelled) {
            setState(loaded(result));
          }
        });
      }

      return () => {
        cancelled = true;
      };
    }, []),
  );

  const retry = useCallback(() => {
    setState(initialOwnerSettingsState);
    void loadOwnerSettings().then((result) => {
      setState(loaded(result));
    });
  }, []);

  const openProfileSettings = useCallback(() => {
    navigation.push('OwnerProfileSettings');
  }, [navigation]);

  const openWorkingHoursSettings = useCallback(() => {
    navigation.push('OwnerWorkingHoursSettings');
  }, [navigation]);

  const openEventTypes = useCallback(() => {
    navigation.push('EventTypesFromSettings');
  }, [navigation]);

  return (
    <OwnerSettingsView
      state={state}
      onOpenProfileSettings={openProfileSettings}
      onOpenWorkingHoursSettings={openWorkingHoursSettings}
      onOpenEventTypes={openEventTypes}
      onRetry={retry}
    />
  );
}

export default OwnerSettingsScreen;
