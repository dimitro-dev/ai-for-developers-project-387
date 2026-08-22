# Результат TASK-BACK-001

## Итог

`apps/api` — работающий REST-backend: 12 операций контракта `0.2.0` поверх in-memory хранилища,
транспортная валидация generated Zod-схемами, доменные инварианты I1–I15 в объёме FR6, доменные
ошибки отображены на статусы одной таблицей. Реализовано по плану P01–P17 без отклонений от ADR:
структура слоёв Р1, точка валидации Р2, таблица `ERROR_STATUS` Р3, три интерфейса репозиториев Р4,
разделение «кандидаты / занятость» Р5, самописные `Intl`-примитивы Р6, запуск из исходников Р11.

Сервер поднимается одной командой без предварительной сборки, `GET /health` отдаёт ровно
`{"status":"ok"}`. Все 10 acceptance criteria закрыты; backend-тесты — 64 в четырёх файлах, exit 0;
корневые гейты (`contracts:format:check`, `generate:check`, `typecheck`, `npm test`) зелены. Контракт
не менялся: API impact `NONE`, ни один generated-файл не тронут.

Заглушек обработчиков не осталось (риск R1 снят пунктом P13). Гап **G3** остаётся осознанным
расхождением — см. «Известные ограничения и риски»; G1, G2 и G4 закрыты upstream задачей
`task-contract-001` и здесь не переоткрываются.

## Что изменено

Все правки — внутри `apps/api/**` плюс три документа. Чужие пакеты, контракт и generated-каталоги не
открывались.

| Файл | Изменение | Решение |
|---|---|---|
| `apps/api/package.json` | `start: node src/server.ts`, `test: node --test`; удалены `build` и `main`; актуальное `description`; явные `dependencies` (`express ^5.2.1`, `zod ^4.0.0`, `@minical/backend-contract *`) и `devDependencies` (`@types/express ^5.0.6`, `@types/node ^26.1.2`, `yaml ^2.9.0`) | Р11, Р13 |
| `apps/api/tsconfig.json` | `noEmit: true` + `allowImportingTsExtensions: true` вместо `rootDir`/`outDir` | Р11 |
| `apps/api/src/server.ts` | полностью заменён: entry `loadConfig() → createMemoryStore() → createApp → listen`, отказ старта на мусорной конфигурации | Р1, Р10 |
| `apps/api/src/config.ts` | новый: `AppConfig`, `loadConfig(env)`, дефолты `3001` / `http://localhost:8081` | Р10 |
| `apps/api/src/app.ts` | новый: `createApp(deps)` — `express.json()` → цикл монтирования по `ROUTES` → `notFoundHandler` → `errorMiddleware` | Р1, Р8, Р9 |
| `apps/api/src/http/routes.ts` | новый: `ROUTES as const` из 12 строк, типы `OperationId` и `HttpMethod` | Р9 |
| `apps/api/src/http/handlers.ts` | новый: `Deps`, `handlers: Record<OperationId, (deps) => RequestHandler>` — 12 обработчиков, transport→command mapping | Р1, Р2, Р9 |
| `apps/api/src/http/parse.ts` | новый: `parseOrThrow(schema, value)` со сборкой сообщения из `issues` | Р2 |
| `apps/api/src/http/present.ts` | новый: 6 презентеров (`eventType`, `slot`, `booking`, `settings`, `publicCalendar`, `setupState`) | Р1 |
| `apps/api/src/http/errors.ts` | новый: `ERROR_STATUS` (11 кодов, `satisfies Record<DomainErrorCode, number>`), `errorMiddleware`, `notFoundHandler` | Р3, Р8 |
| `apps/api/src/usecases/owner.ts` | новый: `getAdminSetup`, `completeAdminSetup`, `getAdminSettings`, `updateAdminSettings`, `getPublicCalendar`, `getAdminEventTypes`, `createAdminEventType`, `getPublicEventTypes`, `getAdminUpcomingBookings`, `requireConfiguredOwner`, доменные проверки V1–V4 | Р2, Р3, Q4, Q6 |
| `apps/api/src/usecases/booking.ts` | новый: `getPublicSlots`, `createPublicBooking` (шаги 1–9 Р5, возврат `{ booking, replayed }`) | Р5, Р7 |
| `apps/api/src/domain/model.ts` | новый: `LocalDate`, `LocalDateTime`, `TimeInterval`, `AvailabilityRule`, `CalendarSettings`, `CalendarOwner`, `OwnerRecord`, `EventType`, `Booking`, `DayOfWeek` | Р1 |
| `apps/api/src/domain/errors.ts` | новый: `DomainError` (поля присваиваются явно) и union `DomainErrorCode` | Р3, Р11, O1 |
| `apps/api/src/domain/slots.ts` | новый: `bookingWindowDates`, `candidateSlots`, `includesLocalDate`, `overlaps`, `isBusy`, `SlotGridInput` | Р5, Р7 |
| `apps/api/src/domain/timezone.ts` | новый: `localPartsOf`, `instantOfLocal`, `isValidTimeZone` на `Intl`, кэш форматтеров по зоне | Р6 |
| `apps/api/src/store/repositories.ts` | новый: `OwnerRepository`, `EventTypeRepository`, `BookingRepository`, `Store` | Р4 |
| `apps/api/src/store/memory.ts` | новый: `createMemoryStore()` — замыкание, владелец переменной, копии на входе и выходе, атомарный `create` | Р4 |
| `apps/api/src/api.test.ts` | новый: 37 HTTP-тестов, тела успешных ответов сверяются generated response-схемами | Р9 |
| `apps/api/src/domain/slots.test.ts` | новый: 15 тестов — таймзоны, окно, сетка, пересечения, политика DST | Р9 |
| `apps/api/src/store/memory.test.ts` | новый: 9 тестов — атомарность `create`, копии записей, snapshot `eventTypeName` | Р9, O2 |
| `apps/api/src/http/routes.contract.test.ts` | новый: 3 теста — двусторонняя сверка `ROUTES` с `generated/openapi.yaml` | Р9, FR7 |
| `apps/api/AGENTS.md` | переписан: Express 5 без схемной машинерии, слои и границы, точка валидации, таблица статусов, команды, ограничения strip-only, место вставки middleware для `task-infra-003` | P15 |
| `README.md` | «Команды»: добавлен `npm test -w @minical/api`, уточнён `npm run build` (`apps/api` не участвует); «Запуск»: `npm start` без сборки, конфигурация через env, in-memory состояние; «Структура»: `apps/api` — REST API 12 операций | P16 |
| `AGENTS.md` | раздел «Структура репозитория»: фактический состав `apps/api/src` и пометка про отсутствие сборки; «Обязательные проверки»: backend-команда `npm test -w @minical/api` | P16 |
| `tasks/README.md` | строка `back-001` в реестре и в «Плане разработки», таблица снимка и сноска ¹ | P17 |
| `package-lock.json` | следствие `npm install` для объявленных зависимостей `apps/api` | P01 |

