# TASK-INFRA-004 — Contract mock server (Prism)

## Контекст и проблема

`packages/contracts/generated/openapi.yaml` описывает 8 маршрутов и 11 операций контракта MiniCal (`getHealth`, `getPublicEventTypes`, `getPublicSlots`, `createPublicBooking`, `getAdminUpcomingBookings`, `getAdminEventTypes`, `createAdminEventType`, `getAdminSettings`, `updateAdminSettings`, `getAdminSetup`, `completeAdminSetup`). Контракт согласован и проверен: `tests/contract-validation.test.ts` подтверждает наличие всех 11 routes, а `tasks/task-003/plan.md` фиксирует структурную и security-верификацию контракта до начала реализации.

При этом `apps/api` — по-прежнему smoke-сервер на `node:http` (`apps/api/src/server.ts`) с единственным реализованным маршрутом `GET /health`; прикладной backend (Event Type, Slot, Booking) ещё не начат и заведён только как будущая implementation task (`tasks/README.md` фиксирует, что задачи `task-back-*` пока не созданы). Из-за этого клиентская разработка полностью заблокирована готовностью backend — что противоречит цели, заявленной в `docs/contract-pipeline.md`: «Frontend Agent может работать по generated SDK и mock API до готовности backend».

Пробел зафиксирован дважды на верификационном этапе:

- `tasks/task-003/plan.md`, пункт P09 («Mock smoke»): решение — «Pipeline не предоставляет mock сервера — P09 пропущен»;
- `tasks/task-003/result.md`, раздел «Известные ограничения», подраздел «Выявлены в TASK-003»: «Нет mock сервера — проверка P09 пропущена. Для frontend-разработки потребуется отдельная настройка mock.»

Эта задача закрывает именно этот пробел: поднимает mock-сервер поверх уже сгенерированного OpenAPI-документа, не дожидаясь реализации backend.

## Цель

Дать клиентской разработке возможность стартовать до готовности backend: локальный mock-сервер на базе Stoplight Prism, поднятый одной командой из `packages/contracts/generated/openapi.yaml`, отвечает на все 11 операций контракта и отклоняет запросы, которые не соответствуют контракту, вместо того чтобы отвечать на них молча.

## Зависимости

- `task-002` — продуктовый TypeSpec-контракт и generated-артефакты; источник OpenAPI-документа для мока.
- `task-003` — верификация контракта, зафиксировавшая отсутствие mock-сервера как пропущенную проверку (P09) и как известное ограничение.
- `task-006` (contract constraints hardening) — не была формальной зависимостью на момент написания brief (тогда — `черновик`); на момент реализации задача слита в main, и её ограничения (`maxLength` на query-параметре `eventTypeId`, `pattern` на `GuestDetails.email` и др.) уже присутствуют в `generated/openapi.yaml`. Мок наследует их бесплатно — валидация запросов Prism будет применяться и к ним. Ограничений из `task-003` достаточно для acceptance criteria этой задачи.
- Backend implementation task (`task-back-*`, ещё не заведена) мок не заменяет и от неё не зависит — это временная замена реального API на период до готовности backend.

## Пользовательские сценарии

Продуктовых сценариев нет — задача инфраструктурная. Потребители результата:

- разработчик клиента или Frontend Agent запускает мок одной командой и обращается к нему по generated SDK (`@minical/api-client`) вместо реального `apps/api`, не дожидаясь реализации backend;
- QA/Contract Agent использует мок для ручной проверки формы ответов по каждому operationId без поднятия backend;
- после появления реального backend разработчик переключает клиент на `http://localhost:3001` без изменения кода — только конфигурацией base URL.

## Функциональные требования

1. Добавить `@stoplight/prism-cli` в `devDependencies` корневого `package.json` как явную зависимость. В проекте зафиксировано правило: зависимость, используемая напрямую, объявляется явно, а не берётся из транзитивного резолва — так уже исправлялись `yaml` и `@typespec/openapi`. Версия фиксируется в `package-lock.json`.
2. Добавить корневой npm-скрипт, запускающий mock-сервер Prism из `packages/contracts/generated/openapi.yaml` на документированном порту `4010` (порт по умолчанию у Prism; свободен и не конфликтует с уже занятыми `3001` — smoke API, и `8081` — Metro).
3. Мок должен работать в режиме валидации запросов: запрос, не соответствующий контракту (нарушение required-поля, `pattern`, типа данных и т. п.), отклоняется с ошибкой, а не принимается молча с дефолтным mock-ответом. Конкретный флаг/конфигурация Prism, обеспечивающая это поведение, подбирается на этапе `plan.md`.
4. Мок должен отвечать на все 11 операций контракта, перечисленных в «Контексте», включая возможность запросить конкретный не-2xx статус-код ответа, документированный в контракте, штатным механизмом Prism (например, через заголовок предпочитаемого ответа) — для операций с несколькими описанными error-ответами (`createPublicBooking`, `getPublicSlots`, `getPublicEventTypes` и т. д.).
5. Обновить корневой README: команда запуска мока, порт, режим валидации, как переключить клиент между мок-сервером и реальным API (конфигурация base URL generated SDK / переменная окружения — без реализации клиентских экранов, которых сейчас нет).
6. Не ломать существующие команды: `npm run generate`, `npm run generate:check`, `npm run typecheck`, `npm run test`, `npm run build` продолжают проходить без изменений в поведении.

