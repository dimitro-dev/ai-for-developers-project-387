import { render, screen } from '@testing-library/react-native';

import { InlineAlert } from '@/design-system/components/InlineAlert';
import { colors } from '@/design-system/tokens';

const HIDDEN = { includeHiddenElements: true } as const;

describe('InlineAlert', () => {
  it('вариант warning: подложка, акцент и иконка кадра 8', async () => {
    await render(
      <InlineAlert
        variant="warning"
        title="Этот слот только что заняли"
        body="Выберите другое доступное время."
      />,
    );

    expect(screen.getByText('Этот слот только что заняли')).toBeTruthy();
    expect(screen.getByText('Выберите другое доступное время.')).toBeTruthy();
    expect(screen.getByTestId('icon-alert-triangle', HIDDEN)).toBeTruthy();

    // Запрос по testID, а не по роли: контейнер алерта намеренно не `accessible` —
    // иначе screen reader склеил бы заголовок и тело в один узел (как у ValidationMessage).
    const alert = screen.getByTestId('inline-alert-warning');
    expect(alert.props.accessibilityRole).toBe('alert');
    expect(alert.props.style).toEqual(
      expect.objectContaining({
        backgroundColor: colors.light.status.warningSurface,
        borderColor: colors.light.status.warning,
      }),
    );
  });

  it('вариант error: своя подложка и иконка', async () => {
    await render(<InlineAlert variant="error" title="Не удалось создать встречу" body="Причина" />);

    expect(screen.getByTestId('icon-alert-circle', HIDDEN)).toBeTruthy();
    expect(screen.getByTestId('inline-alert-error').props.style).toEqual(
      expect.objectContaining({
        backgroundColor: colors.light.status.errorSurface,
        borderColor: colors.light.status.error,
      }),
    );
  });

  // Оба варианта различимы не только цветом — иконка обязательна в каждом.
  it('без body остаётся цельным', async () => {
    await render(<InlineAlert variant="warning" title="Только заголовок" />);

    expect(screen.getByText('Только заголовок')).toBeTruthy();
    expect(screen.getByTestId('icon-alert-triangle', HIDDEN)).toBeTruthy();
  });

  it('не задаёт фиксированную высоту — растёт по контенту', async () => {
    await render(<InlineAlert variant="error" title="Заголовок" body="Тело" />);

    const style = screen.getByTestId('inline-alert-error').props.style;
    expect(style.height).toBeUndefined();
    expect(style.minHeight).toBeUndefined();
  });
});
