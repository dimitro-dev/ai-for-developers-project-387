import { act, fireEvent, render, screen } from '@testing-library/react-native';

import type { AppError } from '@/api/errors';
import { OwnerSettingsScreen } from '@/features/owner/screens/OwnerSettingsScreen';
import type { OwnerSettingsView } from '@/features/owner/model/types';
import { loadOwnerSettings } from '@/features/owner/usecases/owner';

/** Тот же приём подмены `useFocusEffect`, что у `EventTypes.test.tsx`/`OwnerMeetings.test.tsx`. */
const mockUseFocusEffect = jest.fn<void, [() => void | (() => void)]>();
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (callback: () => void | (() => void)) => mockUseFocusEffect(callback),
}));

jest.mock('@/features/owner/usecases/owner', () => ({ loadOwnerSettings: jest.fn() }));

const loadOwnerSettingsMock = loadOwnerSettings as jest.MockedFunction<typeof loadOwnerSettings>;

const HIDDEN = { includeHiddenElements: true } as const;

function settingsView(overrides: Partial<OwnerSettingsView> = {}): OwnerSettingsView {
  return {
    displayName: 'Анна Петрова',
    timeZone: 'Europe/Moscow',
    availabilityRules: [{ daysOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], startLocal: '09:00', endLocal: '18:00' }],
    slotIntervalMinutes: 30,
    publicUrl: 'https://minical.example.com/anna',
    ...overrides,
  };
}

function ok(data: OwnerSettingsView) {
  return Promise.resolve({ ok: true as const, data });
}

function failure(error: Partial<AppError>) {
  return Promise.resolve({
    ok: false as const,
    error: { code: null, message: null, transport: false, ...error },
  });
}

type NavigationMock = { push: jest.Mock };

async function renderScreen(): Promise<NavigationMock> {
  const navigation: NavigationMock = { push: jest.fn() };
  await render(<OwnerSettingsScreen navigation={navigation as never} route={undefined as never} />);
  return navigation;
}

async function focusScreen(): Promise<void> {
  const calls = mockUseFocusEffect.mock.calls;
  const callback = calls[calls.length - 1][0];
  await act(async () => {
    callback();
  });
}

beforeEach(() => {
  mockUseFocusEffect.mockClear();
  loadOwnerSettingsMock.mockReset();
});

describe('OwnerSettingsScreen — состояния', () => {
  it('до фокуса запросов не шлёт и показывает три skeleton-строки', async () => {
    loadOwnerSettingsMock.mockReturnValue(ok(settingsView()));
    await renderScreen();

    expect(mockUseFocusEffect).toHaveBeenCalled();
    expect(loadOwnerSettingsMock).not.toHaveBeenCalled();
    expect(screen.getAllByTestId('skeleton-settings-row', HIDDEN)).toHaveLength(3);
  });

  it('content: три строки с ведущими иконками и подписями текущих значений', async () => {
    loadOwnerSettingsMock.mockReturnValue(ok(settingsView()));
    await renderScreen();
    await focusScreen();

    expect(screen.getByText('Профиль и timezone')).toBeTruthy();
    expect(screen.getByText('Анна Петрова · Europe/Moscow')).toBeTruthy();
    expect(screen.getByText('Рабочее время')).toBeTruthy();
    expect(screen.getByText('Пн–Пт · 09:00–18:00')).toBeTruthy();
    expect(screen.getByText('Типы событий')).toBeTruthy();
    expect(screen.getByText('Управление форматами встреч')).toBeTruthy();
  });

  it('error: полноэкранное состояние с иллюстрацией, текстом и «Повторить»', async () => {
    loadOwnerSettingsMock.mockReturnValue(failure({ transport: true }));
    await renderScreen();
    await focusScreen();

    expect(screen.getByTestId('asset-network-error', HIDDEN)).toBeTruthy();
    expect(screen.getByText('Не удалось загрузить настройки')).toBeTruthy();
    expect(screen.getByText('Проверьте подключение и попробуйте ещё раз.')).toBeTruthy();
    expect(screen.getByTestId('retry-settings-summary')).toBeTruthy();
  });
});

describe('OwnerSettingsScreen — действия', () => {
  it('«Повторить» перезапускает loadSettingsSummary', async () => {
    loadOwnerSettingsMock.mockReturnValueOnce(failure({ transport: true }));
    await renderScreen();
    await focusScreen();
    expect(screen.getByTestId('retry-settings-summary')).toBeTruthy();

    loadOwnerSettingsMock.mockReturnValueOnce(ok(settingsView()));
    await act(async () => {
      await fireEvent.press(screen.getByTestId('retry-settings-summary'));
    });

    expect(screen.getByText('Профиль и timezone')).toBeTruthy();
    expect(loadOwnerSettingsMock).toHaveBeenCalledTimes(2);
  });

  it('строка «Профиль и timezone» ведёт на OwnerProfileSettings', async () => {
    loadOwnerSettingsMock.mockReturnValue(ok(settingsView()));
    const navigation = await renderScreen();
    await focusScreen();

    await fireEvent.press(screen.getByTestId('settings-row-profile'));
    expect(navigation.push).toHaveBeenCalledWith('OwnerProfileSettings');
  });

  it('строка «Рабочее время» ведёт на OwnerWorkingHoursSettings', async () => {
    loadOwnerSettingsMock.mockReturnValue(ok(settingsView()));
    const navigation = await renderScreen();
    await focusScreen();

    await fireEvent.press(screen.getByTestId('settings-row-working-hours'));
    expect(navigation.push).toHaveBeenCalledWith('OwnerWorkingHoursSettings');
  });

  it('строка «Типы событий» ведёт на EventTypesFromSettings', async () => {
    loadOwnerSettingsMock.mockReturnValue(ok(settingsView()));
    const navigation = await renderScreen();
    await focusScreen();

    await fireEvent.press(screen.getByTestId('settings-row-event-types'));
    expect(navigation.push).toHaveBeenCalledWith('EventTypesFromSettings');
  });
});

describe('OwnerSettingsScreen — возврат на экран (фоновый refresh)', () => {
  it('второй фокус обновляет сводку без промежуточного loading', async () => {
    loadOwnerSettingsMock.mockReturnValueOnce(ok(settingsView({ displayName: 'Анна Петрова' })));
    await renderScreen();
    await focusScreen();
    expect(screen.getByText('Анна Петрова · Europe/Moscow')).toBeTruthy();

    loadOwnerSettingsMock.mockReturnValueOnce(ok(settingsView({ displayName: 'Анна Иванова' })));
    await focusScreen();

    expect(loadOwnerSettingsMock).toHaveBeenCalledTimes(2);
    expect(screen.getByText('Анна Иванова · Europe/Moscow')).toBeTruthy();
    expect(screen.queryAllByTestId('skeleton-settings-row', HIDDEN)).toHaveLength(0);
  });

  it('неудачный фоновый refresh уже показанную сводку не портит', async () => {
    loadOwnerSettingsMock.mockReturnValueOnce(ok(settingsView()));
    await renderScreen();
    await focusScreen();

    loadOwnerSettingsMock.mockReturnValueOnce(failure({ transport: true }));
    await focusScreen();

    expect(screen.getByText('Анна Петрова · Europe/Moscow')).toBeTruthy();
    expect(screen.queryByText('Не удалось загрузить настройки')).toBeNull();
  });
});
