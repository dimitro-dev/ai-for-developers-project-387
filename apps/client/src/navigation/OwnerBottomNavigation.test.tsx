import { fireEvent, render, screen } from '@testing-library/react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';

import { OwnerBottomNavigation } from './OwnerBottomNavigation';

describe('OwnerBottomNavigation — standalone (activeTab)', () => {
  it('показывает ровно два пункта — Встречи и Настройки — и подсвечивает активный', async () => {
    await render(<OwnerBottomNavigation activeTab="meetings" onNavigate={jest.fn()} />);

    expect(screen.getByText('Встречи')).toBeTruthy();
    expect(screen.getByText('Настройки')).toBeTruthy();
    expect(screen.queryByText('Типы событий')).toBeNull();

    expect(screen.getByTestId('owner-bottom-navigation-item-meetings').props.accessibilityState).toEqual(
      expect.objectContaining({ selected: true }),
    );
    expect(screen.getByTestId('owner-bottom-navigation-item-settings').props.accessibilityState).toEqual(
      expect.objectContaining({ selected: false }),
    );
  });

  it('activeTab="none" не подсвечивает ни один пункт (экран 06)', async () => {
    await render(<OwnerBottomNavigation activeTab="none" onNavigate={jest.fn()} />);

    expect(screen.getByTestId('owner-bottom-navigation-item-meetings').props.accessibilityState).toEqual(
      expect.objectContaining({ selected: false }),
    );
    expect(screen.getByTestId('owner-bottom-navigation-item-settings').props.accessibilityState).toEqual(
      expect.objectContaining({ selected: false }),
    );
  });

  it('нажатие на неактивный пункт вызывает onNavigate с его id', async () => {
    const onNavigate = jest.fn();
    await render(<OwnerBottomNavigation activeTab="meetings" onNavigate={onNavigate} />);

    await fireEvent.press(screen.getByTestId('owner-bottom-navigation-item-settings'));
    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(onNavigate).toHaveBeenCalledWith('settings');
  });

  it('нажатие на уже активный пункт не вызывает onNavigate', async () => {
    const onNavigate = jest.fn();
    await render(<OwnerBottomNavigation activeTab="meetings" onNavigate={onNavigate} />);

    await fireEvent.press(screen.getByTestId('owner-bottom-navigation-item-meetings'));
    expect(onNavigate).not.toHaveBeenCalled();
  });
});

describe('OwnerBottomNavigation — tabBar (BottomTabBarProps)', () => {
  function buildTabBarProps(overrides?: {
    focusedIndex?: number;
    defaultPrevented?: boolean;
  }): BottomTabBarProps & { navigation: { navigate: jest.Mock; emit: jest.Mock } } {
    const navigate = jest.fn();
    const emit = jest.fn().mockReturnValue({ defaultPrevented: overrides?.defaultPrevented ?? false });
    const state = {
      index: overrides?.focusedIndex ?? 0,
      // Имена — как в реальном `OwnerTabs`: состояние табового навигатора содержит `<Tab id=...>`
      // (`MeetingsTab`/`SettingsTab`), а экранные route живут во вложенных стеках.
      routes: [
        { key: 'meetings-key', name: 'MeetingsTab' },
        { key: 'settings-key', name: 'SettingsTab' },
      ],
    };
    return {
      state,
      descriptors: {},
      insets: { top: 0, right: 0, bottom: 34, left: 0 },
      navigation: { navigate, emit },
    } as unknown as BottomTabBarProps & { navigation: { navigate: jest.Mock; emit: jest.Mock } };
  }

  it('подсвечивает вкладку из state.index, а не переданный activeTab', async () => {
    const props = buildTabBarProps({ focusedIndex: 1 });
    await render(<OwnerBottomNavigation {...props} />);

    expect(screen.getByTestId('owner-bottom-navigation-item-settings').props.accessibilityState).toEqual(
      expect.objectContaining({ selected: true }),
    );
    expect(screen.getByTestId('owner-bottom-navigation-item-meetings').props.accessibilityState).toEqual(
      expect.objectContaining({ selected: false }),
    );
  });

  it('нажатие на неактивный таб эмитит tabPress и вызывает navigation.navigate целевым route', async () => {
    const props = buildTabBarProps({ focusedIndex: 0 });
    await render(<OwnerBottomNavigation {...props} />);

    await fireEvent.press(screen.getByTestId('owner-bottom-navigation-item-settings'));

    expect(props.navigation.emit).toHaveBeenCalledTimes(1);
    expect(props.navigation.emit).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'tabPress', target: 'settings-key' }),
    );
    expect(props.navigation.navigate).toHaveBeenCalledTimes(1);
    expect(props.navigation.navigate).toHaveBeenCalledWith('SettingsTab', { screen: 'OwnerSettings' });
  });

  it('не рисует бар на route, где спека его не показывает (экран 10)', async () => {
    const props = buildTabBarProps({ focusedIndex: 0 });
    // Вкладка «Встречи» с открытым вложенным `CreateEventType`: спека 10 — единственный
    // owner-экран без `<BottomNavigation>`, бар на нём не показывается.
    (props.state as unknown as { routes: unknown[] }).routes = [
      {
        key: 'meetings-key',
        name: 'MeetingsTab',
        state: { index: 1, routes: [{ name: 'EventTypes' }, { name: 'CreateEventType' }] },
      },
      { key: 'settings-key', name: 'SettingsTab' },
    ];

    await render(<OwnerBottomNavigation {...props} />);

    expect(screen.queryByTestId('owner-bottom-navigation')).toBeNull();
  });

  it('нажатие на уже активный таб не вызывает navigate', async () => {
    const props = buildTabBarProps({ focusedIndex: 0 });
    await render(<OwnerBottomNavigation {...props} />);

    await fireEvent.press(screen.getByTestId('owner-bottom-navigation-item-meetings'));
    expect(props.navigation.navigate).not.toHaveBeenCalled();
  });

  it('слушатель экрана может отменить переход через defaultPrevented', async () => {
    const props = buildTabBarProps({ focusedIndex: 0, defaultPrevented: true });
    await render(<OwnerBottomNavigation {...props} />);

    await fireEvent.press(screen.getByTestId('owner-bottom-navigation-item-settings'));
    expect(props.navigation.navigate).not.toHaveBeenCalled();
  });
});
