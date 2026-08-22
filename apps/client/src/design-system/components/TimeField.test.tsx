import { fireEvent, render, screen } from '@testing-library/react-native';

import { TimeField } from '@/design-system/components/TimeField';

// В @testing-library/react-native 14 `render` и `fireEvent` асинхронные — их обязательно await.
describe('TimeField', () => {
  it('показывает подпись и текущее значение HH:mm', async () => {
    await render(<TimeField label="Время начала" value="09:00" onChange={jest.fn()} />);

    expect(screen.getByText('Время начала')).toBeTruthy();
    expect(screen.getByText('09:00')).toBeTruthy();
  });

  it('открывает степперы по тапу на поле и закрывает их по «Готово»', async () => {
    await render(
      <TimeField label="Время начала" value="09:00" onChange={jest.fn()} testID="start-time" />,
    );

    expect(screen.queryByLabelText('Часы 09, увеличить')).toBeNull();

    await fireEvent.press(screen.getByTestId('start-time'));
    expect(screen.getByLabelText('Часы 09, увеличить')).toBeTruthy();
    expect(screen.getByLabelText('Минуты 00, уменьшить')).toBeTruthy();

    await fireEvent.press(screen.getByText('Готово'));
    expect(screen.queryByLabelText('Часы 09, увеличить')).toBeNull();
  });

  it('увеличивает час с переносом через полночь', async () => {
    const onChange = jest.fn();
    await render(
      <TimeField label="Время начала" value="23:30" onChange={onChange} testID="start-time" />,
    );

    await fireEvent.press(screen.getByTestId('start-time'));
    await fireEvent.press(screen.getByLabelText('Часы 23, увеличить'));

    expect(onChange).toHaveBeenCalledWith('00:30');
  });

  it('уменьшает час с переносом на предыдущие сутки', async () => {
    const onChange = jest.fn();
    await render(
      <TimeField label="Время начала" value="00:15" onChange={onChange} testID="start-time" />,
    );

    await fireEvent.press(screen.getByTestId('start-time'));
    await fireEvent.press(screen.getByLabelText('Часы 00, уменьшить'));

    expect(onChange).toHaveBeenCalledWith('23:15');
  });

  it('меняет минуты шагом в 5 и переносит через ноль', async () => {
    const onChange = jest.fn();
    await render(
      <TimeField label="Время начала" value="09:00" onChange={onChange} testID="start-time" />,
    );

    await fireEvent.press(screen.getByTestId('start-time'));
    await fireEvent.press(screen.getByLabelText('Минуты 00, уменьшить'));
    expect(onChange).toHaveBeenLastCalledWith('09:55');

    await fireEvent.press(screen.getByLabelText('Минуты 00, увеличить'));
    expect(onChange).toHaveBeenLastCalledWith('09:05');
  });

  it('показывает и озвучивает ошибку поля', async () => {
    await render(
      <TimeField
        label="Время окончания"
        value="08:00"
        onChange={jest.fn()}
        error="Время окончания должно быть позже времени начала"
        testID="end-time"
      />,
    );

    const message = screen.getByTestId('end-time-error');
    expect(message).toHaveTextContent('Время окончания должно быть позже времени начала');
    expect(screen.getByTestId('end-time').props.accessibilityHint).toBe(
      'Время окончания должно быть позже времени начала',
    );
  });

  it('без ошибки не рендерит сообщение и не задаёт accessibilityHint', async () => {
    await render(
      <TimeField label="Время начала" value="09:00" onChange={jest.fn()} testID="start-time" />,
    );

    expect(screen.queryByTestId('start-time-error')).toBeNull();
    expect(screen.getByTestId('start-time').props.accessibilityHint).toBeUndefined();
  });
});
