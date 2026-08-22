import { useCallback } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { AppButton } from '@/design-system/components/AppButton';
import { AppText } from '@/design-system/components/AppText';
import { Row } from '@/design-system/layout/Row';
import { Spacer } from '@/design-system/layout/Spacer';
import { useColors } from '@/design-system/theme';
import { radii, spacing, typography } from '@/design-system/tokens';

export interface ConfirmationDialogProps {
  title: string;
  /** Готовый текст от родителя (в спеке 04 его собирает `overwriteMessage`) — компонент его не форматирует. */
  body: string;
  cancelLabel: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
  testID?: string;
}

/**
 * UISpec-тег `ConfirmationDialog`. Своего состояния не держит: диалог показывает и убирает
 * родитель (`when="$state == confirmOverwrite"` в спеке 04) простым монтированием/размонтированием —
 * этот компонент лишь рисует вопрос и отдаёт оба исхода наружу действиями `onCancel`/`onConfirm`.
 * Отдельный `Modal` (как у `AppBottomSheet`) гарантирует, что диалог рисуется поверх и sheet, и его
 * backdrop (правило спеки), без ручной работы с z-index.
 */
export function ConfirmationDialog({
  title,
  body,
  cancelLabel,
  confirmLabel,
  onCancel,
  onConfirm,
  testID,
}: ConfirmationDialogProps) {
  const colors = useColors();

  const handleBackdropPress = useCallback(() => {
    onCancel();
  }, [onCancel]);

  const handleRequestClose = useCallback(() => {
    // Системная «назад» на Android — тоже отмена, а не подтверждение (правило спеки).
    onCancel();
  }, [onCancel]);

  const dialogName = testID ?? 'confirmation-dialog';

  return (
    <Modal testID={`${dialogName}-modal`} transparent animationType="fade" onRequestClose={handleRequestClose}>
      <View style={styles.overlay}>
        <Pressable
          testID={`${dialogName}-backdrop`}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[styles.backdrop, { backgroundColor: colors.background.scrim }]}
          onPress={handleBackdropPress}
        />
        <View
          testID={dialogName}
          // Спека просит ARIA-роль `alertdialog`: у RN `AccessibilityRole` такого значения нет
          // (типы платформы её не поддерживают), `alert` — ближайшая существующая роль пакета,
          // тем же путём идёт `InlineAlert`.
          accessibilityRole="alert"
          accessibilityViewIsModal
          style={[styles.card, { backgroundColor: colors.surface.primary }]}
        >
          {/* Заголовок — единственный accessible-узел шапки; body ниже озвучивается отдельно,
              иначе `accessible` на общей обёртке съел бы его текст под чужим label. */}
          <View accessible accessibilityRole="header" accessibilityLabel={title}>
            <AppText typography={typography.title.medium} color={colors.text.primary}>
              {title}
            </AppText>
          </View>
          <Spacer size={spacing[8]} />
          <AppText typography={typography.body.medium} color={colors.text.secondary}>
            {body}
          </AppText>
          <Spacer size={spacing[24]} />
          <Row justify="flex-end" gap={spacing[8]}>
            <AppButton variant="secondary" label={cancelLabel} onPress={onCancel} testID={`${dialogName}-cancel`} />
            <AppButton variant="primary" label={confirmLabel} onPress={onConfirm} testID={`${dialogName}-confirm`} />
          </Row>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // alignItems по умолчанию 'stretch': card тянется по ширине оверлея и сжимается своим marginHorizontal.
  overlay: {
    flex: 1,
    justifyContent: 'center',
  },
  backdrop: StyleSheet.absoluteFill,
  card: {
    marginHorizontal: spacing[24],
    padding: spacing[24],
    borderRadius: radii[20],
  },
});

export default ConfirmationDialog;
