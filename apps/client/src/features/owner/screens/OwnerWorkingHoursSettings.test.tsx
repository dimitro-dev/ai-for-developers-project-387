import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import type { AppError } from '@/api/errors';
import { OwnerWorkingHoursSettingsScreen } from '@/features/owner/screens/OwnerWorkingHoursSettingsScreen';
import type { OwnerSettingsView } from '@/features/owner/model/types';
import { loadOwnerSettings, saveOwnerSettings } from '@/features/owner/usecases/owner';
import type { UseCaseResult } from '@/features/owner/usecases/result';
import type { OwnerSettingsStackParamList } from '@/navigation/OwnerSettingsStackParamList';

jest.mock('@/features/owner/usecases/owner', () => ({
  loadOwnerSettings: jest.fn(),
  saveOwnerSettings: jest.fn(),
}));

const mockLoadOwnerSettings = loadOwnerSettings as jest.MockedFunction<typeof loadOwnerSettings>;
const mockSaveOwnerSettings = saveOwnerSettings as jest.MockedFunction<typeof saveOwnerSettings>;

type Props = NativeStackScreenProps<OwnerSettingsStackParamList, 'OwnerWorkingHoursSettings'>;

function appError(overrides: Partial<AppError>): AppError {
  return { code: null, message: null, transport: false, ...overrides };
}

function settingsView(overrides: Partial<OwnerSettingsView> = {}): OwnerSettingsView {
  return {
    displayName: 'Анна Петрова',
    timeZone: 'Europe/Moscow',
    availabilityRules: [
      { daysOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], startLocal: '09:00', endLocal: '18:00' },
    ],
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
  const navigation = { push: jest.fn() };
  await render(
    <OwnerWorkingHoursSettingsScreen
      navigation={navigation as unknown as Props['navigation']}
      route={{ key: 'working-hours-settings', name: 'OwnerWorkingHoursSettings' } as Props['route']}
    />,
  );
  return { navigation };
}

async function pressAndSettle(element: Parameters<typeof fireEvent.press>[0]) {
  await act(async () => {
    await fireEvent.press(element);
  });
}

async function addDefaultInterval() {
  await fireEvent.press(screen.getByTestId('open-add-working-hours'));
  await fireEvent.press(screen.getByTestId('apply-working-hours'));
}

beforeEach(() => {
  mockLoadOwnerSettings.mockReset();
  mockSaveOwnerSettings.mockReset();
});

describe('OwnerWorkingHoursSettingsScreen — загрузка', () => {
  it('loading: skeleton-карточки графика, формы ещё нет', async () => {
    mockLoadOwnerSettings.mockReturnValue(new Promise(() => {}));
    await renderScreen();

    expect(screen.getAllByTestId('skeleton-schedule-card', { includeHiddenElements: true })).toHaveLength(2);
    expect(screen.queryByTestId('open-add-working-hours')).toBeNull();
  });

  it('editing: график и шаг слота заполнены загруженными значениями, CTA недоступна без правок', async () => {
    mockLoadOwnerSettings.mockReturnValue(ok(settingsView()));
    await renderScreen();
    await act(async () => {});

    expect(screen.getByText('Пн–Пт')).toBeTruthy();
    expect(screen.getByText('09:00–18:00')).toBeTruthy();
    expect(screen.getByTestId('save-working-hours').props.accessibilityState.disabled).toBe(true);
  });

  it('спека не задаёт backAction — кнопки «Назад» в шапке нет', async () => {
    mockLoadOwnerSettings.mockReturnValue(ok(settingsView()));
    await renderScreen();
    await act(async () => {});

    expect(screen.queryByTestId('app-header-back')).toBeNull();
  });
});

