import type { EventType } from '@minical/api-client';

import { errorMessage } from '@/features/owner/model/errors';
import type { UseCaseResult } from '@/features/owner/usecases/result';

/**
 * Состояние экрана `owner.event-types` (спека 06).
 *
 * Набор `kind` и имена свойств — как в `generated/EventTypes.types.generated.ts`; модель
 * объявлена `source="api"`, поэтому `EventType[]` контракта используется как есть, без
 * промежуточного view-model маппинга (в отличие от гостевого каталога).
 */
export type EventTypesState =
  | { kind: 'loading' }
  | { kind: 'empty' }
  | { kind: 'content'; items: EventType[] }
  | { kind: 'error'; message: string };

export const initialEventTypesState: EventTypesState = { kind: 'loading' };

/** Первый фокус (`loadEventTypes`): пустой и непустой список, ошибка — по StateMachine спеки. */
export function loaded(result: UseCaseResult<EventType[]>): EventTypesState {
  if (!result.ok) {
    return { kind: 'error', message: errorMessage(result.error) };
  }
  return contentOrEmpty(result.data);
}

/**
 * Повторный фокус — тот же приём, что у `guest.slots` (`GuestSlotsScreen`): фоновый refresh
 * не возвращает экран в `loading` и неудачный запрос не портит уже показанный список.
 * Ровно так экран узнаёт о типе события, созданном на экране 10 (AC спеки 10: «После успеха
 * новый тип появляется в списке»), без изобретения состояния `refreshing`, которого нет в
 * StateMachine спеки.
 */
export function refreshed(current: EventTypesState, result: UseCaseResult<EventType[]>): EventTypesState {
  if (!result.ok) {
    return current;
  }
  return contentOrEmpty(result.data);
}

function contentOrEmpty(items: EventType[]): EventTypesState {
  return items.length === 0 ? { kind: 'empty' } : { kind: 'content', items };
}