Удалён локальный артефакт `apps/api/dist/` (каталог в `.gitignore`): без уборки
`node dist/server.js` продолжал бы поднимать прежний smoke-сервер.

## Контракт и generated-артефакты

**API impact `NONE`.** `packages/contracts/src/**/*.tsp` не открывался,
`packages/contracts/generated/openapi.yaml` и оба generated-каталога не изменились —
`npm run generate:check` зелен. `tests/contract-validation.test.ts` не правился.

Реализация ведётся против контракта **`0.2.0`**: 12 операций / 9 маршрутов, обязательное
`Booking.eventTypeName`, два успешных статуса у `createPublicBooking`.

Использованные import-специфаеры — ровно те, что зафиксировала `task-infra-005`:

```ts
import { zCompleteAdminSetupBody, zCreateAdminEventTypeBody, zCreatePublicBookingBody,
         zGetPublicSlotsQuery, zUpdateAdminSettingsBody } from '@minical/backend-contract/zod';
import type { HealthResponse, SetupRequest } from '@minical/backend-contract';
```

Схемы — подпутём `/zod` (46 экспортов в рантайме), типы — корневым входом (в рантайме пуст, только
`export type`). Валидируются 5 входов из 12 операций: 4 тела и 1 query; самописных схем нет (FR3).
Ответы на runtime не валидируются, но в тестах тела сверяются схемами `zGetHealthResponse`,
`zGetAdminSetupResponse`, `zCompleteAdminSetupResponse`, `zGetAdminSettingsResponse`,
`zUpdateAdminSettingsResponse`, `zCreateAdminEventTypeResponse`, `zGetAdminEventTypesResponse`,
`zGetPublicEventTypesResponse`, `zGetPublicCalendarResponse`, `zGetPublicSlotsResponse`,
`zCreatePublicBookingResponse`, `zGetAdminUpcomingBookingsResponse`.

