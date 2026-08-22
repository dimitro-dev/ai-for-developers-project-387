import { View } from 'react-native';

import { useColors } from '@/design-system/theme';
import { sizes, spacing } from '@/design-system/tokens';

export interface DragHandleProps {
  /** Значение токена `$size.dragHandle.width`; по умолчанию оно же. */
  width?: number;
  /** Значение токена `$size.dragHandle.height`; по умолчанию оно же. */
  height?: number;
  marginTop?: number;
  marginBottom?: number;
  testID?: string;
}

/**
 * UISpec-тег `DragHandle`: декоративная полоска-индикатор в шапке `AppBottomSheet`.
 * Сама по себе не обрабатывает жест — свайп-зона живёт в `AppBottomSheet` (нужен больший
 * touch target, чем 4dp полоски); здесь только отрисовка, поэтому компонент скрыт от screen
 * reader (MANUAL §10 — иконка/декор без label не должны попадать в дерево доступности).
 */
export function DragHandle({
  width = sizes.dragHandle.width,
  height = sizes.dragHandle.height,
  marginTop = spacing[8],
  marginBottom = spacing[16],
  testID,
}: DragHandleProps) {
  const colors = useColors();
  return (
    <View
      testID={testID ?? 'drag-handle'}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        alignSelf: 'center',
        width,
        height,
        marginTop,
        marginBottom,
        borderRadius: height / 2,
        backgroundColor: colors.border.default,
      }}
    />
  );
}

export default DragHandle;
