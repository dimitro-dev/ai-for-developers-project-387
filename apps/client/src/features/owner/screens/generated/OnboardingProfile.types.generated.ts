export interface OwnerProfileDraft {
  displayName: string;
  timeZone: string;
}

export interface FieldError {
  field: string;
  message: string;
}

export type OnboardingProfileState =
  | { kind: 'editing'; form: OwnerProfileDraft; fieldErrors: FieldError[] }
  | { kind: 'submitting'; form: OwnerProfileDraft; fieldErrors: FieldError[] };

export const OnboardingProfileEditingDefaults = {
  fieldErrors: [],
} as const;

export const OnboardingProfileSubmittingDefaults = {
  fieldErrors: [],
} as const;

export type OnboardingProfileAction =
  | { type: 'changeDisplayName' }
  | { type: 'changeTimezone' }
  | { type: 'continueOnboarding'; profileDraft: OwnerProfileDraft };
