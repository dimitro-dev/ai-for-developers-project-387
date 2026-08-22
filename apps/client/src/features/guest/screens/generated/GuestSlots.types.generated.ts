import type { Slot } from '@minical/api-client';
import type { UtcDateTime } from './uispec-runtime';

export type { Slot };

export interface AvailableDate {
  date: string;
  weekdayLabel: string;
  dayLabel: string;
}

export type GuestSlotsState =
  | { kind: 'loading' }
  | { kind: 'dateSelection'; slots: Slot[]; selectedDate: string; selectedSlot: Slot }
  | { kind: 'slotSelection'; slots: Slot[]; selectedDate: string; selectedSlot: Slot }
  | { kind: 'slotUnavailable'; slots: Slot[]; selectedDate: string; selectedSlot: Slot }
  | { kind: 'empty' }
  | { kind: 'unavailable'; message: string }
  | { kind: 'error'; message: string; canRetry: boolean };

export const GuestSlotsErrorDefaults = {
  canRetry: true,
} as const;

export type GuestSlotsAction =
  | { type: 'loadPublicSlots'; eventTypeId: string }
  | { type: 'refreshPublicSlots'; eventTypeId: string }
  | { type: 'selectDate' }
  | { type: 'selectSlot' }
  | { type: 'continueToForm'; eventTypeId: string; eventTypeName: string; startAtUtc: UtcDateTime; endAtUtc: UtcDateTime }
  | { type: 'goBack' }
  | { type: 'openCatalog' };
