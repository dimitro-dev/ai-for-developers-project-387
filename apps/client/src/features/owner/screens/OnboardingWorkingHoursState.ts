import type { Weekday, WorkingInterval } from '@/features/availability/lib';

/**
 * StateMachine экрана `owner.onboarding-working-hours` (спека 03). Набор `kind` повторяет
 * `screens/generated/OnboardingWorkingHours.types.generated.ts`, но `editedInterval` типизирован
 * `WorkingInterval | null` (генератор потерял `required="false"` из `<Property>` — тот же
 * известный пробел, что у `selectedSlot` в `GuestSlotsState`, см. его комментарий).
 *
 * `WorkingHoursDraft`/`WorkingInterval` здесь — не generated-тип этого конкретного экрана, а
 * общий view-model `@/features/availability/lib` (используют также `AddWorkingHoursSheet` и,
 * позже, экран 07): у generated-версии `startLocal`/`endLocal` — брендированный `LocalTime`
 * (`uispec-runtime.ts`), а sheet отдаёт обычные строки `HH:mm`, поэтому сборка нового интервала
 * из Payload sheet не типизируется generated-полем без приведения. `@minical/api-client`
 * (`AvailabilityRule.startLocal`) сам типизирует `LocalTime` как обычный `string` — общий
 * view-model следует этому же контракту, а не брендированию генератора каркасов.
 */
export interface WorkingHoursDraft {
  availabilityRules: WorkingInterval[];
  slotIntervalMinutes: number;
  timeZone: string;
}
export type OnboardingWorkingHoursState =
  | { kind: 'editing'; form: WorkingHoursDraft; editedInterval: WorkingInterval | null }
  | { kind: 'intervalSheet'; form: WorkingHoursDraft; editedInterval: WorkingInterval | null }
  | { kind: 'submitting'; form: WorkingHoursDraft; editedInterval: WorkingInterval | null }
  | {
      kind: 'error';
      form: WorkingHoursDraft;
      editedInterval: WorkingInterval | null;
      message: string;
    };

export type OnboardingWorkingHoursEvent =
  | { type: 'openAddWorkingHours' }
  | { type: 'editWorkingInterval'; interval: WorkingInterval }
  | { type: 'applyWorkingInterval'; daysOfWeek: Weekday[]; startLocal: string; endLocal: string }
  | { type: 'closeAddWorkingHours' }
  | { type: 'changeSlotStep'; value: number }
  | { type: 'submit/started' }
  | { type: 'submit/failed'; message: string };

/** Спека не задаёт дефолт явно — середина набора 15/30/60 (`slot-step`), тот же выбор, что дефолт 30 у длительности встречи (P18). */
const DEFAULT_SLOT_INTERVAL_MINUTES = 30;

export function initialOnboardingWorkingHoursState(timeZone: string): OnboardingWorkingHoursState {
  return {
    kind: 'editing',
    form: { availabilityRules: [], slotIntervalMinutes: DEFAULT_SLOT_INTERVAL_MINUTES, timeZone },
    editedInterval: null,
  };
}

/**
 * Ключ списка интервала — client-only, в контракт не попадает (`toAvailabilityRules` его
 * отбрасывает), нужен только для React-ключа и «редактируемый интервал заменяет сам себя»
 * (`applyWorkingInterval`). Криптографическая случайность здесь не нужна (в отличие от
 * `newBookingKey` — ключа идемпотентности, который реально уходит на backend), поэтому вместо
 * `expo-crypto` — счётчик поверх `Date.now()`: работает одинаково на web, Android и в jest без
 * зависимости от native-модуля.
 */
let intervalIdSequence = 0;

function newIntervalId(): string {
  intervalIdSequence += 1;
  return `interval-${Date.now().toString(36)}-${intervalIdSequence}`;
}

export function onboardingWorkingHoursReducer(
  state: OnboardingWorkingHoursState,
  event: OnboardingWorkingHoursEvent,
): OnboardingWorkingHoursState {
  switch (event.type) {
    case 'openAddWorkingHours':
      return { kind: 'intervalSheet', form: state.form, editedInterval: null };

    case 'editWorkingInterval':
      return { kind: 'intervalSheet', form: state.form, editedInterval: event.interval };

    case 'applyWorkingInterval': {
      const { daysOfWeek, startLocal, endLocal } = event;
      const edited = state.editedInterval;
      // Редактирование заменяет исходный интервал по id (сохраняя его), создание — добавляет новый.
      const availabilityRules = edited
        ? state.form.availabilityRules.map((existing) =>
            existing.id === edited.id ? { ...existing, daysOfWeek, startLocal, endLocal } : existing,
          )
        : [...state.form.availabilityRules, { id: newIntervalId(), daysOfWeek, startLocal, endLocal }];
      return { kind: 'editing', form: { ...state.form, availabilityRules }, editedInterval: null };
    }

    case 'closeAddWorkingHours':
      return { kind: 'editing', form: state.form, editedInterval: null };

    case 'changeSlotStep': {
      const form = { ...state.form, slotIntervalMinutes: event.value };
      if (state.kind === 'error') {
        return { kind: 'error', form, editedInterval: state.editedInterval, message: state.message };
      }
      return { kind: state.kind, form, editedInterval: state.editedInterval };
    }

    case 'submit/started':
      return { kind: 'submitting', form: state.form, editedInterval: null };

    case 'submit/failed':
      return { kind: 'error', form: state.form, editedInterval: null, message: event.message };
  }
}

/** Правило `interval-required` спеки 03 — вживую, тем же приёмом, что валидация экрана 02. */
export function validateWorkingHoursDraft(form: WorkingHoursDraft): string | null {
  return form.availabilityRules.length === 0 ? 'Добавьте хотя бы один рабочий интервал' : null;
}
