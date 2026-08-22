import { render, screen } from '@testing-library/react-native';

import { colors, sizes } from '@/design-system/tokens';
import { durationLabel as formatDuration, eventTypeAccentIndex } from '@/features/event-types/lib';

import { EventTypeCard } from './EventTypeCard';

const HIDDEN = { includeHiddenElements: true } as const;

describe('EventTypeCard', () => {
  it('показывает название, описание, длительность и публичный id', async () => {
    await render(
      <EventTypeCard
        id="consultation"
        title="Консультация"
        description="Знакомство и ответы на вопросы"
        durationLabel={formatDuration(30)}
        publicId="consultation"
        accentIndex={eventTypeAccentIndex('consultation')}
      />,
    );

    expect(screen.getByText('Консультация')).toBeTruthy();
    expect(screen.getByText('Знакомство и ответы на вопросы')).toBeTruthy();
    expect(screen.getByText('30 минут')).toBeTruthy();
    expect(screen.getByText('/consultation')).toBeTruthy();
  });

  it('без описания раскладка не ломается', async () => {
    await render(
      <EventTypeCard
        id="demo"
        title="Демо"
        durationLabel={formatDuration(60)}
        publicId="demo"
        accentIndex={eventTypeAccentIndex('demo')}
      />,
    );

    expect(screen.getByText('Демо')).toBeTruthy();
    expect(screen.getByText('1 час')).toBeTruthy();
    expect(screen.getByText('/demo')).toBeTruthy();
  });

  it('один и тот же id всегда даёт один и тот же акцентный цвет плитки', async () => {
    await render(
      <EventTypeCard
        id="product-review"
        title="Product review"
        durationLabel={formatDuration(60)}
        publicId="product-review"
        accentIndex={2}
        testID="event-type-card-product-review"
      />,
    );

    expect(screen.getByTestId('event-type-card-product-review').props.style).toEqual(
      expect.objectContaining({ minHeight: sizes.card.eventType.height }),
    );
    expect(screen.getByTestId('event-type-accent').props.style).toEqual(
      expect.objectContaining({ backgroundColor: colors.light.accent[3] }),
    );
  });

  it('карточка не нажимаема, плитка с глифом не попадает в озвучивание', async () => {
    await render(
      <EventTypeCard
        id="demo"
        title="Демо"
        durationLabel={formatDuration(60)}
        publicId="demo"
        accentIndex={0}
      />,
    );

    // В MVP у карточки нет onPress: интерактивных элементов внутри быть не должно.
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    // Глиф плитки декоративен — по умолчанию скрыт от screen reader, доступен только явным запросом.
    expect(screen.queryByTestId('icon-event-type')).toBeNull();
    expect(screen.getByTestId('icon-event-type', HIDDEN)).toBeTruthy();
  });
});
