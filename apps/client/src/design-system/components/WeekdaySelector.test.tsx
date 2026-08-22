import { fireEvent, render, screen } from '@testing-library/react-native';

import { sizes } from '@/design-system/tokens';
import { WeekdaySelector, type Weekday } from '@/design-system/components/WeekdaySelector';

const WORKDAYS: Weekday[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];

// В @testing-library/react-native 14 `render` и `fireEvent` асинхронные — их обязательно await.
describe('WeekdaySelector', () => {
  it('рендерит семь дней короткими подписями, начиная с понедельника', async () => {
    await render(<WeekdaySelector selectedDays={WORKDAYS} onChange={jest.fn()} />);

    expect(screen.getAllByRole('button')).toHaveLength(7);
    expect(
      screen.getAllByRole('button').map((chip) => chip.props.accessibilityLabel),
    ).toEqual([
      'Понедельник',
      'Вторник',
      'Среда',
      'Четверг',
      'Пятница',
      'Суббота',
      'Воскресенье',
    ]);
    expect(screen.getByText('Пн')).toBeTruthy();
    expect(screen.getByText('Вс')).toBeTruthy();
  });

  it('каждый чип не меньше 48×48 dp и выбранные помечены accessibilityState', async () => {
    await render(<WeekdaySelector selectedDays={WORKDAYS} onChange={jest.fn()} />);

    const monday = screen.getByTestId('weekday-chip-monday');
    expect(monday.props.style).toEqual(
      expect.objectContaining({ minWidth: sizes.touch.android, minHeight: sizes.touch.android }),
    );
    expect(monday.props.accessibilityState).toEqual(expect.objectContaining({ selected: true }));

    const saturday = screen.getByTestId('weekday-chip-saturday');
    expect(saturday.props.accessibilityState).toEqual(expect.objectContaining({ selected: false }));
  });

  it('тап снимает выбранный день и отдаёт остаток в порядке недели', async () => {
    const onChange = jest.fn();
    await render(<WeekdaySelector selectedDays={WORKDAYS} onChange={onChange} />);

    await fireEvent.press(screen.getByTestId('weekday-chip-wednesday'));

    expect(onChange).toHaveBeenCalledWith(['monday', 'tuesday', 'thursday', 'friday']);
  });

  it('тап добавляет день и результат идёт в порядке недели, а не в порядке кликов', async () => {
    const onChange = jest.fn();
    await render(<WeekdaySelector selectedDays={['monday']} onChange={onChange} />);

    await fireEvent.press(screen.getByTestId('weekday-chip-sunday'));
    expect(onChange).toHaveBeenLastCalledWith(['monday', 'sunday']);
  });

  it('пустой набор дней рендерится без выбранных чипов', async () => {
    await render(<WeekdaySelector selectedDays={[]} onChange={jest.fn()} />);

    const selected = screen
      .getAllByRole('button')
      .filter((chip) => chip.props.accessibilityState.selected);
    expect(selected).toHaveLength(0);
  });

  it('полный набор дней рендерится со всеми выбранными чипами', async () => {
    const allDays: Weekday[] = [
      'monday',
      'tuesday',
      'wednesday',
      'thursday',
      'friday',
      'saturday',
      'sunday',
    ];
    await render(<WeekdaySelector selectedDays={allDays} onChange={jest.fn()} />);

    const selected = screen
      .getAllByRole('button')
      .filter((chip) => chip.props.accessibilityState.selected);
    expect(selected).toHaveLength(7);
  });
});
