import type { EventType, PublicCalendarResponse } from '@minical/api-client';

export type Calendar = PublicCalendarResponse;
export type { EventType };

export type GuestEventTypesState =
  | { kind: 'loading' }
  | { kind: 'content'; calendar: Calendar; items: EventType[] }
  | { kind: 'empty' }
  | { kind: 'error'; message: string; canRetry: boolean };

export const GuestEventTypesErrorDefaults = {
  canRetry: true,
} as const;

export type GuestEventTypesAction =
  | { type: 'loadPublicCalendar' }
  | { type: 'loadPublicEventTypes' }
  | { type: 'selectEventType'; eventTypeId: string; eventTypeName: string; durationMinutes: number; eventTypeDescription: string };
