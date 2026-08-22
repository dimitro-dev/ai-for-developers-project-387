import type { GuestDetails } from '@minical/api-client';

export type { GuestDetails };

export interface FieldError {
  field: string;
  message: string;
}

export type GuestBookingFormState =
  | { kind: 'editing'; form: GuestDetails; fieldErrors: FieldError[]; bookingKey: string }
  | { kind: 'validationError'; form: GuestDetails; fieldErrors: FieldError[]; bookingKey: string }
  | { kind: 'submitting'; form: GuestDetails; fieldErrors: FieldError[]; bookingKey: string }
  | { kind: 'serverValidationError'; form: GuestDetails; fieldErrors: FieldError[]; bookingKey: string; message: string }
  | { kind: 'networkError'; form: GuestDetails; fieldErrors: FieldError[]; bookingKey: string };

export const GuestBookingFormEditingDefaults = {
  fieldErrors: [],
} as const;

export const GuestBookingFormValidationErrorDefaults = {
  fieldErrors: [],
} as const;

export const GuestBookingFormSubmittingDefaults = {
  fieldErrors: [],
} as const;

export const GuestBookingFormServerValidationErrorDefaults = {
  fieldErrors: [],
} as const;

export const GuestBookingFormNetworkErrorDefaults = {
  fieldErrors: [],
} as const;

export type GuestBookingFormAction =
  | { type: 'initBookingKey' }
  | { type: 'changeName' }
  | { type: 'changeEmail' }
  | { type: 'changeNote' }
  | { type: 'createBooking' }
  | { type: 'retryBooking' }
  | { type: 'chooseAnotherTime' };
