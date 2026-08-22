import { fireEvent, render, screen } from '@testing-library/react-native';

import type { BookingView } from '@/features/owner/model/types';

import { BookingDetailsSheet } from './BookingDetailsSheet';

const HIDDEN = { includeHiddenElements: true } as const;

function booking(comment?: string): BookingView {
  return {
    id: 'booking-1',
    eventTypeTitle: 'Консультация',
    startAt: '2026-07-31T09:00:00Z' as BookingView['startAt'],
    endAt: '2026-07-31T09:30:00Z' as BookingView['endAt'],
    guest: {
      name: 'Anna Novak',
      email: 'anna@example.com',
      ...(comment === undefined ? {} : { comment }),
    },
  };
}

describe('BookingDetailsSheet', () => {
  it('показывает дату/время, timezone и гостя; заголовок — eventTypeTitle', async () => {
    const onClose = jest.fn();
    await render(
      <BookingDetailsSheet
        booking={booking()}
        dateText="Пятница, 31 июля"
        timeZone="Europe/Prague"
        onClose={onClose}
      />,
    );

    expect(screen.getByLabelText('Консультация')).toBeTruthy();
    expect(screen.getByText('Пятница, 31 июля, 11:00–11:30')).toBeTruthy();
    expect(screen.getByText(/Europe\/Prague/)).toBeTruthy();
    expect(screen.getByText('Anna Novak')).toBeTruthy();
    expect(screen.getByText('anna@example.com')).toBeTruthy();
    expect(screen.queryByText('Комментарий')).toBeNull();
  });

  it('непустой комментарий гостя показывает секцию «Комментарий»', async () => {
    await render(
      <BookingDetailsSheet
        booking={booking('Хочу обсудить условия заранее')}
        dateText="Пятница, 31 июля"
        timeZone="Europe/Prague"
        onClose={jest.fn()}
      />,
    );

    expect(screen.getByText('Комментарий')).toBeTruthy();
    expect(screen.getByText('Хочу обсудить условия заранее')).toBeTruthy();
  });

  it('«Закрыть» вызывает onClose', async () => {
    const onClose = jest.fn();
    await render(
      <BookingDetailsSheet
        booking={booking()}
        dateText="Пятница, 31 июля"
        timeZone="Europe/Prague"
        onClose={onClose}
      />,
    );

    await fireEvent.press(screen.getByTestId('booking-details-close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('backdrop и системная «назад» тоже закрывают sheet (конвенция AppBottomSheet)', async () => {
    const onClose = jest.fn();
    await render(
      <BookingDetailsSheet
        booking={booking()}
        dateText="Пятница, 31 июля"
        timeZone="Europe/Prague"
        onClose={onClose}
      />,
    );

    await fireEvent.press(screen.getByTestId('booking-details-sheet-backdrop', HIDDEN));
    expect(onClose).toHaveBeenCalledTimes(1);

    screen.getByTestId('booking-details-sheet-modal').props.onRequestClose();
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
