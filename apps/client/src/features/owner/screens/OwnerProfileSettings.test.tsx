import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import type { AppError } from '@/api/errors';
import { OwnerProfileSettingsScreen } from '@/features/owner/screens/OwnerProfileSettingsScreen';
import type { OwnerSettingsView } from '@/features/owner/model/types';
import { loadOwnerSettings, saveOwnerSettings } from '@/features/owner/usecases/owner';
import type { UseCaseResult } from '@/features/owner/usecases/result';
import type { OwnerSettingsStackParamList } from '@/navigation/OwnerSettingsStackParamList';

// Экран проверяется через мок use-case: серверные ветки Prism не отдаёт, сеть в тестах не нужна.
jest.mock('@/features/owner/usecases/owner', () => ({
  loadOwnerSettings: jest.fn(),
  saveOwnerSettings: jest.fn(),
}));

const mockLoadOwnerSettings = loadOwnerSettings as jest.MockedFunction<typeof loadOwnerSettings>;
const mockSaveOwnerSettings = saveOwnerSettings as jest.MockedFunction<typeof saveOwnerSettings>;

type Props = NativeStackScreenProps<OwnerSettingsStackParamList, 'OwnerProfileSettings'>;

function appError(overrides: Partial<AppError>): AppError {
  return { code: null, message: null, transport: false, ...overrides };
}

function settingsView(overrides: Partial<OwnerSettingsView> = {}): OwnerSettingsView {
  return {
    displayName: 'Анна Петрова',
    timeZone: 'Europe/Moscow',
    availabilityRules: [{ daysOfWeek: ['Monday', 'Tuesday'], startLocal: '09:00', endLocal: '18:00' }],
    slotIntervalMinutes: 30,
    publicUrl: 'https://minical.example.com/anna',
    ...overrides,
  };
}

function ok(data: OwnerSettingsView): Promise<UseCaseResult<OwnerSettingsView>> {
  return Promise.resolve({ ok: true, data });
}

function failed(error: AppError): Promise<UseCaseResult<OwnerSettingsView>> {
  return Promise.resolve({ ok: false, error });
}

async function renderScreen() {
  const navigation = { goBack: jest.fn() };
  await render(
    <OwnerProfileSettingsScreen
      navigation={navigation as unknown as Props['navigation']}
      route={{ key: 'profile-settings', name: 'OwnerProfileSettings' } as Props['route']}
    />,
  );
  return { navigation };
}

/** Нажатие с ожиданием разрешения промиса use-case внутри `act` — приём соседних owner-экранов. */
async function pressAndSettle(element: Parameters<typeof fireEvent.press>[0]) {
  await act(async () => {
    await fireEvent.press(element);
  });
}

beforeEach(() => {
  mockLoadOwnerSettings.mockReset();
  mockSaveOwnerSettings.mockReset();
});

describe('OwnerProfileSettingsScreen — загрузка', () => {
  it('loading: поля-скелетоны, формы ещё нет', async () => {
    mockLoadOwnerSettings.mockReturnValue(new Promise(() => {}));
    await renderScreen();

    expect(screen.getAllByTestId('skeleton-field', { includeHiddenElements: true })).toHaveLength(2);
    expect(screen.queryByTestId('display-name')).toBeNull();
  });

  it('editing: поля заполнены загруженными значениями, CTA недоступна без правок', async () => {
    mockLoadOwnerSettings.mockReturnValue(ok(settingsView()));
    await renderScreen();
    await act(async () => {});

    expect(screen.getByTestId('display-name').props.value).toBe('Анна Петрова');
    expect(screen.getByTestId('timezone').props.accessibilityLabel).toBe('Timezone, Europe/Moscow');
    expect(screen.getByTestId('save-profile-settings').props.accessibilityState.disabled).toBe(true);
  });
});

describe('OwnerProfileSettingsScreen — dirty-гейт и валидация', () => {
  it('правка отображаемого имени включает CTA (dirty)', async () => {
    mockLoadOwnerSettings.mockReturnValue(ok(settingsView()));
    await renderScreen();
    await act(async () => {});

    await fireEvent.changeText(screen.getByTestId('display-name'), 'Анна Иванова');

    expect(screen.getByTestId('save-profile-settings').props.accessibilityState.disabled).toBe(false);
  });

  it('пустое имя держит CTA недоступной и показывает подсказку правила', async () => {
    mockLoadOwnerSettings.mockReturnValue(ok(settingsView()));
    await renderScreen();
    await act(async () => {});

    await fireEvent.changeText(screen.getByTestId('display-name'), '   ');

    expect(screen.getByText('Введите отображаемое имя')).toBeTruthy();
    expect(screen.getByTestId('save-profile-settings').props.accessibilityState.disabled).toBe(true);
  });
});

