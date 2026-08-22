import type { Booking } from '@minical/api-client';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { GuestBookingConfirmationScreen } from '@/features/guest/screens/GuestBookingConfirmationScreen';
import { MISSING_BOOKING_MESSAGE } from '@/features/guest/screens/GuestBookingConfirmationState';
import type { GuestStackParamList } from '@/navigation/GuestStackParamList';

// Timezone гостя фиксируется: подписи дат не должны зависеть от TZ машины прогона (ADR §8).
const PRAGUE = 'Europe/Prague';
jest.mock('@/shared/datetime', () => ({
  ...jest.requireActual('@/shared/datetime'),
  guestTimeZone: () => PRAGUE,
}));

type Props = NativeStackScreenProps<GuestStackParamList, 'GuestBookingConfirmation'>;

const booking: Booking = {
  id: '2f1a1f1e-0a5f-4a7e-9a5a-3d1f5c9b6d21',
  eventTypeId: 'consultation',
  eventTypeName: 'Консультация',
  startAtUtc: '2026-07-31T08:00:00Z',
  endAtUtc: '2026-07-31T08:30:00Z',
  guestName: 'Anna Novak',
  guestEmail: 'anna@example.com',
  guestNote: 'Буду рад обсудить детали.',
  createdAtUtc: '2026-07-30T12:00:00Z',
};

function renderScreen(params: unknown) {
  const reset = jest.fn();
  const props = {
    navigation: { reset },
    route: { key: 'GuestBookingConfirmation-1', name: 'GuestBookingConfirmation', params },
  } as unknown as Props;

  return { props, reset };
}

describe('GuestBookingConfirmationScreen — content', () => {
  it('показывает шесть строк кадра 7 из полей ответа сервера', async () => {
    const { props } = renderScreen({ booking });
    await render(<GuestBookingConfirmationScreen {...props} />);

    expect(screen.getByText('Встреча запланирована')).toBeTruthy();
    // eventTypeName — из брони, а не из навигации; endAtUtc не вычисляется.
    expect(screen.getByText('Консультация')).toBeTruthy();
    expect(screen.getByText('31 июля 2026')).toBeTruthy();
    expect(screen.getByText('10:00 – 10:30')).toBeTruthy();
    expect(screen.getByText(`${PRAGUE} · UTC+02:00`)).toBeTruthy();
    expect(screen.getByText('Anna Novak')).toBeTruthy();
    expect(screen.getByText('anna@example.com')).toBeTruthy();
    expect(screen.getByText('Можно закрыть эту страницу.')).toBeTruthy();
  });

  it('«К другим встречам» сбрасывает стек на каталог', async () => {
    const { props, reset } = renderScreen({ booking });
    await render(<GuestBookingConfirmationScreen {...props} />);

    await fireEvent.press(screen.getByLabelText('К другим встречам'));

    expect(reset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'GuestEventTypes' }] });
  });

  // FR4.4: после подтверждения «назад» не должно возвращать в форму созданной брони —
  // на экране нет ни шапки, ни кнопки «назад», а переход к каталогу выполняется reset'ом.
  it('не содержит кнопки «назад»', async () => {
    const { props } = renderScreen({ booking });
    await render(<GuestBookingConfirmationScreen {...props} />);

    expect(screen.queryByLabelText('Назад')).toBeNull();
    expect(screen.queryByTestId('app-header-back')).toBeNull();
  });
});

describe('GuestBookingConfirmationScreen — error', () => {
  it('без параметра booking показывает состояние error', async () => {
    const { props } = renderScreen(undefined);
    await render(<GuestBookingConfirmationScreen {...props} />);

    expect(screen.getByText('Не удалось показать подтверждение')).toBeTruthy();
    expect(screen.getByTestId('confirmation-error-message')).toHaveTextContent(
      MISSING_BOOKING_MESSAGE,
    );
    expect(screen.queryByText('Встреча запланирована')).toBeNull();
  });

  // Восстановление стека может вернуть параметр без обязательных полей брони.
  it('неполная бронь в параметрах — тоже error', async () => {
    const { props } = renderScreen({ booking: { eventTypeName: 'Консультация' } });
    await render(<GuestBookingConfirmationScreen {...props} />);

    expect(screen.getByText('Не удалось показать подтверждение')).toBeTruthy();
  });

  it('возврат к каталогу доступен и из состояния error', async () => {
    const { props, reset } = renderScreen(undefined);
    await render(<GuestBookingConfirmationScreen {...props} />);

    await fireEvent.press(screen.getByLabelText('К другим встречам'));

    expect(reset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'GuestEventTypes' }] });
  });
});
