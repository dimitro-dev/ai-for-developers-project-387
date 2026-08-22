import type { ReactNode } from 'react';
import { Text, type TextStyle } from 'react-native';

import { useColors } from '@/design-system/theme';
import { typography as typographyTokens, type TypographyToken } from '@/design-system/tokens';

export interface AppTextProps {
  children?: ReactNode;
  /** Токен `$type.*`; по умолчанию — основной текст экрана. */
  typography?: TypographyToken;
  /** Разрешённое значение цвета из `useColors()`; по умолчанию — `text.primary`. */
  color?: string;
  align?: TextStyle['textAlign'];
  numberOfLines?: number;
  /** Атрибуты `flex="1"` и `maxWidth="304"` из спеков. */
  flex?: number;
  maxWidth?: number;
  testID?: string;
}

/** UISpec-тег `Text`. */
export function AppText({
  children,
  typography = typographyTokens.body.medium,
  color,
  align,
  numberOfLines,
  flex,
  maxWidth,
  testID,
}: AppTextProps) {
  const colors = useColors();
  return (
    <Text
      testID={testID}
      numberOfLines={numberOfLines}
      style={{
        // fontFamily токенов — `System`, то есть шрифт платформы: явный fontFamily не выставляем.
        fontSize: typography.fontSize,
        lineHeight: typography.lineHeight,
        fontWeight: typography.fontWeight,
        color: color ?? colors.text.primary,
        textAlign: align,
        flex,
        maxWidth,
      }}
    >
      {children}
    </Text>
  );
}

export default AppText;
