import type { AvailabilityRule } from '@minical/api-client';

export type { AvailabilityRule };

export interface OwnerProfileSettingsDraft {
  displayName: string;
  timeZone: string;
}

export interface CalendarSettingsSnapshot {
  availabilityRules: AvailabilityRule[];
  slotIntervalMinutes: number;
}

export interface FieldError {
  field: string;
  message: string;
}

export type OwnerProfileSettingsState =
  | { kind: 'loading' }
  | { kind: 'editing'; form: OwnerProfileSettingsDraft; snapshot: CalendarSettingsSnapshot; dirty: boolean; fieldErrors: FieldError[] }
  | { kind: 'saving'; form: OwnerProfileSettingsDraft; snapshot: CalendarSettingsSnapshot; dirty: boolean; fieldErrors: FieldError[] }
  | { kind: 'error'; form: OwnerProfileSettingsDraft; snapshot: CalendarSettingsSnapshot; dirty: boolean; fieldErrors: FieldError[]; message: string }
  | { kind: 'saved'; form: OwnerProfileSettingsDraft; snapshot: CalendarSettingsSnapshot; dirty: boolean; fieldErrors: FieldError[] };

export const OwnerProfileSettingsEditingDefaults = {
  dirty: false,
  fieldErrors: [],
} as const;

export const OwnerProfileSettingsSavingDefaults = {
  dirty: false,
  fieldErrors: [],
} as const;

export const OwnerProfileSettingsErrorDefaults = {
  dirty: false,
  fieldErrors: [],
} as const;

export const OwnerProfileSettingsSavedDefaults = {
  dirty: false,
  fieldErrors: [],
} as const;

export type OwnerProfileSettingsAction =
  | { type: 'goBackSettings' }
  | { type: 'loadProfileSettings' }
  | { type: 'changeDisplayName' }
  | { type: 'changeTimezone' }
  | { type: 'saveProfileSettings' };
