# TASK-FRONT-UI-001 — Гостевой UISpec: экраны публичного сценария гостя

## Контекст и проблема

`docs/ui-spec-kit/` описывает только owner-flow: 11 экранов `owner.*`, `navigation.uispec.xml` и `api-bindings.xml` содержат исключительно owner-маршруты и owner-операции. Публичный сценарий гостя (`front-001`) требует 4 экрана — список типов событий, выбор слота, форма гостя, подтверждение бронирования — которых в ките нет. При этом frontend-agent прямо запрещает реализовывать экраны, элементы и navigation-переходы, отсутствующие в UISpec (`.opencode/agents/frontend-agent.md:100-103`), а правка UISpec — изменение согласованной спецификации, которое проходит через task-документы (правило 8 `AGENTS.md`).

Задача закрывает этот разрыв: создаёт гостевую ветку UISpec как источник истины для внешнего вида, состояний и токенов гостевых экранов, чтобы последующая реализация (`front-guest-002…005`) не нарушала правило экранов вне UISpec.

## Цель

Расширить `docs/ui-spec-kit/specs/ui/` гостевой веткой: 4 экрана публичного сценария, guest-стек в navigation, 3 api-binding'а на публичные операции контракта и компонент слота. Только спецификация — реализация в `apps/client` в scope задачи не входит.

## Зависимости

- `002` / `003` / `006` — согласованный контракт: операции `getPublicEventTypes`, `getPublicSlots`, `createPublicBooking` (`packages/contracts/src/operations/public.tsp`) и модели `EventType`, `Slot`, `GuestDetails`, `Booking` (`packages/contracts/src/models/*.tsp`).
- `front-001` — декомпозирована; гостевой scope наследуется на уровне спецификации.

## Пользовательские сценарии

Покрываемые UISpec-экраны соответствуют шагам публичного сценария гостя из `docs/domain-model.md`, §11:

1. Гость открывает клиент и видит список типов событий → экран `guest.event-types`.
2. Гость выбирает тип события и видит свободные слоты → экран `guest.slots`.
3. Гость выбирает слот и заполняет имя, email и заметку → экран `guest.booking-form`.
4. Гость подтверждает бронирование и видит время встречи → экран `guest.booking-confirmation`.
5. При занятом слоте или невалидных данных гость видит ошибку и может исправить данные или вернуться к выбору слота без потери контекста → состояние `error` экрана `guest.booking-form`.

## Функциональные требования

**FR1.** Создать 4 гостевых экрана в `docs/ui-spec-kit/specs/ui/screens/`:

| Файл | id | Содержание |
|---|---|---|
| `12-public-event-types.screen.md` | `guest.event-types` | Список публичных типов событий. Data: `EventType` (`source="api"`, поля строго по контракту). States: loading/empty/content/error. Переиспользование `EventTypeCard`. Действие `selectEventType` → `guest.slots` |
| `13-public-slots.screen.md` | `guest.slots` | Свободные слоты выбранного типа на 14-дневное окно, группировка по датам. Data: `Slot`. States: loading/empty/content/error. Действие `selectSlot` → `guest.booking-form` |
| `14-guest-booking-form.screen.md` | `guest.booking-form` | Имя, email, заметка. Data: `GuestDetails`. Validation (MANUAL §9, не заменяет серверную). States: editing/submitting/error. Действие `createBooking` (`api.command`, `onSuccess` → `guest.booking-confirmation`, `onError` → error). При ошибке форма сохраняет контекст |
| `15-booking-confirmation.screen.md` | `guest.booking-confirmation` | Результат: время встречи (`startAtUtc`/`endAtUtc`) из ответа сервера. Data: `Booking`. States: content/error. Действие `bookAnother` → список |

**FR2.** Обновить `navigation.uispec.xml`: добавить `GuestStack` с маршрутами `GuestEventTypes → GuestSlots → GuestBookingForm → GuestBookingConfirmation`, presentation `screen`. Без нового bottom-tab (MANUAL §13).

