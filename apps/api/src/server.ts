// Точка входа: запускается прямо из исходников (`node src/server.ts`), сборки нет (Р11).

import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { runMigrations } from '@minical/database';
// `pg` — CommonJS: именованные импорты из него под strip-only не разбираются, берём default.
import pg from 'pg';

import { createApp } from './app.ts';
import type { WebBundlePaths } from './app.ts';
import { maybeSeedDemoCalendar } from './bootstrap/seed.ts';
import { loadConfig } from './config.ts';
import type { AppConfig } from './config.ts';
import { createMemoryStore } from './store/memory.ts';
import { createPgStore } from './store/postgres.ts';
import type { Store } from './store/repositories.ts';

// Конвенция размещения бандлов — `apps/client/dist/{guest,owner}`. Путь считается от
// самого файла, а не от `cwd`: локально процесс стартует из `apps/api`, в образе — из
// корня репозитория, и относительный путь разъехался бы между этими запусками.
const WEB_BUNDLES: WebBundlePaths = {
  guestDir: fileURLToPath(new URL('../../client/dist/guest', import.meta.url)),
  ownerDir: fileURLToPath(new URL('../../client/dist/owner', import.meta.url)),
};

let config: AppConfig;
try {
  config = loadConfig();
} catch (error) {
  // Ошибка конфигурации дешевле всего на старте: тихого отката к дефолту нет (Р10).
  const reason = error instanceof Error ? error.message : String(error);
  console.error(`MiniCal API: invalid configuration — ${reason}`);
  process.exit(1);
}

// Режим хранилища выбирает только наличие DATABASE_URL (Р2), и выбор печатается строкой:
// откат в эфемерный режим из-за стёртой на платформе переменной иначе заметен лишь по
// пропавшим данным. Тихого отката в память при заданной строке нет — база недоступна или
// миграция упала означает отказ старта, а не молчаливую потерю персистентности.
let store: Store;
if (config.databaseUrl !== null) {
  // Таймаут подключения: недостижимый хост обязан дать быстрый отказ старта, иначе процесс
  // висел бы в ожидании молча, а платформа считала бы его запускающимся.
  const pool = new pg.Pool({ connectionString: config.databaseUrl, connectionTimeoutMillis: 10_000 });
  // Сбой простаивающего соединения (рестарт базы, обрыв сети) приходит событием пула, и без
  // обработчика unhandled-событие убило бы процесс. Выхода здесь нет намеренно: сломанного
  // клиента pg-pool заменит сам, а работающий процесс переживёт рестарт базы.
  pool.on('error', (error) => {
    console.error(`MiniCal API: postgres pool error — ${error.message}`);
  });
  let applied: string[];
  try {
    ({ applied } = await runMigrations(pool));
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.error(`MiniCal API: migrations failed — ${reason}`);
    process.exit(1);
  }
  store = createPgStore(pool);
  console.log(`MiniCal API: хранилище postgres (применено миграций: ${applied.length})`);
} else {
  store = createMemoryStore();
  console.log('MiniCal API: хранилище in-memory — данные не переживут рестарт');
}

// Без флага хранилище остаётся пустым — поведение по умолчанию не меняется (AC10).
if (config.seedDemo) {
  let outcome: 'seeded' | 'skipped';
  try {
    outcome = await maybeSeedDemoCalendar(store);
  } catch (error) {
    // Тот же порядок, что у ошибки конфигурации: отказ виден строкой, а не сырым
    // unhandled rejection, и процесс не остаётся с полунаполненным хранилищем.
    const reason = error instanceof Error ? error.message : String(error);
    console.error(`MiniCal API: demo seed failed — ${reason}`);
    process.exit(1);
  }
  console.log(
    outcome === 'seeded'
      ? 'MiniCal API: демо-календарь загружен (SEED_DEMO)'
      : 'MiniCal API: демо-сид пропущен — хранилище уже настроено',
  );
}

// Признак раздачи — сам `index.html`, а не каталог: пустой `dist/guest` остался бы от
// прерванной сборки и включил бы «раздачу», в которой нечего отдавать.
const bundlesPresent =
  existsSync(join(WEB_BUNDLES.guestDir, 'index.html')) &&
  existsSync(join(WEB_BUNDLES.ownerDir, 'index.html'));
const app = createApp({ config, store }, bundlesPresent ? WEB_BUNDLES : undefined);
console.log(
  bundlesPresent
    ? 'MiniCal API: web-бандлы раздаются с / (гость) и /admin (владелец)'
    : `MiniCal API: web-бандлы не найдены (${dirname(WEB_BUNDLES.guestDir)}) — режим API-only`,
);

const server = app.listen(config.port, () => {
  console.log(`MiniCal API: http://localhost:${config.port}/health`);
});

// В контейнере процесс запускается первым и получает PID 1: без собственного
// обработчика сигнал остановки игнорируется, и `docker stop` выжидает весь таймаут,
// прежде чем добить процесс SIGKILL. `closeAllConnections` нужен рядом с `close`:
// keep-alive соединения клиентов иначе держат сервер открытым до своего таймаута.
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    console.log(`MiniCal API: ${signal} — остановка`);
    server.close(() => {
      process.exit(0);
    });
    server.closeAllConnections();
  });
}
