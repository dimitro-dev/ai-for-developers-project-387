# front/owner/001 — Экраны владельца

## Контекст и проблема

Owner-flow полностью описан в UISpec-ките (`docs/ui-spec-kit/`): 11 экранов `01–11`, навигация
`SetupCheck → OnboardingStack → OwnerTabs`, привязки действий к операциям контракта в
`api-bindings.xml`. В `apps/client` он не реализован: приложение монтирует только гостевой флоу.
Контракт 0.2.0 покрывает все owner-операции (7 admin-эндпоинтов), backend `back/001` их реализует,
generated SDK и Zod-схемы существуют. Гостевой флоу (`front/guest/001` + `front/guest/002`)
задаёт паттерны: триада Screen/State/View, `runOperation`-usecases, канон ошибок `$error`,
`StateView`/`Repeat`, datetime/forms-хелперы, акцент типа события из `id`.

Спеки owner-флоу приводятся к актуальному контракту и новым макетам задачей `front/ui/003`
(GAP-002, sheets-компоненты, доски `owner-mobile-settings*.png`) — эта задача реализует их
уже в синхронизированном виде, без «осознанных отходов» от буквы спек.

Постановка бывшего `front-002` как текст не существовала — источник требований: спеки `01–11`,
`api-bindings.xml`, `docs/domain-rules.md`, `docs/domain-model.md`.

## Цель

Реализовать в `apps/client` все 11 экранов owner-флоу по UISpec: онбординг (setup check, профиль,
рабочее время), вкладку «Встречи» (список, детали брони, типы событий, создание типа) и вкладку
«Настройки» (сводка, профиль и timezone, рабочее время). Backend — реальный `back/001` (in-memory).

## Зависимости

- `back/001` — REST API всех admin-операций (завершена).
- `front/guest/001` — дизайн-система, generated SDK, канон ошибок, тестовая инфраструктура (завершена).
- `front/ui/003` — синхронизация owner-спек с контрактом 0.2.0, решениями сессии 2026-08-17
  и новыми макетами; реализация не начинается до её завершения.
- Паттерны экранов и уроки — `front/guest/002` (referenced, завершена).

## Пользовательские сценарии

- **A. Первый запуск и онбординг.** Владелец открывает приложение (режим owner), SetupCheck видит
  незавершённый setup и ведёт в онбординг: шаг 1 — имя и timezone, шаг 2 — рабочие интервалы
  (bottom-sheet добавления/редактирования) и шаг слота; submit единым `completeAdminSetup`;
  после успеха — список встреч. Повторный запуск настроенного приложения ведёт сразу в список.
- **B. Просмотр встреч.** Вкладка «Встречи»: предстоящие брони, сгруппированные по датам
  в timezone владельца; pull-to-refresh; пустой список предлагает поделиться публичной ссылкой
  (native share `publicUrl`). Тап по карточке открывает sheet деталей: тип, время, гость.
- **C. Типы событий.** Список типов с акцентным цветом из `id`; создание типа: название, описание,
  длительность, автогенерируемый публичный id; конфликт id показывается ошибкой с сохранением формы.
- **D. Настройки.** Сводка из трёх строк; правка профиля (имя, timezone) и рабочего времени
  (интервалы, шаг слота) — каждая сохраняется полным `SetupRequest` без потери остальных полей;
  повторный вход в типы событий из вкладки.

## Функциональные требования

- **FR1. Точка входа.** `EXPO_PUBLIC_APP_MODE=guest|owner`, по умолчанию `guest`: гостевой флоу
  и текущий web-экспорт не меняют поведения. В режиме `owner` App.tsx монтирует owner-корень.
- **FR2. Навигация.** `SetupCheck → OnboardingStack (2 экрана) → OwnerTabs` (вкладки «Встречи»,
  «Настройки») на `@react-navigation/bottom-tabs` (новая зависимость); ручные param lists по
  образцу `GuestStackParamList`; linking не включается.
- **FR3. Все 11 экранов** реализуются по спекам после `front/ui/003` со всеми состояниями
  (`loading`/`content`/`empty`/`error`/`saving`/`saved`/`submitting` — по спеке экрана).
- **FR4. Bottom-sheets** 04 (рабочие часы: создание и редактирование с префиллом, подтверждение
  перезаписи) и 11 (детали брони) — компоненты родительских экранов, данные пропсами, запросов
  не делают; закрытие — свайп, backdrop, системная «назад».
