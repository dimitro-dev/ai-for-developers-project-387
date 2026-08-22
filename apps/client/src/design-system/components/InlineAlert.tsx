import { View } from 'react-native';

import { AppIcon, type IconName } from '@/design-system/components/AppIcon';
import { AppText } from '@/design-system/components/AppText';
import { Column } from '@/design-system/layout/Column';
import { Row } from '@/design-system/layout/Row';
import { useColors } from '@/design-system/theme';
import { radii, sizes, spacing, typography, type ColorTokens } from '@/design-system/tokens';

export type InlineAlertVariant = 'warning' | 'error';

export interface InlineAlertProps {
  variant: InlineAlertVariant;
  title: string;
  /** Необязателен: алерт из одного заголовка выглядит цельно. */
  body?: string;
  testID?: string;
}

interface VariantStyle {
  readonly background: string;
  readonly accent: string;
  readonly icon: IconName;
}

/**
 * Соответствие «вариант → токены и иконка» из таблицы компонент-спеки: живёт в реализации
 * компонента, как `Button variant=`, а не в helper-функциях, возвращающих оформление.
 */
function variantStyle(variant: InlineAlertVariant, colors: ColorTokens): VariantStyle {
  if (variant === 'warning') {
    return {
      background: colors.status.warningSurface,
      accent: colors.status.warning,
      icon: 'alert-triangle',
    };
  }
  return {
    background: colors.status.errorSurface,
    accent: colors.status.error,
    icon: 'alert-circle',
  };
}

/**
 * UISpec-тег `InlineAlert`: предупреждение над контентом, не заменяющее его.
 * Фиксированной высоты нет — алерт растёт по контенту, поэтому длинный текст не обрезается.
 */
export function InlineAlert({ variant, title, body, testID }: InlineAlertProps) {
  const colors = useColors();
  const style = variantStyle(variant, colors);

  return (
    <View
      testID={testID ?? `inline-alert-${variant}`}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={{
        alignSelf: 'stretch',
        padding: spacing[12],
        borderRadius: radii[12],
        borderWidth: 1,
        borderColor: style.accent,
        backgroundColor: style.background,
      }}
    >
      <Row align="flex-start" gap={spacing[12]}>
        {/* Иконка варианта декоративна: заголовок сообщает то же самое словами. */}
        <AppIcon name={style.icon} size={sizes.icon.medium} color={style.accent} />
        <Column flex={1} gap={spacing[4]}>
          <AppText typography={typography.label.large}>{title}</AppText>
          {body === undefined ? null : (
            <AppText typography={typography.body.small} color={colors.text.secondary}>
              {body}
            </AppText>
          )}
        </Column>
      </Row>
    </View>
  );
}

export default InlineAlert;
