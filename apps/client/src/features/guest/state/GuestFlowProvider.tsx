import { createContext, useCallback, useContext, useMemo, useReducer, type ReactNode } from 'react';

import { newBookingKey } from '@/features/guest/lib/newBookingKey';

import {
  guestFlowReducer,
  initialGuestFlowState,
  type GuestDraft,
  type GuestFlowState,
} from './reducer';

export type GuestFlowContextValue = GuestFlowState & {
  setDraftField: (field: keyof GuestDraft, value: string) => void;
  /**
   * Действие `initBookingKey` спеки 14: новый ключ идемпотентности на каждое монтирование
   * формы. Возвращает выданный ключ — контейнеру он нужен сразу, до следующего рендера.
   */
  initBookingKey: () => string;
  completeBooking: () => void;
  resetFlow: () => void;
};

const GuestFlowContext = createContext<GuestFlowContextValue | null>(null);

export function GuestFlowProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(guestFlowReducer, initialGuestFlowState);

  const setDraftField = useCallback((field: keyof GuestDraft, value: string) => {
    dispatch({ type: 'draft/change', field, value });
  }, []);

  const initBookingKey = useCallback(() => {
    const key = newBookingKey();
    dispatch({ type: 'booking/init', key });
    return key;
  }, []);

  const completeBooking = useCallback(() => {
    dispatch({ type: 'booking/succeeded' });
  }, []);

  const resetFlow = useCallback(() => {
    dispatch({ type: 'flow/reset' });
  }, []);

  const value = useMemo<GuestFlowContextValue>(
    () => ({ ...state, setDraftField, initBookingKey, completeBooking, resetFlow }),
    [state, setDraftField, initBookingKey, completeBooking, resetFlow],
  );

  return <GuestFlowContext.Provider value={value}>{children}</GuestFlowContext.Provider>;
}

export function useGuestFlow(): GuestFlowContextValue {
  const value = useContext(GuestFlowContext);
  if (value === null) {
    throw new Error('useGuestFlow вызван вне GuestFlowProvider');
  }
  return value;
}
