import { fireEvent, render, screen } from '@testing-library/react-native';

import { AppButton } from '@/design-system/components/AppButton';

// В @testing-library/react-native 14 `render` и `fireEvent` асинхронные — их обязательно await.
describe('AppButton', () => {
  it('показывает подпись и вызывает onPress', async () => {
    const onPress = jest.fn();
    await render(<AppButton variant="primary" label="Продолжить" onPress={onPress} />);

    expect(screen.getByText('Продолжить')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('не вызывает onPress в состоянии disabled', async () => {
    const onPress = jest.fn();
    await render(<AppButton variant="primary" label="Продолжить" onPress={onPress} disabled />);

    await fireEvent.press(screen.getByRole('button'));
    expect(onPress).not.toHaveBeenCalled();
  });
});
