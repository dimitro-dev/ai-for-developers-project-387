import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { EventType } from '@minical/api-client';

import type { AppError } from '@/api/errors';
import { EventTypesScreen } from '@/features/owner/screens/EventTypesScreen';
import { loadEventTypes } from '@/features/owner/usecases/owner';

/**
 * `useFocusEffect` подменён регистратором — тот же приём, что у `GuestSlots.test.tsx`:
 * колбэк вызывает тест, а не сам React Navigation, поэтому проверяется именно конвенция
 * «первый фокус грузит, следующий — фоновый refresh», а не «монтирование».
 */
const mockUseFocusEffect = jest.fn<void, [() => void | (() => void)]>();
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (callback: () => void | (() => void)) => mockUseFocusEffect(callback),
}));

jest.mock('@/features/owner/usecases/owner', () => ({
  loadEventTypes: jest.fn(),
}));

const loadEventTypesMock = loadEventTypes as jest.MockedFunction<typeof loadEventTypes>;

const HIDDEN = { includeHiddenElements: true } as const;

function eventType(overrides: Partial<EventType>): EventType {
  return { id: 'consultation', name: 'Консультация', durationMinutes: 30, ...overrides };
}

function ok(items: EventType[]) {
  return Promise.resolve({ ok: true as const, data: items });
}

function failure(error: Partial<AppError>) {
  return Promise.resolve({
    ok: false as const,
    error: { code: null, message: null, transport: false, ...error },
  });
}

type NavigationMock = { goBack: jest.Mock; navigate: jest.Mock };

async function renderScreen(): Promise<NavigationMock> {
  const navigation: NavigationMock = { goBack: jest.fn(), navigate: jest.fn() };
  await render(<EventTypesScreen navigation={navigation as never} route={undefined as never} />);
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
  loadEventTypesMock.mockReset();
});

describe('EventTypesScreen — состояния', () => {
  it('до фокуса запросов не шлёт и показывает loading', async () => {
    loadEventTypesMock.mockReturnValue(ok([eventType({})]));
    await renderScreen();

    expect(mockUseFocusEffect).toHaveBeenCalled();
    expect(loadEventTypesMock).not.toHaveBeenCalled();
    expect(screen.getAllByTestId('skeleton-event-type-card', HIDDEN)).toHaveLength(2);
  });

  it('content: карточки списка с длительностью и публичным id', async () => {
    loadEventTypesMock.mockReturnValue(
      ok([
        eventType({ id: 'consultation', name: 'Консультация', description: 'Звонок', durationMinutes: 30 }),
        eventType({ id: 'demo', name: 'Демо', durationMinutes: 60 }),
      ]),
    );

    await renderScreen();
    await focusScreen();

    expect(screen.getByTestId('event-type-card-consultation')).toBeTruthy();
    expect(screen.getByText('Консультация')).toBeTruthy();
    expect(screen.getByText('30 минут')).toBeTruthy();
    expect(screen.getByText('/consultation')).toBeTruthy();
    // 60 минут — это «1 час» (registry helper приоритетнее пикселей макета).
    expect(screen.getByText('1 час')).toBeTruthy();
  });

  it('empty: пустой список показывает EmptyState с CTA', async () => {
    loadEventTypesMock.mockReturnValue(ok([]));
    await renderScreen();
    await focusScreen();

    expect(screen.getByText('Типов событий пока нет')).toBeTruthy();
    expect(screen.getByText('Создать тип события')).toBeTruthy();
  });

  it('error: показывает текст маппера и «Повторить»', async () => {
    loadEventTypesMock.mockReturnValue(failure({ transport: true }));
    await renderScreen();
    await focusScreen();

    expect(screen.getByText('Не удалось загрузить типы событий')).toBeTruthy();
    expect(screen.getByText('Повторить')).toBeTruthy();
  });
});

describe('EventTypesScreen — действия', () => {
  it('«Повторить» перезапускает loadEventTypes', async () => {
    loadEventTypesMock.mockReturnValueOnce(failure({ transport: true }));
    await renderScreen();
    await focusScreen();
    expect(screen.getByText('Повторить')).toBeTruthy();

    loadEventTypesMock.mockReturnValueOnce(ok([eventType({})]));
    await act(async () => {
      await fireEvent.press(screen.getByText('Повторить'));
    });

    expect(screen.getByTestId('event-type-card-consultation')).toBeTruthy();
    expect(loadEventTypesMock).toHaveBeenCalledTimes(2);
  });

  it('back в шапке возвращает назад', async () => {
    loadEventTypesMock.mockReturnValue(ok([]));
    const navigation = await renderScreen();
    await focusScreen();

    await fireEvent.press(screen.getByTestId('app-header-back'));
    expect(navigation.goBack).toHaveBeenCalledTimes(1);
  });

  it('иконка «plus» в шапке ведёт на создание типа события', async () => {
    loadEventTypesMock.mockReturnValue(ok([]));
    const navigation = await renderScreen();
    await focusScreen();

    await fireEvent.press(screen.getByTestId('app-header-action-create'));
    expect(navigation.navigate).toHaveBeenCalledWith('CreateEventType');
  });

  it('CTA пустого состояния тоже ведёт на создание типа события', async () => {
    loadEventTypesMock.mockReturnValue(ok([]));
    const navigation = await renderScreen();
    await focusScreen();

    await fireEvent.press(screen.getByText('Создать тип события'));
    expect(navigation.navigate).toHaveBeenCalledWith('CreateEventType');
  });
});

describe('EventTypesScreen — возврат на экран (фоновый refresh)', () => {
  it('второй фокус диспатчит повторную загрузку и обновляет список без loading', async () => {
    loadEventTypesMock.mockReturnValueOnce(ok([eventType({ id: 'consultation' })]));
    await renderScreen();
    await focusScreen();
    expect(screen.getByTestId('event-type-card-consultation')).toBeTruthy();

    // Тип события, созданный на экране 10, появляется в списке — AC спеки 10.
    loadEventTypesMock.mockReturnValueOnce(
      ok([eventType({ id: 'consultation' }), eventType({ id: 'demo', name: 'Демо' })]),
    );
    await focusScreen();

    expect(loadEventTypesMock).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('event-type-card-demo')).toBeTruthy();
    expect(screen.queryByTestId('skeleton-event-type-card', HIDDEN)).toBeNull();
  });

  it('неудачный фоновый refresh список не портит', async () => {
    loadEventTypesMock.mockReturnValueOnce(ok([eventType({ id: 'consultation' })]));
    await renderScreen();
    await focusScreen();

    loadEventTypesMock.mockReturnValueOnce(failure({ transport: true }));
    await focusScreen();

    expect(screen.getByTestId('event-type-card-consultation')).toBeTruthy();
    expect(screen.queryByText('Не удалось загрузить типы событий')).toBeNull();
  });
});
