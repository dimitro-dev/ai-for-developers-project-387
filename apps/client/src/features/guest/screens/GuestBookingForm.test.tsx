import { StackActions } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { Booking } from '@minical/api-client';

import type { AppError } from '@/api/errors';
import { GuestBookingFormScreen } from '@/features/guest/screens/GuestBookingFormScreen';
import { GuestFlowProvider } from '@/features/guest/state/GuestFlowProvider';
import { createBooking } from '@/features/guest/usecases/guest';
import type { UseCaseResult } from '@/features/guest/usecases/result';
import type { BookingView } from '@/features/guest/model/types';
import type { GuestStackParamList } from '@/navigation/GuestStackParamList';
import { formattedSlot, guestTimeZone } from '@/shared/datetime';

/** Иллюстрация кадра 9 декоративна и скрыта от screen reader — в запросы входит только явно. */
const HIDDEN = { includeHiddenElements: true } as const;

// Мокается только слой use-cases: экран проверяется целиком, сеть — нет.
jest.mock('@/features/guest/usecases/guest', () => ({ createBooking: jest.fn() }));

// Детерминированный ключ идемпотентности вместо криптографии платформы.
const mockNewBookingKey = jest.fn<string, []>();
jest.mock('@/features/guest/lib/newBookingKey', () => ({
  newBookingKey: () => mockNewBookingKey(),
}));

const mockCreateBooking = createBooking as jest.MockedFunction<typeof createBooking>;

type Props = NativeStackScreenProps<GuestStackParamList, 'GuestBookingForm'>;

const params: GuestStackParamList['GuestBookingForm'] = {
  eventTypeId: 'consultation',
  eventTypeName: 'Консультация',
  startAtUtc: '2026-07-31T08:00:00Z',
  endAtUtc: '2026-07-31T08:30:00Z',
};

const bookingView: BookingView = {
  id: 'booking-1',
  eventTypeId: 'consultation',
  eventTypeName: 'Консультация',
  startAtUtc: '2026-07-31T08:00:00Z',
  endAtUtc: '2026-07-31T08:30:00Z',
  guestName: 'Anna Novak',
  guestEmail: 'anna@example.com',
  guestNote: null,
  createdAtUtc: '2026-07-30T10:00:00Z',
};

function appError(overrides: Partial<AppError>): AppError {
  return { code: null, message: null, transport: false, ...overrides };
}

function ok(): UseCaseResult<BookingView> {
  return { ok: true, data: bookingView };
}

function failed(error: AppError): UseCaseResult<BookingView> {
  return { ok: false, error };
}

async function renderScreen() {
  const navigation = {
    goBack: jest.fn(),
    dispatch: jest.fn(),
    reset: jest.fn(),
    navigate: jest.fn(),
  };

  await render(
    <GuestFlowProvider>
      <GuestBookingFormScreen
        navigation={navigation as unknown as Props['navigation']}
        route={{ key: 'form', name: 'GuestBookingForm', params } as Props['route']}
      />
    </GuestFlowProvider>,
  );

  return { navigation };
}

/**
 * Нажатие, после которого разрешается промис use-case: продолжение `submit()` попадает
 * на микротаск уже после `fireEvent`, поэтому его надо провести внутри `act`.
 */
async function pressAndSettle(element: Parameters<typeof fireEvent.press>[0]) {
  await act(async () => {
    await fireEvent.press(element);
  });
}

/** Заполнение формы валидными данными — путь кадра 6. */
async function fillForm() {
  await fireEvent.changeText(screen.getByTestId('guest-name'), 'Anna Novak');
  await fireEvent.changeText(screen.getByTestId('guest-email'), 'anna@example.com');
}

beforeEach(() => {
  mockCreateBooking.mockReset();
  mockNewBookingKey.mockReset();
  mockNewBookingKey.mockReturnValue('uuid-1');
});

describe('GuestBookingFormScreen — состояние editing', () => {
  it('показывает сводку слота, поля и активную CTA', async () => {
    await renderScreen();

    expect(screen.getByTestId('booking-summary-card')).toBeTruthy();
    // Подпись слота — в timezone устройства гостя, поэтому эталон считается тем же helper'ом.
    expect(
      screen.getByText(formattedSlot(params.startAtUtc, params.endAtUtc, guestTimeZone())),
    ).toBeTruthy();
    expect(screen.getByTestId('guest-name')).toBeTruthy();
    expect(screen.getByTestId('guest-email')).toBeTruthy();
    expect(screen.getByTestId('guest-note')).toBeTruthy();

    // CTA активна при пустых полях (AC3): блокируется только во время отправки.
    expect(screen.getByTestId('submit-booking').props.accessibilityState.disabled).toBe(false);
  });

  it('выдаёт ключ идемпотентности при монтировании, до первой отправки', async () => {
    await renderScreen();

    expect(mockNewBookingKey).toHaveBeenCalledTimes(1);
    expect(mockCreateBooking).not.toHaveBeenCalled();
  });
});

