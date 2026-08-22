# apps/api — устройство зоны

REST-backend MiniCal: все 12 операций контракта над хранилищем, у которого два режима — in-memory
по умолчанию и PostgreSQL при заданной `DATABASE_URL`. Реализовано задачей `back/001`,
middleware-цепочка (CORS, security-заголовки, лимит тела) — `infra/003`, второй режим — `back/002`.
Схема, миграции и exclusion constraint живут в зоне
[`packages/database/`](../../packages/database/AGENTS.md).

Правила зоны — [`AGENTS.md`](AGENTS.md), запуск и переменные окружения — [`README.md`](README.md).

## Фреймворк: Express 5 без схемной машинерии

Контракт живёт в `packages/contracts/src/**/*.tsp` и уже сгенерирован в OpenAPI и Zod, поэтому от
фреймворка нужны только маршрутизация и middleware-цепочка. Инструменты, порождающие OpenAPI **из**
кода (`@fastify/swagger` и производные), создали бы второй источник правды о контракте и нарушили
правила 5 и 6 корневого `AGENTS.md`. Валидация выполняется явным вызовом generated-схем.

Рантайм-зависимости: `express`, `zod`, `@minical/backend-contract`. Сборочного шага нет.

## Слои и правила границ

```text
src/
├── server.ts                 entry: loadConfig() → store по DATABASE_URL (+ миграции) → сид →
│                             createApp(deps) → listen
├── config.ts                 PORT, PUBLIC_WEB_URL, SEED_DEMO, DATABASE_URL; мусорное значение =
│                             отказ старта
├── app.ts                    createApp(deps, webBundles?): middleware → ROUTES → статика → 404 → errors
├── bootstrap/
│   └── seed.ts               демо-календарь через use-cases; включается флагом SEED_DEMO
├── http/
│   ├── routes.ts             ROUTES — реестр 12 операций (данные) и тип OperationId
│   ├── handlers.ts           handlers: Record<OperationId, (deps) => RequestHandler>, Deps
│   ├── parse.ts              parseOrThrow(schema, value) → VALIDATION_ERROR
│   ├── present.ts            domain → transport DTO, Date → ISO, publicUrl из конфигурации
│   └── errors.ts             ERROR_STATUS, errorMiddleware, notFoundHandler
├── usecases/
│   ├── owner.ts              setup, settings, event types, upcoming bookings, публичный профиль
│   └── booking.ts            getPublicSlots, createPublicBooking
├── domain/
│   ├── model.ts              доменные типы и VO
│   ├── errors.ts             DomainError + union DomainErrorCode
│   ├── slots.ts              чистый slot engine: окно, сетка, пересечения
│   └── timezone.ts           Intl-примитивы: localPartsOf, instantOfLocal, isValidTimeZone
└── store/
    ├── repositories.ts       интерфейсы Owner/EventType/Booking + Store
    ├── memory.ts             in-memory реализация (createMemoryStore)
    └── postgres.ts           PostgreSQL-реализация (createPgStore): SQL руками, отказы
                              констрейнтов → DomainError
```

- `domain/**` не импортирует `express`, `@minical/backend-contract` и `store/**` — только `node:*` и
  собственные модули. Это условие дешёвого выноса slot-логики в `packages/slot-engine`.
- `usecases/**` знают домен и интерфейсы репозиториев, но не знают `express`: ни `req`, ни `res`, ни
  статусов.
- `http/**` — единственное место, где живёт transport: Zod-схемы, статусы, сериализация.
- `store/**` реализует интерфейсы и наружу больше ничего не отдаёт. Реализаций две, и различить их
  умеет только `server.ts`: остальные слои видят один и тот же `Store`, поэтому режим хранилища
  ничего в них не меняет.
- `server.ts` — единственное место, где режим известен: при заданной `DATABASE_URL` он поднимает
  пул `pg`, прогоняет миграции `@minical/database` и собирает `createPgStore(pool)`, иначе —
  `createMemoryStore()`. Порядок обязателен: миграции идут до `listen`, чтобы запросы не пришли
  на неполную схему, а отказ подключения или миграции завершает процесс, а не переводит его
  в память (эксплуатационная сторона — [`README.md`](README.md)).
- `bootstrap/**` наполняет хранилище только через `usecases/**`, а не записью в store: доменные
  проверки выполняются те же, что на HTTP-входе, и демо-данные не разъезжаются с доменом.
  Хранилище предполагается пустым — сид рассчитан на единственный вызов при старте процесса.