## База данных и миграции

Не применимо: персистентность — задача Database Agent (non-goal brief). Место перехода подготовлено —
`store/memory.ts` → `store/postgres.ts` плюс одна строка сборки `deps` в `server.ts`; проверка
пересечения и уникальности id уже вынесена внутрь `create`, где PG повесит exclusion constraint и
unique index.

## Выполненные проверки

### Обязательные гейты `AGENTS.md`

| Команда | Exit code | Фактический вывод |
|---|---:|---|
| `npm run contracts:format:check` | 0 | `- Checking format` / `✔ 9 formatted` |
| `npm run generate:check` | 0 | `✓ ./packages/backend-contract/src/generated · 3 files · 80ms`; `git diff --exit-code` без вывода |
| `npm run typecheck` | 0 | `tsc --noEmit` без диагностик во всех четырёх workspaces (`@minical/api`, `@minical/client`, `@minical/api-client`, `@minical/backend-contract`) |
| `npm test` (корневой) | 0 | `uispec:validate`: `Validated 31 files; errors=0`, `approved=26, draft=5`; contract gate: `Route count: 9 === 9`, `Operation count: 12 === 12`, `✅ All contract validation checks passed` |
| `npm test -w @minical/api` | 0 | `tests 64 / pass 64 / fail 0`, `suites 0`, `skipped 0`, `todo 0` |
| `npm run build` (корневой) | 0 | `apps/api` пропущен (`--if-present`), собран только клиент: `Exported: dist` |

`npm run uispec:validate` отдельно не запускался — входит в корневой `npm test` (вывод выше); по
существу не применим: `docs/ui-spec-kit/` и UI-код клиента не менялись.

### Состав backend-тестов

| Файл | Тестов | Что проверяет |
|---|---:|---|
| `src/http/routes.contract.test.ts` | 3 | FR7/AC8: реестр `ROUTES` ↔ `generated/openapi.yaml` в обе стороны, 12/12, без лишнего и без дублей |
| `src/domain/slots.test.ts` | 15 | Р6: зимнее/летнее смещение `America/New_York`, `Asia/Kathmandu` (+05:45), несуществующее `2026-03-08 02:30` → `null`, неоднозначное `2026-11-01 01:30` → `05:30Z`, `Foo/Bar` → `false`; I6 (14 дат, переход через месяц, `today` в зоне владельца), I7, I8, I9, I3, `overlaps`/`isBusy`, пропуск несуществующих часов в день перехода |
| `src/store/memory.test.ts` | 9 | Р4.2: пересечение и повторный id отклонены внутри `create`, соседний интервал принят, `endAtUtc > now`, фильтрация окна в `listBusyIntervals`, I11, мутация возвращённой и переданной записи не портит хранилище, snapshot `eventTypeName` |
| `src/api.test.ts` | 37 | AC2–AC7, AC9 по HTTP; 404/500 (G3, допущение Р8); onboarding и V1/V2/V4; настройки и `publicUrl`; типы встреч; слоты; девять точек отказа `POST /bookings` и три ветви повтора; `/admin/bookings` |

### Acceptance criteria

