import type { OwnerSettingsView } from '@/features/owner/model/types';
import type { FieldError } from '@/shared/forms';

/**
 * StateMachine экрана `owner.profile-settings` (спека 09). Отличие от
 * `generated/OwnerProfileSettings.types.generated.ts`: там `snapshot` типизирован урезанным
 * `CalendarSettingsSnapshot` (`availabilityRules`/`slotIntervalMinutes` — только то, что несёт
 * Payload действия). Здесь `snapshot` — полный `OwnerSettingsView` (P13, тот же контракт
 * `getAdminSettings`/`updateAdminSettings`), чтобы read-modify-write мог напрямую переиспользовать
 * готовый `toSetupRequest` из `features/owner/model/mappers` (P13) вместо повторной сборки
 * `SetupRequest` вручную здесь: `toSetupRequest` уже принимает и тестирует именно эту форму базы,
 * а `publicUrl` в ней реальный (из ответа `getAdminSettings`), а не выдуманное значение под
 * урезанный тип.
 */
export interface OwnerProfileSettingsDraft {
  displayName: string;
  timeZone: string;
}

export type OwnerProfileSettingsState =
  | { kind: 'loading' }
  | {
      kind: 'editing';
      form: OwnerProfileSettingsDraft;
      snapshot: OwnerSettingsView;
      dirty: boolean;
      fieldErrors: FieldError[];
    }
  | {
      kind: 'saving';
      form: OwnerProfileSettingsDraft;
      snapshot: OwnerSettingsView;
      dirty: boolean;
      fieldErrors: FieldError[];
    }
  | {
      kind: 'error';
      form: OwnerProfileSettingsDraft;
      snapshot: OwnerSettingsView;
      dirty: boolean;
      fieldErrors: FieldError[];
      message: string;
    }
  | {
      kind: 'saved';
      form: OwnerProfileSettingsDraft;
      snapshot: OwnerSettingsView;
      dirty: boolean;
      fieldErrors: FieldError[];
    };

export type OwnerProfileSettingsEvent =
  | { type: 'load/succeeded'; view: OwnerSettingsView }
  | { type: 'load/failed'; message: string }
  | { type: 'changeDisplayName'; value: string }
  | { type: 'changeTimezone'; value: string }
  | { type: 'save/started' }
  | { type: 'save/succeeded' }
  | { type: 'save/failed'; message: string };

export const initialOwnerProfileSettingsState: OwnerProfileSettingsState = { kind: 'loading' };

/**
 * Пустой снимок для ветки `load/failed` (`onErrorState="error"` спеки, `error extends editing` —
 * форма видна и в этом состоянии, AC спеки: «форма показывается во всех, кроме loading»). Save
 * остаётся заблокирован `!dirty` до первой правки полей — эта ветка не сравнивалась в AC отдельно
 * (правки спеки описывают ошибку сохранения, а не загрузки), сохранено безопасное поведение по
 * умолчанию: пустая timezone держит `timezone-required` невалидным, CTA недоступна и без правки.
 */
const EMPTY_SNAPSHOT: OwnerSettingsView = {
  displayName: '',
  timeZone: '',
  availabilityRules: [],
  slotIntervalMinutes: 30,
  publicUrl: '',
};

/** Правила `display-name-required`/`timezone-required` спеки 09 — вживую, приём экрана 02. */
export function validateOwnerProfileSettingsDraft(form: OwnerProfileSettingsDraft): FieldError[] {
  const errors: FieldError[] = [];
  if (form.displayName.trim().length === 0) {
    errors.push({ field: 'display-name', message: 'Введите отображаемое имя' });
  }
  if (form.timeZone.length === 0) {
    errors.push({ field: 'timezone', message: 'Выберите timezone' });
  }
  return errors;
}

function withDraft(
  state: Exclude<OwnerProfileSettingsState, { kind: 'loading' }>,
  form: OwnerProfileSettingsDraft,
): OwnerProfileSettingsState {
  const fieldErrors = validateOwnerProfileSettingsDraft(form);
  switch (state.kind) {
    case 'editing':
      return { kind: 'editing', form, snapshot: state.snapshot, dirty: true, fieldErrors };
    case 'saving':
      return { kind: 'saving', form, snapshot: state.snapshot, dirty: true, fieldErrors };
    case 'error':
      return { kind: 'error', form, snapshot: state.snapshot, dirty: true, fieldErrors, message: state.message };
    case 'saved':
      return { kind: 'saved', form, snapshot: state.snapshot, dirty: true, fieldErrors };
  }
}

export function ownerProfileSettingsReducer(
  state: OwnerProfileSettingsState,
  event: OwnerProfileSettingsEvent,
): OwnerProfileSettingsState {
  switch (event.type) {
    case 'load/succeeded':
      return {
        kind: 'editing',
        form: { displayName: event.view.displayName, timeZone: event.view.timeZone },
        snapshot: event.view,
        dirty: false,
        fieldErrors: [],
      };

    case 'load/failed':
      return {
        kind: 'error',
        form: { displayName: '', timeZone: '' },
        snapshot: EMPTY_SNAPSHOT,
        dirty: false,
        fieldErrors: [],
        message: event.message,
      };

    case 'changeDisplayName':
      if (state.kind === 'loading') {
        return state;
      }
      return withDraft(state, { ...state.form, displayName: event.value });

    case 'changeTimezone':
      if (state.kind === 'loading') {
        return state;
      }
      return withDraft(state, { ...state.form, timeZone: event.value });

    case 'save/started':
      if (state.kind === 'loading') {
        return state;
      }
      return { kind: 'saving', form: state.form, snapshot: state.snapshot, dirty: state.dirty, fieldErrors: state.fieldErrors };

    case 'save/succeeded':
      if (state.kind === 'loading') {
        return state;
      }
      return { kind: 'saved', form: state.form, snapshot: state.snapshot, dirty: false, fieldErrors: [] };

    case 'save/failed':
      if (state.kind === 'loading') {
        return state;
      }
      return {
        kind: 'error',
        form: state.form,
        snapshot: state.snapshot,
        dirty: state.dirty,
        fieldErrors: state.fieldErrors,
        message: event.message,
      };
  }
}
