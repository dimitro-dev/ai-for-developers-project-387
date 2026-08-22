import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { OnboardingProfileScreen } from '@/features/owner/screens/OnboardingProfileScreen';
import type { OnboardingStackParamList } from '@/navigation/OnboardingStackParamList';

// Timezone устройства фиксируется, иначе тест зависел бы от машины, на которой запущен CI.
jest.mock('@/shared/datetime', () => ({
  ...jest.requireActual('@/shared/datetime'),
  guestTimeZone: () => 'Europe/Prague',
}));

type Props = NativeStackScreenProps<OnboardingStackParamList, 'OnboardingProfile'>;

async function renderScreen() {
  const navigation = { push: jest.fn(), goBack: jest.fn(), navigate: jest.fn() };

  await render(
    <OnboardingProfileScreen
      navigation={navigation as unknown as Props['navigation']}
      route={{ key: 'profile', name: 'OnboardingProfile', params: undefined } as Props['route']}
    />,
  );

  return { navigation };
}

describe('OnboardingProfileScreen — состояние editing', () => {
  it('показывает поля с timezone устройства по умолчанию, CTA недоступна для пустого имени', async () => {
    await renderScreen();

    expect(screen.getByTestId('display-name')).toBeTruthy();
    expect(screen.getByTestId('timezone').props.accessibilityLabel).toBe('Timezone, Europe/Prague');
    expect(screen.getByTestId('continue-onboarding').props.accessibilityState.disabled).toBe(true);
  });

  it('пустое имя показывает подсказку валидации сразу, без попытки submit', async () => {
    await renderScreen();

    expect(screen.getByText('Введите отображаемое имя')).toBeTruthy();
  });

  it('заполненное имя снимает подсказку и разблокирует CTA', async () => {
    await renderScreen();

    await fireEvent.changeText(screen.getByTestId('display-name'), 'Анна Иванова');

    expect(screen.queryByText('Введите отображаемое имя')).toBeNull();
    expect(screen.getByTestId('continue-onboarding').props.accessibilityState.disabled).toBe(false);
  });
});

describe('OnboardingProfileScreen — continueOnboarding', () => {
  it('передаёт черновик профиля параметром навигации на OnboardingWorkingHours', async () => {
    const { navigation } = await renderScreen();

    await fireEvent.changeText(screen.getByTestId('display-name'), 'Анна Иванова');
    await fireEvent.press(screen.getByTestId('continue-onboarding'));

    expect(navigation.push).toHaveBeenCalledWith('OnboardingWorkingHours', {
      profileDraft: { displayName: 'Анна Иванова', timeZone: 'Europe/Prague' },
    });
  });

  it('смена timezone через поиск в SelectField обновляет черновик', async () => {
    const { navigation } = await renderScreen();

    await fireEvent.changeText(screen.getByTestId('display-name'), 'Анна Иванова');
    await fireEvent.press(screen.getByTestId('timezone'));
    await fireEvent.changeText(screen.getByTestId('timezone-search'), 'Tokyo');
    await fireEvent.press(screen.getByTestId('timezone-option-Asia/Tokyo'));
    await fireEvent.press(screen.getByTestId('continue-onboarding'));

    expect(navigation.push).toHaveBeenCalledWith('OnboardingWorkingHours', {
      profileDraft: { displayName: 'Анна Иванова', timeZone: 'Asia/Tokyo' },
    });
  });
});
