# План TASK-INFRA-003

Все решения зафиксированы в `adr.md` (Р1–Р9). Новых npm-зависимостей нет: `apps/api/package.json` и
`package-lock.json` не открываются (Р1). Кода — один новый модуль, две строки монтирования и одна
ветка в error-middleware.

## Декомпозиция

| ID | Цель / проблема | Решение | Состояние |
|---|---|---|---|
| P01 | Модуля с middleware не существует | Новый `apps/api/src/http/security.ts`: `securityHeaders` (`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, затем `next()`), `cors` (`Access-Control-Allow-Origin: *` всегда; на `OPTIONS` — `Access-Control-Allow-Methods` из `ROUTES` + `OPTIONS`, `Access-Control-Allow-Headers: Content-Type`, `204` без тела), `export const BODY_LIMIT_BYTES = 64 * 1024`. Импорт `ROUTES` из `./routes.ts` (Р1–Р5) | завершено |
| P02 | Middleware не смонтирован, лимит тела дефолтный (100kb) | `apps/api/src/app.ts`: в начале `createApp`, до цикла монтирования — `app.use(securityHeaders)`, `app.use(cors)`, затем `app.use(express.json({ limit: BODY_LIMIT_BYTES }))`. Порядок обязателен (Р2). Комментарий про «CORS, helmet и лимит — работа task-infra-003» заменяется описанием фактической цепочки | завершено |
| P03 | Превышение лимита даёт `500 INTERNAL_ERROR` вместо `413` | `apps/api/src/http/errors.ts`: ветка рядом с `isBodyParseError` — структурная проверка `type === 'entity.too.large'` → `413 {code:'PAYLOAD_TOO_LARGE', message}` с величиной лимита из поля `limit` самой ошибки. `ERROR_STATUS` и `DomainErrorCode` не расширяются (Р6) | завершено |
| P04 | AC1–AC4 иначе проверяются только руками | Новый `apps/api/src/http/security.test.ts` (`node:test`, `createApp(deps)` + `listen(0)` + `fetch`, как в существующих тестах): (1) `GET /health` с `Origin` → ACAO `*`, `nosniff`, `DENY`; (2) `OPTIONS /bookings` → `204`, ACAO, `Access-Control-Allow-Methods` содержит `GET`/`POST`/`PUT`/`OPTIONS`, `Access-Control-Allow-Headers: Content-Type`, тело пустое; (3) список методов равен производному от `ROUTES`; (4) `POST /bookings` 70KB с `Content-Type: application/json` → `413`, тело `{code:'PAYLOAD_TOO_LARGE'}`, заголовки CORS и security на месте; (5) тело ~60KB не даёт `413`; (6) регрессия: битый JSON → `400 VALIDATION_ERROR`; (7) `404` на неизвестном URL несёт ACAO и security-заголовки (Р9.1) | завершено |
| P05 | Изменения могут сломать существующие тесты и типы | `npm test -w @minical/api` целиком (не только новый файл) и `npm run typecheck`: зафиксировать фактические числа тестов и файлов — они нужны P09 | завершено |
| P06 | Brief требует curl-проверок на реально поднятом сервере | `npm start -w @minical/api`, затем AC1 (`curl -i -H 'Origin: http://example.com' /health`), AC2 (`curl -i -X OPTIONS -H 'Origin: …' -H 'Access-Control-Request-Method: POST' /bookings`), AC3 (`curl -i -X POST -H 'Content-Type: application/json' --data-binary @payload-70kb.json /bookings` — заголовок обязателен, иначе `express.json()` тело не читает и критерий проверяет не то, Р5), AC4 (`curl -i /health`). Вывод — в `result.md` (Р9.2) | завершено |
| P07 | AC5 автоматизации не поддаётся | Ручная smoke-проверка: поднять web-сборку клиента (`npm run web -w @minical/client`), из её origin выполнить в консоли браузера `fetch('http://localhost:3001/health')` — CORS-ошибки быть не должно. Код клиента не правится (территория Frontend Agent, Р9.3). **Выполнено частично** исполнителем: web-сборка поднята на `http://localhost:8081`, браузерных инструментов в сессии не было, поэтому проиграны запросы, которые браузер шлёт из этого origin (simple GET, preflight + POST, `GET /slots`) — серверная половина CORS-алгоритма подтверждена. **Закрыто 2026-08-12:** пользователь выполнил `await (await fetch('http://localhost:3001/health')).json()` из консоли браузера на `http://localhost:8081` — получен `{status: 'ok'}`, консоль без CORS-ошибок | завершено |
| P08 | Обязательные гейты `AGENTS.md` | `npm run contracts:format:check`, `npm run generate:check`, `npm run typecheck`, `npm test` (корневой). `uispec:validate` входит в корневой `npm test`; по существу не применим — `docs/ui-spec-kit/` и UI-код клиента не менялись. Ожидание: `generate:check` без diff — API impact `NONE` | завершено |
| P09 | Документы описывают middleware как незакрытую работу | `apps/api/AGENTS.md`: вступление (строка про «security middleware — `task-infra-003`»), раздел «Middleware и место для `task-infra-003`» → фактическая цепочка, лимит 64KB, `413 PAYLOAD_TOO_LARGE`, вне контракта (G5); состав и число тестов по факту P05. `AGENTS.md` (корневой): в дереве `apps/api/src` состав `http/` пополняется модулем `security`. `tasks/README.md`: строка `infra-003` в реестре задач и в «Плане разработки». `README.md` не меняется — ни новой команды, ни новой зависимости, ни счётчика тестов там нет | завершено |
| P10 | Результат не зафиксирован | `result.md`: что изменено (4 файла кода + документы), фактический вывод команд P05/P08, curl-вывод P06, результат P07, G5 как осознанное расхождение, ограничения Р-раздела «Последствия» (лимит только для `application/json`, `OPTIONS` на неизвестный URL → `204`, `Allow` не отдаётся). `status` остаётся `черновик` — согласование за пользователем (правило 11) | завершено |

## Порядок и зависимости

```text
P01 → P02 → P03 → P04 → P05 → P06 → P07 → P08 → P09 → P10
```

P03 технически независим от P01/P02, но без лимита из P02 ветку `413` нечем воспроизвести, поэтому
идёт после. P05 обязателен до P06: смысла поднимать сервер, пока автотесты красные, нет. P09 опирается
на числа из P05, поэтому стоит после проверок.

## Риски

| # | Риск | Реакция |
|---|---|---|
| R1 | P03 правит `apps/api/src/http/errors.ts` — файл, созданный `task-back-001` | Обосновано в ADR Р6 и Р8 до реализации; изменение аддитивное, существующая ветка `entity.parse.failed` не меняется и покрыта регрессией P04.6 |
| R2 | Preflight собран своим кодом, а не пакетом `cors` (Р1) | AC1–AC4 покрыты автотестами P04, а не только curl'ом; ответ — три константных заголовка и статус |
| R3 | `413` не приходит на тело без `Content-Type: application/json` (Р5) | Зафиксировано как ограничение в ADR; P06 передаёт заголовок явно; guard по `Content-Length` отклонён как строго слабый |
| R4 | Ответ `413` вне контракта (G5) | Осознанное расхождение класса G3, форма `ErrorResponse` соблюдена; фиксируется в ADR и `result.md` |

## Блокеры и открытые вопросы

Блокеров нет.

- ~~Выбор фреймворка Express vs Fastify~~ — закрыт: `task-back-001` реализована, фреймворк Express 5.2.1
  установлен, ветвление по фреймворкам удалено из ADR.
- ~~Ожидание работающего сервера~~ — закрыт: `apps/api` поднимается одной командой
  (`npm start -w @minical/api`), точка вставки middleware существует физически.
- ~~Выбор npm-пакетов отложен до backend-задачи~~ — закрыт решением Р1: пакетов не будет, зависимости
  не добавляются.
