import { fireEvent, render, screen } from '@testing-library/react-native';

import { sizes } from '@/design-system/tokens';
import { ProgressHeader } from '@/design-system/components/ProgressHeader';

const HIDDEN = { includeHiddenElements: true } as const;

describe('ProgressHeader', () => {
  it('без backAction рендерится без кнопки «Назад», подпись шага доступна screen reader', async () => {
    await render(<ProgressHeader current={1} total={2} />);

    expect(screen.queryByTestId('progress-header-back')).toBeNull();
    expect(screen.getByText('1 / 2')).toBeTruthy();
  });

  it('с backAction — icon-only кнопка «Назад» с touch target ≥48dp, нажатие вызывает действие', async () => {
    const backAction = jest.fn();
    await render(<ProgressHeader current={2} total={2} backAction={backAction} />);

    const back = screen.getByTestId('progress-header-back');
    expect(back.props.accessibilityLabel).toBe('Назад');
    expect(back.props.style).toEqual(
      expect.objectContaining({ width: sizes.touch.android, height: sizes.touch.android }),
    );

    await fireEvent.press(back);
    expect(backAction).toHaveBeenCalledTimes(1);
  });

  it('при current == total полоса прогресса заполнена полностью', async () => {
    await render(<ProgressHeader current={2} total={2} />);

    expect(screen.getByTestId('progress-header-bar-fill', HIDDEN).props.style).toEqual(
      expect.objectContaining({ width: '100%' }),
    );
  });

  it('прогресс не интерактивен — полоса скрыта от screen reader, заполнение пропорционально шагу', async () => {
    await render(<ProgressHeader current={1} total={2} />);

    // Запрос без HIDDEN — полоса не должна попадать в дерево screen reader.
    expect(screen.queryByTestId('progress-header-bar')).toBeNull();
    expect(screen.getByTestId('progress-header-bar-fill', HIDDEN).props.style).toEqual(
      expect.objectContaining({ width: '50%' }),
    );
  });
});
