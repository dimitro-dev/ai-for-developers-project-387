import { Fragment, type ReactNode } from 'react';

export interface RepeatProps<T> {
  items: readonly T[];
  /** Соответствует атрибуту `key` UISpec-тега `Repeat`. */
  keyExtractor: (item: T, index: number) => string;
  children: (item: T, index: number) => ReactNode;
}

/** UISpec-тег `Repeat`: рендер списка внутри произвольного контейнера. */
export function Repeat<T>({ items, keyExtractor, children }: RepeatProps<T>) {
  return (
    <>
      {items.map((item, index) => (
        <Fragment key={keyExtractor(item, index)}>{children(item, index)}</Fragment>
      ))}
    </>
  );
}

export default Repeat;
