import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import type { CalendarView, EventTypeView } from '@/features/guest/model/types';
import { GuestEventTypesScreen } from '@/features/guest/screens/GuestEventTypesScreen';
import { CONTENT_MAX_WIDTH } from '@/design-system/layout/adaptive';
import type { GuestStackParamList } from '@/navigation/GuestStackParamList';

// Экран проверяется через мок use-cases: ветви ошибок Prism не отдаёт, а сеть в тестах не нужна.
jest.mock('@/features/guest/usecases/guest', () => ({
  loadPublicCalendar: jest.fn(),
  loadPublicEventTypes: jest.fn(),
}));

import { loadPublicCalendar, loadPublicEventTypes } from '@/features/guest/usecases/guest';

const mockedCalendar = loadPublicCalendar as jest.MockedFunction<typeof loadPublicCalendar>;
const mockedEventTypes = loadPublicEventTypes as jest.MockedFunction<typeof loadPublicEventTypes>;

const calendar: CalendarView = { displayName: 'Дмитрием' };

const eventTypes: EventTypeView[] = [
  {
    id: 'consultation',
    name: 'Консультация',
    description: 'Знакомство и ответы на вопросы',
    durationMinutes: 30,
  },
  { id: 'product-review', name: 'Product review', description: null, durationMinutes: 60 },
];

type Props = NativeStackScreenProps<GuestStackParamList, 'GuestEventTypes'>;

const navigate = jest.fn();

function renderScreen() {
  const navigation = { navigate } as unknown as Props['navigation'];
  const route = { key: 'GuestEventTypes', name: 'GuestEventTypes' } as Props['route'];
  return render(<GuestEventTypesScreen navigation={navigation} route={route} />);
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('GuestEventTypesScreen — состояния', () => {
  it('loading: скелетоны до ответа пары чтений', async () => {
    mockedCalendar.mockReturnValue(new Promise(() => {}));
    mockedEventTypes.mockReturnValue(new Promise(() => {}));

    await renderScreen();

    // Скелетоны скрыты от screen reader, поэтому в запрос входят только явно.
    expect(
      screen.getAllByTestId('skeleton-event-type-card', { includeHiddenElements: true }),
    ).toHaveLength(2);
    expect(screen.queryByTestId('catalog-title')).toBeNull();
  });

  it('content: заголовок из displayName и карточки списка', async () => {
    mockedCalendar.mockResolvedValue({ ok: true, data: calendar });
    mockedEventTypes.mockResolvedValue({ ok: true, data: eventTypes });

    await renderScreen();

    await waitFor(() => expect(screen.getByTestId('catalog-title')).toBeTruthy());
    expect(screen.getByText('Запланировать встречу с Дмитрием')).toBeTruthy();
    expect(screen.getByTestId('event-type-card-consultation')).toBeTruthy();
    expect(screen.getByTestId('event-type-card-product-review')).toBeTruthy();
  });

  it('content: колонка контента ограничивает ширину, а не полагается на fit-content', async () => {
    mockedCalendar.mockResolvedValue({ ok: true, data: calendar });
    mockedEventTypes.mockResolvedValue({ ok: true, data: eventTypes });

    await renderScreen();

    await waitFor(() => expect(screen.getByTestId('catalog-title')).toBeTruthy());

    const column = screen.getByTestId('catalog-content-column');
    const styles = Array.isArray(column.props.style) ? column.props.style.flat() : [column.props.style];
    expect(styles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          width: '100%',
          maxWidth: CONTENT_MAX_WIDTH,
          alignSelf: 'center',
        }),
      ]),
    );
  });

  it('empty: пустой список выглядит как ненастроенный календарь', async () => {
    mockedCalendar.mockResolvedValue({ ok: true, data: calendar });
    mockedEventTypes.mockResolvedValue({ ok: true, data: [] });

    await renderScreen();

    await waitFor(() => expect(screen.getByText('Встречи пока недоступны')).toBeTruthy());
  });

  it('empty: CALENDAR_NOT_CONFIGURED любого из двух чтений', async () => {
    const notConfigured = {
      ok: false as const,
      error: { code: 'CALENDAR_NOT_CONFIGURED', message: null, transport: false },
    };
    mockedCalendar.mockResolvedValue(notConfigured);
    mockedEventTypes.mockResolvedValue(notConfigured);

    await renderScreen();

    await waitFor(() => expect(screen.getByText('Встречи пока недоступны')).toBeTruthy());
  });

  it('error: транспортная ошибка списка показывает текст маппера, а не сырой message', async () => {
    mockedCalendar.mockResolvedValue({ ok: true, data: calendar });
    mockedEventTypes.mockResolvedValue({
      ok: false,
      error: { code: null, message: 'Failed to fetch', transport: true },
    });

    await renderScreen();

    await waitFor(() => expect(screen.getByText('Не удалось загрузить встречи')).toBeTruthy());
    expect(screen.getByTestId('catalog-error-message')).toHaveTextContent(
      'Нет связи с сервером. Проверьте подключение и попробуйте ещё раз.',
    );
    expect(screen.queryByText('Failed to fetch')).toBeNull();
  });
});

describe('GuestEventTypesScreen — действия', () => {
  it('«Повторить» перезапускает пару чтений целиком', async () => {
    mockedCalendar.mockResolvedValue({ ok: true, data: calendar });
    mockedEventTypes.mockResolvedValue({
      ok: false,
      error: { code: null, message: null, transport: true },
    });

    await renderScreen();
    await waitFor(() => expect(screen.getByText('Повторить')).toBeTruthy());

    mockedEventTypes.mockResolvedValue({ ok: true, data: eventTypes });
    await fireEvent.press(screen.getByText('Повторить'));

    await waitFor(() => expect(screen.getByTestId('catalog-title')).toBeTruthy());
    expect(mockedCalendar).toHaveBeenCalledTimes(2);
    expect(mockedEventTypes).toHaveBeenCalledTimes(2);
  });

  it('tap по карточке открывает слоты с четырьмя параметрами route', async () => {
    mockedCalendar.mockResolvedValue({ ok: true, data: calendar });
    mockedEventTypes.mockResolvedValue({ ok: true, data: eventTypes });

    await renderScreen();
    await waitFor(() => expect(screen.getByTestId('event-type-card-consultation')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('event-type-card-consultation'));

    expect(navigate).toHaveBeenCalledWith('GuestSlots', {
      eventTypeId: 'consultation',
      eventTypeName: 'Консультация',
      durationMinutes: 30,
      eventTypeDescription: 'Знакомство и ответы на вопросы',
    });
  });

  it('тип встречи без описания не передаёт пустой параметр', async () => {
    mockedCalendar.mockResolvedValue({ ok: true, data: calendar });
    mockedEventTypes.mockResolvedValue({ ok: true, data: eventTypes });

    await renderScreen();
    await waitFor(() => expect(screen.getByTestId('event-type-card-product-review')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('event-type-card-product-review'));

    expect(navigate).toHaveBeenCalledWith('GuestSlots', {
      eventTypeId: 'product-review',
      eventTypeName: 'Product review',
      durationMinutes: 60,
    });
  });
});