describe('GuestBookingFormScreen — состояние validationError', () => {
  it('подсказки появляются после submit, запрос не уходит, CTA остаётся активной', async () => {
    await renderScreen();

    await pressAndSettle(screen.getByTestId('submit-booking'));

    expect(screen.getByText('Введите имя')).toBeTruthy();
    expect(screen.getByText('Введите email')).toBeTruthy();
    expect(mockCreateBooking).not.toHaveBeenCalled();
    expect(screen.getByTestId('submit-booking').props.accessibilityState.disabled).toBe(false);
  });

  it('ошибка формата email относится к своему полю', async () => {
    await renderScreen();

    await fireEvent.changeText(screen.getByTestId('guest-name'), 'Anna');
    await fireEvent.changeText(screen.getByTestId('guest-email'), 'anna@');
    await pressAndSettle(screen.getByTestId('submit-booking'));

    expect(screen.getByText('Введите корректный email')).toBeTruthy();
    expect(screen.getByTestId('guest-email').props.accessibilityHint).toBe(
      'Введите корректный email',
    );
  });
});

describe('GuestBookingFormScreen — состояние submitting', () => {
  it('во время отправки CTA заблокирована и меняет подпись', async () => {
    let resolveCall: (value: UseCaseResult<BookingView>) => void = () => {};
    mockCreateBooking.mockReturnValue(
      new Promise<UseCaseResult<BookingView>>((resolve) => {
        resolveCall = resolve;
      }),
    );

    await renderScreen();
    await fillForm();
    await pressAndSettle(screen.getByTestId('submit-booking'));

    await waitFor(() => expect(screen.getByText('Создаём встречу...')).toBeTruthy());
    expect(screen.getByTestId('submit-booking').props.accessibilityState.disabled).toBe(true);

    // Промис разрешается внутри act: иначе финальный переход экрана уедет за пределы теста.
    await act(async () => {
      resolveCall(ok());
    });
  });
});

describe('GuestBookingFormScreen — успех', () => {
  it('шлёт плоский CreateBookingRequest с ключом монтирования и без endAtUtc', async () => {
    mockCreateBooking.mockResolvedValue(ok());

    await renderScreen();
    await fillForm();
    await fireEvent.changeText(screen.getByTestId('guest-note'), 'Обсудить детали');
    await pressAndSettle(screen.getByTestId('submit-booking'));

    await waitFor(() => expect(mockCreateBooking).toHaveBeenCalledTimes(1));
    expect(mockCreateBooking).toHaveBeenCalledWith({
      eventTypeId: 'consultation',
      startAtUtc: '2026-07-31T08:00:00Z',
      id: 'uuid-1',
      guest: { name: 'Anna Novak', email: 'anna@example.com', note: 'Обсудить детали' },
    });
  });

  it('пустой комментарий в нагрузку не попадает', async () => {
    mockCreateBooking.mockResolvedValue(ok());

    await renderScreen();
    await fillForm();
    await pressAndSettle(screen.getByTestId('submit-booking'));

    await waitFor(() => expect(mockCreateBooking).toHaveBeenCalledTimes(1));
    expect(mockCreateBooking.mock.calls[0][0].guest).toEqual({
      name: 'Anna Novak',
      email: 'anna@example.com',
    });
  });

  // FR4.4/AC4: «назад» после подтверждения не должно возвращать в форму созданной брони.
  it('входит на подтверждение reset-ом стека с бронью из ответа', async () => {
    mockCreateBooking.mockResolvedValue(ok());

    const { navigation } = await renderScreen();
    await fillForm();
    await pressAndSettle(screen.getByTestId('submit-booking'));

    await waitFor(() => expect(navigation.reset).toHaveBeenCalledTimes(1));
    const expectedBooking: Booking = {
      id: 'booking-1',
      eventTypeId: 'consultation',
      eventTypeName: 'Консультация',
      startAtUtc: '2026-07-31T08:00:00Z',
      endAtUtc: '2026-07-31T08:30:00Z',
      guestName: 'Anna Novak',
      guestEmail: 'anna@example.com',
      createdAtUtc: '2026-07-30T10:00:00Z',
    };
    expect(navigation.reset).toHaveBeenCalledWith({
      index: 0,
      routes: [{ name: 'GuestBookingConfirmation', params: { booking: expectedBooking } }],
    });
    expect(navigation.navigate).not.toHaveBeenCalled();
  });
});

