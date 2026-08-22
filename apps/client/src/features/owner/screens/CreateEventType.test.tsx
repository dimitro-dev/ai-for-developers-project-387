import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { EventType } from '@minical/api-client';

import type { AppError } from '@/api/errors';
import { CreateEventTypeScreen } from '@/features/owner/screens/CreateEventTypeScreen';
import { createEventType } from '@/features/owner/usecases/owner';
import type { UseCaseResult } from '@/features/owner/usecases/result';
import type { OwnerMeetingsStackParamList } from '@/navigation/OwnerMeetingsStackParamList';

// Экран проверяется через мок use-case: серверные ветки Prism не отдаёт, сеть в тестах не нужна.
jest.mock('@/features/owner/usecases/owner', () => ({ createEventType: jest.fn() }));

const mockCreateEventType = createEventType as jest.MockedFunction<typeof createEventType>;

type Props = NativeStackScreenProps<OwnerMeetingsStackParamList, 'CreateEventType'>;

const createdEventType: EventType = {
  id: 'konsultaciya',
  name: 'Консультация',
  durationMinutes: 30,
};

function appError(overrides: Partial<AppError>): AppError {
  return { code: null, message: null, transport: false, ...overrides };
}

function ok(): UseCaseResult<EventType> {
  return { ok: true, data: createdEventType };
}

function failed(error: AppError): UseCaseResult<EventType> {
  return { ok: false, error };
}

async function renderScreen() {
  const navigation = { goBack: jest.fn(), navigate: jest.fn() };
  await render(
    <CreateEventTypeScreen
      navigation={navigation as unknown as Props['navigation']}
      route={{ key: 'create', name: 'CreateEventType' } as Props['route']}
    />,
  );
  return { navigation };
}

/** Нажатие с ожиданием разрешения промиса use-case внутри `act` — приём гостевой формы. */
async function pressAndSettle(element: Parameters<typeof fireEvent.press>[0]) {
  await act(async () => {
    await fireEvent.press(element);
  });
}

beforeEach(() => {
  mockCreateEventType.mockReset();
});

describe('CreateEventTypeScreen — состояние editing', () => {
  it('длительность 30 минут выбрана с первого рендера', async () => {
    await renderScreen();

    expect(screen.getByTestId('duration-chip-duration-30').props.accessibilityState.selected).toBe(
      true,
    );
    expect(screen.getByTestId('duration-chip-duration-15').props.accessibilityState.selected).toBe(
      false,
    );
  });

  it('пустая форма держит CTA недоступной', async () => {
    await renderScreen();

    expect(
      screen.getByTestId('submit-create-event-type').props.accessibilityState.disabled,
    ).toBe(true);
  });

  it('id генерируется из названия транслитерацией, пока владелец его не тронул', async () => {
    await renderScreen();

    await fireEvent.changeText(screen.getByTestId('title'), 'Консультация');
    expect(screen.getByTestId('public-id').props.value).toBe('konsultaciya');

    await fireEvent.changeText(screen.getByTestId('title'), 'Консультация 2');
    expect(screen.getByTestId('public-id').props.value).toBe('konsultaciya-2');
  });

  it('ручная правка id останавливает автогенерацию', async () => {
    await renderScreen();

    await fireEvent.changeText(screen.getByTestId('title'), 'Консультация');
    await fireEvent.changeText(screen.getByTestId('public-id'), 'custom-id');
    await fireEvent.changeText(screen.getByTestId('title'), 'Другое название');

    expect(screen.getByTestId('public-id').props.value).toBe('custom-id');
  });

  it('выбор другой длительности переключает чип', async () => {
    await renderScreen();

    await fireEvent.press(screen.getByTestId('duration-chip-duration-45'));

    expect(screen.getByTestId('duration-chip-duration-45').props.accessibilityState.selected).toBe(
      true,
    );
    expect(screen.getByTestId('duration-chip-duration-30').props.accessibilityState.selected).toBe(
      false,
    );
  });

  it('невалидный формат публичного id держит CTA недоступной', async () => {
    await renderScreen();

    await fireEvent.changeText(screen.getByTestId('title'), 'Демо');
    await fireEvent.changeText(screen.getByTestId('public-id'), 'Invalid ID!');

    expect(
      screen.getByTestId('submit-create-event-type').props.accessibilityState.disabled,
    ).toBe(true);
  });
});

