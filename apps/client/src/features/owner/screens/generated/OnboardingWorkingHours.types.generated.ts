import type { LocalTime } from './uispec-runtime';

export type Weekday = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

export interface WorkingInterval {
  id: string;
  daysOfWeek: Weekday[];
  startLocal: LocalTime;
  endLocal: LocalTime;
}

export interface WorkingHoursDraft {
  availabilityRules: WorkingInterval[];
  slotIntervalMinutes: number;
  timeZone: string;
}

export interface OwnerProfileDraft {
  displayName: string;
  timeZone: string;
}

export type OnboardingWorkingHoursState =
  | { kind: 'editing'; profileDraft: OwnerProfileDraft; form: WorkingHoursDraft; editedInterval: WorkingInterval }
  | { kind: 'intervalSheet'; profileDraft: OwnerProfileDraft; form: WorkingHoursDraft; editedInterval: WorkingInterval }
  | { kind: 'submitting'; profileDraft: OwnerProfileDraft; form: WorkingHoursDraft; editedInterval: WorkingInterval }
  | { kind: 'error'; profileDraft: OwnerProfileDraft; form: WorkingHoursDraft; editedInterval: WorkingInterval; message: string };

export type OnboardingWorkingHoursAction =
  | { type: 'goBackProfile' }
  | { type: 'openAddWorkingHours' }
  | { type: 'editWorkingInterval' }
  | { type: 'applyWorkingInterval' }
  | { type: 'closeAddWorkingHours' }
  | { type: 'changeSlotStep' }
  | { type: 'completeSetup' };
