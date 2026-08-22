# План TASK-BACK-001

> **Приведён в соответствие с контрактом `0.2.0` 2026-08-08 задачей
> [`task-contract-001`](../../contract/001-guest-flow-extensions/)** (её FR12, решение Р10). Статус уже был `черновик`.
> Затронуты пункты P01, P02, P05, P07, P08, P09, P10, P11, P12, P13, P17, таблица AC и блокер R3
> (удалён). Число пунктов и их ID сохранены: план перерабатывает его владелец, эта задача только
> убрала расхождения с новым контрактом.

Объём работ ограничен разделом «Затронутые компоненты» `adr.md`. Каждый пункт ссылается на
решение ADR (`Р1`…`Р13`, `V1`…`V4`) и на требование brief (`FR*`, `I*`, `AC*`).

## Декомпозиция

| ID | Цель / проблема | Решение | Состояние |
|---|---|---|---|
| P01 | `apps/api` собран под сборку в `dist`, зависимостей нет вовсе, `test`-скрипта нет; пакет `@minical/backend-contract` не резолвится. Без этого ни один следующий пункт не запускается | Р11 + Р13: в `package.json` — `start: node src/server.ts`, `test: node --test`, удаление `build` и `main`, актуальное `description`; явные `dependencies` (`express ^5.2.1`, `zod ^4.0.0`, `@minical/backend-contract *`) и `devDependencies` (`@types/express ^5.0.6`, `yaml ^2.9.0`, `@types/node ^26.1.2`). В `tsconfig.json` — `noEmit: true` и `allowImportingTsExtensions: true` вместо `rootDir`/`outDir`. Удалить устаревший `apps/api/dist/` (там лежит `server.js` от прежней сборки: без уборки `node dist/server.js` продолжит поднимать старый smoke-сервер; каталог в `.gitignore`, это локальный артефакт). Проверка: `npm install`, `npm run typecheck`, `npm start -w @minical/api` отдаёт `/health` на старом коде, схемы фактически доступны — `node -e "import('@minical/backend-contract/zod').then(m => console.log(Object.keys(m).length))"` печатает 46, а не 0 (проверять именно наличие экспортов, а не только успешный резолв: корневой вход пакета состоит из одного `export type` и в рантайме пуст — см. исправление Р12); типы приходят корневым специфаером `@minical/backend-contract` (следствие `task-infra-005`, см. блокер B1) | завершено |
| P02 | Нет доменных типов и доменной ошибки; на них опирается всё остальное | Р1 + Р3: `domain/model.ts` — `CalendarOwner`/`OwnerRecord`, `CalendarSettings`, `AvailabilityRule`, `EventType`, `Booking` с плоским guest-snapshot (`I13`) и `eventTypeName` — snapshot названия типа встречи (`I15`, контракт `0.2.0`), `LocalDate`/`LocalDateTime`, `TimeInterval`; `domain/errors.ts` — класс `DomainError` (без parameter properties, Р11) и union кодов из FR4. Ограничения strip-only режима Р11 соблюдаются во всех файлах задачи: `as const` вместо `enum`, `import type`, расширение `.ts` в specifier'ах. Размещение `DomainErrorCode` — см. открытый вопрос O1. Проверка: `npm run typecheck` | завершено |
| P03 | Слоты нельзя посчитать без перевода локального времени владельца в instant и обратно; `Temporal` недоступен, библиотеку не берём | Р6: `domain/timezone.ts` — `localPartsOf`, `instantOfLocal` (двухпроходное смещение + round-trip, `null` на несуществующем локальном времени), `isValidTimeZone` через `Intl` (основание `V4`). Только `node:*`-импорты. Проверка: `domain/slots.test.ts` — зимнее/летнее смещение `America/New_York`, `Asia/Kathmandu` (+05:45), несуществующее `2026-03-08 02:30` → `null`, неоднозначное `2026-11-01 01:30` → раннее смещение, мусорная зона → `false` | завершено |
| P04 | Сетку слотов и пересечение интервалов нужно считать один раз для `GET /slots` и `POST /bookings`, иначе коды ошибок расходятся | Р5 + Р7: `domain/slots.ts` — `bookingWindowDates` (`I6`), `candidateSlots` (`I3`, `I6`, `I7`, `I8`, `I9`), `overlaps` (`I2`, `I3`, строгие сравнения), `isBusy`. Без `DomainError`, без репозиториев, без `express` — условие дешёвого выноса в `packages/slot-engine`. Проверка: `domain/slots.test.ts` — окно ровно 14 локальных дат, кратность началу `slotIntervalMinutes` (`I8`), слот целиком внутри рабочего интервала (`I7`), исключение прошлого (`I9`), соседние `10:00–11:00`/`11:00–11:30` не пересекаются (`I3`) | завершено |
| P05 | Прикладной слой не должен переписываться при переходе на PostgreSQL (FR5), а «проверить и вставить» обязано быть неделимым | Р4: `store/repositories.ts` — три интерфейса с асинхронными методами ровно в форме Р4; `store/memory.ts` — `createMemoryStore()` на замыкании, владелец переменной (`I1`), поверхностные копии на выходе, `create` без внутренних `await` проверяет пересечение (`I2`) и уникальность id (`I11`) и отказывает `DomainError`; запись брони хранит `eventTypeName` (`I15`), а `findById` используется и для сравнения полезной нагрузки при идемпотентном повторе (Р5, шаг 5). Проверка: `store/memory.test.ts` — вставка пересекающегося интервала другого EventType отклонена, соседний интервал принят, повторный `EventType.id` отклонён, мутация возвращённой записи не портит хранилище (файл сверх трёх из Р9, см. O2) | завершено |
| P06 | Транспортный фундамент: конфигурация, таблица статусов и единственная точка Zod-валидации; без них обработчики писать некуда | Р10 + Р3 + Р2 + Р8: `config.ts` — `loadConfig()` читает `PORT` и `PUBLIC_WEB_URL` (FR8), дефолты `3001` / `http://localhost:8081`, мусорное значение = отказ старта; `http/errors.ts` — `ERROR_STATUS` (11 строк FR4), `errorMiddleware` (`DomainError` → таблица, `SyntaxError`/`entity.parse.failed` → `400 VALIDATION_ERROR`, остальное → `500 INTERNAL_ERROR` с логом), `notFoundHandler` → `404 NOT_FOUND` (G3); `http/parse.ts` — `parseOrThrow` со сборкой сообщения из `issues`. Проверка: `npm run typecheck`; поведение middleware проверяется в P07 | завершено |
| P07 | Нужен работающий сервер, единственная точка монтирования и гарантия покрытия контракта (FR7) — до того, как появятся операции | Р9 + Р8 + Р1: `http/routes.ts` — `ROUTES as const` из 12 строк (включая `getPublicCalendar`, `GET /calendar`) и тип `OperationId`; `http/handlers.ts` — `Record<OperationId, (deps) => RequestHandler>`, реализован `getHealth` (тело-литерал `{"status":"ok"}`, FR1, AC2), остальные 11 — временные заглушки, заменяемые пунктами P08–P13 (тотальность `Record` требует их наличия; заглушка падает в `500 INTERNAL_ERROR` и не существует после P13); `app.ts` — `createApp(deps)`: `express.json()` с дефолтами → цикл по `ROUTES` → `notFoundHandler` → `errorMiddleware`; `server.ts` — entry `loadConfig() → createMemoryStore() → createApp → listen`. Проверка: `http/routes.contract.test.ts` — двусторонняя сверка `ROUTES` с `paths` из `packages/contracts/generated/openapi.yaml`, 12/12 без лишнего (AC8); `npm start -w @minical/api` + `curl /health` (AC1, AC2); `curl /nope` → `404 NOT_FOUND`; отказ async-обработчика доходит до error-middleware (проверка допущения Р8, а не вера в него) | завершено |
| P08 | Онбординг владельца выполняется однократно, а мусорные настройки, попав в хранилище, обрушают `getPublicSlots` | Р2 + Р3 + Р4: use-case в `usecases/owner.ts` — `getAdminSetup`, `completeAdminSetup` (`I5`, `ONBOARDING_ALREADY_COMPLETED` при повторе); валидация тела `zCompleteAdminSetupBody` через `parseOrThrow` (FR3) плюс доменные `V1`–`V4` (`60 % slotIntervalMinutes`, `startLocal < endLocal`, непустой `daysOfWeek`, `isValidTimeZone`) → `VALIDATION_ERROR` — ответ **документирован** контрактом `0.2.0` (G1 закрыт `task-contract-001`), а `V3` через HTTP недостижим, потому что пустой `daysOfWeek` отвергает `zAvailabilityRule` (`.min(1)`, G2 закрыт там же); `http/present.ts` — `settings`-презентер с `publicUrl` из конфига и `Date → toISOString()`. Проверка: `api.test.ts` — `PUT /admin/setup` 200, повтор 409 (AC4), `GET /admin/setup` до и после, `slotIntervalMinutes: 25` → 400 `VALIDATION_ERROR`, пустой `daysOfWeek` → 400, зона `Foo/Bar` → 400; тело ответа сверяется `zCompleteAdminSetupResponse` | завершено |
| P09 | Чтение и полная замена настроек; до онбординга обе операции обязаны отдавать документированный `CALENDAR_NOT_CONFIGURED`, а `publicUrl` — приходить из env | Р3 + Р10: `getAdminSettings`, `updateAdminSettings` в `usecases/owner.ts`; проверка настроенности включена точно на документированных операциях (Р3); тело `zUpdateAdminSettingsBody` + повторное применение `V1`–`V4` (ответ `400 VALIDATION_ERROR` у этой операции документирован контрактом `0.2.0`, под `400` он стоит рядом с `CalendarNotConfigured`; `V3` через HTTP недостижим — см. P08); full replace, не merge. Проверка: `api.test.ts` — оба вызова до онбординга → 400 `CALENDAR_NOT_CONFIGURED` (AC7), после — 200 с `publicUrl`, равным конфигу (AC9), тело валидно по `zGetAdminSettingsResponse` (`format: uri`), `PUT` заменяет `availabilityRules` целиком | завершено |
| P10 | Три операции над Event Type: admin-список, создание с уникальным id и публичный список, требующий настроенного календаря; плюс двенадцатая операция контракта — публичное имя владельца | Р3 + Р4: `getAdminEventTypes`, `createAdminEventType` (`I11`, `DUPLICATE_EVENT_TYPE_ID`, тело `zCreateAdminEventTypeBody`), `getPublicEventTypes` (`CALENDAR_NOT_CONFIGURED`); `present.eventType`. Асимметрия admin/public по проверке настроенности намеренна и следует контракту (Q6): создание до онбординга разрешено. Здесь же — `getPublicCalendar` (контракт `0.2.0`, Р1): use-case в `usecases/owner.ts` читает запись владельца, проверка настроенности (`CALENDAR_NOT_CONFIGURED`), презентер `present.publicCalendar` отдаёт **только** `displayName`. Проверка: `api.test.ts` — создание 201, повтор того же `id` → 409 `DUPLICATE_EVENT_TYPE_ID` (AC6), `GET /event-types` до онбординга → 400 `CALENDAR_NOT_CONFIGURED` (AC7), после — список; `durationMinutes: 0` → 400 `VALIDATION_ERROR` (AC5); `GET /calendar` до онбординга → 400 `CALENDAR_NOT_CONFIGURED`, после — 200 с `displayName`, тело по `zGetPublicCalendarResponse` | завершено |
| P11 | Свободные слоты выбранного типа события в серверном 14-дневном окне, без побочных эффектов | Р5 + Р2: `usecases/booking.ts` → `listSlots` = `candidateSlots(...)` минус `isBusy(...)` по `listBusyIntervals(окно)`; query валидируется `zGetPublicSlotsQuery` (FR3); порядок отказов: настроенность (`CALENDAR_NOT_CONFIGURED`) → `EVENT_TYPE_NOT_FOUND`; `present.slot`. Проверка: `api.test.ts` — 200 и тело по `zGetPublicSlotsResponse`, все слоты внутри окна и кратны интервалу, слот занятого времени отсутствует, повторный вызов даёт тот же результат (`I10` — вызов ничего не резервирует), неизвестный `eventTypeId` → 404, до онбординга → 400, пустой `eventTypeId` → 400 `VALIDATION_ERROR` (`zGetPublicSlotsQuery` — `.min(1)`, G4 закрыт `task-contract-001`; прежнее «даёт 404, ожидаемо по Q2» больше не верно) | завершено |
| P12 | Создание анонимного бронирования: девять точек отказа, каждая со своим кодом, плюс глобальный запрет пересечений и идемпотентный повтор | Р5 + Р7 + Р3: `createBooking` в `usecases/booking.ts` строго в порядке шагов 1–9 Р5 — в том числе **новый шаг 5**: если `id` передан и найден, сравнить полезную нагрузку (`eventTypeId`, `startAtUtc`, каждое поле `guest` как разобранные значения; `id` в сравнении не участвует) → эквивалентна: ранний успешный выход с существующей бронью и статусом `200`; не эквивалентна: `DUPLICATE_BOOKING_ID`. Возврат use-case перестаёт быть `Booking` и различает создание и повтор (`{ booking, replayed }` или эквивалент), обработчик по этому различию ставит `201` или `200`. `endAtUtc` считает сервер (`I4`), `eventTypeName` записывается snapshot'ом в момент создания (`I15`), guest хранится плоским snapshot'ом (`I13`), `guestName`/`guestEmail` проверяются в домене (`I12`) — через HTTP недостижимо (FR4, unit-вызов use-case напрямую); повторная проверка занятости и атомарный `create` (Р4.2). Проверка: `api.test.ts` — сквозной сценарий гостя `GET /event-types` → `GET /slots` → `POST /bookings` 201 → повтор **без ключа** → 409 `SLOT_UNAVAILABLE` (AC3), повтор **с тем же ключом и той же нагрузкой** → 200 и то же тело, второй брони нет, повтор **с тем же ключом и изменённой нагрузкой** → 409 `DUPLICATE_BOOKING_ID`, пересечение с бронированием другого EventType → 409 (`I2`), соседний слот → 201 (`I3`), отсутствующий `guest` → 400 `VALIDATION_ERROR`, пустой `eventTypeId` → 400 `VALIDATION_ERROR` (AC5), слот вне окна → 400 `SLOT_OUTSIDE_WINDOW`, невыровненный `startAtUtc` → 400 `SLOT_NOT_ALIGNED`, тело по `zCreatePublicBookingResponse` (одна схема на оба успешных статуса); unit-вызовы use-case на `GUEST_NAME_REQUIRED`/`GUEST_EMAIL_REQUIRED` | завершено |
| P13 | Единый список предстоящих бронирований владельца; brief отсечку не задаёт | Q4 (подтверждено) + Р4: `getAdminUpcomingBookings` через `listNotEndedBefore(now)` — критерий `endAtUtc > now`, сортировка по `startAtUtc` возрастанию, без проверки настроенности (не документирована — до онбординга `[]`), без фильтра по EventType. Тело включает `eventTypeName` из сохранённого snapshot'а записи, а не из join'а с текущими типами встреч (`I15`): иначе поведение при переименовании типа разойдётся с `createPublicBooking`. Проверка: `api.test.ts` — идущая встреча в списке, закончившаяся отсутствует, порядок возрастающий, до онбординга `[]`, тело по `zGetAdminUpcomingBookingsResponse`, `eventTypeName` не меняется после переименования типа; здесь же удаляется последняя заглушка обработчика из P07 | завершено |
| P14 | Пункты проверялись по отдельности; нужен один прогон всех гейтов и ручное подтверждение AC, которые не выражаются тестом | Полный чеклист раздела «Обязательные проверки» этого файла: пять корневых команд + `npm test -w @minical/api`; ручные проверки — старт одной командой и `curl /health` (AC1, AC2), `PUBLIC_WEB_URL=http://example.test` меняет `publicUrl` в ответе (AC9), `PORT=abc` и `PUBLIC_WEB_URL=nope` роняют старт с внятным сообщением (Р10). Результаты команд и AC фиксируются в `result.md` | завершено |
| P15 | `apps/api/AGENTS.md` описывает пакет как «только smoke-сервер»; это файл, который роль Backend Agent читает перед работой, и он станет неверным | Переписать под фактическое состояние: Express 5 и почему без code-first схемной машинерии, слои `http/usecases/domain/store` и правила границ (Р1), точка Zod-валидации (Р2), таблица `ERROR_STATUS` как единственное место статусов (Р3), запуск из исходников без сборки и ограничения strip-only (Р11), команды `dev`/`start`/`test`/`typecheck`, место вставки middleware для `task-infra-003` (Р8). Ссылка на `backend-agent.md` сохраняется. Проверка: перечисленные пути и команды существуют в дереве и в `package.json` | завершено |
| P16 | Корневые документы описывают прежний backend: `README.md` предлагает `npm run build -w @minical/api`, которого больше нет, и не знает про `test`; раздел «Структура репозитория» `AGENTS.md` описывает `apps/api` как smoke на `node:http` | `README.md`: в «Командах» и «Запуске» — `npm start -w @minical/api` без предварительной сборки, `npm test -w @minical/api` как backend-гейт, уточнение про `npm run build` (`apps/api` больше не участвует), в «Структуре» — `apps/api` как REST API 11 операций на in-memory. `AGENTS.md`: состав `apps/api/src` по Р1, пометка про отсутствие сборки, в разделе «Обязательные проверки» упоминание backend-команды. Проверка: команды из обоих файлов выполняются как написано | завершено |
| P17 | При проектировании найдены расхождения с контрактом (G1, G2, G4) и осознанное отклонение (G3). G1, G2 и G4 **закрыты upstream** задачей `task-contract-001` до начала реализации; в реестре остаётся только G3, и он должен остаться зафиксированным, иначе будет заново найден при следующем касании контракта | Механизма backend-реестра гапов в проекте нет — `docs/ui-spec-kit/specs/ui/bindings/contract-gaps.xml` привязан к экранам и `api-bindings.xml` и для backend не подходит (см. O3). Действия: зафиксировать в разделе «Известные ограничения и риски» `result.md` **G3** как осознанное расхождение (`404 NOT_FOUND` и `500 INTERNAL_ERROR` вне контракта) со ссылкой на таблицу «Contract gaps» ADR, а G1, G2 и G4 — как закрытые `task-contract-001` (без переоткрытия); сверить абзац про контрактную задачу в `tasks/README.md` («План разработки») — он уже обновлён `task-contract-001`, при расхождении уточнить формулировку; обновить строку `back-001` в реестре задач по факту результата. Проверка: каждый gap из ADR имеет адрес в `result.md`, ссылки из `tasks/README.md` ведут в существующие места | завершено |