## Валидация входа — одна точка

`parseOrThrow(schema, value)` в обработчике, схемы только **операционные** и только generated:

```ts
import { zCreatePublicBookingBody, zGetPublicSlotsQuery } from '@minical/backend-contract/zod';
import type { CreateBookingRequest, ErrorResponse } from '@minical/backend-contract';
```

Схемы приходят подпутём `/zod`, типы — корневым входом: generated `index.ts` состоит из одного
`export type` и в рантайме пуст (`infra/005`). Самописных схем нет. Порядок — транспорт, затем
домен: доменный код работает с уже разобранными значениями.

Доменные проверки сверх схемы (в `usecases/owner.ts`): кратность `slotIntervalMinutes` числу 60,
`startLocal < endLocal`, непустой `daysOfWeek`, существование зоны в ICU. Первое и последнее
keyword'ами OpenAPI 3.0 не выражаются, без них мусорные настройки обрушают `getPublicSlots`.

## Ошибки — одна таблица

`ERROR_STATUS` в `http/errors.ts` — единственное место, где доменный код превращается в статус;
типизирована `satisfies Record<DomainErrorCode, number>`, поэтому код без статуса добавить нельзя.
Домен бросает `DomainError(code, message)`, error-middleware отвечает `{code, message}` — форма
`ErrorResponse`. Express 5 сам доводит отказ промиса async-обработчика до error-middleware, обёрток
вида `asyncHandler` нет.

Вне контракта отдаются только `404 NOT_FOUND` (неизвестный URL или метод), `500 INTERNAL_ERROR` и
`413 PAYLOAD_TOO_LARGE` (превышение лимита тела, `infra/003`) — ситуации, которых контракт не
описывает; форма `ErrorResponse` соблюдена. Статус этих трёх ответов берётся не из `ERROR_STATUS`:
их коды не входят в `DomainErrorCode`, потому что домен об ограничениях транспорта не знает.

## Middleware-цепочка

Точек вставки две, обе в `createApp`: до цикла монтирования маршрутов и сразу после него.
Порядок значим:

```text
securityHeaders                            X-Content-Type-Options: nosniff, X-Frame-Options: DENY
cors                                       Access-Control-Allow-Origin: * на всех ответах;
                                           OPTIONS → 204 + Allow-Methods (выводятся из ROUTES)
                                           + Allow-Headers: Content-Type
express.json({ limit: BODY_LIMIT_BYTES })  64KB; превышение → 413 PAYLOAD_TOO_LARGE
цикл по ROUTES
static(guest) на «/», static(owner) на «/admin»   только если бандлы переданы
notFoundHandler → errorMiddleware
```

Заголовки стоят до парсера тела не случайно: иначе ответ `413` уйдёт без
`Access-Control-Allow-Origin` и браузер не даст клиенту прочитать даже код ошибки.

CORS и security-заголовки живут в `http/security.ts` и реализованы без пакетов `cors` и `helmet`:
при статическом `*` из них не используется ничего, кроме трёх константных заголовков.
`Access-Control-Allow-Origin: *` допустимо только для локальной учебной среды. Список методов
preflight выводится из реестра `ROUTES`, поэтому не может отстать от контракта; `OPTIONS` замыкается
в middleware, из-за чего `Allow` не отдаётся, а `OPTIONS` на неизвестный URL отвечает `204` (сам
запрос по тому же URL по-прежнему получает `404`).

Лимит тела объявлен один раз — `BODY_LIMIT_BYTES` в `http/security.ts` — и действует на тела с
`Content-Type: application/json`, единственный тип запросов в контракте. Тело другого типа
`express.json()` не читает вовсе: оно не попадает в память приложения, но и `413` не получает —
обработчик увидит пустое тело и вернёт `400 VALIDATION_ERROR`.

## Раздача web-бандлов

Тот же процесс раздаёт два собранных web-бандла клиента: гостевой с корня, владельческий с
`/admin`. Второго сервера и новых зависимостей нет — `express.static` входит в Express.

Место вставки — после цикла `ROUTES` и до `notFoundHandler`, и это не деталь оформления:

- операции контракта смонтированы раньше и затенить их невозможно, хотя префикс `/admin` общий:
  `GET /admin/settings` уходит в API, `GET /admin/_expo/...` — в файлы владельческого бандла;
