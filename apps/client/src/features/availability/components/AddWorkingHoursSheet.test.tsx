import { fireEvent, render, screen } from '@testing-library/react-native';

import type { WorkingInterval } from '@/features/availability/lib';

import { AddWorkingHoursSheet } from './AddWorkingHoursSheet';

// В @testing-library/react-native 14 `render` и `fireEvent` асинхронные — их обязательно await.

function interval(
  id: string,
  daysOfWeek: WorkingInterval['daysOfWeek'],
  startLocal: string,
  endLocal: string,
): WorkingInterval {
  return { id, daysOfWeek, startLocal, endLocal };
}

/** Открывает степпер поля времени и уменьшает часы `times` раз (лейбл несёт текущее значение). */
async function decrementHours(fieldTestID: string, times: number) {
  await fireEvent.press(screen.getByTestId(fieldTestID));
  for (let i = 0; i < times; i += 1) {
    await fireEvent.press(screen.getByLabelText(/Часы \d+, уменьшить/));
  }
  await fireEvent.press(screen.getByText('Готово'));
}

describe('AddWorkingHoursSheet — создание', () => {
  it('стартует с дефолтов: будни, 09:00–18:00, CTA «Применить к 5 дням»', async () => {
    await render(
      <AddWorkingHoursSheet interval={null} currentIntervals={[]} onApply={jest.fn()} onClose={jest.fn()} />,
    );

    expect(screen.getByText('Добавить рабочее время')).toBeTruthy();
    expect(screen.getByLabelText('Понедельник').props.accessibilityState.selected).toBe(true);
    expect(screen.getByLabelText('Суббота').props.accessibilityState.selected).toBe(false);
    expect(screen.getByText('09:00')).toBeTruthy();
    expect(screen.getByText('18:00')).toBeTruthy();
    expect(screen.getByText('Применить к 5 дням')).toBeTruthy();
  });

  it('применение без пересечений отдаёт payload и не показывает диалог перезаписи', async () => {
    const onApply = jest.fn();
    await render(
      <AddWorkingHoursSheet interval={null} currentIntervals={[]} onApply={onApply} onClose={jest.fn()} />,
    );

    await fireEvent.press(screen.getByTestId('apply-working-hours'));

    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onApply).toHaveBeenCalledWith({
      daysOfWeek: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
      startLocal: '09:00',
      endLocal: '18:00',
    });
    expect(screen.queryByText('Заменить индивидуальные часы?')).toBeNull();
  });
});

