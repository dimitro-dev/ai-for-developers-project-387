import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { SetupCheckScreen } from '@/features/owner/screens/SetupCheckScreen';
import type { OwnerRootStackParamList } from '@/navigation/OwnerRootStackParamList';

// Экран проверяется через мок use-case: ветви ошибок Prism не отдаёт, а сеть в тестах не нужна.
jest.mock('@/features/owner/usecases/owner', () => ({
  checkSetup: jest.fn(),
}));

import { checkSetup } from '@/features/owner/usecases/owner';

const mockedCheckSetup = checkSetup as jest.MockedFunction<typeof checkSetup>;

type Props = NativeStackScreenProps<OwnerRootStackParamList, 'SetupCheck'>;

const replace = jest.fn();
const navigate = jest.fn();

function renderScreen() {
  const navigation = { replace, navigate } as unknown as Props['navigation'];
  const route = { key: 'SetupCheck', name: 'SetupCheck' } as Props['route'];
  return render(<SetupCheckScreen navigation={navigation} route={route} />);
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('SetupCheckScreen — состояния', () => {
  it('checking: доступный текст загрузки виден сразу, маршрутизации ещё нет', async () => {
    mockedCheckSetup.mockReturnValue(new Promise(() => {}));

    await renderScreen();

    expect(screen.getByText('Проверяем настройки…')).toBeTruthy();
    expect(screen.getByLabelText('Проверяем настройки календаря')).toBeTruthy();
    expect(replace).not.toHaveBeenCalled();
  });

  it('успех, onboardingCompleted=true: маршрутизация на встречи заменяет SetupCheck в стеке', async () => {
    mockedCheckSetup.mockResolvedValue({ ok: true, data: { onboardingCompleted: true } });

    await renderScreen();

    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith('OwnerTabs', { screen: 'MeetingsTab' }),
    );
    expect(replace).toHaveBeenCalledTimes(1);
  });

  it('успех, onboardingCompleted=false: маршрутизация на онбординг', async () => {
    mockedCheckSetup.mockResolvedValue({ ok: true, data: { onboardingCompleted: false } });

    await renderScreen();

    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith('OnboardingStack', { screen: 'OnboardingProfile' }),
    );
  });

  it('error: транспортная ошибка показывает текст owner-словаря, а не сырой message', async () => {
    mockedCheckSetup.mockResolvedValue({
      ok: false,
      error: { code: null, message: 'Failed to fetch', transport: true },
    });

    await renderScreen();

    await waitFor(() => expect(screen.getByText('Не удалось проверить настройки')).toBeTruthy());
    expect(screen.getByTestId('setup-check-error-message')).toHaveTextContent(
      'Нет связи с сервером. Проверьте подключение и попробуйте ещё раз.',
    );
    expect(screen.queryByText('Failed to fetch')).toBeNull();
  });

  it('error: код CALENDAR_NOT_CONFIGURED показывает owner-текст этого кода', async () => {
    mockedCheckSetup.mockResolvedValue({
      ok: false,
      error: { code: 'CALENDAR_NOT_CONFIGURED', message: null, transport: false },
    });

    await renderScreen();

    await waitFor(() =>
      expect(screen.getByTestId('setup-check-error-message')).toHaveTextContent(
        'Настройка календаря ещё не завершена.',
      ),
    );
  });
});

describe('SetupCheckScreen — действия', () => {
  it('«Повторить» перезапускает checkSetup и маршрутизирует по новому результату', async () => {
    mockedCheckSetup.mockResolvedValue({
      ok: false,
      error: { code: null, message: null, transport: true },
    });

    await renderScreen();
    await waitFor(() => expect(screen.getByText('Повторить')).toBeTruthy());

    mockedCheckSetup.mockResolvedValue({ ok: true, data: { onboardingCompleted: true } });
    await fireEvent.press(screen.getByText('Повторить'));

    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith('OwnerTabs', { screen: 'MeetingsTab' }),
    );
    expect(mockedCheckSetup).toHaveBeenCalledTimes(2);
  });
});
