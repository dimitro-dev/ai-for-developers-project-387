import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { Share } from 'react-native';

import type { AppError } from '@/api/errors';
import type { BookingView, OwnerSettingsView } from '@/features/owner/model/types';
import { loadOwnerSettings, loadUpcomingBookings } from '@/features/owner/usecases/owner';
import { OwnerMeetingsScreen } from '@/features/owner/screens/OwnerMeetingsScreen';

/**
 * `useFocusEffect` подменён регистратором — конвенция `GuestSlots.test.tsx`: контейнер не шлёт
 * запросов до первого фокуса, второй фокус диспатчит фоновый refresh, а не повторную загрузку.
 */
const mockUseFocusEffect = jest.fn<void, [() => void | (() => void)]>();
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (callback: () => void | (() => void)) => mockUseFocusEffect(callback),
}));

const mockLoadEventTypes = jest.fn();
jest.mock('@/features/owner/usecases/owner', () => ({
  loadUpcomingBookings: jest.fn(),
  loadOwnerSettings: jest.fn(),
  // AC5 brief: экран 05 не запрашивает словарь типов событий — usecase остаётся в моке
  // только затем, чтобы явно проверить, что он ни разу не вызван.
  loadEventTypes: (...args: unknown[]) => mockLoadEventTypes(...args),
}));

const loadUpcomingBookingsMock = loadUpcomingBookings as jest.MockedFunction<typeof loadUpcomingBookings>;
const loadOwnerSettingsMock = loadOwnerSettings as jest.MockedFunction<typeof loadOwnerSettings>;

const HIDDEN = { includeHiddenElements: true } as const;

function booking(
  id: string,
  startAt: string,
  endAt: string,
  options: { title?: string; guestName?: string; guestEmail?: string; comment?: string } = {},
): BookingView {
  return {
    id,
    eventTypeTitle: options.title ?? 'Консультация',
    startAt: startAt as BookingView['startAt'],
    endAt: endAt as BookingView['endAt'],
    guest: {
      name: options.guestName ?? 'Anna Novak',
      email: options.guestEmail ?? 'anna@example.com',
      ...(options.comment === undefined ? {} : { comment: options.comment }),
    },
  };
}

function settings(overrides: Partial<OwnerSettingsView> = {}): OwnerSettingsView {
  return {
    displayName: 'Иван Петров',
    timeZone: 'Europe/Prague',
    availabilityRules: [],
    slotIntervalMinutes: 30,
    publicUrl: 'https://minical.example/u/ivan',
    ...overrides,
  };
}

function ok<T>(data: T) {
  return Promise.resolve({ ok: true as const, data });
}

function failure(error: Partial<AppError>) {
  return Promise.resolve({
    ok: false as const,
    error: { code: null, message: null, transport: false, ...error },
  });
}

/** Europe/Prague, лето: 07:00Z → 09:00. Те же моменты, что в `GuestSlots.test.tsx`. */
const MORNING = booking('b-morning', '2026-07-31T07:00:00Z', '2026-07-31T07:30:00Z', {
  guestName: 'Guest Morning',
});
const AFTERNOON = booking('b-afternoon', '2026-07-31T09:00:00Z', '2026-07-31T09:30:00Z', {
  guestName: 'Guest Afternoon',
  comment: 'Хочу обсудить контракт заранее',
});
const NEXT_DAY = booking('b-next-day', '2026-08-01T07:00:00Z', '2026-08-01T07:30:00Z', {
  guestName: 'Guest NextDay',
});

type NavigationMock = { push: jest.Mock };

async function renderScreen(): Promise<NavigationMock> {
  const navigation: NavigationMock = { push: jest.fn() };

  await render(
    <OwnerMeetingsScreen
      navigation={navigation as never}
      route={{ key: 'OwnerMeetings-1', name: 'OwnerMeetings', params: undefined } as never}
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
  loadUpcomingBookingsMock.mockReset();
  loadOwnerSettingsMock.mockReset();
  mockLoadEventTypes.mockClear();
  jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' } as never);
});

