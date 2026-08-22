// CORS и security-заголовки (task-infra-003). Без пакетов `cors` и `helmet`: при
// статическом `Access-Control-Allow-Origin: *` из них не используется ничего, кроме трёх
// константных заголовков и одной ветки на OPTIONS (Р1).

import type { RequestHandler } from 'express';

import { ROUTES } from './routes.ts';

/** Лимит тела запроса из brief (64KB). Единственное объявление величины (Р5). */
export const BODY_LIMIT_BYTES = 64 * 1024;

/**
 * Список методов выводится из реестра маршрутов, а не задаётся константой:
 * `routes.contract.test.ts` доказывает равенство `ROUTES` и `generated/openapi.yaml`,
 * поэтому набор равен методам контракта по построению и не может от него отстать (Р3).
 * `HEAD` не перечисляется: Express обслуживает его для GET сам, а CORS относит его к
 * safelisted-методам.
 *
 * Сортировка — чтобы значение заголовка не зависело от порядка строк реестра: он следует
 * контракту и может измениться при добавлении операции. Сегодня даёт ровно тот список,
 * что перечисляет brief: `GET, POST, PUT, OPTIONS`.
 */
const ALLOWED_METHODS = [
  ...new Set(ROUTES.map((route) => route.method.toUpperCase())).values(),
]
  .sort()
  .concat('OPTIONS')
  .join(', ');

/**
 * Стоит первым в цепочке, поэтому заголовки попадают во все ответы, включая preflight
 * `204`, `404 NOT_FOUND`, `413` и `500` (Р2).
 */
export const securityHeaders: RequestHandler = (_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  next();
};

/**
 * `*` — осознанное решение для локальной учебной среды (brief, security review task-002).
 * Preflight замыкается здесь и намеренно замещает встроенный ответ Express 5
 * (`200` + `Allow`): brief требует `204`. Следствия приняты в Р4 — `Allow` не отдаётся,
 * а OPTIONS на неизвестный URL отвечает `204`, тогда как настоящий запрос по тому же URL
 * по-прежнему получает `404`.
 */
export const cors: RequestHandler = (req, res, next) => {
  // Заголовок нужен и на ответах об ошибках: без него браузер не даёт клиенту прочитать
  // даже код ошибки.
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method !== 'OPTIONS') {
    next();
    return;
  }

  res.setHeader('Access-Control-Allow-Methods', ALLOWED_METHODS);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.status(204).end();
};
