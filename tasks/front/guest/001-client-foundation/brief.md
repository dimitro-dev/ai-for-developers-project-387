# TASK-FRONT-GUEST-001 — Клиентский фундамент гостевой ветки

## Контекст и проблема

`apps/client` — пустой Expo scaffold без продуктовых экранов. Гостевые экраны описаны декларативно в `docs/ui-spec-kit/` (`task-front-ui-002`: четыре экрана и восемь гостевых компонентов, пересобранные по макету дизайн-отдела), но в клиенте нет базы для их реализации: дизайн-система, конфигурация API, generated SDK-обвязка, маппер ошибок, guest-flow state и навигация.

## Цель

Заложить фундамент гостевой ветки в `apps/client`: дизайн-система по component registry, конфигурация base URL, инициализация `@minical/api-client`, use-cases + DTO→view-model маппинг, единый маппер ошибок в канонический корень `$error`, guest-flow черновик с ключом идемпотентности, гостевая навигация по типизированным route'ам из `front-ui-002` со стаб-экранами, тестовая инфраструктура клиента.

## Зависимости

- `front-ui-002` — гостевые экраны, компоненты и типизированные route-параметры (`guest.event-types`, `guest.slots`, `guest.booking-form`, `guest.booking-confirmation`). `front-ui-001` — историческая база кита: его гостевые спеки заменены.
- `infra-005` — `exports` generated-пакетов, подтверждённые import-специфаеры `@minical/api-client` и обязательный `client.setConfig({ baseUrl })`.
- `infra-004` — Prism-мок на порту `4010` (целевой base URL для разработки).
- Альтернатива моку: реальный API (`back-001`, 12 операций контракта на in-memory хранилище) доступен на `:3001` и открыт для браузера — `Access-Control-Allow-Origin: *` из `infra-003`.

## Пользовательские сценарии

Прямых пользовательских сценариев нет — задача инфраструктурная. Сценарии гостя (каталог → слоты → форма → подтверждение, кадры макета 1–9) реализует `front-guest-002` на этом фундаменте.

## Функциональные требования

- FR1. Дизайн-система по `components.registry.xml` — базовые компоненты и токены, которые использует гостевая ветка: `Text`, `Icon`, `Image`, `Button`, `TextField`, `Header`, `Row`, `Column`, `Center`, `ScrollView`, `Spacer`, `StateView`, `Repeat`, `Skeleton`, `EmptyState`, `ValidationMessage`, `TimezoneLabel`. Восемь гостевых тегов `front-ui-002` — `PublicEventTypeCard`, `DateStrip`, `DateChip`, `SlotGrid`, `SlotItem` (переписан: props `startAtUtc`/`endAtUtc`/`selected`/`onPress`), `InlineAlert`, `BookingSummaryCard`, `ConfirmationDetails` — реализуются в задачах своих экранов; фундамент даёт им основание, а не сами компоненты.
- FR2. Base URL через `EXPO_PUBLIC_API_BASE_URL` (build-time конфигурация Expo), по умолчанию — Prism `http://localhost:4010` (Android-эмулятор — `10.0.2.2`); значение для работы против реального API — `http://localhost:3001`. Значение обязано применяться к generated SDK явно: после `infra-005` экспортируемый `client` создаётся **вовсе без** `baseUrl` (артефакт `baseUrl: 'packages'` устранён), поэтому без `client.setConfig({ baseUrl })` запросы уйдут по относительному адресу. **Открытое решение для `adr.md`:** где живёт вызов `setConfig` (модуль инициализации против bootstrap приложения) и как объявляется зависимость — `apps/client/package.json` пакет `@minical/api-client` в `dependencies` не объявляет, резолв держится на симлинках npm workspaces, и `task-infra-005/result.md` («Известные ограничения», п. 4) относит объявление именно к этой задаче.
- FR3. Init `@minical/api-client` (fetch-клиент) по подтверждённым специфаерам `task-infra-005/result.md` («Точные import-специфаеры»): `client` и функции операций — из корневого входа `@minical/api-client`. Пробники `infra-005` покрывали три операции; `getPublicCalendar` добавлена позже (`contract-001`) и экспортируется тем же корневым входом (`packages/api-client/src/generated/index.ts`). Обращения — только через generated SDK. Пакет bundler-only: из Node ESM и NodeNext-режима `tsc` не импортируется.
- FR4. Use-cases и DTO→view-model маппинг для `getPublicEventTypes`, `getPublicCalendar` (экран каталога делает оба чтения), `getPublicSlots`, `createPublicBooking`. Пятый binding `api-bindings.xml` — `refreshPublicSlots` — использует тот же `getPublicSlots` и отдельного use-case не порождает.
- FR5. Единый маппер ошибок в **канонический корень `$error`** по `MANUAL.md` §6.4: `{code: string | null, message: string | null, transport: boolean}`, где `transport: true` означает, что ответа от сервера не было вовсе (обрыв сети, таймаут, DNS), а `false` — сервер ответил ошибкой. Без поля `transport` состояние «ошибка сети» на экранах недостижимо: его читает ветвь `onErrorWhen` формы брони (`guest.booking-form`); экраны каталога и слотов ветвятся только по `code`. Плюс `code` → человеческий текст для кодов гостевого сценария (`VALIDATION_ERROR`, `CALENDAR_NOT_CONFIGURED`, `EVENT_TYPE_NOT_FOUND`, `SLOT_OUTSIDE_WINDOW`, `SLOT_NOT_ALIGNED`, `SLOT_UNAVAILABLE`, `DUPLICATE_BOOKING_ID`, `GUEST_NAME_REQUIRED`, `GUEST_EMAIL_REQUIRED`) + fallback. Проверять маппер против Prism-мока нельзя: по `task-infra-004/result.md` тела 4xx-ответов мока — плейсхолдеры (`{"code":"string","message":"string"}`), значение `code` не соответствует enum контракта, надёжен только HTTP-статус. Значит покрытие кодов проверяется на фикстурах `ErrorResponse` в коде задачи, а сквозная проверка против мока ограничивается статусами.
- FR6. Гостевая навигация по route'ам из `navigation.uispec.xml` (`GuestStack`), без bottom-tab, с типизированными параметрами:
  - `GuestEventTypes` — без параметров;
  - `GuestSlots` — `eventTypeId: string`, `eventTypeName: string`, `durationMinutes: int32` (обязательные), `eventTypeDescription: string` (опциональный);
  - `GuestBookingForm` — `eventTypeId: string`, `eventTypeName: string`, `startAtUtc: utcDateTime`, `endAtUtc: utcDateTime`;
  - `GuestBookingConfirmation` — `booking: Booking`.

  В этой задаче каждый route ведёт на минимальный стаб-экран из компонентов FR1, отображающий его типизированные параметры; `front-guest-002` заменяет содержимое экранов, не меняя каркас навигации.