- запрос без файла проваливается сквозь статику дальше по цепочке и получает прежний JSON-404.
  SPA-fallback не вводится: навигация клиента адресную строку не использует, а fallback сломал бы
  правило «вне контракта → 404 в форме `ErrorResponse`»;
- security-заголовки и CORS стоят выше и накрывают статические ответы;
- реестр `ROUTES` не пополняется — соответствие контракту 1:1 остаётся под своим тестом.

`GET /admin` без завершающего слэша получает штатный `301` от `serve-static` на `/admin/` —
браузер проходит это прозрачно, а проверка по адресу должна следовать редиректу. Не-GET запросы
статика не обслуживает вовсе, поэтому `POST /admin` — тот же JSON-404.

Каталоги передаёт `server.ts` вторым необязательным параметром `createApp` — по конвенции
`apps/client/dist/{guest,owner}`, вычисленной от файла, а не от рабочего каталога: локально
процесс стартует из `apps/api`, в образе — из корня репозитория. Если каталогов нет (обычное
состояние рабочей копии — бандлы собирает образ), параметр не передаётся и приложение работает
API-only: локальная разработка и тесты зоны от раздачи не зависят.

## Тесты зоны

Тесты лежат рядом с кодом: `src/http/routes.contract.test.ts` (покрытие контракта 12/12),
`src/domain/slots.test.ts` (таймзоны, окно, сетка, пересечения), `src/store/memory.test.ts`
(атомарность `create`, копии записей), `src/api.test.ts` (HTTP-сценарии, тела ответов сверяются
generated response-схемами), `src/http/security.test.ts` (CORS, preflight, security-заголовки,
лимит тела), `src/config.test.ts` (дефолты, выбор режима хранилища и отказ старта на мусорном
окружении), `src/bootstrap/seed.test.ts` (состав демо-календаря и guard сида на настроенном
хранилище), `src/static.test.ts` (раздача бандлов на временных fixture-каталогах),
`src/store/postgres.test.ts` (тот же контракт `Store` на реальной PostgreSQL: маппинг колонок,
отказы констрейнтов, гонка двух пересекающихся броней) — 109 тестов в 9 файлах.

Раннер — встроенный `node:test`; ни `supertest`, ни внешнего раннера в зависимостях нет. Запуск —
цель `test` зоны (см. [`README.md`](README.md)). Набору PostgreSQL нужна база: без
`TEST_DATABASE_URL` он пропускается с причиной и остаётся 94 теста, поэтому цель `test` зелена и на
машине без Docker. Обязательный прогон обеих зон против поднятого контура — цель `make db-test`
(см. [`infra/README.md`](../../infra/README.md)), её же выполняет CI.

Поднимает приложение общий харнесс `src/http/testServer.ts` — не тест, а его опора: `withServer`
(listen(0), сырой `send` и JSON-клиент поверх глобального `fetch`, закрытие сервера и соединений),
фабрика тестового `AppConfig` и `expectError` — канон ответа-ошибки (статус, тело ровно
`{code, message}`, непустой текст). Три набора HTTP-тестов держали свои копии этого кода, и
добавленное поле конфигурации приходилось чинить в каждом.

## Запуск из исходников: ограничения strip-only

Сборки нет — Node исполняет TypeScript-исходники напрямую, `tsconfig.json` стоит на `noEmit` плюс
`allowImportingTsExtensions`. Из этого следуют обязательные к соблюдению правила:

- у всех относительных импортов явное расширение `.ts`;
- нет `enum` — только `as const` и union-типы;
- нет parameter properties (поля класса присваиваются явно), `namespace` с рантайм-значением и
  декораторов;
- импорты только типов — через `import type`;
- зависимости ставятся в корне репозитория с сохранением симлинков npm workspaces: внутри
  физического `node_modules` Node отказывается стриптить типы
  (`ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING`).

Цель `typecheck` зоны — единственное место, где типы действительно проверяются.

Отсюда же требования к рантайм-образу (задача `infra/009`, состав самого образа — зона
[`infra/`](../../infra/AGENTS.md)): зависимости в него ставятся из корня репозитория, а не внутри
`apps/api`; в образ попадают исходники зоны и `packages/backend-contract`, а не результат сборки —
её нет; процесс стартует тем же способом, что и локально, и раздаёт собранные web-бандлы из
каталогов конвенции, если они там лежат.
