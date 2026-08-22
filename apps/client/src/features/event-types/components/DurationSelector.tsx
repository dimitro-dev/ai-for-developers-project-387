import { Pressable } from 'react-native';

import { AppText } from '@/design-system/components/AppText';
import { Row } from '@/design-system/layout/Row';
import { useColors } from '@/design-system/theme';
import { radii, sizes, spacing, typography } from '@/design-system/tokens';

/** Закрытый набор длительностей типа события (правило спеки `component.duration-selector`). */
export const DURATION_OPTIONS = [15, 30, 45, 60] as const;
export type DurationMinutes = (typeof DURATION_OPTIONS)[number];

export interface DurationSelectorProps {
  /** Идентификатор ряда экрана — цель `ValidationMessage target="duration"` и основа testID чипов. */
  id: string;
  value: number;
  onChange: (minutes: number) => void;
  testID?: string;
}

/**
 * UISpec-тег `DurationSelector`: ряд из четырёх чипов длительности, выбор всегда единственный.
 * Собственный компонент, а не переиспользованный `DateChip` (правило спеки) — здесь одна подпись
 * и закрытый список из четырёх значений, а не динамический набор дат с двумя подписями.
 * Подпись — короткая форма «N мин» (кадр 5); полная форма для карточки типа события в компонент
 * не входит.
 */
export function DurationSelector({ id, value, onChange, testID }: DurationSelectorProps) {
  const colors = useColors();

  return (
    <Row testID={testID ?? `duration-selector-${id}`} gap={spacing[8]}>
      {DURATION_OPTIONS.map((minutes) => {
        const selected = minutes === value;
        return (
          <Pressable
            key={minutes}
            testID={`duration-chip-${id}-${minutes}`}
            onPress={() => onChange(minutes)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={`${minutes} мин`}
            style={{
              flex: 1,
              minHeight: sizes.touch.android,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: radii[8],
              borderWidth: 1,
              borderColor: colors.border.default,
              backgroundColor: selected ? colors.action.primary : colors.background.secondary,
            }}
          >
            <AppText
              typography={typography.label.large}
              color={selected ? colors.text.onPrimary : colors.text.primary}
            >
              {minutes} мин
            </AppText>
          </Pressable>
        );
      })}
    </Row>
  );
}

export default DurationSelector;
