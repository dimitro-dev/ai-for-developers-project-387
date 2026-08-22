import type { UtcDateTime, Url } from './uispec-runtime';

export interface GuestView {
  name: string;
  email: string;
  comment?: string;
}

export interface BookingView {
  id: string;
  eventTypeTitle: string;
  startAt: UtcDateTime;
  endAt: UtcDateTime;
  guest: GuestView;
}

export interface UpcomingMeetingsData {
  timezone: string;
  publicUrl: Url;
  bookings: BookingView[];
}

export type OwnerMeetingsState =
  | { kind: 'loading' }
  | { kind: 'empty'; data: UpcomingMeetingsData }
  | { kind: 'content'; data: UpcomingMeetingsData; selectedBooking: BookingView }
  | { kind: 'refreshing'; data: UpcomingMeetingsData; selectedBooking: BookingView }
  | { kind: 'bookingDetails'; data: UpcomingMeetingsData; selectedBooking: BookingView }
  | { kind: 'error'; message: string; canRetry: boolean };

export const OwnerMeetingsErrorDefaults = {
  canRetry: true,
} as const;

export type OwnerMeetingsAction =
  | { type: 'loadUpcomingMeetings' }
  | { type: 'refreshUpcomingMeetings' }
  | { type: 'loadMeetingsSettings' }
  | { type: 'shareCalendar'; url: Url }
  | { type: 'openEventTypes' }
  | { type: 'openBooking' }
  | { type: 'closeBooking' }
  | { type: 'openSettings' };
