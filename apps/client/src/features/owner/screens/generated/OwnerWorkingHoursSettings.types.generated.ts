import type { LocalTime } from './uispec-runtime';

export type Weekday = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

export interface WorkingInterval {
  id: string;
  daysOfWeek: Weekday[];
  startLocal: LocalTime;
  endLocal: LocalTime;
}

export interface OwnerSettingsDraft {
  displayName: string;
  timeZone: string;
  availabilityRules: WorkingInterval[];
  slotIntervalMinutes: number;
}

export type OwnerWorkingHoursSettingsState =
  | { kind: 'loading' }
  | { kind: 'editing'; form: OwnerSettingsDraft; dirty: boolean; editedInterval: WorkingInterval }
  | { kind: 'intervalSheet'; form: OwnerSettingsDraft; dirty: boolean; editedInterval: WorkingInterval }
  | { kind: 'saving'; form: OwnerSettingsDraft; dirty: boolean; editedInterval: WorkingInterval }
  | { kind: 'error'; form: OwnerSettingsDraft; dirty: boolean; editedInterval: WorkingInterval; message: string }
  | { kind: 'saved'; form: OwnerSettingsDraft; dirty: boolean; editedInterval: WorkingInterval };

export const OwnerWorkingHoursSettingsEditingDefaults = {
  dirty: false,
} as const;

export const OwnerWorkingHoursSettingsIntervalSheetDefaults = {
  dirty: false,
} as const;

export const OwnerWorkingHoursSettingsSavingDefaults = {
  dirty: false,
} as const;

export const OwnerWorkingHoursSettingsErrorDefaults = {
  dirty: false,
} as const;

export const OwnerWorkingHoursSettingsSavedDefaults = {
  dirty: false,
} as const;

export type OwnerWorkingHoursSettingsAction =
  | { type: 'loadWorkingHoursSettings' }
  | { type: 'openAddWorkingHours' }
  | { type: 'editWorkingInterval' }
  | { type: 'applyWorkingInterval' }
  | { type: 'closeAddWorkingHours' }
  | { type: 'changeSlotStep' }
  | { type: 'openEventTypes' }
  | { type: 'saveOwnerSettings' }
  | { type: 'openMeetings' };
