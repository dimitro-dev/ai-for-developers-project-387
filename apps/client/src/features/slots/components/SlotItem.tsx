import { Pressable } from 'react-native';

import { AppText } from '@/design-system/components/AppText';
import { useColors } from '@/design-system/theme';
import { radii, sizes, typography } from '@/design-system/tokens';
import { guestTimeZone, timeLabel } from '@/shared/datetime';

export interface SlotItemProps {
  startAtUtc: string;
  /** На метке не выводится, но уходит в параметры перехода к форме вместе с `startAtUtc`. */
  endAtUtc: string;
  selected: boolean;
  onPress: () => void;
  /**
   * `$system.timeZone` спеки. Явный параметр с дефолтом: разметка спеки его не передаёт,
   * а тестам нужна зона, не зависящая от машины прогона (ADR §8).
   */
  timeZone?: string;
  testID?: string;
}

/**
 * UISpec-тег `SlotItem`: кнопка одного свободного слота. Disabled-варианта нет — занятого слота
 * в наборе не бывает. Выбор кодируется не только цветом (`accessibilityState.selected`).
 */
export function SlotItem({
  startAtUtc,
  selected,
  onPress,
  timeZone = guestTimeZone(),
  testID,
}: SlotItemProps) {
  const colors = useColors();
  const label = timeLabel(startAtUtc, timeZone);

  return (
    <Pressable
      testID={testID ?? `slot-item-${startAtUtc}`}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`Выбрать время ${label}`}
      style={{
        height: sizes.slot.height,
        justifyContent: 'center',
        borderRadius: radii[8],
        borderWidth: 1,
        borderColor: colors.border.default,
        backgroundColor: selected ? colors.guest.selectedSurface : colors.surface.primary,
      }}
    >
      <AppText
        typography={typography.label.large}
        color={selected ? colors.text.onPrimary : colors.text.primary}
        align="center"
      >
        {label}
      </AppText>
    </Pressable>
  );
}

export default SlotItem;
