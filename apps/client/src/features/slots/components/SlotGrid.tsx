import { View } from 'react-native';

import { Column } from '@/design-system/layout/Column';
import { Row } from '@/design-system/layout/Row';
import { spacing } from '@/design-system/tokens';
import { SlotItem } from '@/features/slots/components/SlotItem';
import type { SlotView } from '@/features/guest/model/types';

/** Минимальная ширина элемента сетки (UX rule спеки 13) — по ней экран считает число колонок. */
export const SLOT_MIN_WIDTH = 112;

export interface SlotGridProps {
  /** Слоты выбранной даты в хронологическом порядке; сетка порядок не меняет. */
  slots: readonly SlotView[];
  selectedStartAtUtc?: string;
  /** Несёт выбранный слот целиком: экрану нужен и `endAtUtc` — для перехода к форме. */
  onSelect: (slot: SlotView) => void;
  columns: number;
  timeZone?: string;
  testID?: string;
}

/**
 * UISpec-тег `SlotGrid`. Раскладка — строками по `columns` элементов: фиксированное число
 * колонок с процентными ширинами и `gap` в RN переполняет строку, а строка из `flex: 1`
 * элементов даёт ровные колонки и корректный последний ряд.
 */
export function SlotGrid({
  slots,
  selectedStartAtUtc,
  onSelect,
  columns,
  timeZone,
  testID,
}: SlotGridProps) {
  const perRow = Math.max(1, Math.trunc(columns));
  const rows: SlotView[][] = [];
  for (let index = 0; index < slots.length; index += perRow) {
    rows.push(slots.slice(index, index + perRow));
  }

  return (
    <Column testID={testID ?? 'slot-grid'} gap={spacing[8]}>
      {rows.map((row) => (
        <Row key={row[0].startAtUtc} gap={spacing[12]}>
          {row.map((slot) => (
            <View key={slot.startAtUtc} style={{ flex: 1 }}>
              <SlotItem
                startAtUtc={slot.startAtUtc}
                endAtUtc={slot.endAtUtc}
                selected={slot.startAtUtc === selectedStartAtUtc}
                onPress={() => onSelect(slot)}
                timeZone={timeZone}
              />
            </View>
          ))}
          {/* Неполный последний ряд не растягивает свои элементы на всю ширину. */}
          {Array.from({ length: perRow - row.length }, (_, index) => (
            <View key={`filler-${index}`} style={{ flex: 1 }} />
          ))}
        </Row>
      ))}
    </Column>
  );
}

export default SlotGrid;
