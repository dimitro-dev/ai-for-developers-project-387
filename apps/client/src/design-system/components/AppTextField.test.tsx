import { fireEvent, render, screen } from '@testing-library/react-native';

import { AppTextField } from '@/design-system/components/AppTextField';

// В @testing-library/react-native 14 `render` и `fireEvent` асинхронные — их обязательно await.
describe('AppTextField', () => {
  it('показывает label, значение и вызывает onChangeText', async () => {
    const onChangeText = jest.fn();
    await render(
      <AppTextField label="Название" value="Демо" onChangeText={onChangeText} testID="title" />,
    );

    expect(screen.getByText('Название')).toBeTruthy();
    expect(screen.getByTestId('title').props.value).toBe('Демо');

    await fireEvent.changeText(screen.getByTestId('title'), 'Демо 2');
    expect(onChangeText).toHaveBeenCalledWith('Демо 2');
  });

  it('без ошибки не рендерит ValidationMessage', async () => {
    await render(<AppTextField label="Название" value="" onChangeText={jest.fn()} />);

    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('непустая ошибка подсвечивает поле и показывает сообщение', async () => {
    await render(
      <AppTextField
        label="Email"
        value=""
        onChangeText={jest.fn()}
        error="Введите корректный email"
        testID="email"
      />,
    );

    expect(screen.getByText('Введите корректный email')).toBeTruthy();
    expect(screen.getByTestId('email').props.accessibilityHint).toBe(
      'Введите корректный email',
    );
  });

  // TODO-COMPONENT спеки 10 (`docs/ui-spec-kit/specs/ui/screens/10-create-event-type.screen.md`):
  // префикс «/» у поля публичного id типа события.
  describe('prefix', () => {
    it('рендерит префикс перед значением поля', async () => {
      const onChangeText = jest.fn();
      await render(
        <AppTextField
          label="Публичный id"
          value="demo"
          onChangeText={onChangeText}
          prefix="/"
          testID="public-id"
        />,
      );

      expect(screen.getByText('/')).toBeTruthy();
      expect(screen.getByTestId('public-id').props.value).toBe('demo');

      await fireEvent.changeText(screen.getByTestId('public-id'), 'demo-2');
      expect(onChangeText).toHaveBeenCalledWith('demo-2');
    });

    it('ошибка с префиксом всё ещё показывает ValidationMessage', async () => {
      await render(
        <AppTextField
          label="Публичный id"
          value="demo"
          onChangeText={jest.fn()}
          prefix="/"
          error="Публичный id уже занят"
          testID="public-id"
        />,
      );

      expect(screen.getByText('Публичный id уже занят')).toBeTruthy();
    });

    it('без prefix поведение не меняется: рамка и фон остаются на самом поле', async () => {
      await render(
        <AppTextField label="Название" value="" onChangeText={jest.fn()} testID="title-plain" />,
      );

      const style = screen.getByTestId('title-plain').props.style;
      expect(style.borderWidth).toBe(1);
      expect(style.paddingHorizontal).toBeGreaterThan(0);
    });
  });
});