Допустимые состояния:

```text
в плане
выполняется
завершено
```

## Порядок и зависимости

Внешняя зависимость: **`task-infra-005` должна быть завершена до P01** — см. блокер B1.

```text
task-infra-005 ─→ P01 ─→ P02 ─┬─→ P03 ─→ P04 ─┐
                              ├─→ P05 ─────────┤
                              └─→ P06 ─────────┴─→ P07 ─→ P08 ─→ P09 ─→ P10 ─→ P11 ─→ P12 ─→ P13 ─→ P14 ─→ P15 + P16 + P17
```

- P03 → P04 строго последовательны: сетка слотов считается через примитивы таймзоны.
- P05 и P06 не зависят друг от друга и от ветки P03–P04; порядок между ними произволен.
- P07 — первая точка, где сервер запускается и AC8 проверяем; после него операции добавляются в любом порядке, но P09 удобнее после P08 (нужен завершённый онбординг), а P11–P13 после P10 (нужен существующий EventType).
- P12 после P11 не по коду, а по тестам: сквозной сценарий AC3 выбирает слот через `GET /slots`.
- P15, P16, P17 — документация, зависят только от финального состояния кода (P14); порядок между ними произволен.

## Обязательные проверки

Полный список — в [`AGENTS.md`](../../../AGENTS.md), результаты фиксируются в `result.md`.