describe('OwnerMeetingsScreen — загрузка и фокус', () => {
  it('до фокуса не шлёт запросов и показывает loading', async () => {
    loadUpcomingBookingsMock.mockReturnValue(ok([MORNING]));
    loadOwnerSettingsMock.mockReturnValue(ok(settings()));
    await renderScreen();

    expect(mockUseFocusEffect).toHaveBeenCalled();
    expect(loadUpcomingBookingsMock).not.toHaveBeenCalled();
    expect(loadOwnerSettingsMock).not.toHaveBeenCalled();
    expect(screen.getAllByTestId('skeleton-meeting-card', HIDDEN)).toHaveLength(3);
  });

  it('первый фокус грузит обе операции и группирует встречи по датам владельца', async () => {
    loadUpcomingBookingsMock.mockReturnValue(ok([AFTERNOON, MORNING, NEXT_DAY]));
    loadOwnerSettingsMock.mockReturnValue(ok(settings()));
    await renderScreen();
    await focusScreen();

    expect(loadUpcomingBookingsMock).toHaveBeenCalledTimes(1);
    expect(loadOwnerSettingsMock).toHaveBeenCalledTimes(1);

    expect(screen.getByText('Пятница, 31 июля')).toBeTruthy();
    expect(screen.getByText('Суббота, 1 августа')).toBeTruthy();

    // Внутри группы и между группами — по возрастанию startAt (Morning раньше Afternoon).
    const cards = screen.getAllByRole('button').filter((node) =>
      String(node.props.accessibilityLabel ?? '').includes('Guest'),
    );
    expect(cards.map((node) => node.props.accessibilityLabel)).toEqual([
      expect.stringContaining('Guest Morning'),
      expect.stringContaining('Guest Afternoon'),
      expect.stringContaining('Guest NextDay'),
    ]);

    // `eventTypeName` берётся из самого Booking — второго запроса типов событий нет.
    expect(mockLoadEventTypes).not.toHaveBeenCalled();
  });

  it('второй фокус диспатчит фоновый refresh, а не повторную загрузку настроек', async () => {
    loadUpcomingBookingsMock.mockReturnValue(ok([MORNING]));
    loadOwnerSettingsMock.mockReturnValue(ok(settings()));
    await renderScreen();
    await focusScreen();
    await focusScreen();

    expect(loadUpcomingBookingsMock).toHaveBeenCalledTimes(2);
    // Настройки (timezone/publicUrl) запрашиваются один раз — только при первой загрузке.
    expect(loadOwnerSettingsMock).toHaveBeenCalledTimes(1);
  });
});

describe('OwnerMeetingsScreen — refresh (preserveContent)', () => {
  it('pull-to-refresh не скрывает текущие карточки, пока запрос летит', async () => {
    loadUpcomingBookingsMock.mockReturnValueOnce(ok([MORNING]));
    loadOwnerSettingsMock.mockReturnValue(ok(settings()));
    await renderScreen();
    await focusScreen();

    expect(screen.getByText('Guest Morning')).toBeTruthy();

    let resolveRefresh: (value: { ok: true; data: BookingView[] }) => void = () => {};
    loadUpcomingBookingsMock.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveRefresh = resolve;
      }),
    );

    const scroll = screen.getByTestId('owner-meetings-scroll');
    await act(async () => {
      scroll.props.refreshControl.props.onRefresh();
    });

    // Карточка остаётся на экране, пока фоновый запрос не завершился.
    expect(screen.getByText('Guest Morning')).toBeTruthy();
    expect(screen.queryAllByTestId('skeleton-meeting-card', HIDDEN)).toHaveLength(0);

    await act(async () => {
      resolveRefresh({ ok: true, data: [MORNING, AFTERNOON] });
    });

    expect(screen.getByText('Guest Afternoon')).toBeTruthy();
  });

  it('неудачный refresh состояние не меняет', async () => {
    loadUpcomingBookingsMock.mockReturnValueOnce(ok([MORNING]));
    loadOwnerSettingsMock.mockReturnValue(ok(settings()));
    await renderScreen();
    await focusScreen();

    loadUpcomingBookingsMock.mockReturnValueOnce(failure({ transport: true }));
    const scroll = screen.getByTestId('owner-meetings-scroll');
    await act(async () => {
      scroll.props.refreshControl.props.onRefresh();
    });

    expect(screen.getByText('Guest Morning')).toBeTruthy();
    expect(screen.queryByTestId('owner-meetings-error-message')).toBeNull();
  });
});

