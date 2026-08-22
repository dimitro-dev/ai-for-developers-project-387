import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { boxStyle, type BoxProps } from '@/design-system/layout/box';

export interface ColumnProps extends BoxProps {
  children?: ReactNode;
}

/** UISpec-тег `Column`: вертикальный flow-контейнер. */
export function Column({ children, ...box }: ColumnProps) {
  return (
    <View testID={box.testID} style={[styles.column, boxStyle(box)]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  column: { flexDirection: 'column' },
});

export default Column;