- **FR5. Данные встреч** — `getAdminUpcomingBookings` + `getAdminSettings` (timezone, `publicUrl`);
  название типа — из `Booking.eventTypeName`, без запроса словаря типов.
- **FR6. Настройки** сохраняются read-modify-write: экран правит свои поля и отправляет полный
  `SetupRequest` с нетронутыми остальными (контракт — full replace, GAP-003 workaround).
- **FR7. Акцент типа события** — цвет детерминированно из `id` через существующий
  `eventTypeAccentIndex`, иконка единая для всех типов (FR4 путь (б) `contract/001`).
- **FR8. Ошибки** — канон `$error`: `toAppError`, словарь owner-сообщений на русском; серверный
  `message` пользователю не показывается; формы при ошибке сохраняются.
- **FR9. Новые компоненты** дизайн-системы и фичи по спекам компонентов кита: BottomNavigation,
  MeetingCard, EventTypeCard, ScheduleCard, SettingsRow, WeekdaySelector, TimeField, BottomSheet,
  ProgressHeader, AnimatedSetupIllustration (placeholder, `TODO-ASSET`), searchable SelectField,
  ConfirmationDialog; `rightActions` в AppHeader. Стили — только токены.
- **FR10. Синхронизация токенов**: значения `apps/client/src/design-system/tokens.ts` приводятся
  к киту после токен-фикса `front/ui/003` (`color.action.primary` dark).

## Нефункциональные требования

- TypeScript strict; web и Android обязательны — owner-флоу проверяется на обеих платформах
  в режиме `owner`; iOS — локально при доступном toolchain.
- Гейты зоны: `npm run typecheck`, `npm test -w @minical/client`, `npm run uispec:validate`;
  `expo export --platform web` собирается.
- Реализация — в изолированном worktree, коммит на пункт плана; экраны — параллельными агентами
  (протокол `worktree-isolated-agent`).

## API impact

`NONE` — контракт, generated-пакеты и backend не меняются.

## Acceptance criteria

- **AC1.** Без `EXPO_PUBLIC_APP_MODE` и с `guest` поведение приложения не отличается от текущего;
  с `owner` открывается SetupCheck.
- **AC2.** Сценарий A проходит против реального `back/001`: онбординг завершается, повторный
  запуск ведёт сразу в список встреч; повторный setup невозможен (экран не предлагает).
- **AC3.** Все 11 экранов соответствуют спекам (валидатор кита зелёный, состояния покрыты);
  расхождений «код против спеки» нет.
- **AC4.** Ошибки backend отображаются по канону: 409 дубль id — у формы типа; `ValidationError`
  и `CalendarNotConfigured` — по спекам экранов; сеть — состояние `error` с retry.
- **AC5.** Список встреч показывает название типа из `Booking.eventTypeName` — запроса
  `getAdminEventTypes` на экране встреч нет.
- **AC6.** После сохранения профиля рабочее время и шаг слота не теряются (и наоборот) —
  проверка read-modify-write против реального API.
- **AC7.** Редактирование интервала открывает sheet с префиллом и заменяет исходный интервал.
- **AC8.** Гостевой флоу не регрессирует: полный jest-гейт клиента зелёный.
- **AC9.** Сквозной прогон owner-флоу зафиксирован на web и Android против `back/001`.

## Non-goals

- Отмена и перенос встреч — вне MVP (`docs/domain-rules.md` §10).
- Редактирование, удаление и архивация типов событий — вне контракта 0.2.0.
- Пагинация списка встреч — принимается как есть для учебного объёма.
- Auth для admin-эндпоинтов — правило 9 корневого `AGENTS.md` (локальная учебная среда).
- Изменение UISpec (только задачами `front-ui`), контракта, backend, гостевого флоу.
- Deep links / linking, e2e-автотесты (отдельные infra-задачи).

## Связанные документы

- [`../../ui/003-owner-uispec-sync/task.md`](../../ui/003-owner-uispec-sync/task.md) — синхронизация спек
- `docs/ui-spec-kit/specs/ui/screens/01…11-*.screen.md`, `navigation/navigation.uispec.xml`,
  `bindings/api-bindings.xml` — источник требований (локальная рабочая копия)
- [`../../guest/002-guest-screens/brief.md`](../../guest/002-guest-screens/brief.md) — структурный аналог и уроки
- [`../../../contract/001-guest-flow-extensions/brief.md`](../../../contract/001-guest-flow-extensions/brief.md) — решение FR4 путь (б), GAP-002
- [`../../../back/001-api-skeleton/brief.md`](../../../back/001-api-skeleton/brief.md) — backend owner-операций
