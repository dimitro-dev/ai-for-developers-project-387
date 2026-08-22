import type { ReactNode } from 'react';
import { View } from 'react-native';

import { boxStyle, type BoxProps } from '@/design-system/layout/box';

export interface CenterProps extends BoxProps {
  children?: ReactNode;
}

/**
 * UISpec-тег `Center`: контент по центру обеих осей.
 * Центрирование задаётся дефолтами `align`/`justify`, а не отдельным статическим стилем:
 * при склейке массива стилей ключ со значением `undefined` перекрыл бы статический.
 */
export function Center({ children, ...box }: CenterProps) {
  return (
    <View
      testID={box.testID}
      style={boxStyle({
        ...box,
        align: box.align ?? 'center',
        justify: box.justify ?? 'center',
      })}
    >
      {children}
    </View>
  );
}

export default Center;
