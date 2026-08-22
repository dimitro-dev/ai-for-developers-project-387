import { View } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';

import type { IconName } from '@/design-system/components/AppIcon';
import { Row } from '@/design-system/layout/Row';
import { AppSafeArea } from '@/design-system/layout/AppSafeArea';
import { useColors } from '@/design-system/theme';
import { sizes } from '@/design-system/tokens';

import { BottomNavigationItem } from '@/navigation/BottomNavigationItem';

/** Единственные два таба owner-флоу (`component.bottom-navigation` Rules — «Типы событий не tab»). */
export type OwnerTabId = 'meetings' | 'settings';

/** `activeTab` спеки: `'none'` — бар виден, ни один пункт не подсвечен (экран 06, пушнутый route). */
export type OwnerActiveTab = OwnerTabId | 'none';

interface OwnerTabDescriptor {
  readonly id: OwnerTabId;
  /**
   * Имя таба в реальном навигаторе — `<Tab id=...>` из `navigation.uispec.xml` (`MeetingsTab` /
   * `SettingsTab`). Именно эти имена лежат в `state.routes` табового навигатора; экранные route
   * (`OwnerMeetings`, `OwnerSettings`) живут во вложенных стеках и в состоянии табов не видны.
   */
  readonly tabRoute: string;
  /** Route экрана внутри вкладки — атрибут `route=` пункта спеки `component.bottom-navigation`. */
  readonly screenRoute: string;
  readonly icon: IconName;
  readonly label: string;
}

/** Порядок и состав — буквально `component.bottom-navigation`, менять только вслед за спекой. */
export const OWNER_BOTTOM_NAVIGATION_TABS: readonly OwnerTabDescriptor[] = [
  {
    id: 'meetings',
    tabRoute: 'MeetingsTab',
    screenRoute: 'OwnerMeetings',
    icon: 'calendar',
    label: 'Встречи',
  },
  {
    id: 'settings',
    tabRoute: 'SettingsTab',
    screenRoute: 'OwnerSettings',
    icon: 'settings',
    label: 'Настройки',
  },
];

/**
 * Употребление на экране (05, 06, 07, 08, 09): компонент читает готовый `activeTab` и сам не
 * знает, откуда он взялся. Переход на другой таб компонент не совершает — только сообщает о
 * намерении наружу: правильный способ переключить вкладку (`navigation.getParent()` от вложенного
 * стека или прямой `navigate`) решает контейнер экрана, которому известен реальный навигатор
 * (P14 и экранные пункты P15–P19), а не эта презентационная обёртка.
 */
export interface OwnerBottomNavigationStandaloneProps {
  activeTab: OwnerActiveTab;
  onNavigate: (tab: OwnerTabId) => void;
  testID?: string;
}

/**
 * Употребление как `tabBar` (`createBottomTabNavigator({ tabBar: (props) => <OwnerBottomNavigation {...props} /> })`,
 * P14): проп — ровно `BottomTabBarProps` react-navigation, без обёртки. Активный таб и переход
 * компонент выводит сам из `state`/`navigation`, повторяя типовой рецепт кастомного tab bar
 * (`navigation.emit('tabPress', ...)` перед `navigate`, чтобы слушатели экрана могли отменить переход).
 *
 * Различить два употребления на уровне типов можно по непересекающимся ключам входа
 * (`activeTab` есть только у standalone-режима, `state` — только у `BottomTabBarProps`), поэтому
 * `'activeTab' in props` — корректный type guard без отдельного дискриминанта.
 */
export type OwnerBottomNavigationProps = OwnerBottomNavigationStandaloneProps | BottomTabBarProps;

function isStandaloneProps(
  props: OwnerBottomNavigationProps,
): props is OwnerBottomNavigationStandaloneProps {
  return 'activeTab' in props;
}

/** Route, на которых спека экрана таб-бар не показывает (спека 10 — единственная такая). */
const ROUTES_WITHOUT_BOTTOM_NAVIGATION = new Set<string>(['CreateEventType']);

/** UISpec-тег `BottomNavigation`. */
export function OwnerBottomNavigation(props: OwnerBottomNavigationProps) {
  const colors = useColors();

  if (isStandaloneProps(props)) {
    const { activeTab, onNavigate, testID } = props;
    return (
      <AppSafeArea
        background={colors.surface.primary}
        edges={['bottom']}
        testID={testID ?? 'owner-bottom-navigation'}
      >
        <Row height={sizes.bottomNav.height} align="center">
          {OWNER_BOTTOM_NAVIGATION_TABS.map((tab) => (
            <BottomNavigationItem
              key={tab.id}
              icon={tab.icon}
              label={tab.label}
              selected={activeTab === tab.id}
              onPress={() => {
                if (activeTab !== tab.id) {
                  onNavigate(tab.id);
                }
              }}
              testID={`owner-bottom-navigation-item-${tab.id}`}
            />
          ))}
        </Row>
      </AppSafeArea>
    );
  }

  // Режим tabBar: react-navigation отдаёт готовый safe-area inset — своей SafeAreaView не заводим,
  // иначе нижний отступ посчитается дважды (тот же frame insets, что уже применил SafeAreaProvider).
  const { state, navigation, insets } = props;
  const focusedRoute = state.routes[state.index];

  // Экраны, чьи спеки бар не содержат (единственный такой owner-экран — 10, «Новый тип события»:
  // у остальных экранов вкладок `<BottomNavigation>` объявлен явно). Навигатор рисует бар для всей
  // вкладки, поэтому решение принимает сам бар, глядя на сфокусированный route вложенного стека.
  const nestedState = focusedRoute?.state;
  const nestedRouteName =
    nestedState !== undefined && nestedState.index !== undefined
      ? nestedState.routes[nestedState.index]?.name
      : undefined;
  if (nestedRouteName !== undefined && ROUTES_WITHOUT_BOTTOM_NAVIGATION.has(nestedRouteName)) {
    return null;
  }

  return (
    <View
      testID="owner-bottom-navigation"
      style={{ backgroundColor: colors.surface.primary, paddingBottom: insets.bottom }}
    >
      <Row height={sizes.bottomNav.height} align="center">
        {OWNER_BOTTOM_NAVIGATION_TABS.map((tab) => {
          const route = state.routes.find((candidate) => candidate.name === tab.tabRoute);
          const selected = route !== undefined && route.key === focusedRoute?.key;
          return (
            <BottomNavigationItem
              key={tab.id}
              icon={tab.icon}
              label={tab.label}
              selected={selected}
              onPress={() => {
                if (route === undefined) {
                  return;
                }
                // Тот же рецепт, что в примерах custom tabBar react-navigation: слушатели экрана
                // (`tabPress`) получают шанс отменить переход раньше, чем он произойдёт.
                const emitted = navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });
                if (!selected && !emitted.defaultPrevented) {
                  // Пункт спеки привязан к корневому экрану вкладки (`route="OwnerMeetings"`),
                  // поэтому переключение ведёт именно на него, а не на то место вложенного
                  // стека, где владелец остановился в прошлый раз.
                  navigation.navigate(route.name, { screen: tab.screenRoute });
                }
              }}
              testID={`owner-bottom-navigation-item-${tab.id}`}
            />
          );
        })}
      </Row>
    </View>
  );
}

export default OwnerBottomNavigation;
