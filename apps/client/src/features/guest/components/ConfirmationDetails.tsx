import { View } from 'react-native';

import { AppIcon, type IconName } from '@/design-system/components/AppIcon';
import { AppText } from '@/design-system/components/AppText';
import { TimezoneLabel } from '@/design-system/components/TimezoneLabel';
import { Column } from '@/design-system/layout/Column';
import { Row } from '@/design-system/layout/Row';
import { useColors } from '@/design-system/theme';
import { radii, sizes, spacing, typography, type TypographyToken } from '@/design-system/tokens';
import { formatUtcOffset } from '@/shared/datetime';

export interface ConfirmationDetailsProps {
  eventTypeName: string;
  /** Готовая подпись даты: форматирует экран через `dateLabel`. */
  dateText: string;
  /** Готовая подпись интервала: `timeLabel(start) + ' – ' + timeLabel(end)`. */
  timeRangeText: string;
  timeZone: string;
  guestName: string;
  guestEmail: string;
  testID?: string;
}

/**
 * UISpec-тег `ConfirmationDetails`: шесть строк кадра 7 в фиксированном порядке —
 * тип встречи → дата → интервал → timezone → имя → email. Интерактивных элементов в блоке нет:
 * действие возврата живёт на экране.
 */
export function ConfirmationDetails({
  eventTypeName,
  dateText,
  timeRangeText,
  timeZone,
  guestName,
  guestEmail,
  testID,
}: ConfirmationDetailsProps) {
  const colors = useColors();

  return (
    <View
      testID={testID ?? 'confirmation-details'}
      style={{
        alignSelf: 'stretch',
        padding: spacing[16],
        borderRadius: radii[12],
        borderWidth: 1,
        borderColor: colors.border.default,
        backgroundColor: colors.surface.primary,
      }}
    >
      <Column gap={spacing[12]}>
        <DetailRow icon="event-type" typography={typography.label.large} value={eventTypeName} />
        <DetailRow icon="calendar" value={dateText} />
        <DetailRow icon="clock" value={timeRangeText} />
        <Row align="center" gap={spacing[12]}>
          <TimezoneLabel timezone={timeZone} offset={formatUtcOffset(timeZone)} />
        </Row>
        <DetailRow icon="user" value={guestName} />
        {/* Email визуально сокращается, но screen reader читает его целиком. */}
        <DetailRow icon="mail" value={guestEmail} numberOfLines={1} />
      </Column>
    </View>
  );
}

interface DetailRowProps {
  icon: IconName;
  value: string;
  typography?: TypographyToken;
  numberOfLines?: number;
}

/** Строка блока: иконки декоративны — значение строки понятно из её текста. */
function DetailRow({ icon, value, typography: token, numberOfLines }: DetailRowProps) {
  const colors = useColors();
  return (
    <Row align="center" gap={spacing[12]}>
      <AppIcon name={icon} size={sizes.icon.small} color={colors.icon.secondary} />
      <AppText
        typography={token ?? typography.body.medium}
        numberOfLines={numberOfLines}
        flex={1}
      >
        {value}
      </AppText>
    </Row>
  );
}

export default ConfirmationDetails;
