// Acceptance criteria task-infra-003 (AC1–AC4) поверх createApp. Здесь проверяются
// заголовки ответа, поэтому используется сырой `send` харнесса зоны, а не его
// JSON-клиент: тот отдаёт только статус и тело.

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ROUTES } from './routes.ts';
import { BODY_LIMIT_BYTES } from './security.ts';
import { withServer } from './testServer.ts';

/** Тело валидного JSON заданного размера в байтах (все символы — однобайтовые). */
function jsonBodyOfSize(bytes: number): string {
  const envelope = JSON.stringify({ pad: '' });
  return JSON.stringify({ pad: 'a'.repeat(bytes - envelope.length) });
}

function assertSecurityHeaders(response: Response): void {
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(response.headers.get('x-frame-options'), 'DENY');
  assert.equal(response.headers.get('x-powered-by'), null);
}

// --- CORS и security-заголовки (AC1, AC4) -------------------------------------

test('GET с Origin отдаёт Access-Control-Allow-Origin: * и security-заголовки (AC1, AC4)', async () => {
  await withServer(async ({ send }) => {
    const response = await send('/health', { headers: { Origin: 'http://example.com' } });

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('access-control-allow-origin'), '*');
    assertSecurityHeaders(response);
    assert.deepEqual(await response.json(), { status: 'ok' });
  });
});

test('заголовки стоят и на ответе вне контракта — 404 NOT_FOUND', async () => {
  // Цепочка собрана так, что заголовки выставлены до маршрутизации: без этого браузер не
  // дал бы клиенту прочитать даже код ошибки.
  await withServer(async ({ send }) => {
    const response = await send('/nope', { method: 'GET' });

    assert.equal(response.status, 404);
    assert.equal(response.headers.get('access-control-allow-origin'), '*');
    assertSecurityHeaders(response);
    assert.equal(((await response.json()) as { code: string }).code, 'NOT_FOUND');
  });
});

// --- preflight (AC2) ----------------------------------------------------------

test('OPTIONS-preflight отвечает 204 с CORS-заголовками и пустым телом (AC2)', async () => {
  await withServer(async ({ send }) => {
    const response = await send('/bookings', {
      method: 'OPTIONS',
      headers: { Origin: 'http://example.com', 'Access-Control-Request-Method': 'POST' },
    });

    assert.equal(response.status, 204);
    assert.equal(response.headers.get('access-control-allow-origin'), '*');
    assert.equal(response.headers.get('access-control-allow-methods'), 'GET, POST, PUT, OPTIONS');
    assert.equal(response.headers.get('access-control-allow-headers'), 'Content-Type');
    assertSecurityHeaders(response);
    assert.equal(await response.text(), '');
  });
});

test('Access-Control-Allow-Methods покрывает все методы реестра ROUTES плюс OPTIONS (Р3)', async () => {
  // Проверяется производность списка, а не его сегодняшнее значение (оно зафиксировано
  // тестом выше): новый метод в контракте обязан появиться в preflight сам.
  await withServer(async ({ send }) => {
    const response = await send('/health', { method: 'OPTIONS' });
    const allowed = (response.headers.get('access-control-allow-methods') ?? '').split(', ');

    for (const route of ROUTES) {
      assert.ok(
        allowed.includes(route.method.toUpperCase()),
        `метод ${route.method} из ROUTES отсутствует в preflight: ${allowed.join(', ')}`,
      );
    }
    assert.ok(allowed.includes('OPTIONS'));
  });
});

// --- лимит тела (AC3) ---------------------------------------------------------

test('тело больше лимита → 413 PAYLOAD_TOO_LARGE с CORS-заголовками (AC3)', async () => {
  await withServer(async ({ send }) => {
    const response = await send('/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'http://example.com' },
      body: jsonBodyOfSize(BODY_LIMIT_BYTES + 4096),
    });

    assert.equal(response.status, 413);
    // Без CORS-заголовка на этом ответе браузер скрыл бы от клиента причину отказа.
    assert.equal(response.headers.get('access-control-allow-origin'), '*');
    assertSecurityHeaders(response);

    const body = (await response.json()) as { code: string; message: string };
    assert.deepEqual(Object.keys(body).sort(), ['code', 'message']);
    assert.equal(body.code, 'PAYLOAD_TOO_LARGE');
    assert.ok(
      body.message.includes(String(BODY_LIMIT_BYTES)),
      `сообщение должно называть фактический лимит, получено: ${body.message}`,
    );
  });
});

test('тело в пределах лимита разбирается парсером и доходит до валидации', async () => {
  // Обратная сторона AC3: лимит не должен отсекать допустимые запросы. Zod отвергает
  // такое тело по составу полей, а не по размеру.
  await withServer(async ({ send }) => {
    const response = await send('/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: jsonBodyOfSize(BODY_LIMIT_BYTES - 4096),
    });

    assert.equal(response.status, 400);
    assert.equal(((await response.json()) as { code: string }).code, 'VALIDATION_ERROR');
  });
});

test('битый JSON по-прежнему даёт 400 VALIDATION_ERROR (регрессия existing-ветки)', async () => {
  // Ветка `entity.parse.failed` из back-001 не должна пострадать от новой ветки
  // `entity.too.large`: класс ошибки другой (`SyntaxError` против `PayloadTooLargeError`).
  await withServer(async ({ send }) => {
    const response = await send('/admin/setup', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: '{ not json',
    });

    assert.equal(response.status, 400);
    assert.equal(((await response.json()) as { code: string }).code, 'VALIDATION_ERROR');
  });
});
