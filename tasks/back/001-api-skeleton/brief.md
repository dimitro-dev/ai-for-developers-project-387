# TASK-BACK-001 — Каркас backend и реализация контракта на in-memory хранилище

> **Возвращён в `черновик` 2026-08-08 задачей [`task-contract-001`](../../contract/001-guest-flow-extensions/)**
> (её FR12, решение Р10). Причина: входной контракт изменился — 12 операций вместо 11, обязательное
> `Booking.eventTypeName`, два успешных статуса у `createPublicBooking`, инвертированная семантика
> `DUPLICATE_BOOKING_ID`, `@minItems(1)` у `daysOfWeek` и `@minLength(1)` у ссылок на `eventTypeId`,
> `info.version` `0.2.0`. Затронуты: «Контекст», «Цель», FR2, FR3, FR4, FR6, сценарий гостя п. 3,
> AC3, AC5, AC8. Содержание приведено в соответствие с новым контрактом; статус `согласовано`
> возвращает пользователь или назначенный reviewer (правило 11 `AGENTS.md`).

## Контекст и проблема

`apps/api` сейчас — smoke-сервер на `node:http` с единственным маршрутом `GET /health`
(см. `apps/api/src/server.ts`). Контракт MiniCal при этом полностью готов и захардинен
задачами `002`, `003`, `006` и `contract-001`: 9 маршрутов, 12 операций, 11 моделей ошибок,
`packages/backend-contract/src/generated/` содержит сгенерированные TypeScript-типы
(`types.gen.ts`) и 46 Zod-схем (`zod.gen.ts`). Прикладной реализации нет. Это блокирует:

- клиентскую разработку сквозных сценариев (frontend может работать по generated SDK и
  mock API, но сквозная проверка требует настоящего backend);
- задачу `task-infra-003` (Backend HTTP Security Middleware), которая по своей
  постановке ждёт появления backend-реализации, к которой можно подключить middleware.

### Выбор фреймворка: Express 5

Реализация идёт **от контракта**, а не от фреймворка: транспортный контракт (routes,
статусы, формы ошибок) уже зафиксирован в `.tsp` и сгенерирован в OpenAPI/Zod, поэтому
фреймворку не требуется собственная схемная машинерия — только маршрутизация и
middleware-цепочка.

Инструменты, которые «интегрируют» фреймворк со схемами (например,
`fastify-type-provider-zod`), решают обратную задачу — генерируют OpenAPI **из** кода
через `@fastify/swagger` как обязательную peer-зависимость. Если использовать такой
инструмент, в проекте появится второй источник правды для контракта (route-схемы внутри
кода фреймворка) в дополнение к `.tsp`, что прямо нарушает правила 5 и 6 `AGENTS.md`
(контракт правится только в `.tsp`; generated-файлы не редактируются вручную) —
такая интеграция начинает подталкивать contract-first проект в сторону code-first.

Поэтому выбран **Express 5** — маршрутизатор без встроенной схемной машинерии.
Валидация выполняется явно, вызовом уже сгенерированных Zod-схем из
`@minical/backend-contract` внутри обработчиков/middleware, без какой-либо генерации
контракта из кода.

## Цель

Получить работающий REST-сервер, реализующий все 12 операций контракта поверх
in-memory хранилища, с валидацией входа сгенерированными Zod-схемами и корректным
отображением доменных ошибок на HTTP-статусы. Персистентность (PostgreSQL, миграции,
exclusion constraint) и вынесение Slot Engine в переиспользуемый пакет — отдельные
задачи.

## Зависимости

- `002`, `003` — согласованный и верифицированный контракт (routes, модели, error codes,
  security audit).
- `006` — contract constraints hardening (числовые/коллекционные ограничения,
  `IanaTimeZone`, ограничение query-параметров), на которые опирается серверная
  валидация.
- `contract-001` (завершена) — входной контракт версии `0.2.0`: двенадцатая операция
  `getPublicCalendar`, `Booking.eventTypeName`, идемпотентный `200` у `createPublicBooking`,
  `@minItems(1)`/`@minLength(1)` на трёх полях. Реализация ведётся против него, а не против `0.1.0`.

