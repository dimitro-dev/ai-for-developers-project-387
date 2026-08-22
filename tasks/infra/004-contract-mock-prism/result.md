# Результат TASK-INFRA-004

> **Примечание (2026-08-08, [`task-contract-001`](../../contract/001-guest-flow-extensions/)).** Записи ниже верны на момент их проверки и остаются исторической фиксацией. После расширения контракта в `task-contract-001`: операций 12, а не 11 (добавлена `getPublicCalendar`, `GET /calendar`), и дефолтный 2xx мока на `POST /bookings` — теперь `200`, потому что Prism выбирает наименьший 2xx из двух документированных (`200` — идемпотентный повтор, `201` — создание); прежнее поведение запрашивается штатным `Prefer: code=201`. Статус задачи не отзывается, формулировки ниже не переписываются.

## Итог

Mock-сервер контракта добавлен одной командой: `npm run mock:prism` поднимает Stoplight Prism 5.16.0 на порту `4010` из `packages/contracts/generated/openapi.yaml`. Все 11 операций контракта отвечают 2xx-примерами по схемам, невалидные запросы отклоняются (документированным 4xx-ответом операции — для `POST /bookings` фактически `400`, иначе сгенерированным `422`; детализация — в `sl-violations`), конкретный не-2xx статус запрашивается штатным `Prefer: code=<status>`. Контракт и generated-артефакты не менялись (API impact `NONE`), все существующие команды проходят без регрессий. Реализация закрывает пропущенную проверку P09 из `task-003` и снимает зависимость клиентской разработки от готовности backend.

## Что изменено

**`package.json`** (корень):
- `devDependencies`: добавлен `@stoplight/prism-cli` `^5.16.0` (явная зависимость, не из транзитивного резолва);
- `scripts`: добавлен `"mock:prism": "prism mock packages/contracts/generated/openapi.yaml -p 4010"`.

**`package-lock.json`**: зафиксирована версия `@stoplight/prism-cli@5.16.0` (`dev: true`, integrity + resolved на registry.npmjs.org).

**`README.md`**:
- таблица «Команды» — строка про `npm run mock:prism`;
- раздел «Запуск» — секция «Mock-сервер контракта»: команда, порт `4010`, режим валидации, переключение клиента через `client.setConfig({ baseUrl })`;
- строка про порты: `3001` — smoke API, `4010` — mock-сервер, `8081` — Metro/`expo start`.

## Что изменилось для человека

Раньше у проекта не было работающего API для клиентской разработки: `apps/api` отвечал только на `/health`, а всё остальное (типы событий, слоты, бронирования) существовало только на бумаге в контракте. Из-за этого клиент и QA могли начать работу только после полной реализации backend.

Теперь добавлен **mock-сервер контракта** — программный «заглушечный» API, который запускается одной командой (`npm run mock:prism`) и отвечает на **все 11 операций** контракта так, как они описаны в `openapi.yaml`. Это не настоящий backend и не замена ему — это инструмент разработки:

- **для frontend-разработчика** — можно писать и проверять экраны клиента по `http://localhost:4010`, не дожидаясь backend;
- **для QA/Contract Agent** — можно вручную смотреть форму ответов каждой операции без поднятия сервисов;
- **для всех** — сервер проверяет входящие запросы на соответствие контракту: если запрос невалиден, он получает ошибку, а не молчаливый ответ.

Что конкретно поменялось в репозитории:
- добавлена dev-зависимость `@stoplight/prism-cli` и npm-скрипт `mock:prism` (версия зафиксирована в `package-lock.json`);
- в `README.md` описано: как запустить мок, на каком порту он живёт (`4010`), как он валидирует запросы и как переключить клиент между моком и будущим реальным API (смена `baseUrl`).

Что **не** поменялось: контракт API, generated-артефакты, поведение существующих команд и любые другие файлы. Это чисто инфраструктурное добавление.

## Контракт и generated-артефакты

Не изменялись. `npm run generate:check` подтверждает отсутствие diff в `packages/contracts/generated`, `packages/api-client/src/generated`, `packages/backend-contract/src/generated`. Мок читает уже сгенерированный `openapi.yaml` (включая ограничения `task-006` — `maxLength` на `eventTypeId`, `pattern` на `guest.email`), которые Prism применяет при валидации.