describe('GuestBookingFormScreen — состояние serverValidationError', () => {
  it('показывает текст маппера, а не сырой message сервера', async () => {
    mockCreateBooking.mockResolvedValue(
      failed(appError({ code: 'VALIDATION_ERROR', message: 'guest.email must be an email' })),
    );

    await renderScreen();
    await fillForm();
    await pressAndSettle(screen.getByTestId('submit-booking'));

    await waitFor(() => expect(screen.getByTestId('inline-alert-error')).toBeTruthy());
    expect(screen.getByText('Проверьте введённые данные и попробуйте ещё раз.')).toBeTruthy();
    expect(screen.queryByText('guest.email must be an email')).toBeNull();
    // Форма остаётся на экране: 400 брони не создаёт, править данные безопасно.
    expect(screen.getByTestId('guest-email')).toBeTruthy();
  });
});

describe('GuestBookingFormScreen — конфликт слота', () => {
  it.each(['SLOT_UNAVAILABLE', 'SLOT_OUTSIDE_WINDOW', 'SLOT_NOT_ALIGNED'])(
    '%s возвращает на существующий экран слотов',
    async (code) => {
      mockCreateBooking.mockResolvedValue(failed(appError({ code })));

      const { navigation } = await renderScreen();
      await fillForm();
      await pressAndSettle(screen.getByTestId('submit-booking'));

      // Возврат на существующий экран стека: ни второго push, ни reset.
      // `merge: true` без параметров сохраняет параметры экрана слотов — без него
      // POP_TO перезаписал бы их (см. StackRouter, ветка 'POP_TO').
      await waitFor(() => expect(navigation.dispatch).toHaveBeenCalledTimes(1));
      expect(navigation.dispatch).toHaveBeenCalledWith(
        StackActions.popTo('GuestSlots', undefined, { merge: true }),
      );
      expect(navigation.navigate).not.toHaveBeenCalled();
      expect(navigation.reset).not.toHaveBeenCalled();
      expect(navigation.goBack).not.toHaveBeenCalled();
    },
  );
});

describe('GuestBookingFormScreen — состояние networkError', () => {
  it('показывает экран кадра 9 вместо формы', async () => {
    mockCreateBooking.mockResolvedValue(failed(appError({ transport: true })));

    await renderScreen();
    await fillForm();
    await pressAndSettle(screen.getByTestId('submit-booking'));

    await waitFor(() => expect(screen.getByText('Не удалось создать встречу')).toBeTruthy());
    expect(screen.getByText('Проверьте подключение. Ваши данные сохранены.')).toBeTruthy();
    expect(screen.getByTestId('asset-network-error', HIDDEN)).toBeTruthy();
    expect(screen.queryByTestId('guest-name')).toBeNull();
  });

  // AC3 и кадр 9: повтор уходит с тем же ключом и той же нагрузкой — сервер отдаёт уже
  // созданную бронь вместо второй.
  it('«Повторить» шлёт тот же ключ и ту же нагрузку', async () => {
    mockCreateBooking.mockResolvedValueOnce(failed(appError({ transport: true })));
    mockCreateBooking.mockResolvedValueOnce(ok());

    const { navigation } = await renderScreen();
    await fillForm();
    await fireEvent.changeText(screen.getByTestId('guest-note'), 'Обсудить детали');
    await pressAndSettle(screen.getByTestId('submit-booking'));

    await waitFor(() => expect(screen.getByTestId('retry-booking')).toBeTruthy());
    await pressAndSettle(screen.getByTestId('retry-booking'));

    await waitFor(() => expect(mockCreateBooking).toHaveBeenCalledTimes(2));
    expect(mockCreateBooking.mock.calls[1][0]).toEqual(mockCreateBooking.mock.calls[0][0]);
    expect(mockCreateBooking.mock.calls[1][0].id).toBe('uuid-1');
    // Ключ не перевыдавался: форма не размонтировалась.
    expect(mockNewBookingKey).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(navigation.reset).toHaveBeenCalledTimes(1));
  });

  it('«Выбрать другое время» возвращает к слотам', async () => {
    mockCreateBooking.mockResolvedValue(failed(appError({ transport: true })));

    const { navigation } = await renderScreen();
    await fillForm();
    await pressAndSettle(screen.getByTestId('submit-booking'));

    await waitFor(() => expect(screen.getByText('Выбрать другое время')).toBeTruthy());
    await fireEvent.press(screen.getByText('Выбрать другое время'));

    expect(navigation.goBack).toHaveBeenCalledTimes(1);
  });
});