| AC | Чем проверен | Результат |
|---|---|---|
| AC1 — старт одной командой | ручная: `npm start -w @minical/api` (без `build`) | `MiniCal API: http://localhost:3001/health`, сервер поднялся из исходников |
| AC2 — `/health` ровно `{"status":"ok"}` | `api.test.ts` (+ `zGetHealthResponse`) и `curl` | `{"status":"ok"} <- 200`, лишних полей нет |
| AC3 — сквозной сценарий гостя и три ветви повтора | `api.test.ts` (4 теста) и ручной прогон curl | `POST /bookings` → `201`; повтор с тем же ключом и той же нагрузкой → `200`, тело идентично; с тем же ключом и другой нагрузкой → `409 DUPLICATE_BOOKING_ID`; без ключа → `409 SLOT_UNAVAILABLE`; второй брони не появилось |
| AC4 — онбординг 200, повтор 409 | `api.test.ts`, `curl` | `200`, затем `409 ONBOARDING_ALREADY_COMPLETED` |
| AC5 — невалидный вход → `400 VALIDATION_ERROR` | `api.test.ts` | оба примера brief достижимы: пустой `eventTypeId` в query и в теле → `400`; отсутствующий `guest` → `400`; плюс `durationMinutes: 0`, `id: ''`, невалидный email, naive `startAtUtc`, `id` не-UUID |
| AC6 — `409 DUPLICATE_EVENT_TYPE_ID` | `api.test.ts`, `curl` | повтор `id` отклонён, сохранённая запись не перезаписана |
| AC7 — `400 CALENDAR_NOT_CONFIGURED` до онбординга | `api.test.ts` | на `GET/PUT /admin/settings`, `GET /calendar`, `GET /event-types`, `GET /slots`, `POST /bookings`; на `/slots` проверен и порядок отказов (настроенность раньше `EVENT_TYPE_NOT_FOUND`) |
| AC8 — покрытие контракта 12/12 без лишнего | `routes.contract.test.ts` | 12 операций контракта ↔ 12 строк `ROUTES`, сверка двусторонняя |
| AC9 — валидный `publicUrl` из env | `api.test.ts` (+ `zGetAdminSettingsResponse`, `format: uri`) и ручная подстановка | дефолт → `http://localhost:8081`; `PUBLIC_WEB_URL=https://minical.example.test` → то же значение в ответе |
| AC10 — `typecheck` и корневой `npm test` без регрессий | корневые команды | exit 0 у обеих, смысл скриптов не изменён |

### Ручные проверки P14

```text
$ npm start -w @minical/api
MiniCal API: http://localhost:3001/health

$ curl -s http://localhost:3001/health
{"status":"ok"}                                                          <- 200

$ curl -s http://localhost:3001/admin/setup
{"onboardingCompleted":false}                                            <- 200

$ curl -s -X PUT -d '{"displayName":"Мария","timeZone":"Europe/Amsterdam", …}' …/admin/setup
{"displayName":"Мария","timeZone":"Europe/Amsterdam","availabilityRules":[…],
 "slotIntervalMinutes":30,"publicUrl":"http://localhost:8081"}            <- 200
$ повтор того же PUT
{"code":"ONBOARDING_ALREADY_COMPLETED", …}                                <- 409

$ curl -s -X POST -d '{"id":"intro","name":"Знакомство","durationMinutes":30}' …/admin/event-types
{"id":"intro","name":"Знакомство","durationMinutes":30}                   <- 201

$ curl -s …/calendar
{"displayName":"Мария"}                                                   <- 200
$ curl -s …/event-types
[{"id":"intro","name":"Знакомство","durationMinutes":30}]                 <- 200
$ curl -s '…/slots?eventTypeId=intro'
252 слота, первый 2026-08-08T07:00:00.000Z

$ POST /bookings  (id=8888…, тот же слот)                                 <- 201
$ POST /bookings  (тот же id, та же нагрузка)                             <- 200, тело идентично
$ POST /bookings  (тот же id, другой гость)  DUPLICATE_BOOKING_ID         <- 409
$ POST /bookings  (без id, тот же слот)      SLOT_UNAVAILABLE             <- 409
$ curl -s …/admin/bookings
[{… "eventTypeName":"Знакомство", "startAtUtc":"2026-08-08T07:00:00.000Z" …}]  <- 200

$ PORT=3999 PUBLIC_WEB_URL=https://minical.example.test npm start -w @minical/api
$ curl -s http://localhost:3999/admin/settings
{… "publicUrl":"https://minical.example.test"}                            <- 200

$ PORT=abc node src/server.ts
MiniCal API: invalid configuration — PORT must be an integer in 1..65535, got "abc"
exit=1
$ PORT=70000 node src/server.ts
MiniCal API: invalid configuration — PORT must be an integer in 1..65535, got "70000"
$ PUBLIC_WEB_URL=nope node src/server.ts
MiniCal API: invalid configuration — PUBLIC_WEB_URL must be an absolute http(s) URL, got "nope"
$ PUBLIC_WEB_URL=ftp://example.test node src/server.ts
MiniCal API: invalid configuration — PUBLIC_WEB_URL must use http or https, got "ftp://example.test"
```

## Отклонения от brief / ADR / plan

Отклонений от решений ADR нет; все 17 пунктов плана выполнены в предусмотренном порядке. Четыре
уточнения реализации, каждое — внутри свободы, оставленной ADR:

1. **O1 применён как предложено планом:** union `DomainErrorCode` объявлен в `domain/errors.ts`,
   `ERROR_STATUS` в `http/errors.ts` типизирован им через `satisfies`. Направление зависимостей
   остаётся `http → domain`, полнота таблицы по-прежнему держится компилятором.
