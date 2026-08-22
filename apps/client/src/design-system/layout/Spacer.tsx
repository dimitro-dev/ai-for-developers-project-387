import { View } from 'react-native';

export interface SpacerProps {
  /** Значение токена `$space.*` в dp. */
  size: number;
}

/**
 * UISpec-тег `Spacer`: вертикальный зазор между элементами колонки.
 * Горизонтальные зазоры спеки задают через `gap` у `Row`, поэтому оси у Spacer нет.
 */
export function Spacer({ size }: SpacerProps) {
  return <View style={{ height: size }} />;
}

export default Spacer;