- [x] `npm run contracts:format:check` — применима формально: `.tsp` не меняется (API impact `NONE`), команда обязана проходить без изменений
- [x] `npm run generate:check` — обязательна как защита от случайной правки generated: diff должен отсутствовать
- [x] `npm run typecheck` — главный и единственный типовой гейт: после Р11 сборки нет, `node src/server.ts` типы не проверяет
- [x] `npm test` — корневой гейт (`uispec:validate` + contract gate) обязан проходить без регрессий (AC10); смысл скрипта задача не меняет
- [x] `npm run uispec:validate` — отдельно не нужна: UI и `docs/ui-spec-kit/` не меняются; применима только как часть корневого `npm test`
- [x] `npm test -w @minical/api` — новая backend-команда (`node --test`, Р9 и Р11): `http/routes.contract.test.ts`, `domain/slots.test.ts`, `store/memory.test.ts`, `api.test.ts`
- [x] Ручные проверки P14: старт одной командой, `curl /health`, подстановка `PUBLIC_WEB_URL`, отказ старта на мусорной конфигурации

Соответствие acceptance criteria и проверок:

| AC | Чем проверяется | Пункт |
|---|---|---|
| AC1 — старт одной командой | ручная: `npm start -w @minical/api` (без `build`) | P07, P14 |
| AC2 — `/health` ровно `{"status":"ok"}` | `api.test.ts` + ручной `curl` | P07, P14 |
| AC3 — сквозной сценарий гостя и все три ветви повтора (`200` с ключом и той же нагрузкой, `409 DUPLICATE_BOOKING_ID` с ключом и другой нагрузкой, `409 SLOT_UNAVAILABLE` без ключа) | `api.test.ts` | P12 |
| AC4 — онбординг 200, повтор 409 | `api.test.ts` | P08 |
| AC5 — невалидный вход → `400 VALIDATION_ERROR` | `api.test.ts`: оба примера brief достижимы — пустой `eventTypeId` (`.min(1)` в схемах, G4 закрыт `task-contract-001`) и отсутствующий `guest`, плюс `durationMinutes: 0` | P10, P11, P12 |
| AC6 — `409 DUPLICATE_EVENT_TYPE_ID` | `api.test.ts` | P10 |
| AC7 — `400 CALENDAR_NOT_CONFIGURED` до онбординга | `api.test.ts` (settings, `/event-types`, `/slots`, `/bookings`) | P09, P10, P11, P12 |
| AC8 — покрытие контракта 12/12 без лишнего | `http/routes.contract.test.ts` | P07 |
| AC9 — валидный `publicUrl` из env | `api.test.ts` + `zGetAdminSettingsResponse` + ручная подстановка env | P09, P14 |
| AC10 — `typecheck` и корневой `npm test` без регрессий | корневые команды чеклиста | P14 |

