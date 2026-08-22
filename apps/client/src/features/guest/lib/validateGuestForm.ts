import type { GuestDraft } from '@/features/guest/state/reducer';
import type { FieldError } from '@/shared/forms';

/**
 * Блок `<Validation>` спеки 14: три правила в порядке объявления.
 *
 * Валидация вызывается только на submit (`before="validateGuestForm"`): непустой результат
 * переводит экран в `validationError`, и запрос не уходит. Клиентская проверка не заменяет
 * серверную (MANUAL §9) — авторитет у сервера, 400 брони не создаёт.
 */
export function validateGuestForm(draft: GuestDraft): FieldError[] {
  const errors: FieldError[] = [];

  if (draft.name.trim().length === 0) {
    errors.push({ field: 'guest-name', message: 'Введите имя' });
  }

  if (draft.email.trim().length === 0) {
    errors.push({ field: 'guest-email', message: 'Введите email' });
  } else if (!isEmail(draft.email)) {
    // Правило формата отдельное, но при пустом поле сообщение о пустоте точнее.
    errors.push({ field: 'guest-email', message: 'Введите корректный email' });
  }

  return errors;
}

/**
 * Консервативная структурная проверка: непустые локальная часть и домен вокруг единственной `@`,
 * точка внутри домена, никаких пробелов. Полный синтаксис RFC клиент не разбирает — это работа
 * сервера, и он же выносит окончательный вердикт.
 */
export function isEmail(value: string): boolean {
  const email = value.trim();
  if (email.length === 0 || /\s/.test(email)) {
    return false;
  }

  const at = email.indexOf('@');
  if (at <= 0 || at !== email.lastIndexOf('@')) {
    return false;
  }

  const domain = email.slice(at + 1);
  const dot = domain.indexOf('.');
  return dot > 0 && dot < domain.length - 1;
}
