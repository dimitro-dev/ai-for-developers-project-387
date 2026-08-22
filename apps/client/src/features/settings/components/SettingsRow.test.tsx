import { fireEvent, render, screen } from '@testing-library/react-native';

import { colors, sizes } from '@/design-system/tokens';

import { SettingsRow } from './SettingsRow';

describe('SettingsRow', () => {
  it('показывает название, подпись и ведущую иконку, открывается одним тапом', async () => {
    const onPress = jest.fn();
    await render(
      <SettingsRow
        title="Профиль и timezone"
        subtitle="Anna Novak · Europe/Prague"
        icon="user"
        onPress={onPress}
      />,
    );

    expect(screen.getByText('Профиль и timezone')).toBeTruthy();
    expect(screen.getByText('Anna Novak · Europe/Prague')).toBeTruthy();

    // Вся строка — один интерактивный элемент.
    const row = screen.getByRole('button');
    expect(row.props.accessibilityLabel).toBe('Профиль и timezone. Anna Novak · Europe/Prague');
    await fireEvent.press(row);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('красит плитку ведущей иконки $color.surface.selected и держит высоту строки', async () => {
    await render(
      <SettingsRow
        title="Рабочее время"
        icon="calendar"
        onPress={jest.fn()}
        testID="settings-row-working-hours"
      />,
    );

    expect(screen.getByTestId('settings-row-working-hours').props.style).toEqual(
      expect.objectContaining({ minHeight: sizes.row.settings.height }),
    );
    expect(screen.getByTestId('settings-row-working-hours-icon').props.style).toEqual(
      expect.objectContaining({ backgroundColor: colors.light.surface.selected }),
    );
  });

  it('без subtitle и icon сохраняет раскладку и высоту строки', async () => {
    await render(<SettingsRow title="Типы событий" onPress={jest.fn()} testID="settings-row-plain" />);

    expect(screen.getByText('Типы событий')).toBeTruthy();
    expect(screen.queryByTestId('settings-row-plain-icon')).toBeNull();
    expect(screen.getByRole('button').props.accessibilityLabel).toBe('Типы событий');
    expect(screen.getByTestId('settings-row-plain').props.style).toEqual(
      expect.objectContaining({ minHeight: sizes.row.settings.height }),
    );
  });
});
