import { useWindowDimensions } from 'react-native';

import { AppButton } from '@/design-system/components/AppButton';
import { AppHeader } from '@/design-system/components/AppHeader';
import { AppIcon } from '@/design-system/components/AppIcon';
import { AppText } from '@/design-system/components/AppText';
import { EmptyState } from '@/design-system/components/EmptyState';
import { InlineAlert } from '@/design-system/components/InlineAlert';
import { Skeleton } from '@/design-system/components/Skeleton';
import { TimezoneLabel } from '@/design-system/components/TimezoneLabel';
import { CONTENT_MAX_WIDTH } from '@/design-system/layout/adaptive';
import { AppSafeArea } from '@/design-system/layout/AppSafeArea';
import { AppScrollView } from '@/design-system/layout/AppScrollView';
import { Center } from '@/design-system/layout/Center';
import { Column } from '@/design-system/layout/Column';
import { Row } from '@/design-system/layout/Row';
import { Spacer } from '@/design-system/layout/Spacer';
import { useColors } from '@/design-system/theme';
import { sizes, spacing, typography } from '@/design-system/tokens';
import { durationLabel } from '@/features/event-types/lib';
import type { SlotView } from '@/features/guest/model/types';
import { SLOT_MIN_WIDTH } from '@/features/slots/components/SlotGrid';
import { DateStrip } from '@/features/slots/components/DateStrip';
import { SlotGrid } from '@/features/slots/components/SlotGrid';
import { availableDates, slotsOnDate } from '@/features/slots/lib';
import { formatUtcOffset, fullDateLabel } from '@/shared/datetime';
import { StateView } from '@/shared/ui-state/StateView';

import { contentOf, type GuestSlotsState } from './GuestSlotsState';

/** Горизонтальные поля контента экрана — `contentPaddingHorizontal="$space.24"` спеки. */
const CONTENT_PADDING = spacing[24];

/** Зазор между колонками сетки слотов — `columnGap="$space.12"` спеки компонента. */
const SLOT_COLUMN_GAP = spacing[12];

export interface GuestSlotsViewProps {
  state: GuestSlotsState;
  eventTypeName: string;
  durationMinutes: number;
  eventTypeDescription?: string;
  /** Timezone устройства гостя: экран только форматирует в ней серверные UTC-моменты. */
  timeZone: string;
  onBack: () => void;
  onSelectDate: (date: string) => void;
  onSelectSlot: (slot: SlotView) => void;
  onContinue: () => void;
  onOpenCatalog: () => void;
  onRetry: () => void;
}

/**
 * View экрана `guest.slots` (кадры 2, 3, 8): один экран в трёх стадиях плюс четыре
 * терминальных состояния. Данными и переходами владеет контейнер.
 */
