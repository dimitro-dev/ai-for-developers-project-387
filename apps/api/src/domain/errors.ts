/**
 * Доменная ошибка знает только `code`; HTTP-статус живёт в http/errors.ts (Р3).
 * Union объявлен здесь, чтобы направление зависимостей оставалось `http → domain`
 * (уточнение Р3 по вопросу O1 плана).
 */
export type DomainErrorCode =
  | 'VALIDATION_ERROR'
  | 'CALENDAR_NOT_CONFIGURED'
  | 'SLOT_OUTSIDE_WINDOW'
  | 'SLOT_NOT_ALIGNED'
  | 'GUEST_NAME_REQUIRED'
  | 'GUEST_EMAIL_REQUIRED'
  | 'EVENT_TYPE_NOT_FOUND'
  | 'ONBOARDING_ALREADY_COMPLETED'
  | 'DUPLICATE_EVENT_TYPE_ID'
  | 'SLOT_UNAVAILABLE'
  | 'DUPLICATE_BOOKING_ID';

export class DomainError extends Error {
  // Поля присваиваются явно: parameter properties не являются erasable-синтаксисом
  // и не выполняются в strip-only режиме Node (Р11).
  readonly code: DomainErrorCode;

  constructor(code: DomainErrorCode, message: string) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
  }
}
