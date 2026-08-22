import { act, fireEvent, render, screen } from '@testing-library/react-native';

import type { AppError } from '@/api/errors';
import type { SlotView } from '@/features/guest/model/types';
import { GuestSlotsScreen } from '@/features/guest/screens/GuestSlotsScreen';
import { slotColumns } from '@/features/guest/screens/GuestSlotsView';
import { loadPublicSlots } from '@/features/guest/usecases/guest';

/**
 * `useFocusEffect` подменён регистратором: колбэк не запускается сам, его вызывает тест.
 * Так проверяется именно конвенция «фокус», а не «монтирование» — до первого фокуса
 * контейнер не должен слать ни одного запроса.
 */
const mockUseFocusEffect = jest.fn<void, [() => void | (() => void)]>();
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (callback: () => void | (() => void)) => mockUseFocusEffect(callback),
}));

jest.mock('@/features/guest/usecases/guest', () => ({
  loadPublicSlots: jest.fn(),
}));

// Зона гостя фиксируется: подписи дат и времени не должны зависеть от TZ машины прогона.
jest.mock('@/shared/datetime', () => ({
  ...jest.requireActual('@/shared/datetime'),
  guestTimeZone: () => 'Europe/Prague',
}));

const loadPublicSlotsMock = loadPublicSlots as jest.MockedFunction<typeof loadPublicSlots>;

const HIDDEN = { includeHiddenElements: true } as const;

function slot(startAtUtc: string, endAtUtc: string): SlotView {
  return { startAtUtc, endAtUtc, eventTypeId: 'consultation' };
}

/** Europe/Prague, лето: 07:00Z → 09:00, 07:30Z → 09:30. */
const NINE = slot('2026-07-31T07:00:00Z', '2026-07-31T07:30:00Z');
const NINE_THIRTY = slot('2026-07-31T07:30:00Z', '2026-07-31T08:00:00Z');
const NEXT_DAY = slot('2026-08-01T07:00:00Z', '2026-08-01T07:30:00Z');

function ok(slots: SlotView[]) {
  return Promise.resolve({ ok: true as const, data: slots });
}

function failure(error: Partial<AppError>) {
  return Promise.resolve({
    ok: false as const,
    error: { code: null, message: null, transport: false, ...error },
  });
}

type NavigationMock = {
  push: jest.Mock;
  navigate: jest.Mock;
  goBack: jest.Mock;
  reset: jest.Mock;
};

async function renderScreen(): Promise<NavigationMock> {
  const navigation: NavigationMock = {
    push: jest.fn(),
    navigate: jest.fn(),
    goBack: jest.fn(),
    reset: jest.fn(),
  };

  await render(
    <GuestSlotsScreen
      navigation={navigation as never}
      route={
        {
          key: 'GuestSlots-1',
          name: 'GuestSlots',
          params: {
            eventTypeId: 'consultation',
            eventTypeName: 'Консультация',
            durationMinutes: 30,
            eventTypeDescription: 'Знакомство и ответы на вопросы',
          },
        } as never
      }
    />,
  );

  return navigation;
}

/** Симулирует фокус экрана: запускает последний зарегистрированный колбэк `useFocusEffect`. */
async function focusScreen(): Promise<void> {
  const calls = mockUseFocusEffect.mock.calls;
  const callback = calls[calls.length - 1][0];
  await act(async () => {
    callback();
  });
}

beforeEach(() => {
  mockUseFocusEffect.mockClear();
  loadPublicSlotsMock.mockReset();
});

