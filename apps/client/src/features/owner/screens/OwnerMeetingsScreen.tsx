import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useReducer, useRef } from 'react';
import { Share } from 'react-native';

import type { BookingView } from '@/features/owner/model/types';
import { loadOwnerSettings, loadUpcomingBookings } from '@/features/owner/usecases/owner';
import type { OwnerMeetingsStackParamList } from '@/navigation/OwnerMeetingsStackParamList';

import { initialOwnerMeetingsState, ownerMeetingsReducer } from './OwnerMeetingsState';
import { OwnerMeetingsView } from './OwnerMeetingsView';

type Props = NativeStackScreenProps<OwnerMeetingsStackParamList, 'OwnerMeetings'>;

/**
 * Контейнер экрана `owner.upcoming-meetings` (05).
 *
 * Жизненный цикл повторяет конвенцию `GuestSlotsScreen` (ADR §3, тот же приём): первый фокус
 * грузит данные, каждый следующий — фоновый refresh с `preserveContent`. `load` — единственное
 * место, где выполняются оба биндинга экрана параллельно (`loadUpcomingMeetings` +
 * `loadMeetingsSettings`, UX rules спеки); `refresh` (и pull-to-refresh, и повторный фокус)
 * повторяет только `refreshUpcomingMeetings` — `timezone`/`publicUrl` не перезапрашиваются.
 */
export function OwnerMeetingsScreen({ navigation }: Props) {
  const [state, dispatch] = useReducer(ownerMeetingsReducer, initialOwnerMeetingsState);
  const focusedBefore = useRef(false);

  const load = useCallback(() => {
    let cancelled = false;
    dispatch({ type: 'load/started' });

    void Promise.all([loadUpcomingBookings(), loadOwnerSettings()]).then(
      ([bookingsResult, settingsResult]) => {
        if (cancelled) {
          return;
        }
        // Порядок проверки фиксирован и произволен: обе операции равнозначны, первая
        // неуспешная и определяет сообщение экрана.
        if (!bookingsResult.ok) {
          dispatch({ type: 'load/failed', error: bookingsResult.error });
          return;
        }
        if (!settingsResult.ok) {
          dispatch({ type: 'load/failed', error: settingsResult.error });
          return;
        }
        dispatch({
          type: 'load/succeeded',
          data: {
            timezone: settingsResult.data.timeZone,
            publicUrl: settingsResult.data.publicUrl,
            bookings: bookingsResult.data,
          },
        });
      },
    );

    return () => {
      cancelled = true;
    };
  }, []);

  const refresh = useCallback(() => {
    let cancelled = false;
    dispatch({ type: 'refresh/started' });

    void loadUpcomingBookings().then((result) => {
      if (cancelled) {
        return;
      }
      dispatch(
        result.ok
          ? { type: 'refresh/succeeded', bookings: result.data }
          : { type: 'refresh/failed' },
      );
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (focusedBefore.current) {
        return refresh();
      }
      focusedBefore.current = true;
      return load();
    }, [load, refresh]),
  );

  const onOpenEventTypes = useCallback(() => {
    navigation.push('EventTypes');
  }, [navigation]);

  const onOpenBooking = useCallback(({ booking }: { booking: BookingView }) => {
    dispatch({ type: 'openBooking', booking });
  }, []);

  const onCloseBooking = useCallback(() => {
    dispatch({ type: 'closeBooking' });
  }, []);

  const onShareCalendar = useCallback((url: string) => {
    // Системный share (`native.share` спеки): гость получает публичную ссылку календаря.
    void Share.share({ message: url });
  }, []);

  const onRetry = useCallback(() => {
    load();
  }, [load]);

  return (
    <OwnerMeetingsView
      state={state}
      onOpenEventTypes={onOpenEventTypes}
      onOpenBooking={onOpenBooking}
      onCloseBooking={onCloseBooking}
      onShareCalendar={onShareCalendar}
      onRefresh={refresh}
      onRetry={onRetry}
    />
  );
}

export default OwnerMeetingsScreen;