2. **O2 применён:** заведён четвёртый тест-файл `store/memory.test.ts` сверх трёх из Р9 — атомарность
   `create` через HTTP не воспроизводится.
3. **Шесть презентеров вместо пяти:** к списку Р1 добавлен `setupState` (`getAdminSetup`).
   Альтернатива — собирать `SetupStateResponse` литералом в обработчике — размывала бы правило
   «domain → transport только в `present.ts`».
4. **Кэш `Intl.DateTimeFormat` по зоне** в `domain/timezone.ts`: `candidateSlots` вызывает
   форматтер сотни раз на запрос, конструктор дороже самого форматирования. Три строки, поведение не
   меняется.

Отдельно зафиксированы два решения, которые ADR оставлял открытыми:

- **Привязка сетки слотов.** `docs/domain-model.md` §6, правило 2 говорит «кратно
  `slotIntervalMinutes` **относительно начала рабочего дня**», и реализовано именно так: сетка
  привязана к `startLocal` правила. При `startLocal` на целом часе (и обязательной кратности 60 из
  V1) это совпадает с привязкой к полуночи, поэтому оба чтения инварианта I8 в штатной конфигурации
  дают одну сетку; тест проверяет обе формулировки.
- **Сортировка предстоящих бронирований** выполняется в use-case, а не в репозитории: критерий
  отсечки (`endAtUtc > now`) остался предикатом репозитория по Р4.1, а порядок — прикладным
  требованием Q4.

Проверка «`eventTypeName` не меняется после переименования типа» (P13) выполнена на уровне
хранилища и API, но **не** через переименование по HTTP: контракт не описывает операцию обновления
`EventType`, поэтому переименовать тип через API невозможно. Расхождение имён воспроизведено прямой
записью в хранилище — оба теста доказывают, что значение берётся из snapshot'а записи, а не join'ом.

## Известные ограничения и риски

**Contract gaps.** Реестр — таблица «Contract gaps» `adr.md`; машиночитаемого backend-реестра в
проекте нет и эта задача его не создаёт (O3: `contract-gaps.xml` — реестр UISpec, записи привязаны к
экранам).

| # | Gap | Состояние по факту реализации |
|---|---|---|
| G1 | `400 ValidationError` не был документирован у setup-операций | **закрыт** `task-contract-001` (FR5). Backend отдаёт `400 VALIDATION_ERROR` на `completeAdminSetup` и `updateAdminSettings` — ровно то, что описано в контракте. Не переоткрывается |
| G2 | `AvailabilityRule.daysOfWeek` без `@minItems(1)` | **закрыт** `task-contract-001` (FR6). Пустой массив отвергается на транспортной границе; доменная проверка V3 сохранена для прямых вызовов use-case и через HTTP недостижима |
| G3 | `404 NOT_FOUND` и `500 INTERNAL_ERROR` контрактом не описаны | **остаётся open, осознанно.** Оба относятся к ситуациям вне описанных операций: неизвестный URL или метод и неожиданный сбой. Форма `ErrorResponse` (`{code, message}`) соблюдена, но generated SDK этих кодов не знает и разберёт их как неизвестную ошибку. 405 с `Allow` намеренно не делается (Р8). Воспроизведено тестами `api.test.ts` |
| G4 | `@minLength(1)` не было у ссылок на `eventTypeId` | **закрыт** `task-contract-001` (FR7). Первый пример AC5 достижим, специальной ветки в коде нет |

**Прочие ограничения, принятые ADR и подтверждённые реализацией:**

1. `apps/api` не собирается в `dist`; типы проверяет только `npm run typecheck`, запуск
   `node src/server.ts` их не проверяет.
2. Пооперационные подмножества кодов ошибок из FR4 типами не выражены: `ERROR_STATUS` не мешает
   операции бросить чужой код. Держится ревью и HTTP-тестами.
3. In-memory состояние живёт в процессе: после рестарта onboarding проходится заново, сидов нет.
4. Кандидаты слотов пересчитываются на каждый `POST /bookings` (≈250 интервалов на 14 дней при
   интервале 30 минут), занятость проверяется линейно. Индексы и диапазонные запросы приходят
   вместе с PostgreSQL.
5. В дни перехода на DST локальная вместимость (I7) и абсолютная длительность (I4) расходятся:
   встреча может закончиться позже по стенным часам, чем `endLocal`. I4 авторитетен.