## Блокеры и открытые вопросы

**B1. Блокер: `task-infra-005` (статус `черновик`).** `@minical/backend-contract` не резолвится по
имени — в его `package.json` нет ни `exports`, ни `main`, `import('@minical/backend-contract')`
падает с `ERR_MODULE_NOT_FOUND` (проверено в ADR). Правка вынесена в `task-infra-005` (Q7,
Р12), `task-back-001` чужие пакеты не трогает. Пока задача не завершена, реализация не может
начаться: без generated Zod-схем FR3 не выполним ни в рантайме, ни в `typecheck`. Обходной путь
через `paths` в `apps/api/tsconfig.json` отклонён окончательно (лечит компилятор, не рантайм).
P01 включает явную проверку резолва — это входной контроль зависимости.

**O1. Где живёт `DomainErrorCode`.** Р3 помещает `ERROR_STATUS` и производный от него тип в
`http/errors.ts`, но `DomainError` по Р1 лежит в `domain/errors.ts` — при буквальном чтении домен
импортирует тип из транспорта, что противоречит направлению зависимостей Р1 и удорожает вынос
Slot Engine. Предложение плана: union кодов объявить в `domain/errors.ts`, а в `http/errors.ts`
держать `ERROR_STATUS: Record<DomainErrorCode, number>` — полнота таблицы по-прежнему держится
компилятором, направление зависимостей остаётся `http → domain`. Уточнение реализации, а не
изменение решения; если reviewer считает иначе — правится ADR, а не код.

