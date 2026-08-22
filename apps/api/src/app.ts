import type { ServerResponse } from 'node:http';

import express from 'express';
import type { Express } from 'express';

import type { Deps } from './http/handlers.ts';
import { handlers } from './http/handlers.ts';
import { errorMiddleware, notFoundHandler } from './http/errors.ts';
import { ROUTES } from './http/routes.ts';
import { BODY_LIMIT_BYTES, cors, securityHeaders } from './http/security.ts';

/** Каталоги собранных web-бандлов; оба раздаются этим же процессом (ADR §3 infra/009). */
export interface WebBundlePaths {
  /** Гостевой бандл, раздаётся с корня. */
  guestDir: string;
  /** Владельческий бандл, раздаётся с `/admin`. */
  ownerDir: string;
}

/**
 * Ассеты экспорта несут контент-хеш в имени, поэтому по своему адресу неизменяемы —
 * годовой иммутабельный кеш убирает condition-GET на каждом визите. `index.html`
 * исключён намеренно: он единственный мутабельный файл бандла и именно из него браузер
 * узнаёт имена ассетов новой сборки, так что закешированный он законсервировал бы
 * старую версию приложения. Ему остаётся дефолт `serve-static` — `max-age=0`.
 */
function cacheStaticAsset(res: ServerResponse, filePath: string): void {
  if (!filePath.endsWith('.html')) {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  }
}

/**
 * Единственное место, где монтируются маршруты. Точек вставки middleware две: до цикла
 * маршрутов (заголовки, CORS, парсер тела) и после него — раздача web-бандлов, если
 * они переданы. Порядок цепочки значим: security-заголовки и CORS стоят до парсера
 * тела, иначе ответ `413` уйдёт без `Access-Control-Allow-Origin` и браузер не даст
 * клиенту прочитать даже код ошибки (task-infra-003, Р2).
 */
export function createApp(deps: Deps, webBundles?: WebBundlePaths): Express {
  const app = express();

  // Заголовок разглашает фреймворк, потребителя у него нет.
  app.disable('x-powered-by');

  app.use(securityHeaders);
  app.use(cors);
  app.use(express.json({ limit: BODY_LIMIT_BYTES }));

  for (const route of ROUTES) {
    const handler = handlers[route.operationId](deps);
    // switch, а не app[route.method]: у Express `get` перегружен чтением настроек,
    // и индексация union-типом методов не типизируется.
    switch (route.method) {
      case 'get':
        app.get(route.path, handler);
        break;
      case 'put':
        app.put(route.path, handler);
        break;
      case 'post':
        app.post(route.path, handler);
        break;
    }
  }

  // Место вставки выбрано, а не случайно: раньше цикла статика затенила бы операции
  // контракта, которые делят префикс `/admin` (`GET /admin/settings` ушёл бы в файлы);
  // позже `notFoundHandler` — не увидела бы запрос вовсе. Реестр `ROUTES` при этом не
  // пополняется: соответствие контракту 1:1 остаётся под тестом.
  //
  // Запрос без файла проваливается сквозь `express.static` дальше и получает прежний
  // JSON-404 — SPA-fallback не вводится (навигация клиента адресную строку не
  // использует). Security-заголовки и CORS стоят выше и накрывают статические ответы.
  if (webBundles !== undefined) {
    app.use(express.static(webBundles.guestDir, { setHeaders: cacheStaticAsset }));
    app.use('/admin', express.static(webBundles.ownerDir, { setHeaders: cacheStaticAsset }));
  }

  app.use(notFoundHandler);
  app.use(errorMiddleware);

  return app;
}