describe('OwnerProfileSettingsScreen — сохранение', () => {
  it('AC6: сохранение профиля не теряет availabilityRules/slotIntervalMinutes', async () => {
    const loaded = settingsView();
    mockLoadOwnerSettings.mockReturnValue(ok(loaded));
    mockSaveOwnerSettings.mockResolvedValue({ ok: true, data: loaded });
    await renderScreen();
    await act(async () => {});

    await fireEvent.changeText(screen.getByTestId('display-name'), 'Анна Иванова');
    await pressAndSettle(screen.getByTestId('save-profile-settings'));

    expect(mockSaveOwnerSettings).toHaveBeenCalledWith({
      displayName: 'Анна Иванова',
      timeZone: 'Europe/Moscow',
      availabilityRules: loaded.availabilityRules,
      slotIntervalMinutes: 30,
    });
  });

  it('во время сохранения CTA показывает «Сохраняем...» и блокирует повторный submit', async () => {
    const loaded = settingsView();
    mockLoadOwnerSettings.mockReturnValue(ok(loaded));
    let resolveCall: (value: UseCaseResult<OwnerSettingsView>) => void = () => {};
    mockSaveOwnerSettings.mockReturnValue(
      new Promise<UseCaseResult<OwnerSettingsView>>((resolve) => {
        resolveCall = resolve;
      }),
    );
    await renderScreen();
    await act(async () => {});

    await fireEvent.changeText(screen.getByTestId('display-name'), 'Анна Иванова');
    await pressAndSettle(screen.getByTestId('save-profile-settings'));

    expect(screen.getByText('Сохраняем...')).toBeTruthy();
    expect(screen.getByTestId('save-profile-settings').props.accessibilityState.disabled).toBe(true);

    await fireEvent.press(screen.getByTestId('save-profile-settings'));
    expect(mockSaveOwnerSettings).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveCall({ ok: true, data: loaded });
    });
  });

  it('ошибка сохранения показывает текст владельца под формой и сохраняет введённые значения', async () => {
    mockLoadOwnerSettings.mockReturnValue(ok(settingsView()));
    mockSaveOwnerSettings.mockResolvedValue(
      failed(appError({ code: 'VALIDATION_ERROR', message: 'displayName must not be empty' })) as never,
    );
    await renderScreen();
    await act(async () => {});

    await fireEvent.changeText(screen.getByTestId('display-name'), 'Анна Иванова');
    await pressAndSettle(screen.getByTestId('save-profile-settings'));

    expect(screen.getByTestId('profile-settings-error')).toBeTruthy();
    expect(screen.getByText('Проверьте введённые данные и попробуйте ещё раз.')).toBeTruthy();
    expect(screen.queryByText('displayName must not be empty')).toBeNull();
    expect(screen.getByTestId('display-name').props.value).toBe('Анна Иванова');
  });

  it('транспортная ошибка показывает текст маппера', async () => {
    mockLoadOwnerSettings.mockReturnValue(ok(settingsView()));
    mockSaveOwnerSettings.mockResolvedValue(failed(appError({ transport: true })) as never);
    await renderScreen();
    await act(async () => {});

    await fireEvent.changeText(screen.getByTestId('display-name'), 'Анна Иванова');
    await pressAndSettle(screen.getByTestId('save-profile-settings'));

    expect(
      screen.getByText('Нет связи с сервером. Проверьте подключение и попробуйте ещё раз.'),
    ).toBeTruthy();
  });
});

describe('OwnerProfileSettingsScreen — навигация', () => {
  it('back в шапке возвращает назад', async () => {
    mockLoadOwnerSettings.mockReturnValue(ok(settingsView()));
    const { navigation } = await renderScreen();
    await act(async () => {});

    await fireEvent.press(screen.getByTestId('app-header-back'));
    expect(navigation.goBack).toHaveBeenCalledTimes(1);
  });
});
