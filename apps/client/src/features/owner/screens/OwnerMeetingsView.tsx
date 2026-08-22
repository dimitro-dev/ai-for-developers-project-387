import { RefreshControl, ScrollView } from 'react-native';

import { AppButton } from '@/design-system/components/AppButton';
import { AppHeader } from '@/design-system/components/AppHeader';
import { AppIcon } from '@/design-system/components/AppIcon';
import { AppText } from '@/design-system/components/AppText';
import { EmptyState } from '@/design-system/components/EmptyState';
import { Skeleton } from '@/design-system/components/Skeleton';
import { TimezoneLabel } from '@/design-system/components/TimezoneLabel';
import { AppSafeArea } from '@/design-system/layout/AppSafeArea';
import { Center } from '@/design-system/layout/Center';
import { Column } from '@/design-system/layout/Column';
import { Spacer } from '@/design-system/layout/Spacer';
import { useColors } from '@/design-system/theme';
import { sizes, spacing, typography } from '@/design-system/tokens';
import { BookingDetailsSheet } from '@/features/meetings/components/BookingDetailsSheet';
import { MeetingCard } from '@/features/meetings/components/MeetingCard';
import type { BookingView } from '@/features/owner/model/types';
import { formatUtcOffset, groupBookingsByOwnerDate, timeLabel, type OwnerBookingGroup } from '@/shared/datetime';
import { StateView } from '@/shared/ui-state/StateView';

import { dataOf, type OwnerMeetingsState } from './OwnerMeetingsState';

const CONTENT_PADDING_HORIZONTAL = spacing[16];
const CONTENT_PADDING_BOTTOM = spacing[24];

export interface OwnerMeetingsViewProps {
  state: OwnerMeetingsState;
  onOpenEventTypes: () => void;
  onOpenBooking: (event: { booking: BookingView }) => void;
  onCloseBooking: () => void;
  /** `shareCalendar` спеки: получает `$state.data.publicUrl` уже готовым. */
  onShareCalendar: (url: string) => void;
  onRefresh: () => void;
  onRetry: () => void;
}

/**
 * View экрана `owner.upcoming-meetings` (кадры 5, 6, 8): список встреч владельца плюс
 * sheet деталей поверх него в состоянии `bookingDetails`. Данными и переходами владеет контейнер.
 */
export function OwnerMeetingsView({
  state,
  onOpenEventTypes,
  onOpenBooking,
  onCloseBooking,
  onShareCalendar,
  onRefresh,
  onRetry,
}: OwnerMeetingsViewProps) {
  const colors = useColors();
  const data = dataOf(state);
  const groups = data === null ? [] : groupBookingsByOwnerDate(data.bookings, data.timezone);

  return (
    <AppSafeArea background={colors.background.primary}>
      <AppHeader
        title="Предстоящие встречи"
        rightActions={[
          {
            id: 'event-types',
            icon: 'layout-grid',
            accessibilityLabel: 'Открыть типы событий',
            onPress: onOpenEventTypes,
          },
        ]}
      />

      <StateView state="loading" current={state.kind}>
        <Column flex={1} padding={spacing[16]} gap={spacing[12]}>
          <Skeleton variant="text" height={16} />
          <Skeleton variant="meeting-card" height={sizes.card.meeting.height} />
          <Skeleton variant="meeting-card" height={sizes.card.meeting.height} />
          <Skeleton variant="meeting-card" height={sizes.card.meeting.height} />
        </Column>
      </StateView>

      <StateView state="empty" current={state.kind}>
        {data === null ? null : (
          <EmptyState
            title="У вас пока нет предстоящих встреч"
            body="Поделитесь ссылкой на свой календарь, чтобы гости могли забронировать встречу. Когда появятся бронирования, вы увидите их здесь."
            ctaLabel="Поделиться календарём"
            ctaAction={() => onShareCalendar(data.publicUrl)}
          />
        )}
      </StateView>

      <StateView state="content|refreshing|bookingDetails" current={state.kind}>
        {data === null ? null : (
          <ScrollView
            testID="owner-meetings-scroll"
            contentContainerStyle={{
              paddingHorizontal: CONTENT_PADDING_HORIZONTAL,
              paddingBottom: CONTENT_PADDING_BOTTOM,
            }}
            refreshControl={
              <RefreshControl
                refreshing={state.kind === 'refreshing'}
                onRefresh={onRefresh}
                tintColor={colors.action.primary}
              />
            }
          >
            <Spacer size={spacing[20]} />
            <TimezoneLabel timezone={data.timezone} offset={formatUtcOffset(data.timezone)} />
            <Spacer size={spacing[20]} />
            {groups.map((group, index) => (
              <Column key={group.id}>
                {index === 0 ? null : <Spacer size={spacing[24]} />}
                <AppText typography={typography.title.small}>{group.title}</AppText>
                <Spacer size={spacing[8]} />
                <Column gap={spacing[8]}>
                  {group.bookings.map((booking) => (
                    <MeetingCard<BookingView>
                      key={booking.id}
                      booking={booking}
                      startTime={timeLabel(booking.startAt, data.timezone)}
                      endTime={timeLabel(booking.endAt, data.timezone)}
                      title={booking.eventTypeTitle}
                      guestName={booking.guest.name}
                      guestEmail={booking.guest.email}
                      onPress={onOpenBooking}
                    />
                  ))}
                </Column>
              </Column>
            ))}
          </ScrollView>
        )}
      </StateView>

      <StateView state="error" current={state.kind}>
        {state.kind !== 'error' ? null : (
          <Center flex={1} padding={spacing[24]}>
            <AppIcon name="cloud-off" size={sizes.icon.large} color={colors.icon.secondary} />
            <Spacer size={spacing[16]} />
            <AppText typography={typography.title.medium} align="center">
              Не удалось загрузить встречи
            </AppText>
            <Spacer size={spacing[8]} />
            <AppText
              typography={typography.body.medium}
              color={colors.text.secondary}
              align="center"
              testID="owner-meetings-error-message"
            >
              {state.message}
            </AppText>
            <Spacer size={spacing[24]} />
            {state.canRetry ? (
              <AppButton
                variant="secondary"
                width="fill"
                label="Повторить"
                onPress={onRetry}
                testID="owner-meetings-retry"
              />
            ) : null}
          </Center>
        )}
      </StateView>

      {state.kind !== 'bookingDetails' ? null : (
        <BookingDetailsSheet
          booking={state.selectedBooking}
          dateText={groupTitleFor(groups, state.selectedBooking.id)}
          timeZone={state.data.timezone}
          onClose={onCloseBooking}
        />
      )}
    </AppSafeArea>
  );
}

/** Заголовок группы (`groupBookingsByOwnerDate`), в которую попадает встреча `bookingId`. */
function groupTitleFor(groups: readonly OwnerBookingGroup<BookingView>[], bookingId: string): string {
  const found = groups.find((group) => group.bookings.some((booking) => booking.id === bookingId));
  return found?.title ?? '';
}

export default OwnerMeetingsView;
