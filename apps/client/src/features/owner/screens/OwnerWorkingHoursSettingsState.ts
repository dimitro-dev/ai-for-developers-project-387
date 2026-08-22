import type { AvailabilityRule, DayOfWeek } from '@minical/api-client';

import type { Weekday, WorkingInterval } from '@/features/availability/lib';
import type { OwnerSettingsView } from '@/features/owner/model/types';

/**
 * StateMachine экрана `owner.working-hours-settings` (спека 07). Как и `OnboardingWorkingHoursState`
 * (P16), `editedInterval` типизирован `WorkingInterval | null` (генератор теряет `required="false"`
 * `<Property>` — тот же известный пробел). `form` — `OwnerSettingsDraft` спеки целиком
 * (`displayName`/`timeZone`/`availabilityRules`/`slotIntervalMinutes`): в отличие от экрана 09
 * здесь нет отдельного `snapshot` — Payload `saveOwnerSettings` спеки берёт `displayName`/`timeZone`
 * из того же `$state.form`, что и редактируемые поля (эти два поля этот экран не редактирует,
 * они просто проходят без изменений — read-modify-write того же принципа, но без второй модели).
 */
export interface OwnerWorkingHoursDraft {
  displayName: string;
  timeZone: string;
  availabilityRules: WorkingInterval[];
  slotIntervalMinutes: number;
}

export type OwnerWorkingHoursSettingsState =
  | { kind: 'loading' }
  | { kind: 'editing'; form: OwnerWorkingHoursDraft; dirty: boolean; editedInterval: WorkingInterval | null }
  | { kind: 'intervalSheet'; form: OwnerWorkingHoursDraft; dirty: boolean; editedInterval: WorkingInterval | null }
  | { kind: 'saving'; form: OwnerWorkingHoursDraft; dirty: boolean; editedInterval: WorkingInterval | null }
  | {
      kind: 'error';
      form: OwnerWorkingHoursDraft;
      dirty: boolean;
      editedInterval: WorkingInterval | null;
      message: string;
    }
  | { kind: 'saved'; form: OwnerWorkingHoursDraft; dirty: boolean; editedInterval: WorkingInterval | null };

export type OwnerWorkingHoursSettingsEvent =
  | { type: 'load/succeeded'; view: OwnerSettingsView }
  | { type: 'load/failed'; message: string }
  | { type: 'openAddWorkingHours' }
  | { type: 'editWorkingInterval'; interval: WorkingInterval }
  | { type: 'applyWorkingInterval'; daysOfWeek: Weekday[]; startLocal: string; endLocal: string }
  | { type: 'closeAddWorkingHours' }
  | { type: 'changeSlotStep'; value: number }
  | { type: 'save/started' }
  | { type: 'save/succeeded' }
  | { type: 'save/failed'; message: string };

export const initialOwnerWorkingHoursSettingsState: OwnerWorkingHoursSettingsState = { kind: 'loading' };

/** Спека не задаёт дефолт явно — тот же выбор середины набора 15/30/60, что у онбординга (P16). */
const DEFAULT_SLOT_INTERVAL_MINUTES = 30;

const EMPTY_DRAFT: OwnerWorkingHoursDraft = {
  displayName: '',
  timeZone: '',
  availabilityRules: [],
  slotIntervalMinutes: DEFAULT_SLOT_INTERVAL_MINUTES,
};

const DAY_OF_WEEK_TO_WEEKDAY: Readonly<Record<DayOfWeek, Weekday>> = {
  Monday: 'monday',
  Tuesday: 'tuesday',
  Wednesday: 'wednesday',
  Thursday: 'thursday',
  Friday: 'friday',
  Saturday: 'saturday',
  Sunday: 'sunday',
};

/**
 * Client-only id интервала — счётчик поверх `Date.now()`, тот же приём и то же обоснование
 * (не криптографический), что `newIntervalId` в `OnboardingWorkingHoursState` (P16); отдельный
 * экземпляр здесь, а не общий экспорт — эти два экрана не делят модуль состояния.
 */
let intervalIdSequence = 0;

function newIntervalId(): string {
  intervalIdSequence += 1;
  return `interval-${Date.now().toString(36)}-${intervalIdSequence}`;
}