describe('CreateEventTypeScreen — успех', () => {
  it('шлёт плоский CreateEventTypeRequest без пустого description', async () => {
    mockCreateEventType.mockResolvedValue(ok());

    await renderScreen();
    await fireEvent.changeText(screen.getByTestId('title'), 'Консультация');
    await pressAndSettle(screen.getByTestId('submit-create-event-type'));

    expect(mockCreateEventType).toHaveBeenCalledWith({
      id: 'konsultaciya',
      name: 'Консультация',
      durationMinutes: 30,
    });
  });

  it('непустое описание уходит в нагрузку тримленным', async () => {
    mockCreateEventType.mockResolvedValue(ok());

    await renderScreen();
    await fireEvent.changeText(screen.getByTestId('title'), 'Демо');
    await fireEvent.changeText(screen.getByTestId('description'), '  Знакомство  ');
    await pressAndSettle(screen.getByTestId('submit-create-event-type'));

    expect(mockCreateEventType.mock.calls[0][0].description).toBe('Знакомство');
  });

  it('успех ведёт на route EventTypes', async () => {
    mockCreateEventType.mockResolvedValue(ok());

    const { navigation } = await renderScreen();
    await fireEvent.changeText(screen.getByTestId('title'), 'Демо');
    await pressAndSettle(screen.getByTestId('submit-create-event-type'));

    expect(navigation.navigate).toHaveBeenCalledWith('EventTypes');
  });

  it('во время отправки CTA заблокирована и не шлёт второй запрос', async () => {
    let resolveCall: (value: UseCaseResult<EventType>) => void = () => {};
    mockCreateEventType.mockReturnValue(
      new Promise<UseCaseResult<EventType>>((resolve) => {
        resolveCall = resolve;
      }),
    );

    await renderScreen();
    await fireEvent.changeText(screen.getByTestId('title'), 'Демо');
    await pressAndSettle(screen.getByTestId('submit-create-event-type'));

    expect(
      screen.getByTestId('submit-create-event-type').props.accessibilityState.disabled,
    ).toBe(true);

    await fireEvent.press(screen.getByTestId('submit-create-event-type'));
    expect(mockCreateEventType).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveCall(ok());
    });
  });
});

describe('CreateEventTypeScreen — ошибка создания', () => {
  it('DUPLICATE_EVENT_TYPE_ID: баннер и полевая ошибка публичного id, форма сохраняется', async () => {
    mockCreateEventType.mockResolvedValue(
      failed(appError({ code: 'DUPLICATE_EVENT_TYPE_ID', message: 'id already exists' })),
    );

    await renderScreen();
    await fireEvent.changeText(screen.getByTestId('title'), 'Демо');
    await pressAndSettle(screen.getByTestId('submit-create-event-type'));

    expect(screen.getByTestId('inline-alert-error')).toBeTruthy();
    expect(screen.getByText('Не удалось создать тип события')).toBeTruthy();
    // Текст маппера, не сырой message сервера — виден дважды: баннером и подписью у поля.
    expect(screen.getAllByText('Публичный id уже занят. Выберите другой.')).toHaveLength(2);
    expect(screen.queryByText('id already exists')).toBeNull();
    expect(screen.getByTestId('public-id').props.accessibilityHint).toBe(
      'Публичный id уже занят. Выберите другой.',
    );
    // Введённые значения остаются.
    expect(screen.getByTestId('title').props.value).toBe('Демо');
    expect(screen.getByTestId('public-id').props.value).toBe('demo');
  });

  it('VALIDATION_ERROR: только баннер, без полевой ошибки id', async () => {
    mockCreateEventType.mockResolvedValue(
      failed(appError({ code: 'VALIDATION_ERROR', message: 'name must not be empty' })),
    );

    await renderScreen();
    await fireEvent.changeText(screen.getByTestId('title'), 'Демо');
    await pressAndSettle(screen.getByTestId('submit-create-event-type'));

    expect(screen.getByText('Проверьте введённые данные и попробуйте ещё раз.')).toBeTruthy();
    expect(screen.getByTestId('public-id').props.accessibilityHint).toBeUndefined();
  });

  it('транспортная ошибка показывает текст маппера', async () => {
    mockCreateEventType.mockResolvedValue(failed(appError({ transport: true })));

    await renderScreen();
    await fireEvent.changeText(screen.getByTestId('title'), 'Демо');
    await pressAndSettle(screen.getByTestId('submit-create-event-type'));

    expect(
      screen.getByText('Нет связи с сервером. Проверьте подключение и попробуйте ещё раз.'),
    ).toBeTruthy();
  });
});

describe('CreateEventTypeScreen — навигация', () => {
  it('back в шапке возвращает назад', async () => {
    const { navigation } = await renderScreen();

    await fireEvent.press(screen.getByTestId('app-header-back'));
    expect(navigation.goBack).toHaveBeenCalledTimes(1);
  });
});