describe('OwnerWorkingHoursSettingsScreen — sheet 04', () => {
  it('добавление интервала включает CTA (dirty)', async () => {
    mockLoadOwnerSettings.mockReturnValue(ok(settingsView({ availabilityRules: [] })));
    await renderScreen();
    await act(async () => {});

    expect(screen.getByText('Добавьте хотя бы один рабочий интервал')).toBeTruthy();
    await addDefaultInterval();

    expect(screen.getByText('Пн–Пт')).toBeTruthy();
    expect(screen.getByTestId('save-working-hours').props.accessibilityState.disabled).toBe(false);
  });

  it('редактирование интервала заменяет его, а не дублирует (сохраняя client-only id)', async () => {
    mockLoadOwnerSettings.mockReturnValue(ok(settingsView()));
    await renderScreen();
    await act(async () => {});

    const cardsBefore = screen.getAllByTestId(/^schedule-card-/);
    expect(cardsBefore).toHaveLength(1);
    const idBefore = cardsBefore[0].props.testID as string;

    await fireEvent.press(cardsBefore[0]);
    expect(screen.getByText('Изменить рабочее время')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('apply-working-hours'));

    const cardsAfter = screen.getAllByTestId(/^schedule-card-/);
    expect(cardsAfter).toHaveLength(1);
    expect(cardsAfter[0].props.testID).toBe(idBefore);
  });

  it('закрытие sheet без применения не меняет график и не включает dirty', async () => {
    mockLoadOwnerSettings.mockReturnValue(ok(settingsView()));
    await renderScreen();
    await act(async () => {});

    await fireEvent.press(screen.getByTestId('open-add-working-hours'));
    await fireEvent.press(screen.getByTestId('add-working-hours-sheet-backdrop', { includeHiddenElements: true }));

    expect(screen.queryByTestId('add-working-hours-sheet')).toBeNull();
    expect(screen.getByTestId('save-working-hours').props.accessibilityState.disabled).toBe(true);
  });
});

describe('OwnerWorkingHoursSettingsScreen — шаг слота и сохранение', () => {
  it('шаг слотов меняется через SelectField и включает dirty', async () => {
    mockLoadOwnerSettings.mockReturnValue(ok(settingsView()));
    await renderScreen();
    await act(async () => {});

    await fireEvent.press(screen.getByTestId('slot-step'));
    await fireEvent.press(screen.getByTestId('slot-step-option-15'));

    expect(screen.getByTestId('slot-step').props.accessibilityLabel).toBe('Начало слотов каждые, 15 минут');
    expect(screen.getByTestId('save-working-hours').props.accessibilityState.disabled).toBe(false);
  });

  it('AC6: сохранение рабочего времени не теряет displayName/timeZone', async () => {
    const loaded = settingsView();
    mockLoadOwnerSettings.mockReturnValue(ok(loaded));
    mockSaveOwnerSettings.mockResolvedValue({ ok: true, data: loaded });
    await renderScreen();
    await act(async () => {});

    await fireEvent.press(screen.getByTestId('slot-step'));
    await fireEvent.press(screen.getByTestId('slot-step-option-15'));
    await pressAndSettle(screen.getByTestId('save-working-hours'));

    expect(mockSaveOwnerSettings).toHaveBeenCalledWith({
      displayName: 'Анна Петрова',
      timeZone: 'Europe/Moscow',
      availabilityRules: [
        { daysOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], startLocal: '09:00', endLocal: '18:00' },
      ],
      slotIntervalMinutes: 15,
    });
  });

  it('во время сохранения CTA заблокирована и показывает спиннер', async () => {
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

    await fireEvent.press(screen.getByTestId('slot-step'));
    await fireEvent.press(screen.getByTestId('slot-step-option-15'));
    await pressAndSettle(screen.getByTestId('save-working-hours'));

    expect(screen.getByTestId('save-working-hours').props.accessibilityState.disabled).toBe(true);
    await fireEvent.press(screen.getByTestId('save-working-hours'));
    expect(mockSaveOwnerSettings).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveCall({ ok: true, data: loaded });
    });
  });

  it('network error не очищает draft', async () => {
    mockLoadOwnerSettings.mockReturnValue(ok(settingsView()));
    mockSaveOwnerSettings.mockResolvedValue(failed(appError({ transport: true })) as never);
    await renderScreen();
    await act(async () => {});

    await fireEvent.press(screen.getByTestId('slot-step'));
    await fireEvent.press(screen.getByTestId('slot-step-option-15'));
    await pressAndSettle(screen.getByTestId('save-working-hours'));

    expect(
      screen.getByText('Нет связи с сервером. Проверьте подключение и попробуйте ещё раз.'),
    ).toBeTruthy();
    expect(screen.getByText('Пн–Пт')).toBeTruthy();
    expect(screen.getByTestId('slot-step').props.accessibilityLabel).toBe('Начало слотов каждые, 15 минут');
  });
});

describe('OwnerWorkingHoursSettingsScreen — навигация', () => {
  it('строка «Типы событий» ведёт на EventTypesFromSettings', async () => {
    mockLoadOwnerSettings.mockReturnValue(ok(settingsView()));
    const { navigation } = await renderScreen();
    await act(async () => {});

    await fireEvent.press(screen.getByTestId('settings-row-event-types'));
    expect(navigation.push).toHaveBeenCalledWith('EventTypesFromSettings');
  });
});
