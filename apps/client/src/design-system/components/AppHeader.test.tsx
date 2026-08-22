import { fireEvent, render, screen } from '@testing-library/react-native';

import { AppHeader, type HeaderAction } from '@/design-system/components/AppHeader';

// В @testing-library/react-native 14 `render` и `fireEvent` асинхронные — их обязательно await.
describe('AppHeader', () => {
  it('рендерит заголовок без rightActions', async () => {
    await render(<AppHeader title="Предстоящие встречи" />);

    expect(screen.getByText('Предстоящие встречи')).toBeTruthy();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('рендерит одну right action и вызывает её onPress', async () => {
    const onPress = jest.fn();
    const actions: HeaderAction[] = [
      { id: 'event-types', icon: 'calendar', accessibilityLabel: 'Открыть типы событий', onPress },
    ];
    await render(<AppHeader title="Предстоящие встречи" rightActions={actions} />);

    const button = screen.getByLabelText('Открыть типы событий');
    expect(button).toBeTruthy();

    await fireEvent.press(button);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('рендерит две right actions и вызывает onPress каждой независимо', async () => {
    const onPressFirst = jest.fn();
    const onPressSecond = jest.fn();
    const actions: HeaderAction[] = [
      { id: 'create', icon: 'calendar', accessibilityLabel: 'Создать тип события', onPress: onPressFirst },
      { id: 'user', icon: 'user', accessibilityLabel: 'Профиль', onPress: onPressSecond },
    ];
    await render(<AppHeader title="Типы событий" rightActions={actions} />);

    await fireEvent.press(screen.getByLabelText('Создать тип события'));
    await fireEvent.press(screen.getByLabelText('Профиль'));

    expect(onPressFirst).toHaveBeenCalledTimes(1);
    expect(onPressSecond).toHaveBeenCalledTimes(1);
  });

  it('отбрасывает лишние right actions сверх максимума в две', async () => {
    const actions: HeaderAction[] = [
      { id: 'first', icon: 'calendar', accessibilityLabel: 'Первое действие', onPress: jest.fn() },
      { id: 'second', icon: 'user', accessibilityLabel: 'Второе действие', onPress: jest.fn() },
      { id: 'third', icon: 'globe', accessibilityLabel: 'Третье действие', onPress: jest.fn() },
    ];
    await render(<AppHeader title="Типы событий" rightActions={actions} />);

    expect(screen.getByLabelText('Первое действие')).toBeTruthy();
    expect(screen.getByLabelText('Второе действие')).toBeTruthy();
    expect(screen.queryByLabelText('Третье действие')).toBeNull();
  });

  it('сочетает backAction и rightActions без потери «Назад»', async () => {
    const onBack = jest.fn();
    const actions: HeaderAction[] = [
      { id: 'event-types', icon: 'calendar', accessibilityLabel: 'Открыть типы событий', onPress: jest.fn() },
    ];
    await render(<AppHeader title="Ваши данные" backAction={onBack} rightActions={actions} />);

    await fireEvent.press(screen.getByLabelText('Назад'));
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('Открыть типы событий')).toBeTruthy();
  });
});
