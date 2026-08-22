import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';

import { AppText } from '@/design-system/components/AppText';
import { useColors } from '@/design-system/theme';
import { radii, sizes, spacing, typography, type ColorTokens } from '@/design-system/tokens';

export interface AppButtonProps {
  /** `text` — ссылка-действие внутри контента («Изменить» карточки сводки), без подложки и рамки. */
  variant: 'primary' | 'secondary' | 'text';
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  /** `width="fill"` спеки → кнопка растягивается по ширине родителя. */
  width?: number | 'fill';
  /** Значение токена `$size.button.height`; по умолчанию оно же. */
  height?: number;
  testID?: string;
}

/**
 * UISpec-тег `Button`. Ширина при `loading` не меняется: индикатор добавляется рядом с подписью,
 * подпись остаётся на месте (правило спеки primary-button).
 */
export function AppButton({
  variant,
  label,
  onPress,
  disabled = false,
  loading = false,
  width,
  height = sizes.button.height,
  testID,
}: AppButtonProps) {
  const colors = useColors();
  const inactive = disabled || loading;
  const isPrimary = variant === 'primary';
  const isText = variant === 'text';
  const labelColor = isPrimary ? colors.text.onPrimary : colors.action.primary;

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        {
          height,
          minHeight: sizes.touch.android,
          width: typeof width === 'number' ? width : undefined,
          alignSelf: width === 'fill' ? 'stretch' : undefined,
          opacity: disabled ? disabledOpacity : 1,
          backgroundColor: backgroundFor(variant, pressed, colors),
          borderColor: variant === 'secondary' ? colors.border.default : 'transparent',
          paddingHorizontal: isText ? spacing[8] : spacing[16],
        },
      ]}
    >
      {loading ? <ActivityIndicator testID="app-button-loading" size="small" color={labelColor} /> : null}
      <AppText typography={typography.button} color={labelColor} align="center">
        {label}
      </AppText>
    </Pressable>
  );
}

/** Приглушение disabled — дополнение к `accessibilityState`, а не единственный признак (MANUAL §10). */
const disabledOpacity = 0.5;

function backgroundFor(
  variant: AppButtonProps['variant'],
  pressed: boolean,
  colors: ColorTokens,
): string {
  if (variant === 'primary') {
    return pressed ? colors.action.primaryPressed : colors.action.primary;
  }
  if (variant === 'text') {
    return pressed ? colors.background.secondary : 'transparent';
  }
  return pressed ? colors.background.secondary : colors.surface.primary;
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[8],
    borderRadius: radii[12],
    borderWidth: StyleSheet.hairlineWidth,
  },
});

export default AppButton;