/** `AvailabilityRule[]` контракта → view-model `WorkingInterval[]` с client-only `id` списка. */
function toWorkingIntervals(rules: readonly AvailabilityRule[]): WorkingInterval[] {
  return rules.map((rule) => ({
    id: newIntervalId(),
    daysOfWeek: rule.daysOfWeek.map((day) => DAY_OF_WEEK_TO_WEEKDAY[day]),
    startLocal: rule.startLocal,
    endLocal: rule.endLocal,
  }));
}

function toDraft(view: OwnerSettingsView): OwnerWorkingHoursDraft {
  return {
    displayName: view.displayName,
    timeZone: view.timeZone,
    availabilityRules: toWorkingIntervals(view.availabilityRules),
    slotIntervalMinutes: view.slotIntervalMinutes,
  };
}

/** Правило `interval-required` спеки — вживую, тот же приём, что `validateWorkingHoursDraft` (P16). */
export function validateOwnerWorkingHoursDraft(form: OwnerWorkingHoursDraft): string | null {
  return form.availabilityRules.length === 0 ? 'Добавьте хотя бы один рабочий интервал' : null;
}

function withForm(
  state: Exclude<OwnerWorkingHoursSettingsState, { kind: 'loading' }>,
  form: OwnerWorkingHoursDraft,
  dirty: boolean = true,
  editedInterval: WorkingInterval | null = state.editedInterval,
): OwnerWorkingHoursSettingsState {
  switch (state.kind) {
    case 'editing':
      return { kind: 'editing', form, dirty, editedInterval };
    case 'intervalSheet':
      return { kind: 'intervalSheet', form, dirty, editedInterval };
    case 'saving':
      return { kind: 'saving', form, dirty, editedInterval };
    case 'error':
      return { kind: 'error', form, dirty, editedInterval, message: state.message };
    case 'saved':
      return { kind: 'saved', form, dirty, editedInterval };
  }
}

export function ownerWorkingHoursSettingsReducer(
  state: OwnerWorkingHoursSettingsState,
  event: OwnerWorkingHoursSettingsEvent,
): OwnerWorkingHoursSettingsState {
  switch (event.type) {
    case 'load/succeeded':
      return { kind: 'editing', form: toDraft(event.view), dirty: false, editedInterval: null };

    case 'load/failed':
      return { kind: 'error', form: EMPTY_DRAFT, dirty: false, editedInterval: null, message: event.message };

    case 'openAddWorkingHours':
      if (state.kind === 'loading') {
        return state;
      }
      return { kind: 'intervalSheet', form: state.form, dirty: state.dirty, editedInterval: null };

    case 'editWorkingInterval':
      if (state.kind === 'loading') {
        return state;
      }
      return { kind: 'intervalSheet', form: state.form, dirty: state.dirty, editedInterval: event.interval };

    case 'applyWorkingInterval': {
      if (state.kind === 'loading') {
        return state;
      }
      const { daysOfWeek, startLocal, endLocal } = event;
      const edited = state.editedInterval;
      // Редактирование заменяет исходный интервал по id (сохраняя его), создание — добавляет новый
      // (та же семантика, что `OnboardingWorkingHoursState.applyWorkingInterval`, P16).
      const availabilityRules = edited
        ? state.form.availabilityRules.map((existing) =>
            existing.id === edited.id ? { ...existing, daysOfWeek, startLocal, endLocal } : existing,
          )
        : [...state.form.availabilityRules, { id: newIntervalId(), daysOfWeek, startLocal, endLocal }];
      return { kind: 'editing', form: { ...state.form, availabilityRules }, dirty: true, editedInterval: null };
    }

    case 'closeAddWorkingHours':
      if (state.kind === 'loading') {
        return state;
      }
      return { kind: 'editing', form: state.form, dirty: state.dirty, editedInterval: null };

    case 'changeSlotStep':
      if (state.kind === 'loading') {
        return state;
      }
      return withForm(state, { ...state.form, slotIntervalMinutes: event.value }, true);

    case 'save/started':
      if (state.kind === 'loading') {
        return state;
      }
      return { kind: 'saving', form: state.form, dirty: state.dirty, editedInterval: state.editedInterval };

    case 'save/succeeded':
      if (state.kind === 'loading') {
        return state;
      }
      return { kind: 'saved', form: state.form, dirty: false, editedInterval: null };

    case 'save/failed':
      if (state.kind === 'loading') {
        return state;
      }
      return {
        kind: 'error',
        form: state.form,
        dirty: state.dirty,
        editedInterval: null,
        message: event.message,
      };
  }
}