**FR3.** Обновить `api-bindings.xml`: добавить guest-привязки `loadPublicEventTypes`, `loadPublicSlots`, `createBooking`.

**FR4.** Создать `slot-item.component.md` и зарегистрировать `<SlotItem>` в `components.registry.xml` (в реестре компонента слота нет).

**FR5.** Data-модели с `source="api"` повторяют поля контракта дословно: `EventType` — `id`, `name`, `description?`, `durationMinutes` (`models/event-type.tsp:4-21`); `Slot` — `startAtUtc`, `endAtUtc`, `eventTypeId`; `GuestDetails` — `name`, `email`, `note?`; `Booking` — `id`, `eventTypeId`, `startAtUtc`, `endAtUtc` (`models/booking.tsp:26-69`).

**FR6.** Валидация набора: `python3 tools/uispec/validate_uispec.py specs/ui` — `Validated 31 files; errors=0` (26 существующих + 4 экрана + 1 компонент).

## Нефункциональные требования

- Спеки соответствуют `MANUAL.md`: flow-layout без абсолютных координат, token references вместо хардкода, обязательные Accessibility-правила (§10), touch target ≥48dp.
- Никаких новых HTTP-маршрутов: `<Action operation="...">` ссылается только на существующие операции контракта (MANUAL §8). Модели с `source="api"` не порождают новый TypeSpec.
- Изменение UISpec — согласованная спецификация: фиксируется в task-документах (правило 8 `AGENTS.md`).
- Существующие 26 спеки не изменяются (правки `navigation.uispec.xml`, `api-bindings.xml`, `components.registry.xml` — аддитивные).

## API impact

`NONE` — `.tsp` и generated-артефакты не меняются; гостевые операции уже существуют в контракте.

## Acceptance criteria

1. `validate_uispec.py` завершается со `Validated 31 files; errors=0`.
2. 4 гостевых экрана валидны; Data-модели `source="api"` соответствуют полям контракта (FR5).
3. `navigation.uispec.xml` содержит guest-стек из 4 маршрутов; третий bottom-tab отсутствует.
4. `api-bindings.xml` содержит 3 guest-привязки.
5. `slot-item.component.md` создан и зарегистрирован в `components.registry.xml`; экраны ссылаются только на зарегистрированные компоненты.
6. Каждый экран объявляет применимые состояния (loading/empty/content/error; для формы — editing/submitting/error + Validation).
7. Ошибки `createPublicBooking` (`SLOT_UNAVAILABLE`, `EVENT_TYPE_NOT_FOUND` и др.) предусмотрены в состоянии `error` формы с сохранением контекста и возвратом к выбору слота.

## Non-goals

- Реализация в `apps/client` — `front-guest-001…006`.
- Owner-UISpec — `front-owner-001`.
- Новые дизайн-макеты и иллюстрации: используются существующие ассеты из `ASSETS.md`, недостающие помечаются `TODO-ASSET`.
- Изменение `.tsp` и generated-пакетов.

## Связанные документы

- [`../../../../docs/ui-spec-kit/README.md`](../../../../docs/ui-spec-kit/README.md)
- [`../../../../docs/ui-spec-kit/MANUAL.md`](../../../../docs/ui-spec-kit/MANUAL.md)
- [`../../../../packages/contracts/src/models/event-type.tsp`](../../../../packages/contracts/src/models/event-type.tsp)
- [`../../../../packages/contracts/src/models/booking.tsp`](../../../../packages/contracts/src/models/booking.tsp)
- [`../../../../packages/contracts/src/operations/public.tsp`](../../../../packages/contracts/src/operations/public.tsp)
- `task-front-001/brief.md` — задача удалена: декомпозирована на front/ui/001 и линейку front/guest (таблица legacy-id в REGISTRY.md)
- [`../../../../.opencode/agents/frontend-agent.md`](../../../../.opencode/agents/frontend-agent.md)
