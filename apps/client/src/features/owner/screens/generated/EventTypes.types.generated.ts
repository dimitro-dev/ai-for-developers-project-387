import type { EventType } from '@minical/api-client';

export type { EventType };

export type EventTypesState =
  | { kind: 'loading' }
  | { kind: 'empty' }
  | { kind: 'content'; items: EventType[] }
  | { kind: 'error'; message: string };

export type EventTypesAction =
  | { type: 'loadEventTypes' }
  | { type: 'createEventType' }
  | { type: 'goBack' };
