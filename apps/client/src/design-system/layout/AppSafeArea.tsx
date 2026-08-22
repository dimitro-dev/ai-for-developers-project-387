import type { ReactNode } from 'react';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

export interface AppSafeAreaProps {
  children?: ReactNode;
  /** Значение токена `$color.background.*` — фон закрашивает и сами безопасные зоны. */
  background?: string;
  /**
   * Края, которые экран отдаёт системе. По умолчанию все: `Viewport safeArea="true"` спеков
   * относится к экрану целиком, а не к одной стороне.
   */
  edges?: readonly Edge[];
  testID?: string;
}

const ALL_EDGES: readonly Edge[] = ['top', 'right', 'bottom', 'left'];

/**
 * UISpec-тег `SafeArea` (`components.registry.xml`) — корень экрана с `Viewport safeArea="true"`.
 *
 * Без него контент уезжает под статус-бар: это поймал живой прогон на Android-эмуляторе
 * (Э5), где вордмарк каталога наложился на часы системной строки.
 */
export function AppSafeArea({ children, background, edges = ALL_EDGES, testID }: AppSafeAreaProps) {
  return (
    <SafeAreaView
      testID={testID}
      edges={edges}
      style={{ flex: 1, backgroundColor: background }}
    >
      {children}
    </SafeAreaView>
  );
}

export default AppSafeArea;
