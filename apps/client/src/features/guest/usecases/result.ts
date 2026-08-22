import type { AppError } from '@/api/errors';

/**
 * Единая форма результата use-case. Наружу ничего не бросается: и ответ сервера с ошибкой,
 * и обрыв сети приходят как `{ ok: false }` с каноническим `$error`.
 */
export type UseCaseResult<T> = { ok: true; data: T } | { ok: false; error: AppError };
