import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView } from 'react-native';

export interface AppScrollViewProps {
  children?: ReactNode;
  flex?: number;
  background?: string;
  /** `contentPadding*` спеки → padding контейнера контента, а не самого ScrollView. */
  contentPadding?: number;
  contentPaddingHorizontal?: number;
  contentPaddingTop?: number;
  contentPaddingBottom?: number;
  contentGap?: number;
  /** Экран формы (`keyboardAvoiding="true"`): контент поднимается над клавиатурой. */
  keyboardAvoiding?: boolean;
  testID?: string;
}

/** UISpec-тег `ScrollView`. */
export function AppScrollView({
  children,
  flex,
  background,
  contentPadding,
  contentPaddingHorizontal,
  contentPaddingTop,
  contentPaddingBottom,
  contentGap,
  keyboardAvoiding = false,
  testID,
}: AppScrollViewProps) {
  const scroll = (
    <ScrollView
      testID={testID}
      style={{ flex, backgroundColor: background }}
      contentContainerStyle={{
        padding: contentPadding,
        paddingHorizontal: contentPaddingHorizontal,
        paddingTop: contentPaddingTop,
        paddingBottom: contentPaddingBottom,
        gap: contentGap,
      }}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );

  if (!keyboardAvoiding) {
    return scroll;
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: flex ?? 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {scroll}
    </KeyboardAvoidingView>
  );
}

export default AppScrollView;