## Нефункциональные требования

- Воспроизводимость: мок поднимается из чистого checkout после `npm ci` одной документированной командой, без ручных шагов и без правки generated-артефактов.
- Версия `@stoplight/prism-cli` зафиксирована в `package-lock.json`.
- Мок не требует backend, PostgreSQL или Docker — работает полностью локально поверх `openapi.yaml`.
- Мок предназначен только для локальной разработки клиента: не используется в CI и не подменяет собой существующие контрактные проверки (`tests/contract-validation.test.ts`, `npm run generate:check`).
- Порт `4010` документируется как занятый мок-сервером наряду с уже документированными `3001` (smoke API, см. корневой README) и `8081` (Metro/`expo start`, порт по умолчанию для установленной версии Expo).

## API impact

`NONE` — TypeSpec-контракт и generated-артефакты не меняются. Задача добавляет инструмент разработки поверх уже сгенерированного `openapi.yaml`, не затрагивая сам контракт.

## Acceptance criteria

1. `npm ci` из чистого checkout, затем документированная команда запуска мока поднимает Prism на порту `4010` без ошибок.
2. `curl http://localhost:4010/event-types` возвращает `200` с телом — JSON-массивом, соответствующим схеме `EventType[]`.
3. `curl "http://localhost:4010/slots?eventTypeId=<любой-id>"` возвращает `200` с телом — JSON-массивом, соответствующим схеме `Slot[]`.
4. `curl -X POST http://localhost:4010/bookings` с телом, нарушающим контракт (например, без обязательного поля `guest.email` либо со значением `guest.email`, не соответствующим `pattern` модели `GuestDetails`), получает ответ с кодом ошибки (4xx), а не дефолтный mock-ответ `201`. Обязательные поля `CreateBookingRequest` — `eventTypeId`, `startAtUtc`, `guest`; контактные данные вложены в объект `guest` (модель `GuestDetails`), отдельного поля `guestDetails` в контракте нет.
5. Хотя бы одна операция с несколькими документированными error-ответами (например, `createPublicBooking` → `404 EventTypeNotFound`, либо `getPublicSlots` → `400 ValidationError`) успешно возвращает конкретный запрошенный клиентом не-2xx статус через штатный механизм Prism.
6. Все 11 operationId контракта доступны через мок; проверка зафиксирована в `result.md` (например, серией smoke-запросов к каждому маршруту).
7. После добавления мока команды `npm run generate`, `npm run generate:check`, `npm run typecheck`, `npm run test`, `npm run build` проходят так же, как до изменения, без новых ошибок.
8. Корневой README описывает команду запуска, порт `4010`, режим валидации запросов и способ переключения клиента между моком и реальным API.

## Non-goals

- реализация прикладного backend (Event Type, Slot, Booking) — отдельная будущая implementation task (`task-back-*`);
- персистентность и любое хранение состояния между запросами мока;
- Slot Engine и его алгоритмика;
- сценарные / E2E-тесты поверх мока;
- использование мока в CI-пайплайне;
- замена или дублирование контрактных проверок из `tests/contract-validation.test.ts` и `npm run generate:check`;
- изменение TypeSpec-контракта или generated-артефактов;
- клиентские экраны и фактическое подключение `apps/client` к SDK — base URL остаётся документированной конфигурацией, а не реализованной фичей.

## Связанные документы

- [`../../../docs/contract-pipeline.md`](../../../docs/contract-pipeline.md)
- [`../../archive/003/plan.md`](../../archive/003/plan.md)
- [`../../archive/003/result.md`](../../archive/003/result.md)
- [`../../../.opencode/agents/infrastructure-agent.md`](../../../.opencode/agents/infrastructure-agent.md)
- [`../../README.md`](../../README.md)
