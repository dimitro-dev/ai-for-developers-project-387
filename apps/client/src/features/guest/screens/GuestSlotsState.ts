/**
 * StateMachine экрана `guest.slots` (спека 13) и её чистый редьюсер.
 *
 * Набор `kind` и имена свойств повторяют `screens/generated/GuestSlots.types.generated.ts`,
 * но типизированы view-model'ями фундамента (`SlotView`), а не контрактными DTO, и
 * `selectedSlot` объявлен опциональным: генератор теряет `required="false"`
 * (см. `tasks/task-front-guest-002/generation-report.md`, п. 1–2).
 */

import type { AppError } from '@/api/errors';
import { errorMessage } from '@/api/errors';
import type { SlotView } from '@/features/guest/model/types';
import { availableDates, selectedSlotMissing } from '@/features/slots/lib';

/** Общие свойства трёх «контентных» состояний: `slotSelection` и `slotUnavailable` расширяют `dateSelection`. */
export interface GuestSlotsContent {
  slots: SlotView[];
  selectedDate: string;
  selectedSlot: SlotView | null;
}

export type GuestSlotsState =
  | { kind: 'loading' }
  | ({ kind: 'dateSelection' } & GuestSlotsContent)
  | ({ kind: 'slotSelection' } & GuestSlotsContent)
  | ({ kind: 'slotUnavailable' } & GuestSlotsContent)
  | { kind: 'empty' }
  | { kind: 'unavailable'; message: string }
  | { kind: 'error'; message: string; canRetry: boolean };

/**
 * Действия редьюсера. `timeZone` приходит параметром действия, а не берётся из окружения:
 * редьюсер обязан оставаться чистым, а календарная дата зависит от зоны гостя (ADR §8).
 */
export type GuestSlotsAction =
  | { type: 'load/started' }
  | { type: 'load/succeeded'; slots: SlotView[]; timeZone: string }
  | { type: 'load/failed'; error: AppError }
  | { type: 'refresh/succeeded'; slots: SlotView[]; timeZone: string }
  | { type: 'refresh/failed' }
  | { type: 'selectDate'; date: string }
  | { type: 'selectSlot'; slot: SlotView };

export const initialGuestSlotsState: GuestSlotsState = { kind: 'loading' };

/** Коды, которые спека уводит в `unavailable`; остальные — в `error`. */
const UNAVAILABLE_CODES: ReadonlySet<string> = new Set([
  'EVENT_TYPE_NOT_FOUND',
  'CALENDAR_NOT_CONFIGURED',
]);

/** Контент состояния, если он у состояния есть. */
export function contentOf(state: GuestSlotsState): GuestSlotsContent | null {
  if (
    state.kind === 'dateSelection' ||
    state.kind === 'slotSelection' ||
    state.kind === 'slotUnavailable'
  ) {
    return { slots: state.slots, selectedDate: state.selectedDate, selectedSlot: state.selectedSlot };
  }
  return null;
}

export function guestSlotsReducer(
  state: GuestSlotsState,
  action: GuestSlotsAction,
): GuestSlotsState {
  switch (action.type) {
    case 'load/started':
      return initialGuestSlotsState;

    case 'load/succeeded': {
      if (action.slots.length === 0) {
        return { kind: 'empty' };
      }
      return {
        kind: 'dateSelection',
        slots: action.slots,
        selectedDate: firstAvailableDate(action.slots, action.timeZone),
        selectedSlot: null,
      };
    }

    case 'load/failed': {
      const message = errorMessage(action.error);
      if (action.error.code !== null && UNAVAILABLE_CODES.has(action.error.code)) {
        return { kind: 'unavailable', message };
      }
      return { kind: 'error', message, canRetry: true };
    }

    // Порядок ветвей — ровно как в `onSuccessWhen` спеки, сверху вниз.
    case 'refresh/succeeded': {
      const previous = contentOf(state);
      const selected = previous?.selectedSlot ?? null;

      if (action.slots.length === 0) {
        return { kind: 'empty' };
      }

      if (selectedSlotMissing(action.slots, selected)) {
        // Кадр 8: выбранный слот заняли — выбор снимается, дальше гость выбирает заново.
        return {
          kind: 'slotUnavailable',
          slots: action.slots,
          selectedDate: keepDate(previous, action.slots, action.timeZone),
          selectedSlot: null,
        };
      }

      if (selected === null) {
        return {
          kind: 'dateSelection',
          slots: action.slots,
          selectedDate: keepDate(previous, action.slots, action.timeZone),
          selectedSlot: null,
        };
      }

      return {
        kind: 'slotSelection',
        slots: action.slots,
        selectedDate: keepDate(previous, action.slots, action.timeZone),
        selectedSlot: selected,
      };
    }

    // `preserveContent="true"` без `onErrorState`: неудачный фоновый refresh состояние не меняет.
    case 'refresh/failed':
      return state;

    case 'selectDate': {
      const content = contentOf(state);
      if (content === null) {
        return state;
      }
      // Смена даты сбрасывает выбранный слот (`after="clearSelectedSlot"`).
      return {
        kind: 'dateSelection',
        slots: content.slots,
        selectedDate: action.date,
        selectedSlot: null,
      };
    }

    case 'selectSlot': {
      const content = contentOf(state);
      if (content === null) {
        return state;
      }
      return {
        kind: 'slotSelection',
        slots: content.slots,
        selectedDate: content.selectedDate,
        selectedSlot: action.slot,
      };
    }
  }
}

function firstAvailableDate(slots: readonly SlotView[], timeZone: string): string {
  return availableDates(slots, timeZone)[0].date;
}

/** Выбранная дата переживает refresh, если у неё остались слоты; иначе — первая доступная. */
function keepDate(
  previous: GuestSlotsContent | null,
  slots: readonly SlotView[],
  timeZone: string,
): string {
  const dates = availableDates(slots, timeZone);
  const kept = dates.find((item) => item.date === previous?.selectedDate);
  return kept?.date ?? dates[0].date;
}
