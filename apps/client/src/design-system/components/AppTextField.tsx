import { TextInput, View, type TextInputProps } from 'react-native';

import { AppText } from '@/design-system/components/AppText';
import { ValidationMessage } from '@/design-system/components/ValidationMessage';
import { Column } from '@/design-system/layout/Column';
import { useColors } from '@/design-system/theme';
import { radii, sizes, spacing, typography } from '@/design-system/tokens';

export interface AppTextFieldProps {
  /** Отдельный видимый label: placeholder его не заменяет (правило спеки form-field). */
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  /** Непустая строка включает ошибочную рамку и рендер `ValidationMessage`. */
  error?: string | null;
  multiline?: boolean;
  keyboardType?: TextInputProps['keyboardType'];
  autoCapitalize?: TextInputProps['autoCapitalize'];
  autoComplete?: TextInputProps['autoComplete'];
  /**
   * Статический префикс перед значением, например «/» у публичного id типа события
   * (спека 10, TODO-COMPONENT). Без него поле выглядит и ведёт себя ровно как раньше.
   */
  prefix?: string;
  testID?: string;
}

/** UISpec-тег `TextField` вместе с label и сообщением об ошибке (композиция спеки form-field). */
export function AppTextField({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  multiline = false,
  keyboardType,
  autoCapitalize,
  autoComplete,
  prefix,
  testID,
}: AppTextFieldProps) {
  const colors = useColors();
  const invalid = error !== undefined && error !== null && error.length > 0;
  const hasPrefix = prefix !== undefined;

  const input = (
    <TextInput
      testID={testID}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors.text.secondary}
      multiline={multiline}
      keyboardType={keyboardType}
      autoCapitalize={autoCapitalize}
      autoComplete={autoComplete}
      accessibilityLabel={label}
      // RN не знает aria-describedby: ошибка связывается с полем через hint и живой регион
      // самого ValidationMessage.
      accessibilityHint={invalid ? (error ?? undefined) : undefined}
      style={{
        // С префиксом рамку и фон рисует обёртка, а поле только тянется на оставшееся место.
        flex: hasPrefix ? 1 : undefined,
        height: multiline ? undefined : sizes.input.height,
        minHeight: multiline ? sizes.textarea.minHeight : undefined,
        textAlignVertical: multiline ? 'top' : 'center',
        paddingHorizontal: hasPrefix ? 0 : spacing[12],
        paddingVertical: multiline ? spacing[12] : 0,
        borderWidth: hasPrefix ? undefined : 1,
        borderRadius: hasPrefix ? undefined : radii[12],
        borderColor: hasPrefix ? undefined : invalid ? colors.status.error : colors.border.default,
        backgroundColor: hasPrefix ? undefined : colors.surface.primary,
        color: colors.text.primary,
        fontSize: typography.body.large.fontSize,
        lineHeight: typography.body.large.lineHeight,
      }}
    />
  );

  return (
    <Column gap={spacing[8]}>
      <AppText typography={typography.label.large} color={colors.text.primary}>
        {label}
      </AppText>
      {hasPrefix ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            height: multiline ? undefined : sizes.input.height,
            minHeight: multiline ? sizes.textarea.minHeight : undefined,
            paddingHorizontal: spacing[12],
            borderWidth: 1,
            borderRadius: radii[12],
            borderColor: invalid ? colors.status.error : colors.border.default,
            backgroundColor: colors.surface.primary,
          }}
        >
          <AppText typography={typography.body.large} color={colors.text.secondary}>
            {prefix}
          </AppText>
          {input}
        </View>
      ) : (
        input
      )}
      <ValidationMessage message={error} />
    </Column>
  );
}

export default AppTextField;
