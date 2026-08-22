import { toAppError } from '@/api/errors';

import { errorMessage } from './errors';

/** Фикстуры контрактного `ErrorResponse` документированных ошибок 7 admin-операций. */
const OWNER_ERROR_FIXTURES: ReadonlyArray<{ code: string; message: string }> = [
  { code: 'VALIDATION_ERROR', message: 'Request body is invalid' },
  { code: 'CALENDAR_NOT_CONFIGURED', message: 'Calendar owner has not completed setup' },
  { code: 'ONBOARDING_ALREADY_COMPLETED', message: 'Owner has already completed setup' },
  { code: 'DUPLICATE_EVENT_TYPE_ID', message: 'Event type with this id already exists' },
];

const OFF_CONTRACT_FIXTURES: ReadonlyArray<{ code: string; message: string }> = [
  { code: 'NOT_FOUND', message: 'Route not found' },
  { code: 'INTERNAL_ERROR', message: 'Unexpected error' },
  { code: 'PAYLOAD_TOO_LARGE', message: 'Request body too large' },
];

const serverResponse = new Response(null, { status: 400 });

describe('errorMessage', () => {
  it.each(OWNER_ERROR_FIXTURES)('даёт свой текст коду $code', (fixture) => {
    const message = errorMessage(toAppError({ error: fixture, response: serverResponse }));

    expect(message).not.toBe('Что-то пошло не так. Попробуйте ещё раз.');
    expect(message.length).toBeGreaterThan(0);
  });

  it('четыре кода owner-сценария имеют четыре разных текста', () => {
    const messages = OWNER_ERROR_FIXTURES.map((fixture) =>
      errorMessage(toAppError({ error: fixture, response: serverResponse })),
    );

    expect(new Set(messages).size).toBe(OWNER_ERROR_FIXTURES.length);
  });

  it.each(OFF_CONTRACT_FIXTURES)('даёт свой текст внеконтрактному коду $code', (fixture) => {
    const message = errorMessage(toAppError({ error: fixture, response: serverResponse }));

    expect(message).not.toBe('Что-то пошло не так. Попробуйте ещё раз.');
  });

  it('серверный message не используется — текст берётся из словаря по коду', () => {
    const message = errorMessage(
      toAppError({
        error: { code: 'DUPLICATE_EVENT_TYPE_ID', message: 'Event type with this id already exists' },
        response: serverResponse,
      }),
    );

    expect(message).toBe('Публичный id уже занят. Выберите другой.');
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
    expect(
      errorMessage({ code: 'CALENDAR_NOT_CONFIGURED', message: null, transport: true }),
    ).toBe('Нет связи с сервером. Проверьте подключение и попробуйте ещё раз.');
  });
});