- FR7. Guest-flow state: черновик формы гостя (`name`, `email`, `note`) живёт в контейнере ветки, а не в параметрах route — `navigation.back` параметров не несёт, а на web они уезжают в URL и историю браузера, то есть PII. Черновик обязан переживать возврат на экран слотов при конфликте слота. Ключ идемпотентности `CreateBookingRequest.id` — UUID, сгенерированный **до первой попытки** создания брони: повтор после обрыва сети уходит с тем же ключом и той же нагрузкой, иначе сервер не распознает его как повтор. Сущность вне UISpec (грамматика способ хранения состояния не описывает), фундамент для этапов `front-guest-002` — кадры 8 (слот заняли) и 9 (обрыв сети) макета.
- FR8. Тестовая инфраструктура клиента: тестовый раннер и команда `npm test -w @minical/client` появляются в этой задаче; выбор раннера — решение `adr.md` с учётом ограничения FR3 (`@minical/api-client` — bundler-only, из Node ESM и NodeNext-режима `tsc` не импортируется). Проверки AC3 и AC4 выполняются этой инфраструктурой; добавление команды в «Обязательные проверки» `AGENTS.md` — пункт plan.

## Нефункциональные требования

- TypeScript strict, без `any` в новых модулях.
- `npm run typecheck -w @minical/client` и `expo export --platform web` проходят.
- Тесты клиента запускаются одной командой `npm test -w @minical/client` (FR8).
- Никаких ручных правок generated SDK (`packages/api-client/src/generated/**`).

## API impact

`NONE`.

## Acceptance criteria

1. Клиент стартует, навигация вживую открывает четыре гостевых route'а из `front-ui-002` на стаб-экранах с их параметрами (FR6); параметры каждого route типизированы по `navigation.uispec.xml` — передача лишнего или пропуск обязательного ловится компилятором.
2. Запросы идут через generated SDK на base URL из `EXPO_PUBLIC_API_BASE_URL`, применённый явным `client.setConfig`.
3. Маппер ошибок отдаёт форму `$error` с полем `transport` (`MANUAL.md` §6.4) и покрывает все коды гостевого сценария + fallback; покрытие проверяется автотестами на фикстурах `ErrorResponse` (FR8), а не через Prism (см. FR5).
4. Черновик формы гостя и ключ идемпотентности покрыты автотестами (FR8): черновик переживает возврат на экран слотов, повторная попытка отправляет тот же ключ (FR7).
5. `npm run typecheck -w @minical/client`, `npm test -w @minical/client` и `expo export --platform web` проходят.

## Non-goals

- Реализация экранов — `front-guest-002`.
- Изменение UISpec — только через `front-ui` задачи.
- Backend, персистентность, auth.

## Связанные документы

- [`../../ui/002-guest-uispec-rebuild/brief.md`](../../ui/002-guest-uispec-rebuild/brief.md)
- [`../../../infra/005-generated-entrypoints/result.md`](../../../infra/005-generated-entrypoints/result.md)
- [`../../../../docs/ui-spec-kit/MANUAL.md`](../../../../docs/ui-spec-kit/MANUAL.md) — §6.4 (`$error`, `onErrorWhen`)
- [`../../../../docs/ui-spec-kit/specs/ui/registry/components.registry.xml`](../../../../docs/ui-spec-kit/specs/ui/registry/components.registry.xml)
- [`../../../../docs/ui-spec-kit/specs/ui/navigation/navigation.uispec.xml`](../../../../docs/ui-spec-kit/specs/ui/navigation/navigation.uispec.xml)
- [`../../../../docs/ui-spec-kit/specs/ui/bindings/api-bindings.xml`](../../../../docs/ui-spec-kit/specs/ui/bindings/api-bindings.xml)
- `task-front-001/brief.md` — задача удалена: декомпозирована на front/ui/001 и линейку front/guest (таблица legacy-id в REGISTRY.md)
- [`../../../../.opencode/agents/frontend-agent.md`](../../../../.opencode/agents/frontend-agent.md)
