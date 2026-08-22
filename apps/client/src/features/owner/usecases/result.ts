import type { AppError } from '@/api/errors';

/**
 * Единая форма результата owner use-case — тот же канон, что у гостевого
 * (`features/guest/usecases/result.ts`): наружу ничего не бросается, и ответ сервера с ошибкой,
 * и обрыв сети приходят как `{ ok: false }` с каноническим `$error`.
 *
 * Не импортируется из `features/guest/**`: guest-модуль его не экспортирует (тип приватен для
 * своего файла), а зона гостя в этой задаче не редактируется — owner заводит свою копию по
 * тому же контракту, а не форкает чужую.
 */
export type UseCaseResult<T> = { ok: true; data: T } | { ok: false; error: AppError };
