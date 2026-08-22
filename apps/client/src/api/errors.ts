import type { ErrorResponse } from '@minical/api-client';

/**
 * Канонический корень `$error` (`docs/ui-spec-kit/MANUAL.md` §6.4) — единственная форма ошибки,
 * которую видят экраны и по которой ветвится `onErrorWhen`.
 *
 * `message` — это `ErrorResponse.message` **сервера**, а не текст для гостя: человекочитаемые
 * формулировки отдаёт `errorMessage()`.
 */
export type AppError = {
  code: string | null;
  message: string | null;
  /** `true` — ответа от сервера не было вовсе (обрыв сети, таймаут, DNS). */
  transport: boolean;
};

/**
 * Неуспешный результат generated SDK. `throwOnError` выключен, поэтому операция возвращает
 * `{ data: undefined, error, request?, response? }`, а при обрыве сети `fetch` бросает `TypeError`
 * и `response` остаётся `undefined` — это и есть дискриминатор транспортной ошибки.
 * Тот же тип принимает перехваченное исключение: вызов `toAppError({ error: thrown })` без
 * `response` означает «ответа не было».
 */
export type SdkFailure = {
  error: unknown;
  response?: Response;
};

function isErrorResponse(value: unknown): value is ErrorResponse {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  if (!('code' in value) || !('message' in value)) {
    return false;
  }
  return typeof value.code === 'string' && typeof value.message === 'string';
}

export function toAppError({ error, response }: SdkFailure): AppError {
  const transport = response === undefined;

  if (isErrorResponse(error)) {
    return { code: error.code, message: error.message, transport };
  }

  // Тело ошибки не JSON — SDK бросает сырой текст ответа; кода в нём нет.
  if (typeof error === 'string' && error.trim() !== '') {
    return { code: null, message: error, transport };
  }

  return { code: null, message: null, transport };
}

/**
 * Коды гостевого сценария (`brief.md` FR5) плюс внеконтрактные ответы инфраструктуры.
 * Значения кодов приходят из контракта; сообщения — тон гостевого флоу.
 */
const GUEST_ERROR_MESSAGES: Readonly<Record<string, string | undefined>> = {
  VALIDATION_ERROR: 'Проверьте введённые данные и попробуйте ещё раз.',
  CALENDAR_NOT_CONFIGURED: 'Календарь пока не настроен — записаться не на что.',
  EVENT_TYPE_NOT_FOUND: 'Эта встреча больше недоступна.',
  SLOT_OUTSIDE_WINDOW: 'Записаться можно только на ближайшие 14 дней. Выберите другое время.',
  SLOT_NOT_ALIGNED: 'Это время больше не доступно для записи. Выберите другое время.',
  SLOT_UNAVAILABLE: 'Этот слот только что заняли. Выберите другое время.',
  DUPLICATE_BOOKING_ID: 'Данные встречи изменились. Вернитесь к выбору времени и попробуйте снова.',
  GUEST_NAME_REQUIRED: 'Введите имя.',
  GUEST_EMAIL_REQUIRED: 'Введите корректный email.',
  NOT_FOUND: 'Запрошенная страница не найдена.',
  INTERNAL_ERROR: 'На сервере что-то пошло не так. Попробуйте позже.',
  PAYLOAD_TOO_LARGE: 'Слишком длинный текст. Сократите комментарий и попробуйте снова.',
};

const TRANSPORT_MESSAGE = 'Нет связи с сервером. Проверьте подключение и попробуйте ещё раз.';

const FALLBACK_MESSAGE = 'Что-то пошло не так. Попробуйте ещё раз.';

/** Текст для гостя. Серверный `message` не показываем: он на английском и адресован разработчику. */
export function errorMessage(error: AppError): string {
  if (error.transport) {
    return TRANSPORT_MESSAGE;
  }

  const known = error.code === null ? undefined : GUEST_ERROR_MESSAGES[error.code];
  return known ?? FALLBACK_MESSAGE;
}
