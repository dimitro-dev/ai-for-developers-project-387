import { fireEvent, render, screen } from '@testing-library/react-native';

import { sizes } from '@/design-system/tokens';

import { ScheduleCard } from './ScheduleCard';

interface TestInterval {
  id: string;
}

describe('ScheduleCard', () => {
  const interval: TestInterval = { id: 'interval-1' };

  it('показывает дни и время одной accessibility-фразой, тап отдаёт интервал целиком', async () => {
    const onPress = jest.fn();
    await render(
      <ScheduleCard<TestInterval>
        interval={interval}
        daysLabel="Пн–Пт"
        timeLabel="09:00–18:00"
        onPress={onPress}
      />,
    );

    expect(screen.getByText('Пн–Пт')).toBeTruthy();
    expect(screen.getByText('09:00–18:00')).toBeTruthy();

    const card = screen.getByRole('button');
    expect(card.props.accessibilityLabel).toBe('Пн–Пт. 09:00–18:00');

    await fireEvent.press(card);
    // Нагрузка нажатия — интервал строки целиком: экрану не нужно искать его по id.
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(onPress).toHaveBeenCalledWith({ interval });
  });

  it('держит минимальную высоту карточки', async () => {
    await render(
      <ScheduleCard<TestInterval>
        interval={interval}
        daysLabel="Сб, Вс"
        timeLabel="10:00–14:00"
        onPress={jest.fn()}
        testID="schedule-card-1"
      />,
    );

    expect(screen.getByTestId('schedule-card-1').props.style).toEqual(
      expect.objectContaining({ minHeight: sizes.card.schedule.height }),
    );
  });
});
