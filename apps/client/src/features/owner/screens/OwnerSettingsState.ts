import { formatAvailabilitySummary } from '@/features/availability/lib';
import { errorMessage } from '@/features/owner/model/errors';
import type { OwnerSettingsView } from '@/features/owner/model/types';
import type { UseCaseResult } from '@/features/owner/usecases/result';

import type { OwnerSettingsState, OwnerSettingsSummary } from './generated/OwnerSettings.types.generated';

export type { OwnerSettingsState, OwnerSettingsSummary };

export const initialOwnerSettingsState: OwnerSettingsState = { kind: 'loading' };

/**
 * `OwnerSettingsSummary` — view-model derived-полей над общим `OwnerSettingsView` (P13):
 * `workingHoursSummary` считает `formatAvailabilitySummary` (`@/features/availability/lib`),
 * а не отдельный запрос — тот же контракт `getAdminSettings`, что у экранов 07/09 (спека 08,
 * UX rules).
 */
function toSummary(view: OwnerSettingsView): OwnerSettingsSummary {
  return {
    displayName: view.displayName,
    timeZone: view.timeZone,
    workingHoursSummary: formatAvailabilitySummary(view.availabilityRules),
  };
}

/** Первый фокус (`loadSettingsSummary`): та же конвенция, что `EventTypesState.loaded`. */
export function loaded(result: UseCaseResult<OwnerSettingsView>): OwnerSettingsState {
  if (!result.ok) {
    return { kind: 'error', message: errorMessage(result.error) };
  }
  return { kind: 'content', data: toSummary(result.data) };
}

/**
 * Повторный фокус — фоновый refresh: возврат с экранов 07/09 после успешного сохранения
 * обновляет сводку без промежуточного `loading` (та же конвенция, что `EventTypesState.refreshed`);
 * неудачный фоновый refresh не портит уже показанную сводку.
 */
export function refreshed(current: OwnerSettingsState, result: UseCaseResult<OwnerSettingsView>): OwnerSettingsState {
  if (!result.ok) {
    return current;
  }
  return { kind: 'content', data: toSummary(result.data) };
}
