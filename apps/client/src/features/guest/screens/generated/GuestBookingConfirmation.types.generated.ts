import type { Booking } from '@minical/api-client';

export type { Booking };

export type GuestBookingConfirmationState =
  | { kind: 'content'; booking: Booking }
  | { kind: 'error'; message: string };

export type GuestBookingConfirmationAction =
  | { type: 'backToCatalog' };
