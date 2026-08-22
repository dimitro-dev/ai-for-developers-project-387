import type { SetupStateResponse } from '@minical/api-client';

export type SetupState = SetupStateResponse;

export type SetupCheckState =
  | { kind: 'checking'; progress: number }
  | { kind: 'error'; message: string; canRetry: boolean };

export const SetupCheckErrorDefaults = {
  canRetry: true,
} as const;

export type SetupCheckAction =
  | { type: 'checkSetup' }
  | { type: 'retrySetup' };
