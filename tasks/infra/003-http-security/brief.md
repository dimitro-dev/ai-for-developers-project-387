# TASK-INFRA-003 — Backend HTTP Security Middleware

## Контекст и проблема

Контракт MiniCal (task-002) определил HTTP API. React Web клиент (браузер) не сможет обращаться к API без CORS-заголовков — запросы будут заблокированы политикой Same-Origin. Backend без минимальных security-заголовков избыточно открыт.

## Цель

Настроить middleware для backend HTTP-сервера: CORS, security headers, body size limit.

## Зависимости

- **`task-back-001` — завершена 2026-08-08.** Блокировка снята: `apps/api` — работающий сервер на **Express 5**, 12 операций контракта `0.2.0`, запускается одной командой `npm start -w @minical/api` на порту 3001. Обоснование выбора фреймворка — в её `brief.md`: реализация идёт от контракта, а инструменты, генерирующие OpenAPI из кода, создали бы второй источник правды в нарушение правил 5 и 6 `AGENTS.md`.
- **Точка вставки middleware уже определена и задокументирована** решением Р8 её ADR: начало `createApp(deps)` в `apps/api/src/app.ts`, до цикла монтирования маршрутов по `ROUTES`. Текущая цепочка — `express.json()` с дефолтами (в том числе дефолтный лимит 100kb, который **не** является принятым решением о лимите) → монтирование → `notFoundHandler` → `errorMiddleware`.
- `task-infra-003` выполняется как настройка middleware-цепочки поверх готового каркаса, а не параллельно с ним. Acceptance criteria проверяются curl-запросами к реально поднятому серверу.
- Фактический набор HTTP-методов контракта `0.2.0` подтверждён: `GET`, `POST`, `PUT`; двенадцатая операция `getPublicCalendar` — `GET`, поэтому список методов для CORS не расширяется.

## Функциональные требования

### CORS
- Разрешить `Access-Control-Allow-Origin: *` для всех origin.
- Это осознанное решение для локальной учебной среды, а не умолчание: риск зафиксирован в security review task-002 (см. [`../../archive/002/result.md`](../../archive/002/result.md), раздел «Security review») и допустим только потому, что контур не публикуется наружу (нет TLS, нет auth на admin endpoints, только локальный dev/учебный запуск).
- HTTP-методы: должны соответствовать фактическому набору методов, используемых в generated OpenAPI (`packages/contracts/generated/openapi.yaml`), плюс `OPTIONS` для preflight. На момент написания фактический набор операций контракта — `GET, POST, PUT` (`DELETE`/`PATCH` не используются), итоговый список для CORS: `GET, POST, PUT, OPTIONS`. **Список не константа**: при добавлении нового HTTP-метода в TypeSpec-контракте CORS-конфигурацию нужно пересмотреть вручную — иначе preflight для нового метода будет молча отклоняться.
- Разрешённые заголовки: `Content-Type`
- OPTIONS preflight отвечает 204 с CORS-заголовками
- Проверка: React Web (браузер) → fetch к API без CORS error

### Security headers
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY` — для чистого JSON API даёт минимальный практический эффект: заголовок защищает HTML-документы от встраивания в iframe, а не JSON-ответы. Он безвреден, поэтому оставлен как defense-in-depth, но реальную пользу принесёт при раздаче web-клиента (React Web), что вне scope этой задачи.

### Body size limit
- Максимальный размер тела запроса: 64KB (65536 байт).
- Обоснование: после хардининга контракта (task-006) строковые поля ограничены — `note`/`guestNote` ≤ 5000 символов, `description` ≤ 2000, остальные строковые поля (`name`, `guestName`, `displayName`, `email`/`guestEmail`, идентификаторы) ≤ 320 символов (см. `packages/contracts/src/models/*.tsp`, `@maxLength`). Даже для самого крупного запроса (создание booking с `guestNote` + `guestName` + `guestEmail` + служебными полями) реалистичный payload — единицы килобайт. Прежний лимит 1MB превышал необходимый более чем на порядок и не давал предметной защиты.
- При превышении — 413 Payload Too Large

## API impact

`NONE` — только infra-настройка, HTTP-контракт не меняется.

## Acceptance criteria

1. `curl -i -H "Origin: http://example.com" <api-url>/health` (или любой GET-эндпоинт) возвращает заголовок `Access-Control-Allow-Origin: *`.
2. `curl -i -X OPTIONS -H "Origin: http://example.com" -H "Access-Control-Request-Method: POST" <api-url>/<endpoint>` возвращает статус 204 с заголовками `Access-Control-Allow-Origin`, `Access-Control-Allow-Methods` (содержащими фактический набор методов контракта, см. «Функциональные требования» → CORS), `Access-Control-Allow-Headers: Content-Type`.
3. `curl -i -X POST --data-binary @<payload-более-64kb> <api-url>/<write-endpoint>` возвращает статус 413.
4. `curl -i <api-url>/<endpoint>` содержит заголовки `X-Content-Type-Options: nosniff` и `X-Frame-Options: DENY`.
5. **Ручная smoke-проверка (не автоматизируется):** React Web клиент делает fetch к API из браузера — в консоли браузера нет CORS error.

## Non-goals

- Rate limiting (требует анализа реальной нагрузки)
- HTTPS/TLS (для локального dev избыточен)
- Helmet full preset (достаточно отдельных заголовков)

## Связанные документы

- [`../../../docs/architecture.md`](../../../docs/architecture.md)
- [`../../archive/002/result.md`](../../archive/002/result.md) — security review, риск CORS