**O2. Четвёртый тест-файл сверх списка Р9.** Атомарность `create` (Р4.2) — свойство store-уровня:
через HTTP гонку детерминированно не воспроизвести, а поведение «пересечение отклонено внутри
`create`» проверяется только прямым вызовом. Поэтому P05 заводит `store/memory.test.ts` сверх трёх
файлов, перечисленных в Р9. Расширение состава тестов, не scope; отмечено, чтобы не выглядело
самовольством.

**O3. Место регистрации backend contract gaps — механизма нет.** `contract-gaps.xml` — реестр
UISpec: записи привязаны к экранам (`screens=`), помечаются в `*.screen.md` и `api-bindings.xml`,
механизм предписан `MANUAL §8`. Backend-гапы G1/G2/G4 (`ValidationError` в 400 setup-операций,
`@minItems(1)` у `daysOfWeek`, `@minLength(1)` у ссылок на `eventTypeId`) ни к одному экрану не
привязаны и в этот реестр не ложатся. Штатный путь для роли — раздел «При недостаточном контракте»
`backend-agent.md`: фиксировать в task-документах и передавать contract-работу Contract Agent;
фактически G1, G2 и G4 уже перечислены прозой в `tasks/README.md`, абзац после таблицы «План
разработки». P17 опирается на это и нового файла не создаёт. Если нужен машиночитаемый
backend-реестр — это отдельное решение вне границ `task-back-001`.

