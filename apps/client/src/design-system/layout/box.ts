import type { ViewStyle } from 'react-native';

/**
 * Общие layout-атрибуты UISpec-тегов `Row`, `Column` и `Center` (MANUAL §5).
 * Значения — числа dp (значение токена); резолв `$space.16` → `spacing[16]` делает вызывающий код.
 */
export interface BoxProps {
  gap?: number;
  padding?: number;
  paddingHorizontal?: number;
  paddingVertical?: number;
  paddingTop?: number;
  paddingBottom?: number;
  flex?: number;
  /** `width="fill"` спеки → `alignSelf: 'stretch'`; число — фиксированная ширина в dp. */
  width?: number | 'fill';
  height?: number;
  /** Ограничение ширины контента правилом раскладки (`CONTENT_MAX_WIDTH`). */
  maxWidth?: number;
  /** Центрирование ограниченного по ширине контента внутри широкого окна. */
  alignSelf?: ViewStyle['alignSelf'];
  /** Перенос элементов строки: две колонки карточек на широком окне. */
  wrap?: boolean;
  /** `radius="$radius.12"` спеки. */
  radius?: number;
  background?: string;
  align?: ViewStyle['alignItems'];
  justify?: ViewStyle['justifyContent'];
  testID?: string;
}

export function boxStyle(props: BoxProps): ViewStyle {
  const { width } = props;
  return {
    gap: props.gap,
    padding: props.padding,
    paddingHorizontal: props.paddingHorizontal,
    paddingVertical: props.paddingVertical,
    paddingTop: props.paddingTop,
    paddingBottom: props.paddingBottom,
    flex: props.flex,
    width: typeof width === 'number' ? width : undefined,
    alignSelf: props.alignSelf ?? (width === 'fill' ? 'stretch' : undefined),
    maxWidth: props.maxWidth,
    flexWrap: props.wrap === true ? 'wrap' : undefined,
    height: props.height,
    borderRadius: props.radius,
    backgroundColor: props.background,
    alignItems: props.align,
    justifyContent: props.justify,
  };
}