## База данных и миграции

Не затрагиваются — мок не требует backend, PostgreSQL или Docker.

## Выполненные проверки

Все проверки выполнялись против живого сервера, запущенного ровно командой `npm run mock:prism` (процесс `prism mock ... -p 4010`, версия подтверждена `npx --no-install prism --version` → `5.16.0`).

### AC#1–#8

| # | Критерий | Результат |
|---|---|---|
| 1 | `npm ci` из чистого checkout + документированная команда поднимают Prism на `4010` | PASS — установка `npm i -D @stoplight/prism-cli@^5.16.0`, запуск `npm run mock:prism`, «Prism is listening on http://127.0.0.1:4010»; `package-lock.json` зафиксирован (lockfileVersion 3), путь к `openapi.yaml` трекается в git |
| 2 | `GET /event-types` → `200` + `EventType[]` | PASS — `200`, JSON-массив |
| 3 | `GET /slots?eventTypeId=<id>` → `200` + `Slot[]` | PASS — `200`, JSON-массив |
| 4 | `POST /bookings` с нарушением контракта → 4xx, а не `201` | PASS — без `guest.email` → `400`; `guest.email: "not-an-email"` (вне `pattern`) → `400`; без `eventTypeId` → `400`; в ответе заголовок `sl-violations` с ошибкой в `request`. Валидный `POST /bookings` → `201` |
| 5 | Конкретный не-2xx статус через штатный механизм | PASS — `Prefer: code=404` на `POST /bookings` → `404`; `Prefer: code=400`/`code=404` на `GET /slots` → `400`/`404`; `Prefer: code=409` на `PUT /admin/setup` → `409` |
| 6 | Все 11 operationId доступны | PASS — см. таблицу smoke ниже |
| 7 | `generate`, `generate:check`, `typecheck`, `test`, `build` проходят | PASS — все exit 0, см. таблицу команд ниже |
| 8 | README описывает команду, порт, режим валидации, переключение клиента | PASS — независимый review-субагент подтвердил полноту и точность текста |

### Smoke всех 11 операций (AC#6)

| # | Операция | Маршрут / метод | Статус | Тело |
|---|---|---|---|---|
| 1 | `getAdminUpcomingBookings` | `GET /admin/bookings` | 200 | `Booking[]` |
| 2 | `getAdminEventTypes` | `GET /admin/event-types` | 200 | `EventType[]` |
| 3 | `createAdminEventType` | `POST /admin/event-types` | 201 | `EventType` |
| 4 | `getAdminSettings` | `GET /admin/settings` | 200 | `CalendarSettingsResponse` |
| 5 | `updateAdminSettings` | `PUT /admin/settings` | 200 | `CalendarSettingsResponse` |
| 6 | `getAdminSetup` | `GET /admin/setup` | 200 | `SetupStateResponse` |
| 7 | `completeAdminSetup` | `PUT /admin/setup` | 200 | `CalendarSettingsResponse` |
| 8 | `createPublicBooking` | `POST /bookings` | 201 | `Booking` |
| 9 | `getPublicEventTypes` | `GET /event-types` | 200 | `EventType[]` |
| 10 | `getHealth` | `GET /health` | 200 | `HealthResponse` |
| 11 | `getPublicSlots` | `GET /slots?eventTypeId=intro-call` | 200 | `Slot[]` |

Тела POST/PUT для операций 3, 5, 7, 8 строились по схемам контракта (`CreateEventTypeRequest`, `SetupRequest`, `CreateBookingRequest`) и проходили валидацию Prism.

### Регрессия существующих команд (AC#7, FR#6)

| Команда | Exit | Комментарий |
|---|---|---|
| `npm run contracts:format:check` | 0 | `✔ 9 formatted` |
| `npm run generate` | 0 | contracts:build + client (4 файла) + backend (3 файла) |
| `npm run generate:check` | 0 | diff в generated отсутствует |
| `npm run typecheck` | 0 | 4 workspace (api, client, api-client, backend-contract) |
| `npm test` | 0 | 139 PASS / 0 FAIL / 4 INFO |
| `npm run build` | 0 | api → `dist/`, client → web-export (`apps/client/dist/`) |

### Ревью-сабагенты (назначены пользователем, проведены по каждому шагу)

