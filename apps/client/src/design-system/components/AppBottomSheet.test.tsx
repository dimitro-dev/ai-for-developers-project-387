import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { AppBottomSheet } from '@/design-system/components/AppBottomSheet';

// В @testing-library/react-native 14 `render` и `fireEvent` асинхронные — их обязательно await.
// Backdrop декоративен для screen reader (см. AppIcon.test.tsx) — запрос по testID нуждается
// в includeHiddenElements, иначе RNTL не найдёт скрытый узел.
const HIDDEN = { includeHiddenElements: true } as const;

describe('AppBottomSheet', () => {
  it('заголовок — доступное имя sheet, контент виден', async () => {
    await render(
      <AppBottomSheet title="Добавить рабочее время" onClose={jest.fn()}>
        <Text>Контент sheet</Text>
      </AppBottomSheet>,
    );

    expect(screen.getByText('Добавить рабочее время')).toBeTruthy();
    expect(screen.getByText('Контент sheet')).toBeTruthy();
    expect(screen.getByLabelText('Добавить рабочее время')).toBeTruthy();
    expect(screen.getByTestId('app-bottom-sheet').props.accessibilityViewIsModal).toBe(true);
  });

  it('backdrop закрывает sheet, когда dismissible (по умолчанию)', async () => {
    const onClose = jest.fn();
    await render(
      <AppBottomSheet title="Заголовок" onClose={onClose}>
        <Text>Контент</Text>
      </AppBottomSheet>,
    );

    await fireEvent.press(screen.getByTestId('app-bottom-sheet-backdrop', HIDDEN));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('backdrop не закрывает sheet при dismissible={false}', async () => {
    const onClose = jest.fn();
    await render(
      <AppBottomSheet title="Заголовок" onClose={onClose} dismissible={false}>
        <Text>Контент</Text>
      </AppBottomSheet>,
    );

    await fireEvent.press(screen.getByTestId('app-bottom-sheet-backdrop', HIDDEN));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('onRequestClose (системная «назад» на Android) закрывает dismissible sheet', async () => {
    const onClose = jest.fn();
    await render(
      <AppBottomSheet title="Заголовок" onClose={onClose}>
        <Text>Контент</Text>
      </AppBottomSheet>,
    );

    screen.getByTestId('app-bottom-sheet-modal').props.onRequestClose();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('onRequestClose не закрывает non-dismissible sheet', async () => {
    const onClose = jest.fn();
    await render(
      <AppBottomSheet title="Заголовок" onClose={onClose} dismissible={false}>
        <Text>Контент</Text>
      </AppBottomSheet>,
    );

    screen.getByTestId('app-bottom-sheet-modal').props.onRequestClose();
    expect(onClose).not.toHaveBeenCalled();
  });

  // RNTL/react-test-renderer не разыгрывают настоящую responder-negotiation жеста (нет нативного
  // раннера тачей и `PanResponder` здесь намеренно не используется — только сырые onResponder*
  // на drag-handle, см. комментарий в AppBottomSheet.tsx). Тест вызывает эти пропы напрямую —
  // так же, как их вызвал бы нативный слой при grant/move/release — и проверяет именно нашу
  // пороговую логику закрытия, а не сам факт распознавания жеста платформой.
  it('свайп вниз дальше порога закрывает sheet', async () => {
    const onClose = jest.fn();
    await render(
      <AppBottomSheet title="Заголовок" onClose={onClose}>
        <Text>Контент</Text>
      </AppBottomSheet>,
    );

    const dragArea = screen.getByTestId('app-bottom-sheet-drag-handle');
    await act(async () => {
      dragArea.props.onResponderGrant({ nativeEvent: { pageY: 100 } });
      dragArea.props.onResponderMove({ nativeEvent: { pageY: 220 } });
      dragArea.props.onResponderRelease({ nativeEvent: { pageY: 220 } });
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('свайп меньше порога не закрывает sheet', async () => {
    const onClose = jest.fn();
    await render(
      <AppBottomSheet title="Заголовок" onClose={onClose}>
        <Text>Контент</Text>
      </AppBottomSheet>,
    );

    const dragArea = screen.getByTestId('app-bottom-sheet-drag-handle');
    await act(async () => {
      dragArea.props.onResponderGrant({ nativeEvent: { pageY: 100 } });
      dragArea.props.onResponderMove({ nativeEvent: { pageY: 130 } });
      dragArea.props.onResponderRelease({ nativeEvent: { pageY: 130 } });
    });

    expect(onClose).not.toHaveBeenCalled();
  });

  it('non-dismissible sheet не разрешает начать свайп', async () => {
    await render(
      <AppBottomSheet title="Заголовок" onClose={jest.fn()} dismissible={false}>
        <Text>Контент</Text>
      </AppBottomSheet>,
    );

    const dragArea = screen.getByTestId('app-bottom-sheet-drag-handle');
    expect(dragArea.props.onStartShouldSetResponder()).toBe(false);
  });

  it('keyboardAvoiding оборачивает контент в KeyboardAvoidingView', async () => {
    await render(
      <AppBottomSheet title="Заголовок" onClose={jest.fn()} keyboardAvoiding>
        <Text>Контент</Text>
      </AppBottomSheet>,
    );

    // Sheet остаётся смонтированным и доступным — обёртка не ломает дерево контента.
    expect(screen.getByText('Контент')).toBeTruthy();
    expect(screen.getByTestId('app-bottom-sheet')).toBeTruthy();
  });
});
