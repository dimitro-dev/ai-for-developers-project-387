// Общий харнесс HTTP-тестов зоны. Файл не `*.test.ts` — тестов не содержит и раннером
// не подхватывается; он существует, чтобы три набора тестов не держали три копии
// «поднять listen(0) → сходить fetch'ем → закрыть» и три литерала `AppConfig`: новое
// поле конфигурации чинится здесь, а не в каждом файле.

import assert from 'node:assert/strict';
import { once } from 'node:events';

import { createApp } from '../app.ts';
import type { WebBundlePaths } from '../app.ts';
import type { AppConfig } from '../config.ts';
import { createMemoryStore } from '../store/memory.ts';
import type { Store } from '../store/repositories.ts';

export const TEST_PUBLIC_WEB_URL = 'http://localhost:8081';

export function testConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  // `databaseUrl: null` — HTTP-тесты идут против переданного store, режим им безразличен.
  return {
    port: 0,
    publicWebUrl: TEST_PUBLIC_WEB_URL,
    seedDemo: false,
    databaseUrl: null,
    ...overrides,
  };
}

/** Разобранный ответ: тесты операций сверяют статус и тело, заголовки им не нужны. */
export interface JsonResponse {
  status: number;
  body: unknown;
}

export interface JsonClient {
  get(path: string): Promise<JsonResponse>;
  put(path: string, body: unknown): Promise<JsonResponse>;
  post(path: string, body: unknown): Promise<JsonResponse>;
  /** Тело уходит строкой как есть — для заведомо битого JSON. */
  raw(method: string, path: string, body: string): Promise<JsonResponse>;
}

/** Сырой запрос: метод, заголовки и чтение ответа задаёт вызывающий. */
export type Send = (path: string, init?: RequestInit) => Promise<Response>;

export interface TestServer {
  send: Send;
  http: JsonClient;
  store: Store;
  baseUrl: string;
}

export interface ServerOptions {
  store?: Store;
  config?: Partial<AppConfig>;
  /** Каталоги web-бандлов; без них приложение остаётся API-only. */
  webBundles?: WebBundlePaths;
}

export async function withServer(
  run: (server: TestServer) => Promise<void>,
  options: ServerOptions = {},
): Promise<void> {
  const store = options.store ?? createMemoryStore();
  const server = createApp(
    { config: testConfig(options.config), store },
    options.webBundles,
  ).listen(0);
  await once(server, 'listening');

  const address = server.address();
  assert.ok(address !== null && typeof address === 'object', 'server is listening on a TCP port');
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const send = sender(baseUrl);

  try {
    await run({ send, http: jsonClient(send), store, baseUrl });
  } finally {
    server.close();
    // Иначе keep-alive соединения fetch'а держат закрытие до своего таймаута, и прогон
    // упирается в ожидание вместо работы.
    server.closeAllConnections();
    await once(server, 'close');
  }
}

/** `redirect: 'manual'` — редирект статики проверяется, а не проходится незаметно. */
function sender(baseUrl: string): Send {
  return (path, init = {}) => fetch(`${baseUrl}${path}`, { redirect: 'manual', ...init });
}

function jsonClient(send: Send): JsonClient {
  async function request(method: string, path: string, body?: string): Promise<JsonResponse> {
    const response = await send(path, {
      method,
      ...(body === undefined ? {} : { headers: { 'content-type': 'application/json' }, body }),
    });
    const text = await response.text();
    return { status: response.status, body: text === '' ? undefined : JSON.parse(text) };
  }

  return {
    get: (path) => request('GET', path),
    put: (path, body) => request('PUT', path, JSON.stringify(body)),
    post: (path, body) => request('POST', path, JSON.stringify(body)),
    raw: (method, path, body) => request(method, path, body),
  };
}

/** Канон ответа-ошибки: статус, тело ровно `{code, message}` и непустой текст. */
export function expectError(response: JsonResponse, status: number, code: string): void {
  assert.equal(response.status, status, `unexpected status, body: ${JSON.stringify(response.body)}`);
  assert.deepEqual(Object.keys(response.body as object).sort(), ['code', 'message']);
  assert.equal((response.body as { code: string }).code, code);
  assert.ok((response.body as { message: string }).message.length > 0);
}
