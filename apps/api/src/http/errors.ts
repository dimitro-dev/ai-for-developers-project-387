// Единственное место, где доменный код превращается в HTTP-статус (FR4, Р3).
// Домен знает только `code`, транспорт — только статус.

import type { NextFunction, Request, RequestHandler, Response } from 'express';

import { DomainError } from '../domain/errors.ts';
import type { DomainErrorCode } from '../domain/errors.ts';

/**
 * `satisfies` держит две гарантии: статус обязан быть у каждого кода, лишних ключей
 * быть не может. Тип берётся из домена, поэтому направление зависимостей —
 * `http → domain`, а не наоборот (уточнение Р3).
 */
export const ERROR_STATUS = {
  VALIDATION_ERROR: 400,
  CALENDAR_NOT_CONFIGURED: 400,
  SLOT_OUTSIDE_WINDOW: 400,
  SLOT_NOT_ALIGNED: 400,
  GUEST_NAME_REQUIRED: 400,
  GUEST_EMAIL_REQUIRED: 400,
  EVENT_TYPE_NOT_FOUND: 404,
  ONBOARDING_ALREADY_COMPLETED: 409,
  DUPLICATE_EVENT_TYPE_ID: 409,
  SLOT_UNAVAILABLE: 409,
  DUPLICATE_BOOKING_ID: 409,
} as const satisfies Record<DomainErrorCode, number>;

/** `ErrorResponse.message` ограничен контрактом; длинный список Zod-issues обрезается. */
const MAX_MESSAGE_LENGTH = 2000;

/**
 * Неизвестный URL и неподдерживаемый метод — один ответ (G3: вне контракта, но в
 * форме `ErrorResponse`). 405 с `Allow` не делаем: потребителя у него нет.
 */
export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({ code: 'NOT_FOUND', message: 'Route not found' });
};

/**
 * Последний middleware цепочки. Express 5 сам передаёт сюда отказ промиса
 * async-обработчика, поэтому обёрток вида `asyncHandler` нет (Р8).
 */
export function errorMiddleware(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (error instanceof DomainError) {
    res
      .status(ERROR_STATUS[error.code])
      .json({ code: error.code, message: clampMessage(error.message) });
    return;
  }
  if (isBodyParseError(error)) {
    // То же, что дал бы Zod на нераспарсенном теле.
    res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Invalid request: malformed JSON body' });
    return;
  }
  if (isPayloadTooLargeError(error)) {
    // Лимит задаёт `express.json()` (task-infra-003, Р5, Р6). Статус берётся не из
    // `ERROR_STATUS`, а код не входит в `DomainErrorCode`: домен об ограничениях
    // транспорта не знает. Ответ вне контракта — тот же класс, что `NOT_FOUND` (G5).
    res.status(413).json({ code: 'PAYLOAD_TOO_LARGE', message: payloadTooLargeMessage(error) });
    return;
  }
  console.error('MiniCal API: unhandled error', error);
  res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
}

/** `express.json()` бросает `SyntaxError` с `type: 'entity.parse.failed'`. */
function isBodyParseError(error: unknown): boolean {
  return (
    error instanceof SyntaxError &&
    'type' in error &&
    (error as { type?: unknown }).type === 'entity.parse.failed'
  );
}

/**
 * `express.json()` бросает `PayloadTooLargeError` с `type: 'entity.too.large'` и
 * `status: 413`. Проверка структурная, как у парсинга: `http-errors` не является
 * объявленной зависимостью `apps/api`, и `instanceof` привязал бы код к транзитивному
 * пакету. `SyntaxError` этот класс ошибок не наследует, поэтому ветка выше не задета.
 */
function isPayloadTooLargeError(error: unknown): boolean {
  return (
    error instanceof Error &&
    'type' in error &&
    (error as { type?: unknown }).type === 'entity.too.large'
  );
}

/** Величина берётся из самой ошибки, поэтому текст не может разойтись с фактическим лимитом. */
function payloadTooLargeMessage(error: unknown): string {
  const limit = (error as { limit?: unknown }).limit;
  return typeof limit === 'number'
    ? `Request body exceeds the limit of ${limit} bytes`
    : 'Request body is too large';
}

function clampMessage(message: string): string {
  return message.length <= MAX_MESSAGE_LENGTH ? message : `${message.slice(0, MAX_MESSAGE_LENGTH - 1)}…`;
}
