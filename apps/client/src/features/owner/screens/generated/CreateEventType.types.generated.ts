export interface CreateEventTypeDraft {
  id: string;
  name: string;
  description?: string;
  durationMinutes: number;
}

export interface FieldError {
  field: string;
  message: string;
}

export type CreateEventTypeState =
  | { kind: 'editing'; form: CreateEventTypeDraft; publicIdTouched: boolean; fieldErrors: FieldError[] }
  | { kind: 'submitting'; form: CreateEventTypeDraft; publicIdTouched: boolean; fieldErrors: FieldError[] }
  | { kind: 'error'; form: CreateEventTypeDraft; publicIdTouched: boolean; fieldErrors: FieldError[]; message: string };

export const CreateEventTypeEditingDefaults = {
  publicIdTouched: false,
  fieldErrors: [],
} as const;

export const CreateEventTypeSubmittingDefaults = {
  publicIdTouched: false,
  fieldErrors: [],
} as const;

export const CreateEventTypeErrorDefaults = {
  publicIdTouched: false,
  fieldErrors: [],
} as const;

export type CreateEventTypeAction =
  | { type: 'goBackEventTypes' }
  | { type: 'changeTitle' }
  | { type: 'changeDescription' }
  | { type: 'changeDuration' }
  | { type: 'changePublicId' }
  | { type: 'submitEventType' };