| Шаг | Ревьюер | Вердикт |
|---|---|---|
| P01 (установка зависимости) | Infrastructure reviewer | approve (audit-находки не блокируют) |
| P02 (npm-скрипт) | Infrastructure reviewer | approve |
| P03–P05 (верификация мока) | Infrastructure reviewer | approve с замечаниями → исправлены ADR/plan (см. «Отклонения») |
| P06 (README) | Infrastructure reviewer | approve (внесена рекомендация про 422-оговорку) |
| P07 (регресс-гейты) | Infrastructure reviewer | approve |

## Отклонения от brief / ADR / plan

1. **Статус валидации: 400, а не 422.** `adr.md`/`plan.md` изначально предсказывали, что невалидный запрос Prism отклоняет `422 Unprocessable Entity` (RFC 7807 problem details). Фактически Prism 5.16.0 для операций с документированным 4xx-ответом возвращает его (`POST /bookings` → `400`), детали — в заголовке `sl-violations`; для операций без документированного 4xx (например, `completeAdminSetup` с единственным `409`) невалидный запрос даёт сгенерированный `422`. Тексты `adr.md` (п.1) и `plan.md` (P04, P06) приведены к фактам; ADR и plan возвращены в `черновик` и пересогласованы ревьюером.
2. **Артефакт примеров на anyOf error-схемах.** Error-схемы контракта требуют `code` из конкретного enum, но Prism генерирует пример `{"code":"string","message":"string"}`, который ни одной из них не соответствует. Следствие: в `sl-violations` на 4xx-ответах появляется response-шум (`code must be equal to one of the allowed values: ...`), а тело `Prefer: code=404/409` отдаёт `code: "string"` вместо `EVENT_TYPE_NOT_FOUND`/`ONBOARDING_ALREADY_COMPLETED`. Статус выбирается верно, форма error-тела — нет. Зафиксировано в README как ограничение мока; возможное решение (явные `examples` в TypeSpec error-моделях) — изменение контракта, отдельная задача.
3. **Косметика 2xx-примеров.** Сгенерированные примеры в отдельных полях не соответствуют собственным паттернам (например, `startLocal: "string"` не проходит `LocalTime` pattern). На доступность всех 11 операций и форму структур не влияет.

## Известные ограничения и риски

- **Error-тела мока — плейсхолдеры.** Тела 4xx/не-2xx ответов не соответствуют enum-схемам (см. «Отклонения» п.2). Клиент/QA, ветвящиеся по `code`, не могут полагаться на значение `code` в теле; ориентироваться следует на HTTP-статус.
- **Нет состояния между запросами.** Мок не хранит данные (onboarding → слоты → бронь не образуют последовательность); для сценарных проверок нужен реальный backend.
- **Мок не заменяет доменную логику.** Слоты, конфликты, 14-дневное окно, кратность `slotIntervalMinutes` — не реализованы, это ограничение mock-примера.
- **Audit-находки (dev-only).** `npm audit` (с dev-деревом) — 22 (15 moderate, 7 high); из них через Prism — 1 high (`lodash@4.17.21` под `postman-collection`, code injection/prototype pollution) и 1 moderate (`uuid`). `npm audit --omit=dev` — 12 (10 moderate, 2 high) в Expo-дереве клиента, **без Prism** — в production Prism не попадает. `npm audit fix --force` НЕ применять: он понижает `prism-cli` до 5.6.0 (breaking, против ADR) и `@hey-api/openapi-ts` (ломает `generate`). Отслеживать апстрим-патч у `@stoplight/http-spec`/`prism-http`.
- **Import-плюмбинг клиента.** Корневой generated `index.ts` пакета `@minical/api-client` не реэкспортирует `client` и нет `main`/`exports` — точный import-спецификатор для `setConfig` не документирован. Фактическое подключение SDK — явный non-goal этой задачи, решается при реальной интеграции клиента.

## Описание для PR

**Title:** `feat: contract mock server (Prism) — npm run mock:prism`

**Body:**

**Что это.** Добавляет локальный mock-сервер контракта MiniCal на базе Stoplight Prism. Одна команда — `npm run mock:prism` — поднимает на порту `4010` сервер, отвечающий на все 11 операций контракта по `packages/contracts/generated/openapi.yaml`. Нужен, чтобы клиентская разработка и QA могли стартовать до готовности backend: фронтенд работает по `http://localhost:4010`, а при появлении реального API переключается сменой `baseUrl` без изменения кода.