describe('GuestSlotsScreen — загрузка и фокус', () => {
  it('до фокуса запросов не шлёт и показывает loading', async () => {
    loadPublicSlotsMock.mockReturnValue(ok([NINE]));
    await renderScreen();

    expect(mockUseFocusEffect).toHaveBeenCalled();
    expect(loadPublicSlotsMock).not.toHaveBeenCalled();
    expect(screen.getByTestId('skeleton-date-strip', HIDDEN)).toBeTruthy();
  });

  it('первый фокус грузит слоты и открывает выбор даты', async () => {
    loadPublicSlotsMock.mockReturnValue(ok([NINE_THIRTY, NINE, NEXT_DAY]));
    await renderScreen();
    await focusScreen();

    expect(loadPublicSlotsMock).toHaveBeenCalledWith('consultation');
    expect(screen.getByText('Пятница, 31 июля')).toBeTruthy();
    expect(screen.getByTestId('date-chip-2026-07-31').props.accessibilityState.selected).toBe(true);
    expect(screen.getByTestId('date-chip-2026-08-01').props.accessibilityState.selected).toBe(false);
    // Сетка показывает слоты выбранной даты хронологически.
    expect(screen.getByLabelText('Выбрать время 09:00')).toBeTruthy();
    expect(screen.getByLabelText('Выбрать время 09:30')).toBeTruthy();
    // Без выбранного слота CTA недоступна.
    expect(screen.getByTestId('slots-continue').props.accessibilityState.disabled).toBe(true);
  });

  it('второй фокус диспатчит refresh, а не повторную загрузку', async () => {
    loadPublicSlotsMock.mockReturnValue(ok([NINE, NINE_THIRTY]));
    await renderScreen();
    await focusScreen();
    await focusScreen();

    expect(loadPublicSlotsMock).toHaveBeenCalledTimes(2);
    // Refresh не возвращает экран в loading: контент остаётся на месте.
    expect(screen.queryByTestId('skeleton-date-strip', HIDDEN)).toBeNull();
    expect(screen.getByLabelText('Выбрать время 09:00')).toBeTruthy();
  });
});

describe('GuestSlotsScreen — выбор даты и слота', () => {
  it('выбор слота включает CTA и передаёт серверные start/end', async () => {
    loadPublicSlotsMock.mockReturnValue(ok([NINE, NINE_THIRTY]));
    const navigation = await renderScreen();
    await focusScreen();

    await fireEvent.press(screen.getByLabelText('Выбрать время 09:30'));

    const cta = screen.getByTestId('slots-continue');
    expect(cta.props.accessibilityState.disabled).toBe(false);

    await fireEvent.press(cta);
    expect(navigation.push).toHaveBeenCalledWith('GuestBookingForm', {
      eventTypeId: 'consultation',
      eventTypeName: 'Консультация',
      startAtUtc: NINE_THIRTY.startAtUtc,
      endAtUtc: NINE_THIRTY.endAtUtc,
    });
  });

  it('без выбранного слота «Продолжить» никуда не ведёт', async () => {
    loadPublicSlotsMock.mockReturnValue(ok([NINE]));
    const navigation = await renderScreen();
    await focusScreen();

    await fireEvent.press(screen.getByTestId('slots-continue'));
    expect(navigation.push).not.toHaveBeenCalled();
  });

  it('смена даты сбрасывает выбранный слот', async () => {
    loadPublicSlotsMock.mockReturnValue(ok([NINE, NINE_THIRTY, NEXT_DAY]));
    await renderScreen();
    await focusScreen();

    await fireEvent.press(screen.getByLabelText('Выбрать время 09:00'));
    expect(screen.getByTestId('slots-continue').props.accessibilityState.disabled).toBe(false);

    await fireEvent.press(screen.getByTestId('date-chip-2026-08-01'));

    expect(screen.getByText('Суббота, 1 августа')).toBeTruthy();
    expect(screen.getByTestId('slots-continue').props.accessibilityState.disabled).toBe(true);
    expect(screen.queryByLabelText('Выбрать время 09:30')).toBeNull();
  });
});

