export interface OwnerSettingsSummary {
  displayName: string;
  timeZone: string;
  workingHoursSummary: string;
}

export type OwnerSettingsState =
  | { kind: 'loading' }
  | { kind: 'content'; data: OwnerSettingsSummary }
  | { kind: 'error'; message: string };

export type OwnerSettingsAction =
  | { type: 'loadSettingsSummary' }
  | { type: 'openProfileSettings' }
  | { type: 'openWorkingHoursSettings' }
  | { type: 'openEventTypes' }
  | { type: 'openMeetings' };
