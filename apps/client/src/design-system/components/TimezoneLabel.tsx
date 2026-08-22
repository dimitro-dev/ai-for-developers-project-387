import { AppIcon } from '@/design-system/components/AppIcon';
import { AppText } from '@/design-system/components/AppText';
import { Row } from '@/design-system/layout/Row';
import { useColors } from '@/design-system/theme';
import { sizes, spacing, typography } from '@/design-system/tokens';

export interface TimezoneLabelProps {
  /** IANA-имя таймзоны, например `Europe/Belgrade`. */
  timezone: string;
  /** Готовая подпись смещения на текущую дату, например `UTC+02:00`. */
  offset: string;
  testID?: string;
}

/** UISpec-тег `TimezoneLabel`. */
export function TimezoneLabel({ timezone, offset, testID }: TimezoneLabelProps) {
  const colors = useColors();
  return (
    <Row testID={testID} align="center" gap={spacing[8]}>
      <AppIcon name="globe" size={sizes.icon.small} color={colors.icon.secondary} />
      <AppText typography={typography.label.medium} color={colors.text.secondary}>
        {`${timezone} · ${offset}`}
      </AppText>
    </Row>
  );
}

export default TimezoneLabel;