describe('GuestSlotsScreen — возврат на экран (refreshPublicSlots)', () => {
  it('слот заняли: алерт кадра 8, выбор снят, слоты перезагружены', async () => {
    loadPublicSlotsMock.mockReturnValueOnce(ok([NINE, NINE_THIRTY]));
    await renderScreen();
    await focusScreen();
    await fireEvent.press(screen.getByLabelText('Выбрать время 09:00'));

    loadPublicSlotsMock.mockReturnValueOnce(ok([NINE_THIRTY]));
    await focusScreen();

    expect(screen.getByTestId('inline-alert-warning')).toBeTruthy();
    expect(screen.getByText('Этот слот только что заняли')).toBeTruthy();
    expect(screen.queryByLabelText('Выбрать время 09:00')).toBeNull();
    expect(screen.getByLabelText('Выбрать время 09:30').props.accessibilityState.selected).toBe(
      false,
    );
    expect(screen.getByTestId('slots-continue').props.accessibilityState.disabled).toBe(true);
  });

  it('пустой набор на возврате ведёт в empty, а не в slotUnavailable', async () => {
    loadPublicSlotsMock.mockReturnValueOnce(ok([NINE]));
    await renderScreen();
    await focusScreen();
    await fireEvent.press(screen.getByLabelText('Выбрать время 09:00'));

    loadPublicSlotsMock.mockReturnValueOnce(ok([]));
    await focusScreen();

    expect(screen.getByText('Нет свободного времени')).toBeTruthy();
    expect(screen.queryByTestId('inline-alert-warning')).toBeNull();
  });

  it('выбранный слот на месте — состояние сохраняется', async () => {
    loadPublicSlotsMock.mockReturnValue(ok([NINE, NINE_THIRTY]));
    await renderScreen();
    await focusScreen();
    await fireEvent.press(screen.getByLabelText('Выбрать время 09:00'));

    await focusScreen();

    expect(screen.queryByTestId('inline-alert-warning')).toBeNull();
    expect(screen.getByLabelText('Выбрать время 09:00').props.accessibilityState.selected).toBe(
      true,
    );
    expect(screen.getByTestId('slots-continue').props.accessibilityState.disabled).toBe(false);
  });

  it('неудачный фоновый refresh состояние не меняет', async () => {
    loadPublicSlotsMock.mockReturnValueOnce(ok([NINE, NINE_THIRTY]));
    await renderScreen();
    await focusScreen();
    await fireEvent.press(screen.getByLabelText('Выбрать время 09:30'));

    loadPublicSlotsMock.mockReturnValueOnce(failure({ transport: true }));
    await focusScreen();

    expect(screen.getByLabelText('Выбрать время 09:30').props.accessibilityState.selected).toBe(
      true,
    );
    expect(screen.queryByText('Не удалось загрузить свободное время')).toBeNull();
    expect(screen.getByTestId('slots-continue').props.accessibilityState.disabled).toBe(false);
  });
});

describe('slotColumns — правило раскладки сетки', () => {
  it('на узком экране не меньше двух колонок', () => {
    expect(slotColumns(320)).toBe(2);
    expect(slotColumns(360)).toBe(2);
  });

  it('на широком окне добавляет колонки по минимальной ширине элемента', () => {
    expect(slotColumns(768)).toBeGreaterThan(2);
    // Контент шире 760 dp не растёт, поэтому и колонок больше не становится.
    expect(slotColumns(1440)).toBe(slotColumns(760));
  });
});

describe('GuestSlotsScreen — терминальные состояния', () => {
  it('пустой набор при загрузке — состояние empty с переходом в каталог', async () => {
    loadPublicSlotsMock.mockReturnValue(ok([]));
    const navigation = await renderScreen();
    await focusScreen();

    expect(screen.getByText('Нет свободного времени')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Посмотреть другие встречи'));
    expect(navigation.reset).toHaveBeenCalledWith({
      index: 0,
      routes: [{ name: 'GuestEventTypes' }],
    });
  });

  it.each(['EVENT_TYPE_NOT_FOUND', 'CALENDAR_NOT_CONFIGURED'])(
    'код %s уводит в unavailable',
    async (code) => {
      loadPublicSlotsMock.mockReturnValue(failure({ code, message: 'server text' }));
      await renderScreen();
      await focusScreen();

      expect(screen.getByText('Эта встреча недоступна')).toBeTruthy();
      // Гостю показывается текст маппера, а не сырое сообщение сервера.
      expect(screen.queryByText('server text')).toBeNull();
      expect(screen.getByTestId('slots-unavailable-message')).toBeTruthy();
    },
  );

  it('транспортная ошибка — состояние error, «Повторить» перезапускает загрузку', async () => {
    loadPublicSlotsMock.mockReturnValueOnce(failure({ transport: true }));
    await renderScreen();
    await focusScreen();

    expect(screen.getByText('Не удалось загрузить свободное время')).toBeTruthy();
    expect(screen.getByTestId('slots-error-message')).toHaveTextContent(
      'Нет связи с сервером. Проверьте подключение и попробуйте ещё раз.',
    );

    loadPublicSlotsMock.mockReturnValueOnce(ok([NINE]));
    await act(async () => {
      await fireEvent.press(screen.getByLabelText('Повторить'));
    });

    expect(loadPublicSlotsMock).toHaveBeenCalledTimes(2);
    expect(screen.getByLabelText('Выбрать время 09:00')).toBeTruthy();
  });

  it('back в шапке возвращает назад', async () => {
    loadPublicSlotsMock.mockReturnValue(ok([NINE]));
    const navigation = await renderScreen();
    await focusScreen();

    await fireEvent.press(screen.getByTestId('app-header-back'));
    expect(navigation.goBack).toHaveBeenCalledTimes(1);
  });
});
