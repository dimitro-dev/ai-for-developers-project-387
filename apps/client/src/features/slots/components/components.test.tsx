import { fireEvent, render, screen } from '@testing-library/react-native';

import { colors, sizes } from '@/design-system/tokens';
import { DateChip } from '@/features/slots/components/DateChip';
import { DateStrip } from '@/features/slots/components/DateStrip';
import { SlotGrid } from '@/features/slots/components/SlotGrid';
import { SlotItem } from '@/features/slots/components/SlotItem';
import type { SlotView } from '@/features/guest/model/types';
import type { AvailableDate } from '@/features/slots/lib';

const PRAGUE = 'Europe/Prague';

const dates: AvailableDate[] = [
  { date: '2026-07-31', weekdayLabel: 'Пт', dayLabel: '31' },
  { date: '2026-08-01', weekdayLabel: 'Сб', dayLabel: '1' },
  { date: '2026-08-03', weekdayLabel: 'Пн', dayLabel: '3' },
];

function slot(startAtUtc: string, endAtUtc: string): SlotView {
  return { startAtUtc, endAtUtc, eventTypeId: 'consultation' };
}

const slots: SlotView[] = [
  slot('2026-07-31T07:00:00Z', '2026-07-31T07:30:00Z'),
  slot('2026-07-31T07:30:00Z', '2026-07-31T08:00:00Z'),
  slot('2026-07-31T08:00:00Z', '2026-07-31T08:30:00Z'),
];

describe('DateChip', () => {
  it('озвучивает полную дату и отдаёт свою дату в onPress', async () => {
    const onPress = jest.fn();
    await render(
      <DateChip date="2026-07-31" weekdayLabel="Пт" dayLabel="31" selected={false} onPress={onPress} />,
    );

    const chip = screen.getByLabelText('Пятница, 31 июля');
    expect(screen.getByText('Пт')).toBeTruthy();
    expect(screen.getByText('31')).toBeTruthy();

    await fireEvent.press(chip);
    expect(onPress).toHaveBeenCalledWith('2026-07-31');
  });

  it('выбранный чип помечен для screen reader и залит guest-токеном', async () => {
    await render(
      <DateChip date="2026-07-31" weekdayLabel="Пт" dayLabel="31" selected onPress={jest.fn()} />,
    );

    const chip = screen.getByTestId('date-chip-2026-07-31');
    expect(chip.props.accessibilityState).toEqual(expect.objectContaining({ selected: true }));
    expect(chip.props.style).toEqual(
      expect.objectContaining({
        backgroundColor: colors.light.guest.selectedSurface,
        width: sizes.dateChip.width,
        height: sizes.dateChip.height,
      }),
    );
  });
});

describe('DateStrip', () => {
  it('рендерит все даты по возрастанию и ровно одну выбранную', async () => {
    await render(<DateStrip dates={dates} selectedDate="2026-08-01" onSelect={jest.fn()} />);

    const selected = dates.filter(
      (item) => screen.getByTestId(`date-chip-${item.date}`).props.accessibilityState.selected,
    );
    expect(selected).toEqual([dates[1]]);
    expect(screen.getAllByRole('button')).toHaveLength(3);
  });

  it('передаёт выбранную дату наверх', async () => {
    const onSelect = jest.fn();
    await render(<DateStrip dates={dates} onSelect={onSelect} />);

    await fireEvent.press(screen.getByTestId('date-chip-2026-08-03'));
    expect(onSelect).toHaveBeenCalledWith('2026-08-03');
  });
});

describe('SlotItem', () => {
  it('показывает только время начала в timezone гостя', async () => {
    await render(
      <SlotItem
        startAtUtc="2026-07-31T08:00:00Z"
        endAtUtc="2026-07-31T08:30:00Z"
        selected={false}
        onPress={jest.fn()}
        timeZone={PRAGUE}
      />,
    );

    expect(screen.getByText('10:00')).toBeTruthy();
    expect(screen.queryByText('10:30')).toBeNull();
    expect(screen.getByLabelText('Выбрать время 10:00')).toBeTruthy();
  });

  it('выбранный слот помечен и залит guest-токеном', async () => {
    await render(
      <SlotItem
        startAtUtc="2026-07-31T08:00:00Z"
        endAtUtc="2026-07-31T08:30:00Z"
        selected
        onPress={jest.fn()}
        timeZone={PRAGUE}
      />,
    );

    const item = screen.getByTestId('slot-item-2026-07-31T08:00:00Z');
    expect(item.props.accessibilityState).toEqual(expect.objectContaining({ selected: true }));
    expect(item.props.style).toEqual(
      expect.objectContaining({
        backgroundColor: colors.light.guest.selectedSurface,
        height: sizes.slot.height,
      }),
    );
  });
});

describe('SlotGrid', () => {
  it('отдаёт в onSelect выбранный слот целиком', async () => {
    const onSelect = jest.fn();
    await render(<SlotGrid slots={slots} columns={2} onSelect={onSelect} timeZone={PRAGUE} />);

    await fireEvent.press(screen.getByTestId('slot-item-2026-07-31T07:30:00Z'));
    expect(onSelect).toHaveBeenCalledWith(slots[1]);
  });

  it('порядок слотов сохраняет и выбранным помечает не больше одного', async () => {
    await render(
      <SlotGrid
        slots={slots}
        columns={2}
        selectedStartAtUtc="2026-07-31T08:00:00Z"
        onSelect={jest.fn()}
        timeZone={PRAGUE}
      />,
    );

    expect(screen.getAllByRole('button').map((item) => item.props.accessibilityLabel)).toEqual([
      'Выбрать время 09:00',
      'Выбрать время 09:30',
      'Выбрать время 10:00',
    ]);
    const selected = screen
      .getAllByRole('button')
      .filter((item) => item.props.accessibilityState.selected);
    expect(selected).toHaveLength(1);
  });

  it('раскладывает по указанному числу колонок', async () => {
    const view = await render(
      <SlotGrid slots={slots} columns={2} onSelect={jest.fn()} timeZone={PRAGUE} />,
    );
    // Три слота при двух колонках — два ряда; последний ряд не растягивает единственный элемент.
    expect(view.getByTestId('slot-grid').props.children).toHaveLength(2);
  });

  it('пустой набор рендерится без рядов', async () => {
    await render(<SlotGrid slots={[]} columns={2} onSelect={jest.fn()} timeZone={PRAGUE} />);

    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });
});
