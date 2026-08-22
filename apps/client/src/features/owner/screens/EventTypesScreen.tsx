import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useRef, useState } from 'react';

import { loadEventTypes } from '@/features/owner/usecases/owner';
import type { OwnerMeetingsStackParamList } from '@/navigation/OwnerMeetingsStackParamList';

import { initialEventTypesState, loaded, refreshed, type EventTypesState } from './EventTypesState';
import { EventTypesView } from './EventTypesView';

type Props = NativeStackScreenProps<OwnerMeetingsStackParamList, 'EventTypes'>;

/**
 * Контейнер экрана `owner.event-types` (спека 06).
 *
 * Конвенция жизненного цикла — та же, что у `guest.slots` (`GuestSlotsScreen`, ADR/UX rule обоих
 * экранов не описывают триггер грамматикой): первый фокус показывает `loading` и грузит список,
 * каждый следующий (в т.ч. возврат из «Создать тип события» после успешного `submitEventType`)
 * диспатчит фоновый refresh без повторного `loading`; неудачный refresh список не портит.
 * `retry` (кнопка «Повторить» состояния `error`) — та же операция `loadEventTypes`, что и
 * первый показ (`onPress="loadEventTypes"` спеки), поэтому отдельного action для неё нет.
 */
export function EventTypesScreen({ navigation }: Props) {
  const [state, setState] = useState<EventTypesState>(initialEventTypesState);
  const focusedBefore = useRef(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      if (focusedBefore.current) {
        void loadEventTypes().then((result) => {
          if (!cancelled) {
            setState((current) => refreshed(current, result));
          }
        });
      } else {
        focusedBefore.current = true;
        setState(initialEventTypesState);
        void loadEventTypes().then((result) => {
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
    setState(initialEventTypesState);
    void loadEventTypes().then((result) => {
      setState(loaded(result));
    });
  }, []);

  const goBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const create = useCallback(() => {
    navigation.navigate('CreateEventType');
  }, [navigation]);

  return <EventTypesView state={state} onGoBack={goBack} onCreate={create} onRetry={retry} />;
}

export default EventTypesScreen;
