import { fireEvent, render, screen } from '@testing-library/react-native';

import { colors, sizes } from '@/design-system/tokens';
import { DurationSelector } from '@/features/event-types/components/DurationSelector';

// В @testing-library/react-native 14 `render` и `fireEvent` асинхронные — их обязательно await.
describe('DurationSelector', () => {
  it('рендерит четыре чипа короткой подписью «N мин»', async () => {
    await render(<DurationSelector id="duration" value={30} onChange={jest.fn()} />);

    expect(screen.getAllByRole('button')).toHaveLength(4);
    expect(screen.getByText('15 мин')).toBeTruthy();
    expect(screen.getByText('30 мин')).toBeTruthy();
    expect(screen.getByText('45 мин')).toBeTruthy();
    expect(screen.getByText('60 мин')).toBeTruthy();
  });

  it('ровно один чип выбран и озвучен как selected', async () => {
    await render(<DurationSelector id="duration" value={30} onChange={jest.fn()} />);

    const selected = screen
      .getAllByRole('button')
      .filter((chip) => chip.props.accessibilityState.selected);
    expect(selected).toHaveLength(1);
    expect(selected[0].props.accessibilityLabel).toBe('30 мин');
  });

  it('каждое значение длительности выбирается тапом и отдаёт число минут', async () => {
    const onChange = jest.fn();
    await render(<DurationSelector id="duration" value={30} onChange={onChange} />);

    await fireEvent.press(screen.getByTestId('duration-chip-duration-15'));
    expect(onChange).toHaveBeenLastCalledWith(15);

    await fireEvent.press(screen.getByTestId('duration-chip-duration-45'));
    expect(onChange).toHaveBeenLastCalledWith(45);

    await fireEvent.press(screen.getByTestId('duration-chip-duration-60'));
    expect(onChange).toHaveBeenLastCalledWith(60);
  });

  it('каждый чип не меньше 48 dp и выбранный залит токеном action.primary', async () => {
    await render(<DurationSelector id="duration" value={60} onChange={jest.fn()} />);

    const chip = screen.getByTestId('duration-chip-duration-60');
    expect(chip.props.style).toEqual(
      expect.objectContaining({
        minHeight: sizes.touch.android,
        backgroundColor: colors.light.action.primary,
      }),
    );

    const unselected = screen.getByTestId('duration-chip-duration-15');
    expect(unselected.props.style).toEqual(
      expect.objectContaining({ backgroundColor: colors.light.background.secondary }),
    );
  });
});
