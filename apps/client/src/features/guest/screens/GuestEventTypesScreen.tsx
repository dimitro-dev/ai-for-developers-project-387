import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';

import type { EventTypeView } from '@/features/guest/model/types';
import { loadPublicCalendar, loadPublicEventTypes } from '@/features/guest/usecases/guest';
import type { GuestStackParamList } from '@/navigation/GuestStackParamList';

import {
  catalogLoaded,
  initialGuestEventTypesState,
  type GuestEventTypesState,
} from './GuestEventTypesState';
import { GuestEventTypesView } from './GuestEventTypesView';

type Props = NativeStackScreenProps<GuestStackParamList, 'GuestEventTypes'>;

/**
 * Контейнер экрана `guest.event-types` (кадр 1) — точка входа гостевого стека.
 *
 * Конвенция контейнера (UX rule спеки, ADR §3): оба начальных `api.query` диспатчатся при
 * монтировании; грамматика UISpec триггеров жизненного цикла не описывает. Переходом состояний
 * владеет `loadPublicEventTypes`, поэтому «Повторить» ссылается на него — но контейнер
 * перезапускает пару целиком, иначе имя владельца осталось бы незагруженным.
 */
export function GuestEventTypesScreen({ navigation }: Props) {
  const [state, setState] = useState<GuestEventTypesState>(initialGuestEventTypesState);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState(initialGuestEventTypesState);

    void Promise.all([loadPublicCalendar(), loadPublicEventTypes()]).then(
      ([calendar, eventTypes]) => {
        if (!cancelled) {
          setState(catalogLoaded({ calendar, eventTypes }));
        }
      },
    );

    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const retry = useCallback(() => {
    setAttempt((value) => value + 1);
  }, []);

  const selectEventType = useCallback(
    (eventType: EventTypeView) => {
      navigation.navigate('GuestSlots', {
        eventTypeId: eventType.id,
        eventTypeName: eventType.name,
        durationMinutes: eventType.durationMinutes,
        // Необязательный параметр не передаётся вовсе, если описания нет.
        ...(eventType.description === null ? {} : { eventTypeDescription: eventType.description }),
      });
    },
    [navigation],
  );

  return (
    <GuestEventTypesView state={state} onSelectEventType={selectEventType} onRetry={retry} />
  );
}

export default GuestEventTypesScreen;