Задача разблокирует `task-infra-003`, которая в своей постановке ожидает появления
backend-реализации.

## Пользовательские сценарии

### Владелец

1. `GET /admin/setup` — проверить состояние onboarding.
2. `PUT /admin/setup` — завершить первоначальную настройку; повторный вызов даёт
   `409 ONBOARDING_ALREADY_COMPLETED`.
3. `GET /admin/settings` / `PUT /admin/settings` — прочитать и полностью заменить
   настройки календаря.
4. `GET /admin/event-types` / `POST /admin/event-types` — получить и создать типы
   событий; создание с уже занятым `id` даёт `409 DUPLICATE_EVENT_TYPE_ID`.
5. `GET /admin/bookings` — единый список предстоящих бронирований всех типов событий.

### Гость

1. `GET /event-types` — публичный список типов событий.
2. `GET /slots?eventTypeId=...` — свободные слоты выбранного типа события в серверном
   14-дневном окне.
3. `POST /bookings` — создать анонимное бронирование с `GuestDetails`. Повторная попытка на тот
   же слот **с другим (или отсутствующим) ключом `id`** даёт `409 SLOT_UNAVAILABLE`; повтор
   **с тем же ключом `id` и эквивалентной нагрузкой** — идемпотентный, он даёт `200` с уже
   созданной бронью, а не ошибку.
4. `GET /calendar` — публичное имя владельца календаря (`displayName`), без обращения к
   `/admin/**`; до завершения onboarding — `400 CALENDAR_NOT_CONFIGURED`.

## Функциональные требования

**FR1.** Заменить smoke-сервер на Express 5 в `apps/api`, сохранив `GET /health` в
точности по контрактной модели `HealthResponse` — ответ ровно `{"status":"ok"}`, без
дополнительных полей (в `task-006` уже была исправлена регрессия с лишним
`uptimeSeconds`; не повторять её).

**FR2.** Реализовать все 12 операций контракта:

| # | operationId | Метод | Маршрут |
|---:|---|---|---|
| 1 | `getHealth` | GET | `/health` |
| 2 | `getAdminSetup` | GET | `/admin/setup` |
| 3 | `completeAdminSetup` | PUT | `/admin/setup` |
| 4 | `getAdminSettings` | GET | `/admin/settings` |
| 5 | `updateAdminSettings` | PUT | `/admin/settings` |
| 6 | `getAdminEventTypes` | GET | `/admin/event-types` |
| 7 | `createAdminEventType` | POST | `/admin/event-types` |
| 8 | `getAdminUpcomingBookings` | GET | `/admin/bookings` |
| 9 | `getPublicCalendar` | GET | `/calendar` |
| 10 | `getPublicEventTypes` | GET | `/event-types` |
| 11 | `getPublicSlots` | GET | `/slots` |
| 12 | `createPublicBooking` | POST | `/bookings` |

**FR3.** Валидировать тело запроса и query-параметры сгенерированными Zod-схемами из
`@minical/backend-contract` (`zSetupRequest`, `zCreateEventTypeRequest`,
`zCreateBookingRequest`/`zCreatePublicBookingBody`, `zGetPublicSlotsQuery` и т.д.) —
не самописными схемами. При нарушении транспортных ограничений — `400
VALIDATION_ERROR` в форме `ErrorResponse` (`{code, message}`). Состав схем задача не выбирает:
после `task-contract-001` схемы `eventTypeId` (`zCreateBookingRequest`, `zGetPublicSlotsQuery`)
отвергают пустую строку (`.min(1)`), а `zAvailabilityRule` — пустой `daysOfWeek` (`.min(1)`), то
есть эти три случая закрываются транспортной границей, а не доменной проверкой.

**FR4.** Отображать доменные ошибки на HTTP-статусы строго по контракту:

