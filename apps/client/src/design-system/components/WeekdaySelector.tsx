import { Pressable } from 'react-native';

import { AppText } from '@/design-system/components/AppText';
import { Row } from '@/design-system/layout/Row';
import { useColors } from '@/design-system/theme';
import { radii, sizes, spacing, typography } from '@/design-system/tokens';

/** UISpec Enum `Weekday` (спека 04, `component.weekday-selector`) — понедельник первым. */
export type Weekday =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday';

/** Порядок отображения и результата — `firstDay="monday"` спеки, а не порядок кликов пользователя. */
const ORDER: readonly Weekday[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

const SHORT_LABEL: Readonly<Record<Weekday, string>> = {
  monday: 'Пн',
  tuesday: 'Вт',
  wednesday: 'Ср',
  thursday: 'Чт',
  friday: 'Пт',
  saturday: 'Сб',
  sunday: 'Вс',
};

/** Полные названия — только для screen reader (правило спеки), визуально не выводятся. */
const FULL_LABEL: Readonly<Record<Weekday, string>> = {
  monday: 'Понедельник',
  tuesday: 'Вторник',
  wednesday: 'Среда',
  thursday: 'Четверг',
  friday: 'Пятница',
  saturday: 'Суббота',
  sunday: 'Воскресенье',
};

export interface WeekdaySelectorProps {
  selectedDays: Weekday[];
  onChange: (days: Weekday[]) => void;
  testID?: string;
}

/**
 * UISpec-тег `WeekdaySelector`: ряд из семи чипов дней недели. Короткая подпись видима на чипе,
 * полное имя дня озвучивается screen reader-ом. Тап переключает день во множестве выбранных;
 * результат `onChange` всегда идёт в порядке `ORDER`, а не в порядке кликов.
 */
export function WeekdaySelector({ selectedDays, onChange, testID }: WeekdaySelectorProps) {
  const colors = useColors();

  function toggle(day: Weekday) {
    const isSelected = selectedDays.includes(day);
    const next = isSelected
      ? selectedDays.filter((item) => item !== day)
      : [...selectedDays, day];
    onChange(ORDER.filter((item) => next.includes(item)));
  }

  return (
    <Row testID={testID ?? 'weekday-selector'} gap={spacing[8]}>
      {ORDER.map((day) => {
        const selected = selectedDays.includes(day);
        return (
          <Pressable
            key={day}
            testID={`weekday-chip-${day}`}
            onPress={() => toggle(day)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={FULL_LABEL[day]}
            style={{
              flex: 1,
              minWidth: sizes.touch.android,
              minHeight: sizes.touch.android,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: radii.pill,
              backgroundColor: selected ? colors.action.primary : colors.background.secondary,
            }}
          >
            <AppText
              typography={typography.label.large}
              color={selected ? colors.text.onPrimary : colors.text.primary}
            >
              {SHORT_LABEL[day]}
            </AppText>
          </Pressable>
        );
      })}
    </Row>
  );
}

export default WeekdaySelector;
