import type { ErrorResponse } from '@minical/api-client';

import { errorMessage, toAppError } from './errors';

/** Ответ сервера: важен только факт его наличия — тело SDK уже разобрал в `error`. */
const serverResponse = new Response(null, { status: 400 });

/** Фикстуры контрактного `ErrorResponse`: коды из контракта, тексты — как их шлёт backend. */
const GUEST_ERROR_FIXTURES: ReadonlyArray<ErrorResponse> = [
  { code: 'VALIDATION_ERROR', message: 'Request body is invalid' },
  { code: 'CALENDAR_NOT_CONFIGURED', message: 'Calendar owner has not completed setup' },
  { code: 'EVENT_TYPE_NOT_FOUND', message: 'Event type does not exist' },
  { code: 'SLOT_OUTSIDE_WINDOW', message: 'Slot start is outside the 14-day window' },
  { code: 'SLOT_NOT_ALIGNED', message: 'Slot start does not align with the slot grid' },
  { code: 'SLOT_UNAVAILABLE', message: 'Slot is already booked' },
  { code: 'DUPLICATE_BOOKING_ID', message: 'Booking id already exists with a different payload' },
  { code: 'GUEST_NAME_REQUIRED', message: 'Guest name is required' },
  { code: 'GUEST_EMAIL_REQUIRED', message: 'Guest email is required' },
];

const OFF_CONTRACT_FIXTURES: ReadonlyArray<ErrorResponse> = [
  { code: 'NOT_FOUND', message: 'Route not found' },
  { code: 'INTERNAL_ERROR', message: 'Unexpected error' },
  { code: 'PAYLOAD_TOO_LARGE', message: 'Request body too large' },
];

describe('toAppError', () => {
  it.each(GUEST_ERROR_FIXTURES)('переносит код и серверный message ($code)', (fixture) => {
    expect(toAppError({ error: fixture, response: serverResponse })).toEqual({
      code: fixture.code,
      message: fixture.message,
      transport: false,
    });
  });

  it('ответ сервера даёт transport: false', () => {
    const error = toAppError({
      error: { code: 'SLOT_UNAVAILABLE', message: 'Slot is already booked' },
      response: serverResponse,
    });

    expect(error.transport).toBe(false);
  });

  it('отсутствие response даёт transport: true', () => {
    // Обрыв сети: fetch бросил TypeError, SDK вернул его в error без response.
    const error = toAppError({ error: new TypeError('Network request failed') });

    expect(error).toEqual({ code: null, message: null, transport: true });
  });

  it('не-JSON тело ошибки: сырой текст в message, кода нет', () => {
    const error = toAppError({ error: '<html>502 Bad Gateway</html>', response: serverResponse });

    expect(error).toEqual({
      code: null,
      message: '<html>502 Bad Gateway</html>',
      transport: false,
    });
  });

  it('пустое тело ошибки не порождает ни кода, ни сообщения', () => {
    expect(toAppError({ error: {}, response: serverResponse })).toEqual({
      code: null,
      message: null,
      transport: false,
    });
  });

  it('объект без строковых code/message игнорируется целиком', () => {
    expect(toAppError({ error: { code: 500, message: null }, response: serverResponse })).toEqual({
      code: null,
      message: null,
      transport: false,
    });
  });
});

describe('errorMessage', () => {
  it.each(GUEST_ERROR_FIXTURES)('даёт свой текст коду $code', (fixture) => {
    const message = errorMessage(toAppError({ error: fixture, response: serverResponse }));

    expect(message).not.toBe('Что-то пошло не так. Попробуйте ещё раз.');
    expect(message.length).toBeGreaterThan(0);
  });

  it('девять кодов гостевого сценария имеют девять разных текстов', () => {
    const messages = GUEST_ERROR_FIXTURES.map((fixture) =>
      errorMessage(toAppError({ error: fixture, response: serverResponse })),
    );

    expect(new Set(messages).size).toBe(GUEST_ERROR_FIXTURES.length);
  });

  it.each(OFF_CONTRACT_FIXTURES)('даёт свой текст внеконтрактному коду $code', (fixture) => {
    const message = errorMessage(toAppError({ error: fixture, response: serverResponse }));

    expect(message).not.toBe('Что-то пошло не так. Попробуйте ещё раз.');
  });

  it('неизвестный код падает в fallback', () => {
    const error = toAppError({
      error: { code: 'TEAPOT', message: 'I am a teapot' },
      response: serverResponse,
    });

    expect(errorMessage(error)).toBe('Что-то пошло не так. Попробуйте ещё раз.');
  });

  it('отсутствующий код падает в fallback', () => {
    expect(errorMessage({ code: null, message: null, transport: false })).toBe(
      'Что-то пошло не так. Попробуйте ещё раз.',
    );
  });

  it('транспортная ошибка получает текст про связь, а не fallback', () => {
    const message = errorMessage({ code: null, message: null, transport: true });

    expect(message).toBe('Нет связи с сервером. Проверьте подключение и попробуйте ещё раз.');
  });

  it('transport перекрывает код: ответа сервера не было', () => {
    expect(errorMessage({ code: 'SLOT_UNAVAILABLE', message: null, transport: true })).toBe(
      'Нет связи с сервером. Проверьте подключение и попробуйте ещё раз.',
    );
  });
});