| Код ошибки | Статус | На каких операциях (по контракту) |
|---|---|---|
| `VALIDATION_ERROR` | 400 | `completeAdminSetup`, `updateAdminSettings`, `createAdminEventType`, `getPublicSlots`, `createPublicBooking` |
| `CALENDAR_NOT_CONFIGURED` | 400 | `getAdminSettings`, `updateAdminSettings`, `getPublicCalendar`, `getPublicEventTypes`, `getPublicSlots`, `createPublicBooking` |
| `ONBOARDING_ALREADY_COMPLETED` | 409 | `completeAdminSetup` |
| `EVENT_TYPE_NOT_FOUND` | 404 | `getPublicSlots`, `createPublicBooking` |
| `DUPLICATE_EVENT_TYPE_ID` | 409 | `createAdminEventType` |
| `SLOT_UNAVAILABLE` | 409 | `createPublicBooking` |
| `SLOT_OUTSIDE_WINDOW` | 400 | `createPublicBooking` |
| `SLOT_NOT_ALIGNED` | 400 | `createPublicBooking` |
| `DUPLICATE_BOOKING_ID` | 409 | `createPublicBooking` — тот же ключ `id`, но **другая** полезная нагрузка |
| `GUEST_NAME_REQUIRED` | 400 | `createPublicBooking` |
| `GUEST_EMAIL_REQUIRED` | 400 | `createPublicBooking` |

Обратить внимание: `createPublicBooking` (`POST /bookings`) — самая нагруженная операция по
делению статуса между моделями ошибок: под `400` в контракте документированы шесть моделей
(`ValidationError`, `CalendarNotConfigured`, `SlotOutsideWindow`, `SlotNotAligned`,
`GuestNameRequired`, `GuestEmailRequired`), а под `409` — две (`SlotUnavailable`,
`DuplicateBookingId`). Различать их нужно по полю `code` тела ответа, а не по статусу. После
`task-contract-001` она не единственная такая: у `updateAdminSettings` под `400` документированы
`ValidationError` и `CalendarNotConfigured`.

`createPublicBooking` — также единственная операция с **двумя успешными статусами**: `201` —
бронь создана этим запросом, `200` — идемпотентный повтор, в теле ранее созданная бронь, ничего
не создано. Тела совпадают (`Booking`), поэтому различать создание и повтор нужно по статусу, а
не по форме ответа; use-case обязан возвращать это различие вызывающему, а не только `Booking`.

Отдельно зафиксировать нюанс достижимости: `zGuestDetails` в сгенерированной схеме уже
требует `name`/`email` непустыми (`minLength(1)`) и email — по формату (`pattern`) на
транспортной границе. При обычном порядке проверки (сначала transport-валидация Zod,
затем доменные правила) любой запрос с пустым/невалидным `guest.name` или
`guest.email` будет отклонён на границе как `400 VALIDATION_ERROR` раньше, чем
доменный код `GUEST_NAME_REQUIRED`/`GUEST_EMAIL_REQUIRED` будет вычислен. Оба кода
всё равно должны быть реализованы в доменном слое (для полноты маппинга и на случай,
если он вызывается напрямую, в обход HTTP-границы, например из unit-теста), но
acceptance criteria не должны требовать HTTP-сценария, который надёжно доводит запрос
именно до этих двух кодов — этого не позволяет сделать текущая форма
`CreateBookingRequest`. Это наблюдение, а не повод менять контракт в рамках этой
задачи.

**FR5.** In-memory хранилище должно быть спрятано за интерфейсом репозитория
(например, `OwnerRepository`, `EventTypeRepository`, `BookingRepository`), чтобы в
следующей задаче замена на PostgreSQL не переписывала прикладной слой (handlers,
mapping, доменные проверки), а только реализацию репозитория.

**FR6.** Реализовать доменные инварианты, выполнимые без БД (полный список — раздел
10 `docs/domain-model.md`; DB-уровень защиты явно вне scope этой задачи и остаётся за
Database Agent):

