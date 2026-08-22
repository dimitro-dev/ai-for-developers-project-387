import { ScrollView } from 'react-native';

import { DateChip } from '@/features/slots/components/DateChip';
import type { AvailableDate } from '@/features/slots/lib';
import { spacing } from '@/design-system/tokens';
import { Repeat } from '@/shared/ui-state/Repeat';

export interface DateStripProps {
  /** Только даты, у которых есть хотя бы один свободный слот (`availableDates`). */
  dates: readonly AvailableDate[];
  selectedDate?: string;
  onSelect: (date: string) => void;
  testID?: string;
}

/**
 * UISpec-тег `DateStrip`: горизонтальная полоска доступных дат серверного 14-дневного окна.
 * Собственной высоты у полоски нет — её задают чипы плюс вертикальный отступ.
 */
export function DateStrip({ dates, selectedDate, onSelect, testID }: DateStripProps) {
  return (
    <ScrollView
      testID={testID ?? 'date-strip'}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: spacing[8], paddingVertical: spacing[4] }}
    >
      <Repeat items={dates} keyExtractor={(item) => item.date}>
        {(item) => (
          <DateChip
            date={item.date}
            weekdayLabel={item.weekdayLabel}
            dayLabel={item.dayLabel}
            selected={item.date === selectedDate}
            onPress={onSelect}
          />
        )}
      </Repeat>
    </ScrollView>
  );
}

export default DateStrip;
