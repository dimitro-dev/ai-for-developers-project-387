import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { boxStyle, type BoxProps } from '@/design-system/layout/box';

export interface RowProps extends BoxProps {
  children?: ReactNode;
}

/** UISpec-тег `Row`: горизонтальный flow-контейнер. */
export function Row({ children, ...box }: RowProps) {
  return (
    <View testID={box.testID} style={[styles.row, boxStyle(box)]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
});

export default Row;
