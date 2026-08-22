import { fireEvent, render, screen } from '@testing-library/react-native';

import { ConfirmationDialog } from '@/design-system/components/ConfirmationDialog';

// В @testing-library/react-native 14 `render` и `fireEvent` асинхронные — их обязательно await.
// Backdrop декоративен для screen reader (см. AppIcon.test.tsx) — запрос по testID нуждается
// в includeHiddenElements, иначе RNTL не найдёт скрытый узел.
const HIDDEN = { includeHiddenElements: true } as const;

const baseProps = {
  title: 'Заменить индивидуальные часы?',
  body: 'Понедельник, вторник: 09:00–18:00 будет заменено на 10:00–19:00.',
  cancelLabel: 'Отмена',
  confirmLabel: 'Заменить',
};

describe('ConfirmationDialog', () => {
  it('показывает заголовок (доступное имя) и текст — оба пропсами, без зашитых строк', async () => {
    const onCancel = jest.fn();
    const onConfirm = jest.fn();
    await render(<ConfirmationDialog {...baseProps} onCancel={onCancel} onConfirm={onConfirm} />);

    expect(screen.getByText(baseProps.title)).toBeTruthy();
    expect(screen.getByText(baseProps.body)).toBeTruthy();
    expect(screen.getByLabelText(baseProps.title)).toBeTruthy();
    // RN `AccessibilityRole` не знает `alertdialog` из спеки — используется ближайшая `alert`.
    expect(screen.getByTestId('confirmation-dialog').props.accessibilityRole).toBe('alert');
  });

  it('порядок кнопок «Отмена → Подтвердить»', async () => {
    await render(<ConfirmationDialog {...baseProps} onCancel={jest.fn()} onConfirm={jest.fn()} />);

    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(2);
    expect(buttons[0].props.accessibilityLabel).toBe(baseProps.cancelLabel);
    expect(buttons[1].props.accessibilityLabel).toBe(baseProps.confirmLabel);
  });

  it('кнопка отмены вызывает onCancel, а не onConfirm', async () => {
    const onCancel = jest.fn();
    const onConfirm = jest.fn();
    await render(<ConfirmationDialog {...baseProps} onCancel={onCancel} onConfirm={onConfirm} />);

    await fireEvent.press(screen.getByTestId('confirmation-dialog-cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('кнопка подтверждения вызывает onConfirm, а не onCancel', async () => {
    const onCancel = jest.fn();
    const onConfirm = jest.fn();
    await render(<ConfirmationDialog {...baseProps} onCancel={onCancel} onConfirm={onConfirm} />);

    await fireEvent.press(screen.getByTestId('confirmation-dialog-confirm'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('backdrop эквивалентен отмене, не подтверждению', async () => {
    const onCancel = jest.fn();
    const onConfirm = jest.fn();
    await render(<ConfirmationDialog {...baseProps} onCancel={onCancel} onConfirm={onConfirm} />);

    await fireEvent.press(screen.getByTestId('confirmation-dialog-backdrop', HIDDEN));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('системная «назад» на Android эквивалентна отмене', async () => {
    const onCancel = jest.fn();
    const onConfirm = jest.fn();
    await render(<ConfirmationDialog {...baseProps} onCancel={onCancel} onConfirm={onConfirm} />);

    screen.getByTestId('confirmation-dialog-modal').props.onRequestClose();
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
