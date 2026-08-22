import { useCallback, useRef } from 'react';
import type { ReactNode } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type GestureResponderEvent,
} from 'react-native';

import { AppText } from '@/design-system/components/AppText';
import { DragHandle } from '@/design-system/components/DragHandle';
import { useColors } from '@/design-system/theme';
import { radii, sizes, spacing, typography } from '@/design-system/tokens';

export interface AppBottomSheetProps {
  /** Доступное имя sheet — тот же текст, что видимый заголовок (MANUAL §10, `component.bottom-sheet`). */
  title: string;
  /** Управляет разом backdrop и swipe-down (`$props.dismissible` спеки); по умолчанию — `true`. */
  dismissible?: boolean;
  /** `keyboardAvoiding="true"` в спеке 04 — sheet поднимается над клавиатурой, не перекрывая CTA. */
  keyboardAvoiding?: boolean;
  /**
   * Единая точка закрытия: backdrop, swipe-down полосы и системная «назад» на Android
   * (`onRequestClose`) сводятся сюда — родитель сам решает, размонтировать sheet или нет.
   */
  onClose: () => void;
  children?: ReactNode;
  testID?: string;
}

/** dp вертикального свайпа вниз, после которого drag-handle закрывает sheet (в ките не токенизировано). */
const SWIPE_DISMISS_DISTANCE = 80;

/**
 * UISpec-тег `BottomSheet`. Открытие/закрытие — не собственное состояние: sheet монтирует и
 * размонтирует родительский экран (ADR `front/owner/001`, решение 3); RN `Modal` выбран вместо
 * самодельного overlay именно ради нативного focus trap на iOS (`accessibilityViewIsModal`) и
 * восстановления фокуса вызвавшему элементу при закрытии — своей реализации это не требует.
 *
 * Свайп реализован на сырых responder-пропах (`onResponder*`), а не `PanResponder`/жестовыми
 * библиотеками: клиент их не подключает (`react-native-gesture-handler`/`reanimated` не в
 * зависимостях), а зона свайпа — только drag handle, конфликтов с прокруткой контента нет.
 */
export function AppBottomSheet({
  title,
  dismissible = true,
  keyboardAvoiding = false,
  onClose,
  children,
  testID,
}: AppBottomSheetProps) {
  const colors = useColors();
  const translateY = useRef(new Animated.Value(0)).current;
  const dragStartY = useRef(0);

  const resetPosition = useCallback(() => {
    Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start();
  }, [translateY]);

  const handleGrant = useCallback((event: GestureResponderEvent) => {
    dragStartY.current = event.nativeEvent.pageY;
  }, []);

  const handleMove = useCallback(
    (event: GestureResponderEvent) => {
      const distance = event.nativeEvent.pageY - dragStartY.current;
      // Sheet — не резиновая лента вверх: тянуть можно только вниз, к закрытию.
      translateY.setValue(Math.max(0, distance));
    },
    [translateY],
  );

  const handleRelease = useCallback(
    (event: GestureResponderEvent) => {
      const distance = event.nativeEvent.pageY - dragStartY.current;
      if (distance > SWIPE_DISMISS_DISTANCE) {
        onClose();
        return;
      }
      resetPosition();
    },
    [onClose, resetPosition],
  );

  const handleBackdropPress = useCallback(() => {
    if (dismissible) {
      onClose();
    }
  }, [dismissible, onClose]);

  const handleRequestClose = useCallback(() => {
    // Системная «назад» на Android — тот же смысл, что backdrop: не подтверждение, а отказ.
    if (dismissible) {
      onClose();
    }
  }, [dismissible, onClose]);

  const sheetName = testID ?? 'app-bottom-sheet';

  const content = (
    <View style={styles.overlay}>
      <Pressable
        testID={`${sheetName}-backdrop`}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[styles.backdrop, { backgroundColor: colors.background.scrim }]}
        onPress={handleBackdropPress}
      />
      <Animated.View
        testID={sheetName}
        // iOS: ограничивает VoiceOver-навигацию содержимым sheet, пока он открыт.
        accessibilityViewIsModal
        style={[
          styles.sheet,
          {
            maxHeight: sizes.sheet.maxHeight,
            backgroundColor: colors.surface.primary,
            transform: [{ translateY }],
          },
        ]}
      >
        <View
          testID={`${sheetName}-drag-handle`}
          style={styles.dragArea}
          onStartShouldSetResponder={() => dismissible}
          onMoveShouldSetResponder={() => dismissible}
          onResponderGrant={handleGrant}
          onResponderMove={handleMove}
          onResponderRelease={handleRelease}
          onResponderTerminate={resetPosition}
        >
          <DragHandle />
        </View>
        {/* Заголовок объявляется как modal title: единственный accessible-узел шапки. */}
        <View accessible accessibilityRole="header" accessibilityLabel={title} style={styles.header}>
          <AppText typography={typography.title.medium} color={colors.text.primary}>
            {title}
          </AppText>
        </View>
        {children}
      </Animated.View>
    </View>
  );

  return (
    <Modal
      testID={`${sheetName}-modal`}
      transparent
      animationType="slide"
      onRequestClose={handleRequestClose}
    >
      {keyboardAvoiding ? (
        <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {content}
        </KeyboardAvoidingView>
      ) : (
        content
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: StyleSheet.absoluteFill,
  sheet: {
    borderTopLeftRadius: radii[24],
    borderTopRightRadius: radii[24],
    overflow: 'hidden',
  },
  dragArea: {
    minHeight: sizes.touch.android,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    paddingHorizontal: spacing[16],
  },
});

export default AppBottomSheet;
