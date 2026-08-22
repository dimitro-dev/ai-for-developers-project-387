import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useMemo } from 'react';

import type { GuestStackParamList } from '@/navigation/GuestStackParamList';
import { guestTimeZone } from '@/shared/datetime';

import { confirmationStateFrom } from './GuestBookingConfirmationState';
import { GuestBookingConfirmationView } from './GuestBookingConfirmationView';

type Props = NativeStackScreenProps<GuestStackParamList, 'GuestBookingConfirmation'>;

/**
 * Контейнер экрана `guest.booking-confirmation`. Данных не запрашивает: всё показанное —
 * поля ответа `createPublicBooking`, пришедшие параметром route. Единственная логика —
 * guard при открытии экрана без брони (ADR §3).
 */
export function GuestBookingConfirmationScreen({ navigation, route }: Props) {
  const state = useMemo(() => confirmationStateFrom(route.params), [route.params]);
  const timeZone = useMemo(() => guestTimeZone(), []);

  // `navigation.reset`, а не push: иначе системное «назад» вернуло бы гостя в форму уже
  // созданной брони и предложило отправить её снова (FR4.4).
  const backToCatalog = useCallback(() => {
    navigation.reset({ index: 0, routes: [{ name: 'GuestEventTypes' }] });
  }, [navigation]);

  return (
    <GuestBookingConfirmationView
      state={state}
      timeZone={timeZone}
      onBackToCatalog={backToCatalog}
    />
  );
}

export default GuestBookingConfirmationScreen;
