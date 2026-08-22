import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import type { AppError } from '@/api/errors';
import { OnboardingWorkingHoursScreen } from '@/features/owner/screens/OnboardingWorkingHoursScreen';
import { completeSetup } from '@/features/owner/usecases/owner';
import type { UseCaseResult } from '@/features/owner/usecases/result';
import type { OwnerSettingsView } from '@/features/owner/model/types';
import type { OnboardingStackParamList } from '@/navigation/OnboardingStackParamList';

// Мокается только слой use-cases: экран проверяется целиком, сеть — нет.
jest.mock('@/features/owner/usecases/owner', () => ({ completeSetup: jest.fn() }));

const mockCompleteSetup = completeSetup as jest.MockedFunction<typeof completeSetup>;

type Props = NativeStackScreenProps<OnboardingStackParamList, 'OnboardingWorkingHours'>;

const profileDraft: OnboardingStackParamList['OnboardingWorkingHours']['profileDraft'] = {
  displayName: 'Анна Иванова',
  timeZone: 'Europe/Prague',
};

function appError(overrides: Partial<AppError>): AppError {
  return { code: null, message: null, transport: false, ...overrides };
}

function settingsView(): OwnerSettingsView {
  return {
    displayName: profileDraft.displayName,
    timeZone: profileDraft.timeZone,
    availabilityRules: [{ daysOfWeek: ['Monday'], startLocal: '09:00', endLocal: '18:00' }],
    slotIntervalMinutes: 30,
    publicUrl: 'https://example.test/owner',
  };
}

async function renderScreen() {
  const rootReset = jest.fn();
  const navigation = {
    goBack: jest.fn(),
    getParent: jest.fn(() => ({ reset: rootReset })),
  };

  await render(
    <OnboardingWorkingHoursScreen
      navigation={navigation as unknown as Props['navigation']}
      route={{ key: 'working-hours', name: 'OnboardingWorkingHours', params: { profileDraft } } as Props['route']}
    />,
  );

  return { navigation, rootReset };
}

async function addDefaultInterval() {
  await fireEvent.press(screen.getByTestId('open-add-working-hours'));
  await fireEvent.press(screen.getByTestId('apply-working-hours'));
}

beforeEach(() => {
  mockCompleteSetup.mockReset();
});

describe('OnboardingWorkingHoursScreen — состояние editing', () => {
  it('пустой график: подсказка о выходных, CTA недоступна, timezone видна', async () => {
    await renderScreen();

    expect(screen.getByText('Рабочее время ещё не настроено')).toBeTruthy();
    expect(screen.getByTestId('complete-setup').props.accessibilityState.disabled).toBe(true);
    expect(screen.getByText('Добавьте хотя бы один рабочий интервал')).toBeTruthy();
    expect(screen.getByText(/Europe\/Prague/)).toBeTruthy();
  });

  it('«Назад» вызывает navigation.goBack, а не сброс стека', async () => {
    const { navigation } = await renderScreen();

    await fireEvent.press(screen.getByTestId('progress-header-back'));

    expect(navigation.goBack).toHaveBeenCalledTimes(1);
  });
});

describe('OnboardingWorkingHoursScreen — sheet 04', () => {
  it('закрытие без применения не меняет график', async () => {
    await renderScreen();

    await fireEvent.press(screen.getByTestId('open-add-working-hours'));
    expect(screen.getByTestId('add-working-hours-sheet')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('add-working-hours-sheet-backdrop', { includeHiddenElements: true }));

    expect(screen.queryByTestId('add-working-hours-sheet')).toBeNull();
    expect(screen.getByText('Рабочее время ещё не настроено')).toBeTruthy();
  });

  it('применение добавляет карточку интервала и включает CTA', async () => {
    await renderScreen();

    await addDefaultInterval();

    expect(screen.queryByTestId('add-working-hours-sheet')).toBeNull();
    expect(screen.getByText('Пн–Пт')).toBeTruthy();
    expect(screen.getByText('09:00–18:00')).toBeTruthy();
    expect(screen.getByTestId('complete-setup').props.accessibilityState.disabled).toBe(false);
  });

  it('редактирование интервала заменяет его, а не дублирует (сохраняя client-only id)', async () => {
    await renderScreen();
    await addDefaultInterval();

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

  it('шаг слотов меняется через SelectField', async () => {
    await renderScreen();

    await fireEvent.press(screen.getByTestId('slot-step'));
    await fireEvent.press(screen.getByTestId('slot-step-option-15'));

    expect(screen.getByTestId('slot-step').props.accessibilityLabel).toBe(
      'Начало слотов каждые, 15 минут',
    );
  });
});

describe('OnboardingWorkingHoursScreen — completeSetup', () => {
  it('успех отправляет плоский SetupRequest и сбрасывает корневой стек на OwnerMeetings', async () => {
    mockCompleteSetup.mockResolvedValue({ ok: true, data: settingsView() });

    const { rootReset } = await renderScreen();
    await addDefaultInterval();
    await act(async () => {
      await fireEvent.press(screen.getByTestId('complete-setup'));
    });

    expect(mockCompleteSetup).toHaveBeenCalledWith({
      displayName: 'Анна Иванова',
      timeZone: 'Europe/Prague',
      availabilityRules: [
        { daysOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], startLocal: '09:00', endLocal: '18:00' },
      ],
      slotIntervalMinutes: 30,
    });
    expect(rootReset).toHaveBeenCalledWith({
      index: 0,
      routes: [{ name: 'OwnerTabs', params: { screen: 'MeetingsTab', params: { screen: 'OwnerMeetings' } } }],
    });
  });

  it('ошибка сервера показывает текст owner-словаря, а не сырой message', async () => {
    mockCompleteSetup.mockResolvedValue({
      ok: false,
      error: appError({ code: 'VALIDATION_ERROR', message: 'timeZone must be an IANA zone' }),
    });

    const { rootReset } = await renderScreen();
    await addDefaultInterval();
    await act(async () => {
      await fireEvent.press(screen.getByTestId('complete-setup'));
    });

    expect(screen.getByTestId('inline-alert-error')).toBeTruthy();
    expect(screen.getByText('Проверьте введённые данные и попробуйте ещё раз.')).toBeTruthy();
    expect(screen.queryByText('timeZone must be an IANA zone')).toBeNull();
    expect(rootReset).not.toHaveBeenCalled();
    // Данные формы не теряются — карточка интервала остаётся на экране.
    expect(screen.getByText('Пн–Пт')).toBeTruthy();
  });
});
