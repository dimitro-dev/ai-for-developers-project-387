import { AppButton } from '@/design-system/components/AppButton';
import { AppIcon } from '@/design-system/components/AppIcon';
import { AppText } from '@/design-system/components/AppText';
import { AppSafeArea } from '@/design-system/layout/AppSafeArea';
import { AppScrollView } from '@/design-system/layout/AppScrollView';
import { Center } from '@/design-system/layout/Center';
import { Column } from '@/design-system/layout/Column';
import { Spacer } from '@/design-system/layout/Spacer';
import { useColors } from '@/design-system/theme';
import { sizes, spacing, typography } from '@/design-system/tokens';
import { ConfirmationDetails } from '@/features/guest/components/ConfirmationDetails';
import { dateLabel, timeLabel } from '@/shared/datetime';
import { StateView } from '@/shared/ui-state/StateView';

import type { GuestBookingConfirmationState } from './GuestBookingConfirmationState';

export interface GuestBookingConfirmationViewProps {
  state: GuestBookingConfirmationState;
  /** Timezone устройства гостя (`$system.timeZone`) — та же, в которой выбирался слот. */
  timeZone: string;
  onBackToCatalog: () => void;
}

/**
 * View экрана `guest.booking-confirmation` (кадр 7). Шапки и кнопки «назад» здесь нет:
 * сценарий гостя заканчивается, а возврат к каталогу — сброс стека, не push.
 */
export function GuestBookingConfirmationView({
  state,
  timeZone,
  onBackToCatalog,
}: GuestBookingConfirmationViewProps) {
  const colors = useColors();

  return (
    <AppSafeArea background={colors.background.primary}>
      <StateView state="content" current={state.kind}>
        {state.kind !== 'content' ? null : (
          <AppScrollView
            flex={1}
            contentPaddingHorizontal={spacing[24]}
            contentPaddingTop={spacing[32]}
            contentPaddingBottom={spacing[32]}
          >
            <Center>
              <AppIcon
                name="check-circle"
                size={sizes.icon.hero}
                color={colors.status.success}
              />
            </Center>
            <Spacer size={spacing[20]} />
            <AppText typography={typography.title.large} align="center">
              Встреча запланирована
            </AppText>
            <Spacer size={spacing[24]} />
            {/* Все значения — поля ответа `createPublicBooking`; экран форматирует подписи. */}
            <ConfirmationDetails
              eventTypeName={state.booking.eventTypeName}
              dateText={dateLabel(state.booking.startAtUtc, timeZone)}
              timeRangeText={`${timeLabel(state.booking.startAtUtc, timeZone)} – ${timeLabel(
                state.booking.endAtUtc,
                timeZone,
              )}`}
              timeZone={timeZone}
              guestName={state.booking.guestName}
              guestEmail={state.booking.guestEmail}
            />
            <Spacer size={spacing[20]} />
            <AppText
              typography={typography.body.medium}
              color={colors.text.secondary}
              align="center"
            >
              Можно закрыть эту страницу.
            </AppText>
            <Spacer size={spacing[16]} />
            <AppButton
              variant="secondary"
              width="fill"
              label="К другим встречам"
              onPress={onBackToCatalog}
            />
          </AppScrollView>
        )}
      </StateView>

      <StateView state="error" current={state.kind}>
        {state.kind !== 'error' ? null : (
          <Center flex={1} padding={spacing[24]}>
            <AppIcon name="cloud-off" size={sizes.icon.large} color={colors.icon.secondary} />
            <Spacer size={spacing[16]} />
            <AppText typography={typography.title.medium} align="center">
              Не удалось показать подтверждение
            </AppText>
            <Spacer size={spacing[8]} />
            <AppText
              typography={typography.body.medium}
              color={colors.text.secondary}
              align="center"
              testID="confirmation-error-message"
            >
              {state.message}
            </AppText>
            <Spacer size={spacing[24]} />
            <AppButton
              variant="secondary"
              width="fill"
              label="К другим встречам"
              onPress={onBackToCatalog}
            />
          </Center>
        )}
      </StateView>
    </AppSafeArea>
  );
}

export default GuestBookingConfirmationView;
