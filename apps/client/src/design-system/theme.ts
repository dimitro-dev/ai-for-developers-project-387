import { useColorScheme } from 'react-native';

import { colors, type ColorTokens } from '@/design-system/tokens';

/**
 * Единственная точка выбора цветовой схемы: компоненты берут цвета только отсюда.
 * `useColorScheme()` возвращает `null`, когда схема системе неизвестна — это светлая палитра.
 */
export function useColors(): ColorTokens {
  return useColorScheme() === 'dark' ? colors.dark : colors.light;
}
