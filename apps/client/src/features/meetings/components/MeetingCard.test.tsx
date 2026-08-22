import { fireEvent, render, screen } from '@testing-library/react-native';

import { sizes } from '@/design-system/tokens';

import { MeetingCard } from './MeetingCard';

interface TestBooking {
  id: string;
}

describe('MeetingCard', () => {
  const booking: TestBooking = { id: 'booking-1' };

  it('показывает время, тип встречи и гостя, тап отдаёт встречу целиком', async () => {
    const onPress = jest.fn();
    await render(
      <MeetingCard<TestBooking>
        booking={booking}
        startTime="10:00"
        endTime="10:30"
        title="Консультация"
        guestName="Anna Novak"
        guestEmail="anna@example.com"
        onPress={onPress}
      />,
    );

    expect(screen.getByText('10:00')).toBeTruthy();
    expect(screen.getByText('10:30')).toBeTruthy();
    expect(screen.getByText('Консультация')).toBeTruthy();
    expect(screen.getByText('Anna Novak')).toBeTruthy();
    expect(screen.getByText('anna@example.com')).toBeTruthy();

    const card = screen.getByRole('button');
    expect(card.props.accessibilityLabel).toBe('10:00–10:30. Консультация. Anna Novak');

    await fireEvent.press(card);
    // Нагрузка нажатия — встреча целиком: экран не ищет её по id.
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(onPress).toHaveBeenCalledWith({ booking });
  });

  it('email сокращается визуально, но остаётся целым текстом, карточка держит минимальную высоту', async () => {
    await render(
      <MeetingCard<TestBooking>
        booking={booking}
        startTime="14:00"
        endTime="14:45"
        title="Product review"
        guestName="Jan Novotny"
        guestEmail="very.long.address@example.com"
        onPress={jest.fn()}
        testID="meeting-card-1"
      />,
    );

    const email = screen.getByText('very.long.address@example.com');
    expect(email.props.numberOfLines).toBe(1);

    expect(screen.getByTestId('meeting-card-1').props.style).toEqual(
      expect.objectContaining({ minHeight: sizes.card.meeting.height }),
    );
  });
});