describe('OwnerMeetingsScreen — empty (share)', () => {
  it('empty предлагает поделиться календарём — share получает publicUrl', async () => {
    loadUpcomingBookingsMock.mockReturnValue(ok([]));
    loadOwnerSettingsMock.mockReturnValue(ok(settings({ publicUrl: 'https://minical.example/u/ivan-petrov' })));
    await renderScreen();
    await focusScreen();

    expect(screen.getByText('У вас пока нет предстоящих встреч')).toBeTruthy();

    await fireEvent.press(screen.getByText('Поделиться календарём'));

    expect(Share.share).toHaveBeenCalledWith({ message: 'https://minical.example/u/ivan-petrov' });
  });
});

describe('OwnerMeetingsScreen — sheet деталей встречи', () => {
  it('тап по карточке открывает sheet пропсами, «Закрыть» возвращает в content', async () => {
    loadUpcomingBookingsMock.mockReturnValue(ok([AFTERNOON]));
    loadOwnerSettingsMock.mockReturnValue(ok(settings()));
    await renderScreen();
    await focusScreen();

    await fireEvent.press(screen.getByText('Guest Afternoon'));

    const sheet = within(screen.getByTestId('booking-details-sheet'));
    expect(sheet.getByLabelText('Консультация')).toBeTruthy();
    // Дата в sheet — заголовок группы, в которой лежит встреча.
    expect(sheet.getByText(/Пятница, 31 июля/)).toBeTruthy();
    // Комментарий гостя показан, потому что он непустой у этой встречи.
    expect(sheet.getByText('Хочу обсудить контракт заранее')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('booking-details-close'));
    expect(screen.queryByTestId('booking-details-sheet')).toBeNull();
  });

  it('без комментария секция «Комментарий» не показывается', async () => {
    loadUpcomingBookingsMock.mockReturnValue(ok([MORNING]));
    loadOwnerSettingsMock.mockReturnValue(ok(settings()));
    await renderScreen();
    await focusScreen();

    await fireEvent.press(screen.getByText('Guest Morning'));

    expect(screen.getByTestId('booking-details-sheet')).toBeTruthy();
    expect(screen.queryByText('Комментарий')).toBeNull();
  });
});

describe('OwnerMeetingsScreen — заголовок и error', () => {
  it('header action открывает типы событий', async () => {
    loadUpcomingBookingsMock.mockReturnValue(ok([MORNING]));
    loadOwnerSettingsMock.mockReturnValue(ok(settings()));
    const navigation = await renderScreen();
    await focusScreen();

    await fireEvent.press(screen.getByLabelText('Открыть типы событий'));
    expect(navigation.push).toHaveBeenCalledWith('EventTypes');
  });

  it('ошибка загрузки — состояние error, «Повторить» перезапускает загрузку', async () => {
    loadUpcomingBookingsMock.mockReturnValueOnce(failure({ transport: true }));
    loadOwnerSettingsMock.mockReturnValue(ok(settings()));
    await renderScreen();
    await focusScreen();

    expect(screen.getByText('Не удалось загрузить встречи')).toBeTruthy();
    expect(screen.getByTestId('owner-meetings-error-message')).toHaveTextContent(
      'Нет связи с сервером. Проверьте подключение и попробуйте ещё раз.',
    );

    loadUpcomingBookingsMock.mockReturnValueOnce(ok([MORNING]));
    await act(async () => {
      await fireEvent.press(screen.getByTestId('owner-meetings-retry'));
    });

    expect(loadUpcomingBookingsMock).toHaveBeenCalledTimes(2);
    expect(screen.getByText('Guest Morning')).toBeTruthy();
  });
});