| # | Инвариант | В scope этой задачи |
|---|---|---|
| I1 | `CalendarOwner` — singleton | Да — единственная in-memory запись |
| I2 | Booking-интервалы не пересекаются глобально, независимо от EventType | Да, application-уровень; DB exclusion constraint — вне scope |
| I3 | `[startAtUtc, endAtUtc)` — полуоткрытый интервал; соседние интервалы (`10:00–11:00` и `11:00–11:30`) допустимы | Да |
| I4 | `endAtUtc` вычисляется сервером как `startAtUtc + EventType.durationMinutes`, не принимается от клиента | Да |
| I5 | Onboarding выполняется однократно (`ONBOARDING_ALREADY_COMPLETED` при повторе) | Да |
| I6 | Окно — ровно 14 локальных дат владельца `[today, today+13]`, сервер сам вычисляет границы | Да — нужно для `getPublicSlots`/`createPublicBooking` |
| I7 | Слот целиком помещается в рабочий интервал `AvailabilityRule` | Да |
| I8 | Начало слота кратно `slotIntervalMinutes` | Да |
| I9 | Слоты в прошлом (по серверному времени) исключаются | Да |
| I10 | `GET /slots` не резервирует слот (не имеет побочных эффектов) | Да |
| I11 | `EventType.id` уникален в пределах владельца (`DUPLICATE_EVENT_TYPE_ID`) | Да, application-уровень; DB unique constraint — вне scope |
| I12 | `guestName`/`guestEmail` обязательны | Да, application-уровень; DB not null — вне scope |
| I13 | `GuestDetails` — snapshot внутри `Booking`, не отдельная сущность/аккаунт | Да — отражается в форме in-memory записи |
| I14 | Существование `Booking` = подтверждена (в MVP нет статусов) | Да |
| I15 | `Booking.eventTypeName` — snapshot названия `EventType`, зафиксированный в момент создания брони: переименование типа существующие брони не меняет, значение переживает удаление типа. Отдаётся **обеими** booking-операциями из сохранённого значения, а не join'ом с текущими типами | Да — поле обязательное в контракте (`task-contract-001`, Р2) |

**FR7.** Тест покрытия контракта: каждый `operationId` из сгенерированного
`packages/contracts/generated/openapi.yaml` имеет реализованный маршрут в `apps/api`, и
ни один маршрут `apps/api` не выходит за пределы контракта. Образец приёма — уже
работающая проверка route/operation coverage в `tests/contract-validation.test.ts`
(секции 1–2); для backend её нужно завести отдельной проверкой, которая сверяет
реально смонтированные Express-маршруты с тем же списком `expectedOperations`/
`expectedRoutes` (или эквивалентным, полученным из generated OpenAPI), а не дублирует
проверки самого OpenAPI-документа.

**FR8.** Конфигурация через environment: порт сервера — `PORT` (как и в текущем
smoke-сервере); `PUBLIC_WEB_URL` — канонический публичный адрес гостевого
web-клиента, который backend подставляет в обязательное поле `publicUrl` ответов
`CalendarSettingsResponse` (`PUT /admin/setup`, `GET /admin/settings`,
`PUT /admin/settings`; контрактное решение AUDIT.md 8.4, реализовано в R5).
Значения по умолчанию безопасны и позволяют поднять сервер без дополнительной
настройки (для `PUBLIC_WEB_URL` — валидный URL web-сборки клиента по умолчанию,
например `http://localhost:8081`).

## Нефункциональные требования

- TypeScript strict (проект уже собран на `tsconfig.base.json` со `strict: true`).
- Никаких ручных правок generated-файлов (`packages/contracts/generated/**`,
  `packages/backend-contract/src/generated/**`) — правило 6 `AGENTS.md`.
- `npm run typecheck` и `npm test` (корневые скрипты) проходят без изменений своего
  смысла; для backend-тестов завести собственный npm-скрипт в `apps/api/package.json`
  (например, `test`), не ломающий корневой `npm run typecheck --workspaces --if-present`.
- Сервер поднимается одной командой (`npm run dev` или `npm start` в `apps/api`, как и
  сейчас).
