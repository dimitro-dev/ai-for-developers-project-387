import { Pressable } from 'react-native';

import { AppIcon } from '@/design-system/components/AppIcon';
import { AppText } from '@/design-system/components/AppText';
import { Column } from '@/design-system/layout/Column';
import { useColors } from '@/design-system/theme';
import { radii, sizes, spacing, typography } from '@/design-system/tokens';

export interface MeetingCardProps<TBooking = unknown> {
  /**
   * Встреча своей карточки (`BookingView` экранов 05/11). Карточка её не отображает, а несёт
   * как нагрузку нажатия: `onPress` получает `{ booking }` целиком, экран не ищет встречу по id.
   */
  booking: TBooking;
  /** Подпись начала встречи в timezone владельца — считает экран, карточка её не выводит из `booking`. */
  startTime: string;
  endTime: string;
  title: string;
  guestName: string;
  guestEmail: string;
  onPress: (event: { booking: TBooking }) => void;
  testID?: string;
}

/**
 * UISpec-тег `MeetingCard`: карточка предстоящей встречи в списке владельца (экран 05).
 */
export function MeetingCard<TBooking = unknown>({
  booking,
  startTime,
  endTime,
  title,
  guestName,
  guestEmail,
  onPress,
  testID,
}: MeetingCardProps<TBooking>) {
  const colors = useColors();

  return (
    <Pressable
      testID={testID ?? 'meeting-card'}
      onPress={() => onPress({ booking })}
      accessibilityRole="button"
      // Вся карточка — один интерактивный элемент: время, тип встречи и гость озвучиваются вместе.
      accessible
      accessibilityLabel={[`${startTime}–${endTime}`, title, guestName].join('. ')}
      style={{
        minHeight: sizes.card.meeting.height,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing[12],
        padding: spacing[12],
        borderRadius: radii[12],
        borderWidth: 1,
        borderColor: colors.border.default,
      }}
    >
      <Column width={52} align="center">
        <AppText typography={typography.label.large}>{startTime}</AppText>
        <AppText typography={typography.label.medium} color={colors.text.secondary}>
          {endTime}
        </AppText>
      </Column>
      <Column flex={1} gap={spacing[4]}>
        <AppText typography={typography.title.small}>{title}</AppText>
        <AppText typography={typography.body.medium}>{guestName}</AppText>
        {/* Email может сокращаться визуально, но остаётся доступен полностью в details. */}
        <AppText typography={typography.body.small} color={colors.text.secondary} numberOfLines={1}>
          {guestEmail}
        </AppText>
      </Column>
      <AppIcon name="chevron-right" size={sizes.icon.small} color={colors.icon.secondary} />
    </Pressable>
  );
}

export default MeetingCard;
