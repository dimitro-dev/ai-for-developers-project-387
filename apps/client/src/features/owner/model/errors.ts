import type { AppError } from '@/api/errors';

/**
 * Owner-словарь сообщений в каноне `$error` (`AGENTS.md` FR8, `docs/ui-spec-kit/MANUAL.md` §6.4):
 * серверный `AppError.message` — для разработчика, а не для владельца, поэтому текст владельцу
 * даёт только эта функция. Живёт рядом с owner-usecases, а не в `@/api/errors`: тот файл уже
 * занят гостевым словарём (`GUEST_ERROR_MESSAGES`/`errorMessage`), а `features/guest/**` в этой
 * задаче не редактируется — `toAppError`/`AppError` остаются общим каноном, тексты по кодам
 * owner-флоу заводят свою копию по тому же контракту.
 *
 * Коды подобраны по документированным ошибкам 7 admin-операций (`packages/api-client`):
 * `VALIDATION_ERROR` и `DUPLICATE_EVENT_TYPE_ID` — `createAdminEventType`; `VALIDATION_ERROR`
 * и `CALENDAR_NOT_CONFIGURED` — `getAdminSettings`/`updateAdminSettings`; `VALIDATION_ERROR`
 * и `ONBOARDING_ALREADY_COMPLETED` — `completeAdminSetup`; плюс общие инфраструктурные коды
 * (`apps/api/src/http/errors.ts`), одинаковые для всех операций.
 */
const OWNER_ERROR_MESSAGES: Readonly<Record<string, string | undefined>> = {
  VALIDATION_ERROR: 'Проверьте введённые данные и попробуйте ещё раз.',
  CALENDAR_NOT_CONFIGURED: 'Настройка календаря ещё не завершена.',
  ONBOARDING_ALREADY_COMPLETED: 'Настройка календаря уже завершена.',
  // Экран 10 (`10-create-event-type.screen.md`) раскладывает этот код в полевую ошибку
  // `public-id` сам — из словаря он получает только текст, разложение по полю — конвенция
  // контейнера (см. отчёт задачи), а не грамматика UISpec.
  DUPLICATE_EVENT_TYPE_ID: 'Публичный id уже занят. Выберите другой.',
  NOT_FOUND: 'Запрошенная страница не найдена.',
  INTERNAL_ERROR: 'На сервере что-то пошло не так. Попробуйте позже.',
  PAYLOAD_TOO_LARGE: 'Слишком длинный текст. Сократите его и попробуйте снова.',
};

const TRANSPORT_MESSAGE = 'Нет связи с сервером. Проверьте подключение и попробуйте ещё раз.';

const FALLBACK_MESSAGE = 'Что-то пошло не так. Попробуйте ещё раз.';

/** Текст для владельца. Серверный `message` не показываем — он на английском и для разработчика. */
export function errorMessage(error: AppError): string {
  if (error.transport) {
    return TRANSPORT_MESSAGE;
  }

  const known = error.code === null ? undefined : OWNER_ERROR_MESSAGES[error.code];
  return known ?? FALLBACK_MESSAGE;
}
