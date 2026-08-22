import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useMemo, useReducer, useRef } from 'react';

import type { SlotView } from '@/features/guest/model/types';
import { loadPublicSlots } from '@/features/guest/usecases/guest';
import type { GuestStackParamList } from '@/navigation/GuestStackParamList';
import { guestTimeZone } from '@/shared/datetime';

import { contentOf, guestSlotsReducer, initialGuestSlotsState } from './GuestSlotsState';
import { GuestSlotsView } from './GuestSlotsView';

type Props = NativeStackScreenProps<GuestStackParamList, 'GuestSlots'>;

/**
 * Контейнер экрана `guest.slots`.
 *
 * Конвенция жизненного цикла (ADR §3, UX rules спеки 13): первый фокус — он же монтирование —
 * диспатчит `loadPublicSlots`, каждый следующий (возврат на экран, в том числе из формы по
 * конфликту слота) — `refreshPublicSlots`. Грамматика UISpec триггеров жизненного цикла не
 * описывает, поэтому это правило контейнера, а не атрибут спеки.
 *
 * Обе операции — один binding `getPublicSlots`, поэтому use-case тоже один; различается только
 * то, как результат ложится в StateMachine.
 */
export function GuestSlotsScreen({ navigation, route }: Props) {
  const { eventTypeId, eventTypeName, durationMinutes, eventTypeDescription } = route.params;
  // Зона гостя фиксируется на монтирование и дальше идёт вниз явным параметром.
  const timeZone = useMemo(() => guestTimeZone(), []);
  const [state, dispatch] = useReducer(guestSlotsReducer, initialGuestSlotsState);
  const focusedBefore = useRef(false);

  const load = useCallback(() => {
    let cancelled = false;
    dispatch({ type: 'load/started' });

    void loadPublicSlots(eventTypeId).then((result) => {
      if (cancelled) {
        return;
      }
      dispatch(
        result.ok
          ? { type: 'load/succeeded', slots: result.data, timeZone }
          : { type: 'load/failed', error: result.error },
      );
    });

    return () => {
      cancelled = true;
    };
  }, [eventTypeId, timeZone]);

  const refresh = useCallback(() => {
    let cancelled = false;

    void loadPublicSlots(eventTypeId).then((result) => {
      if (cancelled) {
        return;
      }
      // Неудачный фоновый refresh состояние не меняет: гость остаётся с показанными слотами.
      dispatch(
        result.ok
          ? { type: 'refresh/succeeded', slots: result.data, timeZone }
          : { type: 'refresh/failed' },
      );
    });

    return () => {
      cancelled = true;
    };
  }, [eventTypeId, timeZone]);

  useFocusEffect(
    useCallback(() => {
      if (focusedBefore.current) {
        return refresh();
      }
      focusedBefore.current = true;
      return load();
    }, [load, refresh]),
  );

  const onSelectDate = useCallback((date: string) => {
    dispatch({ type: 'selectDate', date });
  }, []);

  const onSelectSlot = useCallback((slot: SlotView) => {
    dispatch({ type: 'selectSlot', slot });
  }, []);

  const onContinue = useCallback(() => {
    const selected = contentOf(state)?.selectedSlot ?? null;
    if (selected === null) {
      return;
    }
    // В форму уходят серверные `startAtUtc`/`endAtUtc` выбранного слота: конец встречи
    // считает сервер, клиент его не вычисляет.
    navigation.push('GuestBookingForm', {
      eventTypeId,
      eventTypeName,
      startAtUtc: selected.startAtUtc,
      endAtUtc: selected.endAtUtc,
    });
  }, [state, navigation, eventTypeId, eventTypeName]);

  const onOpenCatalog = useCallback(() => {
    // `navigation.reset`, а не push: экран может быть точкой входа по web-deep-link,
    // и «назад» после сброса не должен вести в чужую историю.
    navigation.reset({ index: 0, routes: [{ name: 'GuestEventTypes' }] });
  }, [navigation]);

  const onBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const onRetry = useCallback(() => {
    load();
  }, [load]);

  return (
    <GuestSlotsView
      state={state}
      eventTypeName={eventTypeName}
      durationMinutes={durationMinutes}
      {...(eventTypeDescription === undefined ? {} : { eventTypeDescription })}
      timeZone={timeZone}
      onBack={onBack}
      onSelectDate={onSelectDate}
      onSelectSlot={onSelectSlot}
      onContinue={onContinue}
      onOpenCatalog={onOpenCatalog}
      onRetry={onRetry}
    />
  );
}

export default GuestSlotsScreen;
