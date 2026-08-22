import { View } from 'react-native';

import { AppButton } from '@/design-system/components/AppButton';
import { AppIcon } from '@/design-system/components/AppIcon';
import { AppText } from '@/design-system/components/AppText';
import { TimezoneLabel } from '@/design-system/components/TimezoneLabel';
import { Center } from '@/design-system/layout/Center';
import { Column } from '@/design-system/layout/Column';
import { Row } from '@/design-system/layout/Row';
import { useColors } from '@/design-system/theme';
import { radii, sizes, spacing, typography } from '@/design-system/tokens';
import { formatUtcOffset, formattedSlot } from '@/shared/datetime';

export interface BookingSummaryCardProps {
  eventTypeName: string;
  startAtUtc: string;
  endAtUtc: string;
  /** Timezone устройства гостя (`$system.timeZone`), а не владельца. */
  timeZone: string;
  onEdit: () => void;
  testID?: string;
}

/**
 * UISpec-тег `BookingSummaryCard`: сводка «что именно бронируется» над формой данных гостя.
 * Карточка не источник истины — всё приходит параметрами route от экрана слотов;
 * `endAtUtc` клиент не пересчитывает.
 */
export function BookingSummaryCard({
  eventTypeName,
  startAtUtc,
  endAtUtc,
  timeZone,
  onEdit,
  testID,
}: BookingSummaryCardProps) {
  const colors = useColors();

  return (
    <View
      testID={testID ?? 'booking-summary-card'}
      style={{
        alignSelf: 'stretch',
        minHeight: sizes.card.summary.height,
        justifyContent: 'center',
        padding: spacing[16],
        borderRadius: radii[12],
        borderWidth: 1,
        borderColor: colors.border.default,
        backgroundColor: colors.surface.primary,
      }}
    >
      <Row align="flex-start" gap={spacing[12]}>
        {/* Плитка здесь не акцентная: сводка описывает уже выбранную встречу. */}
        <Center
          width={sizes.touch.android}
          height={sizes.touch.android}
          radius={radii[12]}
          background={colors.surface.selected}
        >
          <AppIcon name="event-type" size={sizes.icon.medium} color={colors.action.primary} />
        </Center>
        <Column flex={1} gap={spacing[4]}>
          <AppText typography={typography.title.small}>{eventTypeName}</AppText>
          <AppText typography={typography.body.small} color={colors.text.secondary}>
            {formattedSlot(startAtUtc, endAtUtc, timeZone)}
          </AppText>
          <TimezoneLabel timezone={timeZone} offset={formatUtcOffset(timeZone)} />
        </Column>
        {/* «Изменить» — то же действие возврата, что back в шапке экрана формы. */}
        <AppButton variant="text" label="Изменить" onPress={onEdit} testID="booking-summary-edit" />
      </Row>
    </View>
  );
}

export default BookingSummaryCard;
