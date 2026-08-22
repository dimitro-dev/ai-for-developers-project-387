import { View } from 'react-native';

import { AppText } from '@/design-system/components/AppText';
import { useColors } from '@/design-system/theme';
import { typography } from '@/design-system/tokens';

export interface ValidationMessageProps {
  /** Пустое сообщение, `null` или `undefined` — компонент не рендерит ничего. */
  message?: string | null;
  testID?: string;
}

/** UISpec-тег `ValidationMessage`: сообщение об ошибке поля, объявляемое screen reader. */
export function ValidationMessage({ message, testID }: ValidationMessageProps) {
  const colors = useColors();
  if (message === undefined || message === null || message.length === 0) {
    return null;
  }
  return (
    <View testID={testID} accessibilityRole="alert" accessibilityLiveRegion="polite">
      <AppText typography={typography.body.small} color={colors.status.error}>
        {message}
      </AppText>
    </View>
  );
}

export default ValidationMessage;
