// Раздача web-бандлов проверяется на временных fixture-каталогах, а не на настоящем
// экспорте клиента: в рабочей копии бандлов нет, а гейт зоны обязан быть
// самодостаточным. Приложение поднимает общий харнесс зоны — здесь остаётся только
// подготовка каталогов.

import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import type { WebBundlePaths } from './app.ts';
import { expectError, withServer } from './http/testServer.ts';
import type { TestServer } from './http/testServer.ts';

const GUEST_HTML = '<!doctype html><title>MiniCal — гость</title>';
const OWNER_HTML = '<!doctype html><title>MiniCal — владелец</title>';
const IMMUTABLE = 'public, max-age=31536000, immutable';

/** Каталог ассетов называется `_expo/` — так его кладёт экспорт клиента. */
async function writeBundle(dir: string, html: string, marker: string): Promise<void> {
  await mkdir(join(dir, '_expo'), { recursive: true });
  await writeFile(join(dir, 'index.html'), html);
  await writeFile(join(dir, '_expo', 'bundle.js'), `console.log('${marker}');`);
}

async function writeBundles(root: string): Promise<WebBundlePaths> {
  const paths: WebBundlePaths = { guestDir: join(root, 'guest'), ownerDir: join(root, 'owner') };
  await writeBundle(paths.guestDir, GUEST_HTML, 'guest');
  await writeBundle(paths.ownerDir, OWNER_HTML, 'owner');
  return paths;
}

/** Бандлы включены по умолчанию: без них проверять здесь нечего, кроме одного теста. */
async function withBundles(
  run: (server: TestServer) => Promise<void>,
  options: { bundles?: boolean } = {},
): Promise<void> {
  const root = (options.bundles ?? true) ? await mkdtemp(join(tmpdir(), 'minical-bundles-')) : null;
  try {
    await withServer(run, { webBundles: root === null ? undefined : await writeBundles(root) });
  } finally {
    if (root !== null) await rm(root, { recursive: true, force: true });
  }
}

test('GET / отдаёт гостевой бандл, GET /admin/ — владельческий (AC3)', async () => {
  await withBundles(async ({ send }) => {
    const guest = await send('/');
    assert.equal(guest.status, 200);
    assert.ok(guest.headers.get('content-type')?.startsWith('text/html'));
    assert.equal(await guest.text(), GUEST_HTML);

    const owner = await send('/admin/');
    assert.equal(owner.status, 200);
    assert.ok(owner.headers.get('content-type')?.startsWith('text/html'));
    assert.equal(await owner.text(), OWNER_HTML);
  });
});

test('ассеты бандлов не смешиваются: /_expo — гостевой, /admin/_expo — владельческий', async () => {
  await withBundles(async ({ send }) => {
    assert.match(await (await send('/_expo/bundle.js')).text(), /guest/);
    assert.match(await (await send('/admin/_expo/bundle.js')).text(), /owner/);
  });
});

test('ассеты кешируются иммутабельно, index.html — нет', async () => {
  await withBundles(async ({ send }) => {
    assert.equal((await send('/_expo/bundle.js')).headers.get('cache-control'), IMMUTABLE);
    assert.equal((await send('/admin/_expo/bundle.js')).headers.get('cache-control'), IMMUTABLE);

    // Мутабельный файл: браузер обязан каждый раз узнавать про новую сборку.
    assert.match((await send('/')).headers.get('cache-control') ?? '', /max-age=0/);
    assert.match((await send('/admin/')).headers.get('cache-control') ?? '', /max-age=0/);
  });
});

test('GET /admin без завершающего слэша — штатный 301 serve-static на /admin/', async () => {
  await withBundles(async ({ send }) => {
    const response = await send('/admin');
    assert.equal(response.status, 301);
    const location = new URL(response.headers.get('location') ?? '', 'http://127.0.0.1');
    assert.equal(location.pathname, '/admin/');
  });
});

test('операции контракта не затенены статикой, включая общий префикс /admin', async () => {
  await withBundles(async ({ http }) => {
    // До онбординга операция отвечает доменной ошибкой — значит, запрос дошёл до
    // обработчика, а не до index.html владельческого бандла.
    expectError(await http.get('/admin/settings'), 400, 'CALENDAR_NOT_CONFIGURED');

    const health = await http.get('/health');
    assert.equal(health.status, 200);
    assert.deepEqual(health.body, { status: 'ok' });
  });
});

test('запрос без файла проваливается сквозь статику и получает прежний JSON-404 (G3)', async () => {
  await withBundles(async ({ http }) => {
    expectError(await http.get('/nope'), 404, 'NOT_FOUND');
    expectError(await http.get('/admin/nope'), 404, 'NOT_FOUND');
    // Не-GET: serve-static такие запросы не обслуживает вовсе.
    expectError(await http.post('/health', {}), 404, 'NOT_FOUND');
    expectError(await http.post('/admin', {}), 404, 'NOT_FOUND');
  });
});

test('без каталогов бандлов приложение остаётся API-only', async () => {
  await withBundles(
    async ({ http }) => {
      expectError(await http.get('/'), 404, 'NOT_FOUND');
      expectError(await http.get('/admin/'), 404, 'NOT_FOUND');
      assert.equal((await http.get('/health')).status, 200);
    },
    { bundles: false },
  );
});