describe('AddWorkingHoursSheet — редактирование', () => {
  it('префиллится днями и временем переданного интервала, заголовок меняется', async () => {
    await render(
      <AddWorkingHoursSheet
        interval={interval('sat', ['saturday'], '10:00', '14:00')}
        currentIntervals={[interval('sat', ['saturday'], '10:00', '14:00')]}
        onApply={jest.fn()}
        onClose={jest.fn()}
      />,
    );

    expect(screen.getByText('Изменить рабочее время')).toBeTruthy();
    expect(screen.getByLabelText('Суббота').props.accessibilityState.selected).toBe(true);
    expect(screen.getByLabelText('Понедельник').props.accessibilityState.selected).toBe(false);
    expect(screen.getByText('10:00')).toBeTruthy();
    expect(screen.getByText('14:00')).toBeTruthy();
    expect(screen.getByText('Применить к 1 дню')).toBeTruthy();
  });

  it('редактируемый интервал не перезаписывает сам себя', async () => {
    const onApply = jest.fn();
    const self = interval('self', ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'], '09:00', '18:00');
    await render(
      <AddWorkingHoursSheet interval={self} currentIntervals={[self]} onApply={onApply} onClose={jest.fn()} />,
    );

    await fireEvent.press(screen.getByTestId('apply-working-hours'));

    expect(onApply).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Заменить индивидуальные часы?')).toBeNull();
  });
});

describe('AddWorkingHoursSheet — валидация', () => {
  it('без выбранных дней CTA недоступна и показывает ошибку', async () => {
    const onApply = jest.fn();
    await render(
      <AddWorkingHoursSheet interval={null} currentIntervals={[]} onApply={onApply} onClose={jest.fn()} />,
    );

    for (const day of ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']) {
      await fireEvent.press(screen.getByTestId(`weekday-chip-${day}`));
    }

    expect(screen.getByText('Выберите хотя бы один день')).toBeTruthy();
    expect(screen.getByTestId('apply-working-hours').props.accessibilityState.disabled).toBe(true);

    await fireEvent.press(screen.getByTestId('apply-working-hours'));
    expect(onApply).not.toHaveBeenCalled();
  });

  it('время окончания раньше или равно времени начала — CTA недоступна и показывает ошибку', async () => {
    const onApply = jest.fn();
    await render(
      <AddWorkingHoursSheet interval={null} currentIntervals={[]} onApply={onApply} onClose={jest.fn()} />,
    );

    // 18:00 → 09:00 (9 уменьшений часа), сравнявшись с началом (09:00) — уже невалидно.
    await decrementHours('end-time', 9);

    expect(screen.getByText('Время окончания должно быть позже времени начала')).toBeTruthy();
    expect(screen.getByTestId('apply-working-hours').props.accessibilityState.disabled).toBe(true);

    await fireEvent.press(screen.getByTestId('apply-working-hours'));
    expect(onApply).not.toHaveBeenCalled();
  });
});

describe('AddWorkingHoursSheet — перезапись', () => {
  it('пересечение дней с чужим интервалом уводит в подтверждение вместо немедленного применения', async () => {
    const onApply = jest.fn();
    const other = interval('other', ['monday'], '06:00', '08:00');
    await render(
      <AddWorkingHoursSheet interval={null} currentIntervals={[other]} onApply={onApply} onClose={jest.fn()} />,
    );

    await fireEvent.press(screen.getByTestId('apply-working-hours'));

    expect(onApply).not.toHaveBeenCalled();
    expect(screen.getByText('Заменить индивидуальные часы?')).toBeTruthy();
    expect(screen.getByText('Пн: рабочее время будет заменено на 09:00–18:00.')).toBeTruthy();
  });

  it('подтверждение отдаёт payload и закрывает диалог', async () => {
    const onApply = jest.fn();
    const other = interval('other', ['monday'], '06:00', '08:00');
    await render(
      <AddWorkingHoursSheet interval={null} currentIntervals={[other]} onApply={onApply} onClose={jest.fn()} />,
    );

    await fireEvent.press(screen.getByTestId('apply-working-hours'));
    await fireEvent.press(screen.getByTestId('add-working-hours-sheet-overwrite-dialog-confirm'));

    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onApply).toHaveBeenCalledWith({
      daysOfWeek: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
      startLocal: '09:00',
      endLocal: '18:00',
    });
  });

  it('отмена возвращает к форме без применения, sheet остаётся открытым', async () => {
    const onApply = jest.fn();
    const onClose = jest.fn();
    const other = interval('other', ['monday'], '06:00', '08:00');
    await render(
      <AddWorkingHoursSheet interval={null} currentIntervals={[other]} onApply={onApply} onClose={onClose} />,
    );

    await fireEvent.press(screen.getByTestId('apply-working-hours'));
    await fireEvent.press(screen.getByTestId('add-working-hours-sheet-overwrite-dialog-cancel'));

    expect(screen.queryByText('Заменить индивидуальные часы?')).toBeNull();
    expect(screen.getByTestId('apply-working-hours')).toBeTruthy();
    expect(onApply).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('AddWorkingHoursSheet — закрытие без применения', () => {
  it('системная «назад» вызывает onClose родителя', async () => {
    const onClose = jest.fn();
    await render(
      <AddWorkingHoursSheet interval={null} currentIntervals={[]} onApply={jest.fn()} onClose={onClose} />,
    );

    screen.getByTestId('add-working-hours-sheet-modal').props.onRequestClose();

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