export function GuestSlotsView({
  state,
  eventTypeName,
  durationMinutes,
  eventTypeDescription,
  timeZone,
  onBack,
  onSelectDate,
  onSelectSlot,
  onContinue,
  onOpenCatalog,
  onRetry,
}: GuestSlotsViewProps) {
  const colors = useColors();
  const { width } = useWindowDimensions();
  const content = contentOf(state);

  return (
    <AppSafeArea background={colors.background.primary}>
      <AppHeader title={eventTypeName} backAction={onBack} />

      <StateView state="loading" current={state.kind}>
        <Column flex={1} padding={CONTENT_PADDING} gap={spacing[16]}>
          <Skeleton variant="text" />
          <Skeleton variant="date-strip" height={sizes.dateChip.height} />
          <Skeleton variant="slot-grid" height={sizes.slot.height} />
          <Skeleton variant="slot-grid" height={sizes.slot.height} />
        </Column>
      </StateView>

      <StateView state="dateSelection|slotSelection|slotUnavailable" current={state.kind}>
        {content === null ? null : (
          <AppScrollView
            flex={1}
            contentPaddingHorizontal={CONTENT_PADDING}
            contentPaddingBottom={spacing[32]}
          >
            {/* Правило раскладки: контент ограничен по ширине и центрируется (ADR §10).
                Процент вместо fill: на web fit-content-центрирование игнорирует ширину
                родителя, и колонка переполняет окно уже ~760px. */}
            <Column
              width="100%"
              maxWidth={CONTENT_MAX_WIDTH}
              alignSelf="center"
              testID="slots-content-column"
            >
              <Row align="center" gap={spacing[8]}>
                <AppIcon
                  name="event-type"
                  size={sizes.icon.medium}
                  color={colors.action.primary}
                />
                <AppText typography={typography.label.large}>
                  {durationLabel(durationMinutes)}
                </AppText>
              </Row>
              <Spacer size={spacing[8]} />
              {eventTypeDescription === undefined ? null : (
                <AppText typography={typography.body.medium} color={colors.text.secondary}>
                  {eventTypeDescription}
                </AppText>
              )}
              <Spacer size={spacing[8]} />
              <TimezoneLabel timezone={timeZone} offset={formatUtcOffset(timeZone)} />

              <StateView state="slotUnavailable" current={state.kind}>
                <Spacer size={spacing[16]} />
                <InlineAlert
                  variant="warning"
                  title="Этот слот только что заняли"
                  body="Выберите другое доступное время."
                />
              </StateView>

              <Spacer size={spacing[16]} />
              <AppText typography={typography.label.large}>Выберите дату</AppText>
              <Spacer size={spacing[12]} />
              <DateStrip
                dates={availableDates(content.slots, timeZone)}
                selectedDate={content.selectedDate}
                onSelect={onSelectDate}
              />
              <Spacer size={spacing[20]} />
              <AppText typography={typography.title.small} testID="slots-selected-date">
                {fullDateLabel(content.selectedDate)}
              </AppText>
              <Spacer size={spacing[12]} />
              <SlotGrid
                slots={slotsOnDate(content.slots, content.selectedDate, timeZone)}
                {...(content.selectedSlot === null
                  ? {}
                  : { selectedStartAtUtc: content.selectedSlot.startAtUtc })}
                onSelect={onSelectSlot}
                columns={slotColumns(width)}
                timeZone={timeZone}
              />
              <Spacer size={spacing[12]} />
              <Row align="center" gap={spacing[8]}>
                <AppIcon name="info" size={sizes.icon.small} color={colors.icon.secondary} />
                <AppText typography={typography.body.small} color={colors.text.secondary}>
                  Слоты доступны на ближайшие 14 дней
                </AppText>
              </Row>
              <Spacer size={spacing[24]} />
              <AppButton
                variant="primary"
                width="fill"
                label="Продолжить"
                onPress={onContinue}
                disabled={content.selectedSlot === null}
                testID="slots-continue"
              />
            </Column>
          </AppScrollView>
        )}
      </StateView>

      <StateView state="empty" current={state.kind}>
        <EmptyState
          title="Нет свободного времени"
          body="В ближайшие 14 дней у этого типа встреч нет свободных слотов."
          ctaLabel="Посмотреть другие встречи"
          ctaAction={onOpenCatalog}
        />
      </StateView>

      <StateView state="unavailable" current={state.kind}>
        {state.kind !== 'unavailable' ? null : (
          <Center flex={1} padding={CONTENT_PADDING}>
            <AppIcon name="calendar-x" size={sizes.icon.large} color={colors.icon.secondary} />
            <Spacer size={spacing[16]} />
            <AppText typography={typography.title.medium} align="center">
              Эта встреча недоступна
            </AppText>
            <Spacer size={spacing[8]} />
            <AppText
              typography={typography.body.medium}
              color={colors.text.secondary}
              align="center"
              testID="slots-unavailable-message"
            >
              {state.message}
            </AppText>
            <Spacer size={spacing[24]} />
            <AppButton
              variant="secondary"
              width="fill"
              label="К другим встречам"
              onPress={onOpenCatalog}
            />
          </Center>
        )}
      </StateView>

      <StateView state="error" current={state.kind}>
        {state.kind !== 'error' ? null : (
          <Center flex={1} padding={CONTENT_PADDING}>
            <AppIcon name="cloud-off" size={sizes.icon.large} color={colors.icon.secondary} />
            <Spacer size={spacing[16]} />
            <AppText typography={typography.title.medium} align="center">
              Не удалось загрузить свободное время
            </AppText>
            <Spacer size={spacing[8]} />
            <AppText
              typography={typography.body.medium}
              color={colors.text.secondary}
              align="center"
              testID="slots-error-message"
            >
              {state.message}
            </AppText>
            <Spacer size={spacing[24]} />
            {state.canRetry ? (
              <>
                <AppButton
                  variant="primary"
                  width="fill"
                  label="Повторить"
                  onPress={onRetry}
                />
                <Spacer size={spacing[12]} />
              </>
            ) : null}
            <AppButton
              variant="secondary"
              width="fill"
              label="К другим встречам"
              onPress={onOpenCatalog}
            />
          </Center>
        )}
      </StateView>
    </AppSafeArea>
  );
}

/**
 * Число колонок сетки слотов — правило раскладки, а не платформа: не меньше двух,
 * шире — столько, сколько помещается при минимальной ширине элемента 112 dp.
 */
export function slotColumns(windowWidth: number): number {
  const contentWidth = Math.min(windowWidth, CONTENT_MAX_WIDTH) - CONTENT_PADDING * 2;
  const fits = Math.floor(
    (contentWidth + SLOT_COLUMN_GAP) / (SLOT_MIN_WIDTH + SLOT_COLUMN_GAP),
  );
  return Math.max(2, fits);
}

export default GuestSlotsView;