**Что входит в diff.**

- `package.json`:
  - `devDependencies` += `@stoplight/prism-cli` `^5.16.0` (явная зависимость, не из транзитивного резолва);
  - `scripts` += `mock:prism: prism mock packages/contracts/generated/openapi.yaml -p 4010`.
- `package-lock.json`: зафиксирована `@stoplight/prism-cli@5.16.0` (`dev: true`).
- `README.md`: строка команды в таблице, секция «Mock-сервер контракта» (запуск, порт `4010`, режим валидации, переключение клиента через `client.setConfig({ baseUrl })`), перечень портов `3001/4010/8081`.

**Человекочитаемо (для ревьюера).**

- Было: для клиента нет API — есть только smoke `GET /health` на `3001`.
- Стало: `npm run mock:prism` поднимает заглушечный API на `4010`, отвечающий на все 11 операций контракта; невалидные запросы отклоняются (4xx + `sl-violations`), конкретный не-2xx ответ запрашивается через `Prefer: code=<status>`.
- Контракт, generated-артефакты и все существующие команды не тронуты — это чисто инфраструктурная добавка.

**Как проверить.**

```bash
npm ci
npm run mock:prism                      # Prism is listening on http://127.0.0.1:4010
curl http://localhost:4010/event-types  # 200, JSON-массив EventType[]
curl http://localhost:4010/slots?eventTypeId=abc   # 200, JSON-массив Slot[]
curl -X POST http://localhost:4010/bookings \
  -H 'Content-Type: application/json' \
  -d '{"eventTypeId":"abc","startAtUtc":"2026-08-10T09:00:00Z","guest":{"name":"A"}}'  # 400, sl-violations (нет guest.email)
curl -X POST http://localhost:4010/bookings -H 'Prefer: code=404' \
  -H 'Content-Type: application/json' \
  -d '{"eventTypeId":"abc","startAtUtc":"2026-08-10T09:00:00Z","guest":{"name":"A","email":"a@b.c"}}'  # 404
```

Регрессия: `contracts:format:check`, `generate`, `generate:check`, `typecheck`, `test` (139 PASS / 0 FAIL), `build` — все exit 0.

**Известные ограничения.** Тела 4xx/не-2xx ответов — сгенерированные Prism примеры (`{"code":"string","message":"string"}`), не соответствующие enum-схемам ошибок; полагаться можно только на HTTP-статус. Мок не хранит состояние и не реализует доменную логику (слоты, конфликты, 14-дневное окно). Dev-only audit-находки в Prism-дереве (`lodash`/`uuid`) приняты; `npm audit fix --force` противопоказан (понижает зависимости).

### Summary

TASK-INFRA-004: contract mock server (Prism) — `npm run mock:prism` поднимает все 11 операций контракта на порту `4010` по `generated/openapi.yaml`.

### Changes

- `package.json`: `@stoplight/prism-cli@^5.16.0` в `devDependencies`; скрипт `mock:prism`.
- `package-lock.json`: зафиксирована `5.16.0`.
- `README.md`: команда, порт `4010`, режим валидации, переключение base URL клиента, перечень портов.

### Verification

- Smoke всех 11 операций (8 маршрутов) — все 2xx, тела по схемам.
- Валидация: невалидный `POST /bookings` (нет `guest.email`, битый `pattern`, нет `eventTypeId`) → `400` + `sl-violations`, не `201`.
- `Prefer: code=404/400/409` → запрошенные статусы.
- Регресс: `contracts:format:check`, `generate`, `generate:check`, `typecheck`, `test` (139 PASS / 0 FAIL), `build` — все exit 0, generated diff отсутствует.
- Независимые ревью-субагенты по каждому шагу (P01–P07) — approve.

### Known limitations

- Error-тела мока — сгенерированные примеры, не соответствуют enum-схемам (статус верный, форма тела нет).
- Мок не хранит состояние и не реализует доменную логику (слоты, конфликты).
- Dev-only audit-находки в Prism-дереве (`lodash`/`uuid`) — приняты; `npm audit fix --force` противопоказан.
