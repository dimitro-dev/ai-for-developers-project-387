import { fireEvent, render, screen } from '@testing-library/react-native';

import { sizes } from '@/design-system/tokens';

import { BottomNavigationItem } from './BottomNavigationItem';

describe('BottomNavigationItem', () => {
  it('показывает подпись и помечает активный пункт accessibilityState, а не только цветом', async () => {
    await render(
      <BottomNavigationItem icon="calendar" label="Встречи" selected onPress={jest.fn()} testID="item" />,
    );

    expect(screen.getByText('Встречи')).toBeTruthy();
    const item = screen.getByTestId('item');
    expect(item.props.accessibilityState).toEqual(expect.objectContaining({ selected: true }));
    expect(item.props.accessibilityRole).toBe('tab');
  });

  it('неактивный пункт несёт accessibilityState.selected=false', async () => {
    await render(
      <BottomNavigationItem icon="calendar" label="Встречи" selected={false} onPress={jest.fn()} testID="item" />,
    );

    expect(screen.getByTestId('item').props.accessibilityState).toEqual(
      expect.objectContaining({ selected: false }),
    );
  });

  it('touch target не меньше 48dp и нажатие вызывает onPress', async () => {
    const onPress = jest.fn();
    await render(
      <BottomNavigationItem icon="settings" label="Настройки" selected={false} onPress={onPress} testID="item" />,
    );

    const item = screen.getByTestId('item');
    expect(item.props.style).toEqual(expect.objectContaining({ minHeight: sizes.touch.android }));

    await fireEvent.press(item);
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
