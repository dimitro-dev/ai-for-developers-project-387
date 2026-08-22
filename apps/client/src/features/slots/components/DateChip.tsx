import { Pressable } from 'react-native';

import { AppText } from '@/design-system/components/AppText';
import { Column } from '@/design-system/layout/Column';
import { useColors } from '@/design-system/theme';
import { radii, sizes, spacing, typography } from '@/design-system/tokens';
import { fullDateLabel } from '@/shared/datetime';

export interface DateChipProps {
  /** Календарная дата `YYYY-MM-DD` в timezone гостя, а не момент времени. */
  date: string;
  weekdayLabel: string;
  dayLabel: string;
  selected: boolean;
  onPress: (date: string) => void;
  testID?: string;
}

/**
 * UISpec-тег `DateChip`. Варианта `disabled` нет: недоступные даты в полоску не попадают вовсе.
 * Выбор кодируется не только цветом — `accessibilityState.selected` обязателен (MANUAL §10).
 */
export function DateChip({
  date,
  weekdayLabel,
  dayLabel,
  selected,
  onPress,
  testID,
}: DateChipProps) {
  const colors = useColors();
  const textColor = selected ? colors.text.onPrimary : colors.text.primary;

  return (
    <Pressable
      testID={testID ?? `date-chip-${date}`}
      onPress={() => onPress(date)}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      // Screen reader озвучивает полную дату, а не «Пт 31».
      accessibilityLabel={fullDateLabel(date)}
      style={{
        width: sizes.dateChip.width,
        height: sizes.dateChip.height,
        borderRadius: radii[12],
        borderWidth: 1,
        borderColor: colors.border.default,
        backgroundColor: selected ? colors.guest.selectedSurface : colors.surface.primary,
      }}
    >
      <Column flex={1} align="center" justify="center" gap={spacing[4]}>
        <AppText typography={typography.label.medium} color={textColor}>
          {weekdayLabel}
        </AppText>
        <AppText typography={typography.title.small} color={textColor}>
          {dayLabel}
        </AppText>
      </Column>
    </Pressable>
  );
}

export default DateChip;
