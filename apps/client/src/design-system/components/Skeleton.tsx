import { View } from 'react-native';

import { useColors } from '@/design-system/theme';
import { radii, sizes, typography } from '@/design-system/tokens';

/** Варианты, встречающиеся в спеках экранов. */
export type SkeletonVariant =
  | 'text'
  | 'field'
  | 'date-strip'
  | 'slot-grid'
  | 'event-type-card'
  | 'meeting-card'
  | 'schedule-card'
  | 'settings-row';

export interface SkeletonProps {
  variant: SkeletonVariant;
  /** Спека может задать высоту явно (`height="$size.slot.height"`). */
  height?: number;
  testID?: string;
}

const variantHeight: Record<SkeletonVariant, number> = {
  text: typography.body.medium.lineHeight,
  field: sizes.input.height,
  'date-strip': sizes.dateChip.height,
  'slot-grid': sizes.slot.height,
  'event-type-card': sizes.card.eventType.height,
  'meeting-card': sizes.card.meeting.height,
  'schedule-card': sizes.card.schedule.height,
  'settings-row': sizes.row.settings.height,
};

/**
 * UISpec-тег `Skeleton`: заглушка загрузки. Текстовый статус загрузки — ответственность экрана
 * (MANUAL §10), сам скелетон от screen reader скрыт.
 */
export function Skeleton({ variant, height, testID }: SkeletonProps) {
  const colors = useColors();
  return (
    <View
      testID={testID ?? `skeleton-${variant}`}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        alignSelf: 'stretch',
        height: height ?? variantHeight[variant],
        borderRadius: variant === 'text' ? radii[8] : radii[12],
        backgroundColor: colors.skeleton,
      }}
    />
  );
}

export default Skeleton;