6. Неоднозначное локальное время осеннего перехода отдаёт более раннее смещение; второй проход того
   же часа слотами не покрывается. Оба DST-компромисса зафиксированы тестами как принятое
   поведение, а не как эталон (R4).
7. Backend-тесты не входят в корневой `npm test` (R2): корневой гейт регрессию backend не поймает,
   команда `npm test -w @minical/api` остаётся отдельной. Сведение гейтов — предмет CI-задачи.
8. Атомарность `create` защищает от гонки только внутри одного процесса Node. Второго процесса API
   над тем же хранилищем не существует по построению in-memory; для PG эту роль возьмёт constraint.
9. Требование Docker из `task-infra-005` и Р11 в силе: зависимости ставятся в корне репозитория с
   сохранением симлинков npm workspaces, иначе type stripping внутри физического `node_modules`
   падает (`ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING`).
10. `express.json()` взят с дефолтами, включая лимит 100kb. Это не решение о лимите, а его
    отсутствие: CORS, security-заголовки и лимит тела — `task-infra-003`, место вставки одно и
    задокументировано в начале `createApp`.

## Описание для MR

### Summary

`apps/api` из smoke-сервера на `node:http` превращён в REST-backend: 12 операций контракта `0.2.0`
на Express 5 поверх in-memory хранилища, транспортная валидация generated Zod-схемами из
`@minical/backend-contract/zod`, доменные ошибки отображены на HTTP-статусы одной таблицей.
Слоистость `http / usecases / domain / store` выбрана так, чтобы переход на PostgreSQL менял только
`store/**`, а вынос Slot Engine был перемещением файлов. Сборочного шага больше нет — сервер
запускается прямо из исходников (`npm start -w @minical/api`). Контракт не менялся: API impact
`NONE`. Задача разблокирует `task-infra-003`.

### Changes

- `apps/api/src/`: `server.ts`, `config.ts`, `app.ts`, `http/` (routes, handlers, parse, present,
  errors), `usecases/` (owner, booking), `domain/` (model, errors, slots, timezone), `store/`
  (repositories, memory) плюс четыре тест-файла.
- Реестр `ROUTES` — единственный источник смонтированных маршрутов; `handlers` — тотальный
  `Record<OperationId, …>`; `ERROR_STATUS` — единственное место, где код превращается в статус.
- Слот-логика: 14-дневное окно локальных дат владельца, сетка от начала рабочего интервала,
  полуоткрытые интервалы, глобальная занятость; самописные `Intl`-примитивы вместо библиотеки
  (`Temporal` в Node 26 недоступен).
- Идемпотентность `POST /bookings`: `201` при создании, `200` при повторе с тем же ключом и
  эквивалентной нагрузкой, `409 DUPLICATE_BOOKING_ID` при том же ключе и другой нагрузке,
  `409 SLOT_UNAVAILABLE` при чужом или отсутствующем ключе.
- `apps/api/package.json` и `tsconfig.json`: `start`/`test` вместо `build`, явные зависимости,
  `noEmit` + `allowImportingTsExtensions`.
- Документы: `apps/api/AGENTS.md` переписан под фактическое состояние; `README.md` и `AGENTS.md` —
  команды, запуск и структура; `tasks/README.md` — строка `back-001`.

### Verification

`npm run contracts:format:check`, `npm run generate:check`, `npm run typecheck`, `npm test`,
`npm run build` — все exit 0; `npm test -w @minical/api` — 64 теста, exit 0. AC1/AC2/AC9 и отказ
старта на мусорной конфигурации проверены вручную curl'ом и запуском с env; сквозной сценарий гостя
и все три ветви повтора воспроизведены и в тестах, и вручную. Покрытие контракта — 12/12 без лишних
маршрутов (`routes.contract.test.ts`). Generated-файлы не тронуты.

### Known limitations

`404 NOT_FOUND` и `500 INTERNAL_ERROR` остаются вне контракта (G3, осознанно). Состояние живёт в
процессе: после рестарта onboarding проходится заново. Backend-тесты не входят в корневой `npm test`.
Атомарность `create` защищает от гонки только внутри одного процесса — PostgreSQL constraint придёт
отдельной задачей. В дни перехода на DST локальная вместимость слота и абсолютная длительность
встречи расходятся; `endAtUtc = startAtUtc + durationMinutes` авторитетен. CORS, security-заголовки и
лимит тела — `task-infra-003`.
