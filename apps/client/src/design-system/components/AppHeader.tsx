import { Pressable, StyleSheet } from 'react-native';

import { AppIcon, type IconName } from '@/design-system/components/AppIcon';
import { AppText } from '@/design-system/components/AppText';
import { Row } from '@/design-system/layout/Row';
import { useColors } from '@/design-system/theme';
import { sizes, spacing, typography } from '@/design-system/tokens';

/** Элемент `$props.rightActions` спеки `app-header` (тег `Repeat` → `IconButton`). */
export interface HeaderAction {
  id: string;
  icon: IconName;
  accessibilityLabel: string;
  onPress: () => void;
}

export interface AppHeaderProps {
  title: string;
  /** Кнопка «Назад» появляется, только если действие передано. */
  backAction?: () => void;
  /**
   * Правые icon-действия. Правило спеки «максимум две header actions справа» соблюдается
   * структурно: лишние элементы отбрасываются, а не падают молча в layout.
   */
  rightActions?: HeaderAction[];
  testID?: string;
}

const MAX_RIGHT_ACTIONS = 2;

/** UISpec-тег `Header`. */
export function AppHeader({ title, backAction, rightActions, testID }: AppHeaderProps) {
  const colors = useColors();
  const visibleActions = rightActions?.slice(0, MAX_RIGHT_ACTIONS);
  return (
    <Row
      testID={testID}
      height={sizes.header.height}
      paddingHorizontal={spacing[16]}
      gap={spacing[8]}
      align="center"
      background={colors.background.primary}
    >
      {backAction === undefined ? null : (
        <Pressable
          testID="app-header-back"
          onPress={backAction}
          accessibilityRole="button"
          accessibilityLabel="Назад"
          style={styles.touchTarget}
        >
          <AppIcon name="arrow-left" size={sizes.icon.medium} color={colors.icon.primary} />
        </Pressable>
      )}
      <AppText typography={typography.title.medium} color={colors.text.primary} flex={1} numberOfLines={1}>
        {title}
      </AppText>
      {visibleActions?.map((action) => (
        <Pressable
          key={action.id}
          testID={`app-header-action-${action.id}`}
          onPress={action.onPress}
          accessibilityRole="button"
          accessibilityLabel={action.accessibilityLabel}
          style={styles.touchTarget}
        >
          <AppIcon name={action.icon} size={sizes.icon.medium} color={colors.icon.primary} />
        </Pressable>
      ))}
    </Row>
  );
}

const styles = StyleSheet.create({
  // Touch target не меньше 48 dp (MANUAL §10), при этом иконка остаётся размером токена.
  touchTarget: {
    width: sizes.touch.android,
    height: sizes.touch.android,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default AppHeader;