**O4. Модуль для `V1`–`V4` в ADR не назван.** Р2 задаёт сами проверки и относит `isValidTimeZone`
в `domain/timezone.ts`, но не говорит, где живут остальные три. План размещает их в
`usecases/owner.ts` (единственный слой, который вправе бросать `DomainError` и общий для обеих
setup-операций). Подтверждения не требует, фиксирую, чтобы при реализации не выбирать заново.

**R1. Заглушки обработчиков между P07 и P13.** `Record<OperationId, …>` тотален, поэтому сервер
компилируется только с 11 обработчиками. В промежуточном состоянии нереализованные операции
отвечают `500 INTERNAL_ERROR` — недокументированный ответ внутри задачи. Риск снимается тем, что
P13 удаляет последнюю заглушку, а P14 прогоняет полный чеклист; сдавать задачу с оставшейся
заглушкой нельзя.

**R2. Backend-тесты не входят в корневой `npm test`.** НФТ brief запрещает менять смысл корневых
скриптов, поэтому `npm test -w @minical/api` остаётся отдельной командой, и корневой гейт
регрессию backend не поймает. Ограничение принято; сведение гейтов — предмет будущей CI-задачи.

**R4. DST-компромиссы фиксируются тестами как принятое поведение**, а не как эталон: расхождение
`I7` (локальная вместимость) и `I4` (абсолютная длительность) в дни перехода и выбор раннего
смещения на неоднозначном времени (Последствия 5 и 6 ADR). Тест на «правильную» встречу в день
перехода писать некуда — правила нет; проверяется детерминированность, а не желаемость.

**R5. `node --test` и discovery.** Р9 опирается на дефолтный поиск `**/*.test.ts` в Node 26.
Прогон в песочнице ADR это подтвердил, но в реальном пакете рядом есть `node_modules`; если
discovery зацепит лишнее или, наоборот, пропустит файлы в подкаталогах `src/`, в P01 добавляется
явный glob в скрипт `test`. Риск дешёвый, но обнаружится только на первом прогоне.
