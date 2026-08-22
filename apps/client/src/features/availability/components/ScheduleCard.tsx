import { Pressable } from 'react-native';

import { AppIcon } from '@/design-system/components/AppIcon';
import { AppText } from '@/design-system/components/AppText';
import { Column } from '@/design-system/layout/Column';
import { useColors } from '@/design-system/theme';
import { radii, sizes, spacing, typography } from '@/design-system/tokens';

export interface ScheduleCardProps<TInterval = unknown> {
  /**
   * Интервал своей строки (`WorkingInterval` экранов 03, 04, 07). Карточка его не показывает, а
   * несёт как нагрузку нажатия: `onPress` получает `{ interval }` целиком, экран не ищет строку по id.
   */
  interval: TInterval;
  /** Подпись дней недели — считает экран (`formatWeekdays`), карточка её не выводит из `interval`. */
  daysLabel: string;
  timeLabel: string;
  onPress: (event: { interval: TInterval }) => void;
  testID?: string;
}

/**
 * UISpec-тег `ScheduleCard`: строка рабочего интервала на экранах 03/04/07. Карточка целиком нажимаема.
 */
export function ScheduleCard<TInterval = unknown>({
  interval,
  daysLabel,
  timeLabel,
  onPress,
  testID,
}: ScheduleCardProps<TInterval>) {
  const colors = useColors();

  return (
    <Pressable
      testID={testID ?? 'schedule-card'}
      onPress={() => onPress({ interval })}
      accessibilityRole="button"
      // Дни и время читаются одной accessibility-фразой.
      accessible
      accessibilityLabel={[daysLabel, timeLabel].join('. ')}
      style={{
        minHeight: sizes.card.schedule.height,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing[12],
        padding: spacing[12],
        borderRadius: radii[12],
        borderWidth: 1,
        borderColor: colors.border.default,
      }}
    >
      <AppIcon name="calendar" size={sizes.icon.medium} color={colors.action.primary} />
      <Column flex={1} gap={spacing[4]}>
        <AppText typography={typography.title.small} color={colors.text.primary}>
          {daysLabel}
        </AppText>
        <AppText typography={typography.body.medium} color={colors.text.primary}>
          {timeLabel}
        </AppText>
      </Column>
      <AppIcon name="chevron-right" size={sizes.icon.small} color={colors.icon.secondary} />
    </Pressable>
  );
}

export default ScheduleCard;