- Зависимости (Express 5, тестовый раннер и т.п.) объявляются явно в
  `apps/api/package.json` — в проекте уже была найдена и исправлена (`task-006`)
  ситуация со скрытыми транзитивными зависимостями `yaml` и `@typespec/openapi`;
  повторение этой ошибки для backend-зависимостей недопустимо.

## API impact

`NONE` — задача не меняет `.tsp` и не порождает новый generated diff; она полностью
реализует уже согласованный и захардиненный контракт `002`/`003`/`006`.

## Acceptance criteria

1. Сервер стартует одной командой (`npm start` / `npm run dev` в `apps/api`).
2. `curl http://localhost:<port>/health` возвращает ровно `{"status":"ok"}` — без
   дополнительных полей.
3. Сценарий гостя проходит end-to-end: `GET /event-types` → `GET /slots?eventTypeId=`
   → `POST /bookings` (201) → повторный `POST /bookings` на тот же `startAtUtc`/
   `eventTypeId`. Обе ветви повтора проверяются: **с тем же ключом `id` и эквивалентной
   нагрузкой** → `200` с той же бронью (то же `id`, то же тело); **без ключа или с другим
   ключом** → `409 SLOT_UNAVAILABLE`; **с тем же ключом и изменённой нагрузкой** →
   `409 DUPLICATE_BOOKING_ID`.
4. Онбординг владельца: `PUT /admin/setup` завершает настройку (200); повторный
   `PUT /admin/setup` даёт `409 ONBOARDING_ALREADY_COMPLETED`.
5. Невалидный вход (нарушение транспортных ограничений Zod-схемы — например, пустое
   `eventTypeId` или отсутствующий обязательный `guest`) даёт `400 VALIDATION_ERROR` в
   форме `ErrorResponse`. Оба примера достижимы: `@minLength(1)` на ссылках на `eventTypeId`
   добавлен `task-contract-001` (FR7), поэтому пустая строка отвергается на транспортной
   границе, а не доходит до `404 EVENT_TYPE_NOT_FOUND`.
6. Создание `EventType` с уже существующим `id` даёт `409 DUPLICATE_EVENT_TYPE_ID`.
7. Запрос к операциям, требующим настроенного календаря, до завершения onboarding
   даёт `400 CALENDAR_NOT_CONFIGURED`.
8. Тест покрытия контракта (FR7) проходит: 12/12 операций реализованы, лишних
   маршрутов нет.
9. Ответ `GET /admin/settings` (после завершённого onboarding) содержит валидное
   поле `publicUrl`, равное значению env `PUBLIC_WEB_URL` (или безопасному дефолту
   при отсутствии переменной).
10. `npm run typecheck` и существующий `npm test` (`uispec:validate` guard + contract
    gate-скрипт) проходят без регрессий.

## Non-goals

- PostgreSQL, миграции и exclusion constraint — задача Database Agent.
- Вынесение Slot Engine в `packages/slot-engine` как отдельного переиспользуемого
  модуля с полным набором доменных тестов (сейчас `packages/slot-engine` — пустой
  placeholder с `.gitkeep`); в этой задаче логика слотов реализуется внутри `apps/api`
  в объёме, необходимом для `getPublicSlots`/`createPublicBooking`.
- Auth, роли, множественные владельцы.
- CORS, security headers, ограничение размера тела запроса — предмет
  `task-infra-003`.
- UI.
- Docker.
- Rate limiting.
- Пагинация ответов-списков (уже принятое ограничение MVP, см.
  `tests/contract-validation.test.ts`, секция «Unbounded arrays»).

## Связанные документы

- [`../../../docs/domain-model.md`](../../../docs/domain-model.md)
- [`../../../docs/domain-rules.md`](../../../docs/domain-rules.md)
- [`../../../docs/contract-pipeline.md`](../../../docs/contract-pipeline.md)
- [`../../../.opencode/agents/backend-agent.md`](../../../.opencode/agents/backend-agent.md)
- [`../../archive/002/`](../../archive/002/)
- [`../../archive/003/`](../../archive/003/)
