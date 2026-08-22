import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppBottomSheet } from '@/design-system/components/AppBottomSheet';
import { AppButton } from '@/design-system/components/AppButton';
import { AppIcon, type IconName } from '@/design-system/components/AppIcon';
import { AppText } from '@/design-system/components/AppText';
import { TimezoneLabel } from '@/design-system/components/TimezoneLabel';
import { AppScrollView } from '@/design-system/layout/AppScrollView';
import { Spacer } from '@/design-system/layout/Spacer';
import { useColors } from '@/design-system/theme';
import { radii, sizes, spacing, typography } from '@/design-system/tokens';
import type { BookingView } from '@/features/owner/model/types';
import { formatUtcOffset, timeLabel } from '@/shared/datetime';

export interface BookingDetailsSheetProps {
  /** Встреча целиком, из нагрузки нажатия `MeetingCard` (`$state.selectedBooking` родителя). */
  booking: BookingView;
  /** Заголовок группы, в которой лежит встреча — берёт родитель из `groupBookingsByOwnerDate`. */
  dateText: string;
  /** Timezone владельца (`UpcomingMeetingsData.timezone` родителя). */
  timeZone: string;
  onClose: () => void;
}

/**
 * Sheet-компонент экрана `owner.upcoming-meetings` (спека `11-booking-details-sheet.screen.md`,
 * `MANUAL.md` §2.1) — не route: монтируется/размонтируется состоянием `bookingDetails` родителя,
 * входа кроме пропсов не имеет, собственных запросов к backend не делает.
 *
 * Тег `<BottomSheet>` спеки резолвится в `AppBottomSheet` (`components.registry.xml`), который
 * уже сам рисует `DragHandle` и заголовок как modal title (`component.bottom-sheet`). Спека 11
 * прописывает оба элемента ещё раз явно внутри `<ScrollView>` тем же текстом
 * (`booking.eventTypeTitle`) — здесь это не дублируется: `eventTypeTitle` уходит в `title`
 * `AppBottomSheet`, а после него — только оставшийся отступ `$space.24` перед «Дата и время».
 * Закрытие (backdrop/swipe-down/системная «назад») делает сам `AppBottomSheet`, sheet передаёт
 * ему `onClose` родителя без дополнительной логики.
 */
export function BookingDetailsSheet({ booking, dateText, timeZone, onClose }: BookingDetailsSheetProps) {
  const colors = useColors();
  const hasComment = booking.guest.comment !== undefined && booking.guest.comment.length > 0;

  return (
    <AppBottomSheet title={booking.eventTypeTitle} onClose={onClose} testID="booking-details-sheet">
      <AppScrollView contentPaddingHorizontal={spacing[16]} contentPaddingBottom={spacing[24]}>
        <Spacer size={spacing[24]} />

        <AppText typography={typography.label.large}>Дата и время</AppText>
        <InfoRow icon="calendar">
          <AppText typography={typography.body.medium}>
            {`${dateText}, ${timeLabel(booking.startAt, timeZone)}–${timeLabel(booking.endAt, timeZone)}`}
          </AppText>
          <TimezoneLabel timezone={timeZone} offset={formatUtcOffset(timeZone)} />
        </InfoRow>

        <Spacer size={spacing[24]} />
        <AppText typography={typography.label.large}>Гость</AppText>
        <InfoRow icon="user">
          <AppText typography={typography.body.medium}>{booking.guest.name}</AppText>
          <AppText typography={typography.body.small} color={colors.text.secondary} numberOfLines={1}>
            {booking.guest.email}
          </AppText>
        </InfoRow>

        {hasComment ? (
          <>
            <Spacer size={spacing[24]} />
            <AppText typography={typography.label.large}>Комментарий</AppText>
            <InfoRow icon="message-square" align="flex-start">
              <AppText typography={typography.body.medium}>{booking.guest.comment}</AppText>
            </InfoRow>
          </>
        ) : null}

        <Spacer size={spacing[24]} />
        <AppButton
          variant="secondary"
          width="fill"
          label="Закрыть"
          onPress={onClose}
          testID="booking-details-close"
        />
      </AppScrollView>
    </AppBottomSheet>
  );
}

interface InfoRowProps {
  icon: IconName;
  align?: 'center' | 'flex-start';
  children: ReactNode;
}

/**
 * Строка «иконка + содержимое» секций sheet (кадр 8, UX rules спеки 11): локальная композиция
 * `Row` + `Icon`, реестр отдельного тега для неё не заводит. Собрана на голом `View`, а не
 * `Row`/`Column` дизайн-системы: тем не хватает `borderColor`/`borderWidth` из `BoxProps`
 * (тот же приём, что рамка карточки в `MeetingCard.tsx`).
 */
function InfoRow({ icon, align = 'center', children }: InfoRowProps) {
  const colors = useColors();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: align,
        gap: spacing[12],
        marginTop: spacing[8],
        padding: spacing[12],
        borderRadius: radii[12],
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.border.default,
        backgroundColor: colors.surface.primary,
      }}
    >
      <AppIcon name={icon} size={sizes.icon.small} color={colors.action.primary} />
      <View style={{ flex: 1, gap: spacing[4] }}>{children}</View>
    </View>
  );
}

export default BookingDetailsSheet;
