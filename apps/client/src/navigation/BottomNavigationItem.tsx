import { Pressable } from 'react-native';

import { AppIcon, type IconName } from '@/design-system/components/AppIcon';
import { AppText } from '@/design-system/components/AppText';
import { Column } from '@/design-system/layout/Column';
import { useColors } from '@/design-system/theme';
import { sizes, spacing, typography } from '@/design-system/tokens';

export interface BottomNavigationItemProps {
  /** Глиф пункта (`$size.icon.medium`, тон меняется вместе с `selected`). */
  icon: IconName;
  label: string;
  /** Активный пункт — `component.bottom-navigation`, AC «active state не только цветом». */
  selected: boolean;
  onPress: () => void;
  testID?: string;
}

/**
 * UISpec-тег `BottomNavigationItem`: один пункт нижней навигации владельца — иконка над подписью,
 * весь пункт целиком нажимаем. Активный пункт красится в `$color.action.primary`, но это не
 * единственный признак: `accessibilityState.selected` обязателен (MANUAL §10), как у остальных
 * selectable-компонентов кита (`SlotItem`, `WeekdaySelector`, `DateChip`).
 */
export function BottomNavigationItem({ icon, label, selected, onPress, testID }: BottomNavigationItemProps) {
  const colors = useColors();
  const tint = selected ? colors.action.primary : colors.icon.secondary;

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      style={{
        flex: 1,
        // Touch target пункта — вся высота бара (`$size.bottomNav.height` = 64 dp), с запасом
        // сверх минимума Android (MANUAL §10); minHeight страхует случай кастомной высоты бара.
        minHeight: sizes.touch.android,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Column align="center" gap={spacing[4]}>
        <AppIcon name={icon} size={sizes.icon.medium} color={tint} />
        <AppText typography={typography.label.medium} color={tint}>
          {label}
        </AppText>
      </Column>
    </Pressable>
  );
}

export default BottomNavigationItem;
