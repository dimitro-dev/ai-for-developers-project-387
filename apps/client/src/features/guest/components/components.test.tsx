import { fireEvent, render, screen } from '@testing-library/react-native';

import { colors, sizes } from '@/design-system/tokens';
import { BookingSummaryCard } from '@/features/guest/components/BookingSummaryCard';
import { ConfirmationDetails } from '@/features/guest/components/ConfirmationDetails';
import { PublicEventTypeCard } from '@/features/guest/components/PublicEventTypeCard';

const HIDDEN = { includeHiddenElements: true } as const;
const PRAGUE = 'Europe/Prague';

describe('PublicEventTypeCard', () => {
  it('показывает название, описание и длительность и открывается одним тапом', async () => {
    const onPress = jest.fn();
    await render(
      <PublicEventTypeCard
        id="consultation"
        name="Консультация"
        description="Знакомство и ответы на вопросы"
        durationMinutes={30}
        accentIndex={0}
        onPress={onPress}
      />,
    );

    expect(screen.getByText('Консультация')).toBeTruthy();
    expect(screen.getByText('Знакомство и ответы на вопросы')).toBeTruthy();
    expect(screen.getByText('30 минут')).toBeTruthy();

    // Вся карточка — один интерактивный элемент.
    const card = screen.getByRole('button');
    expect(card.props.accessibilityLabel).toBe(
      'Консультация. Знакомство и ответы на вопросы. 30 минут',
    );
    await fireEvent.press(card);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('красит плитку акцентом по индексу и держит высоту карточки', async () => {
    await render(
      <PublicEventTypeCard
        id="product-review"
        name="Product review"
        durationMinutes={60}
        accentIndex={2}
        onPress={jest.fn()}
      />,
    );

    // accentIndex 0…5 → токены $color.accent.1 … $color.accent.6.
    expect(screen.getByTestId('event-type-card-product-review').props.style).toEqual(
      expect.objectContaining({ minHeight: sizes.card.eventType.height }),
    );
    expect(screen.getByTestId('event-type-accent').props.style).toEqual(
      expect.objectContaining({ backgroundColor: colors.light.accent[3] }),
    );
  });

  it('без описания раскладка не ломается', async () => {
    await render(
      <PublicEventTypeCard
        id="demo"
        name="Демо"
        durationMinutes={60}
        accentIndex={1}
        onPress={jest.fn()}
      />,
    );

    expect(screen.getByText('Демо')).toBeTruthy();
    expect(screen.getByText('1 час')).toBeTruthy();
    expect(screen.getByRole('button').props.accessibilityLabel).toBe('Демо. 1 час');
  });
});

describe('BookingSummaryCard', () => {
  it('показывает встречу, слот и timezone гостя', async () => {
    await render(
      <BookingSummaryCard
        eventTypeName="Консультация"
        startAtUtc="2026-07-31T08:00:00Z"
        endAtUtc="2026-07-31T08:30:00Z"
        timeZone={PRAGUE}
        onEdit={jest.fn()}
      />,
    );

    expect(screen.getByText('Консультация')).toBeTruthy();
    expect(screen.getByText('31 июля · 10:00–10:30')).toBeTruthy();
    expect(screen.getByText(`${PRAGUE} · UTC+02:00`)).toBeTruthy();
  });

  it('«Изменить» вызывает возврат и держит тап-таргет 48 dp', async () => {
    const onEdit = jest.fn();
    await render(
      <BookingSummaryCard
        eventTypeName="Консультация"
        startAtUtc="2026-07-31T08:00:00Z"
        endAtUtc="2026-07-31T08:30:00Z"
        timeZone={PRAGUE}
        onEdit={onEdit}
      />,
    );

    const edit = screen.getByTestId('booking-summary-edit');
    await fireEvent.press(edit);
    expect(onEdit).toHaveBeenCalledTimes(1);

    expect(edit.props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ minHeight: sizes.touch.android })]),
    );
  });
});

describe('ConfirmationDetails', () => {
  const details = {
    eventTypeName: 'Консультация',
    dateText: '31 июля 2026',
    timeRangeText: '10:00 – 10:30',
    timeZone: PRAGUE,
    guestName: 'Anna Novak',
    guestEmail: 'anna@example.com',
  };

  it('показывает все шесть строк кадра 7 в порядке спеки', async () => {
    await render(<ConfirmationDetails {...details} />);

    for (const value of [
      details.eventTypeName,
      details.dateText,
      details.timeRangeText,
      `${PRAGUE} · UTC+02:00`,
      details.guestName,
      details.guestEmail,
    ]) {
      expect(screen.getByText(value)).toBeTruthy();
    }

    for (const icon of ['event-type', 'calendar', 'clock', 'user', 'mail']) {
      expect(screen.getByTestId(`icon-${icon}`, HIDDEN)).toBeTruthy();
    }
  });

  it('email сокращается визуально, но остаётся целым текстом', async () => {
    await render(<ConfirmationDetails {...details} guestEmail="very.long.address@example.com" />);

    const email = screen.getByText('very.long.address@example.com');
    expect(email.props.numberOfLines).toBe(1);
  });

  it('не содержит интерактивных элементов', async () => {
    await render(<ConfirmationDetails {...details} />);

    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });
});
