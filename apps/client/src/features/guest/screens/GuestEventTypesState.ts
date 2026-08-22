import type { AppError } from '@/api/errors';
import { errorMessage } from '@/api/errors';
import type { CalendarView, EventTypeView } from '@/features/guest/model/types';

/**
 * Состояние экрана `guest.event-types`.
 *
 * Набор `kind` и имена свойств — как в `screens/generated/GuestEventTypes.types.generated.ts`;
 * типы — view-model фундамента вместо контрактных DTO (`generation-report.md`, расхождение 2).
 */
export type GuestEventTypesState =
  | { kind: 'loading' }
  | { kind: 'content'; calendar: CalendarView; items: EventTypeView[] }
  | { kind: 'empty' }
  | { kind: 'error'; message: string; canRetry: boolean };

export const initialGuestEventTypesState: GuestEventTypesState = { kind: 'loading' };

/** Результат пары чтений экрана: переходом владеет `loadPublicEventTypes` (UX rule спеки). */
export interface CatalogLoad {
  /** `loadPublicCalendar`: имя владельца. Ошибка чтения календаря не отменяет список. */
  calendar: { ok: true; data: CalendarView } | { ok: false; error: AppError };
  /** `loadPublicEventTypes`: голый `EventType[]`. */
  eventTypes: { ok: true; data: EventTypeView[] } | { ok: false; error: AppError };
}

const CALENDAR_NOT_CONFIGURED = 'CALENDAR_NOT_CONFIGURED';

/**
 * Переходы по результатам пары чтений, в порядке ветвей спеки.
 *
 * `CALENDAR_NOT_CONFIGURED` любого из двух чтений ведёт в `empty`: гостю незачем различать
 * «владелец не настроил календарь» и «типов встреч нет» — записаться в обоих случаях не на что.
 */
export function catalogLoaded({ calendar, eventTypes }: CatalogLoad): GuestEventTypesState {
  if (!eventTypes.ok) {
    if (eventTypes.error.code === CALENDAR_NOT_CONFIGURED) {
      return { kind: 'empty' };
    }
    return { kind: 'error', message: errorMessage(eventTypes.error), canRetry: true };
  }

  if (!calendar.ok && calendar.error.code === CALENDAR_NOT_CONFIGURED) {
    return { kind: 'empty' };
  }

  if (eventTypes.data.length === 0) {
    return { kind: 'empty' };
  }

  // Список получен, а имя владельца — нет: заголовок «Запланировать встречу с …» без имени
  // не собрать, поэтому это ошибка экрана, а не молчаливый пропуск (`onErrorState` спеки).
  if (!calendar.ok) {
    return { kind: 'error', message: errorMessage(calendar.error), canRetry: true };
  }

  return { kind: 'content', calendar: calendar.data, items: eventTypes.data };
}
