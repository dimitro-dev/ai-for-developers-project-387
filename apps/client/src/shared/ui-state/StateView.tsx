import type { ReactNode } from 'react';

export interface StateViewProps {
  /** Одно или несколько состояний спеки через `|`: `state="dateSelection|slotSelection"`. */
  state: string;
  /** Текущее состояние экрана. */
  current: string;
  children?: ReactNode;
}

/** UISpec-тег `StateView`: children видны, только когда текущее состояние совпало. */
export function StateView({ state, current, children }: StateViewProps) {
  const matches = state
    .split('|')
    .map((value) => value.trim())
    .includes(current);
  return matches ? <>{children}</> : null;
}

export default StateView;
