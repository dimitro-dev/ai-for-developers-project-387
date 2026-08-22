import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import {
  guestStackInitialRoute,
  type GuestStackParamList,
} from '@/navigation/GuestStackParamList';

/**
 * AC1: параметры route типизированы, пропуск обязательного и передача лишнего ловятся
 * компилятором. Проверку выполняет `npm run typecheck -w @minical/client`: каждый
 * `@ts-expect-error` ниже обязан гаснуть об реальную ошибку типов — если типизация
 * ослабнет, tsc сообщит «Unused '@ts-expect-error' directive».
 */
declare const navigation: NativeStackNavigationProp<GuestStackParamList>;

export function routeParamsAreTyped(): void {
  navigation.navigate('GuestEventTypes');

  navigation.navigate('GuestSlots', {
    eventTypeId: 'intro-call',
    eventTypeName: 'Знакомство',
    durationMinutes: 30,
  });
  navigation.navigate('GuestSlots', {
    eventTypeId: 'intro-call',
    eventTypeName: 'Знакомство',
    durationMinutes: 30,
    eventTypeDescription: 'Короткий созвон',
  });

  // @ts-expect-error пропущен обязательный durationMinutes
  navigation.navigate('GuestSlots', { eventTypeId: 'intro-call', eventTypeName: 'Знакомство' });

  navigation.navigate('GuestSlots', {
    eventTypeId: 'intro-call',
    eventTypeName: 'Знакомство',
    durationMinutes: 30,
    // @ts-expect-error лишний параметр route
    ownerTimeZone: 'Europe/Berlin',
  });

  navigation.navigate('GuestSlots', {
    eventTypeId: 'intro-call',
    eventTypeName: 'Знакомство',
    // @ts-expect-error durationMinutes — int32, не строка
    durationMinutes: '30',
  });

  navigation.navigate('GuestBookingForm', {
    eventTypeId: 'intro-call',
    eventTypeName: 'Знакомство',
    startAtUtc: '2026-08-14T08:00:00Z',
    endAtUtc: '2026-08-14T08:30:00Z',
  });

  // @ts-expect-error пропущен endAtUtc
  navigation.navigate('GuestBookingForm', {
    eventTypeId: 'intro-call',
    eventTypeName: 'Знакомство',
    startAtUtc: '2026-08-14T08:00:00Z',
  });

  navigation.navigate('GuestBookingConfirmation', {
    booking: {
      id: '2f1a1f1e-0a5f-4a7e-9a5a-3d1f5c9b6d21',
      eventTypeId: 'intro-call',
      eventTypeName: 'Знакомство',
      startAtUtc: '2026-08-14T08:00:00Z',
      endAtUtc: '2026-08-14T08:30:00Z',
      guestName: 'Анна',
      guestEmail: 'anna@example.com',
      createdAtUtc: '2026-08-12T10:00:00Z',
    },
  });

  // @ts-expect-error у GuestEventTypes параметров нет
  navigation.navigate('GuestEventTypes', { eventTypeId: 'intro-call' });

  // @ts-expect-error route вне GuestStack
  navigation.navigate('OwnerMeetings');
}

it('начальный route гостевого стека — каталог встреч', () => {
  expect(guestStackInitialRoute).toBe('GuestEventTypes');
});
