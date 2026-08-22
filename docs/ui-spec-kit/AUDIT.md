# Аудит UISpec Kit

Дата: 2026-08-05. Охват: `docs/ui-spec-kit/**` (15 экранов, 16 компонентов, 6 файлов токенов, navigation, registry, bindings, schema, 3 Python-инструмента), skill-копия `.opencode/skills/uispec-generator/`, стыковка с TypeSpec-контрактом (`packages/contracts/`), generated SDK (`packages/api-client/`), TypeScript- и generation-пайплайном, процессными документами (`docs/*.md`, `AGENTS.md`, `tasks/`).

## 1. Резюме

**Кит внутренне аккуратен, но полностью оторван от фактического HTTP-контракта, а его валидатор зелёный именно потому, что слеп ко всем местам реальных разрывов.**

Токены, registry и внутренние ссылки состояний выдержаны дисциплинированно: `validate_uispec.py` проходит все 31 файл без единой ошибки и предупреждения. При этом ни одна из 11 operation-ссылок UISpec не совпадает ни с одним артефактом реального контракта (TypeSpec op, `operationId`, функция SDK), как минимум 6 экранов ожидают формы данных, которых API не отдаёт или не принимает, а один экран при честной реализации «по спеку» затёр бы данные владельца. Ни один из этих разрывов не детектируется: валидатор не читает ни контракт, ни navigation, ни bindings, а сам кит не входит ни в один gate проекта.

Всего 30 находок: **3 critical, 11 high, 10 medium, 6 low.**

| Severity | Критерий отнесения |
|---|---|
| critical | Реализация по спеку невозможна, падает или теряет данные |
| high | Реализация разойдётся с контрактом, либо инструмент создаёт ложную уверенность |
| medium | Не блокирует сегодня, но гарантирует дальнейший drift |
| low | Гигиена кита: мёртвые артефакты и пробелы покрытия |

## 2. Методика и охват

Что и против чего сверялось:

- `api-bindings.xml` + inline `operation=` во всех экранах ↔ `packages/contracts/src/operations/*.tsp` ↔ `operationId` в `packages/contracts/generated/openapi.yaml` ↔ экспорт `packages/api-client/src/generated/sdk.gen.ts`;
- модели `source="api"` и `Payload` в спеках ↔ модели `packages/contracts/src/models/*.tsp`;
- `target=` навигационных действий ↔ `navigation.uispec.xml` ↔ `Meta.id` экранов;
- `$`-ссылки ↔ `tokens/*.xml`; теги ↔ `components.registry.xml`; MANUAL.md ↔ фактическая грамматика спеков ↔ skill-references;
- процесс: `AGENTS.md`, `docs/sources-of-truth.md`, `docs/architecture.md`, `docs/contract-pipeline.md`, `tasks/task-front-*`, корневой `package.json`.

Живые прогоны (все выполнены фактически, вывод процитирован):

1. `python3 tools/uispec/validate_uispec.py specs/ui` → `Validated 31 files; errors=0`, 0 warnings. **Это ложно-зелёный сигнал**: см. находки A1, B*, C1–C3, C14.
2. `generate_scaffold.py` на экранах 05, 10, 14 → каркасы созданы.
3. `tsc --strict` по `*.types.generated.ts`: экраны 05 и 14 — чисто; экран 10 — `error TS2304: Cannot find name 'FieldError'` ×3 (сгенерированный код не компилируется, C14).
4. `tsp compile --no-emit` по `*.models.generated.tsp`: 10 и 14 — успешно; 05 — ошибка на `bookings: Booking[]` (висячая ссылка на пропущенную `source="api"`-модель, C15).

## 3. Сводная таблица находок

| ID | Название | Severity | Задача |
|---|---|---|---|
| A1 | Выдуманный словарь операций не совпадает с контрактом | critical | R1 |
| B1 | Screen 05 ждёт обёртку ответа, контракт отдаёт `Booking[]` | high | R1 |
| B2 | UISpec `Booking`/`Guest` ≠ контрактные `Booking`/`GuestDetails` | high | R1 |
| B3 | Screen 03: вложенный Payload vs плоский `SetupRequest` | high | R1 |
| B4 | Screen 10: `title`/`publicId` vs `name`/`id` контракта | high | R1 |
| B5 | Screens 07/09: `OwnerSettingsDraft` ≠ `SetupRequest` | high | R1 |
| B6 | Screen 09: partial payload при PUT = full replace | critical | R1 |
| B7 | Мёртвый биндинг `OwnerSetup.updateProfile` | high | R1 |
| B8 | Механизм contract gaps предписан, но не существует | high | R1 |
| C1 | bindings ⇄ inline-операции рассинхронизированы | high | R1 |
| C2a | `target="MeetingFiltersSheet"` — route и экран не существуют | critical | R1 |
| C2b | Route `EventTypesFromSettings` — сирота | medium | R1 |
| C3 | `onSuccess` перегружен: то state-id, то route-id | medium | R1 |
| C4 | MANUAL не документирует половину используемого DSL | medium | R3 |
| C5 | Схема имён файлов: MANUAL ≠ генератор | medium | R3 |
| C6 | `uispec.config.json` и `uispec.xsd` мертвы | low | R2 |
| C7 | FRAME_MAP покрывает 7 из 15 экранов; дубль PNG | low | R3 |
| C8 | Мёртвые registry-теги `Screen/SafeArea/Stack/Overlay` | low | R3 |
| C9 | Правило «повторяющиеся размеры → токены» не соблюдается и не проверяется | low | R2 |
| C10 | Guest-экраны `draft` проходят пайплайн наравне с `approved` | low | R2 |
| C11 | Helper-функции нигде не объявлены | medium | R1/R2 |
| C12 | `generation-report.md` предписан, не существует | low | R3 |
| C13 | Валидатор слеп ко всем стыкам; skill-checklist заявляет несуществующую проверку | high | R2 |
| C14 | Необъявленные типы (`FieldError`) → сгенерированный TS не компилируется | high | R1+R2 |
| C15 | Зрелость генератора: `unknown`-параметры, игнор `default`, дубли SDK-типов, некомпилируемый TSP-фрагмент | medium | R2 |
| D1 | Валидация UISpec не входит ни в один gate | medium | R4 |
| D2 | Дубль скриптов в ките и skill с ручной синхронизацией | high | R2 |
| D3 | `architecture.md` не знает о guest-ветке кита | medium | R3 |
| D4 | `task-front-ui-001`: реализация до согласования | medium | R6 |
| D5 | MANUAL обещает нереализованные outputs; два неидентичных описания DSL | medium | R3 |

## 4. Находки

### Группа A — словарь операций

#### A1. Выдуманный словарь операций не совпадает с контрактом — critical

**Суть и последствия.** Все operation-ссылки кита — `api-bindings.xml` (12 записей) и inline `<Action operation="...">` в экранах — используют namespace-словарь `OwnerSetup.getState`, `OwnerBookings.listUpcoming`, `PublicBookings.create` и т.д. Таких сущностей не существует нигде: контракт объявляет плоские операции (`op getAdminSetup`, `op createPublicBooking`) в едином `namespace MiniCal` без интерфейсов, `operationId` в `generated/openapi.yaml` и имена функций generated SDK (`sdk.gen.ts`) совпадают с ними 1:1. Ни одна строка UISpec-словаря не резолвится ни в один артефакт — соответствие устанавливается только по смыслу, вручную, и ничем не проверяется. Любой агент, реализующий экран «по спеку», не найдёт `OwnerSetup.getState` в SDK и будет вынужден угадывать; UISpec дополнительно использует домен «Owner» там, где контракт говорит «Admin». Полная таблица соответствий — Приложение П1.

**Решение.** Перевести словарь на фактические `operationId`; единственной точкой связи action → operation сделать `api-bindings.xml`; inline `operation=` в экранах запретить (роль человекочитаемого имени уже играет action id: `loadUpcomingMeetings`, `createBooking`). Api-action id становятся глобально уникальными между экранами. Отвергнутые альтернативы: (а) поменять контракт под namespace (`interface OwnerSetup {...}`) — контракт выше UISpec в иерархии истины (`docs/sources-of-truth.md`), правка уходит в зону Contract Agent, перегенерирует SDK/Zod и ломает контрактный gate, который сверяет точный список операций; (б) оставить namespace + добавить таблицу маппинга namespace→operationId — третий словарь и вторая точка синхронизации ради абстракции без потребителя.

**План исправления.**
1. В `api-bindings.xml` заменить значения `operation=` по таблице П1 (10 однозначных замен; `OwnerSetup.updateProfile` — см. B7).
2. Удалить атрибут `operation=` из всех `<Action>` в `specs/ui/screens/*.screen.md`; добавить недостающие биндинги (см. C1).
3. Переписать MANUAL §8: «`<Action kind="api.*">` биндится к операции только через `api-bindings.xml`; значение `operation` — точный `operationId` из `packages/contracts/generated/openapi.yaml`».
4. Закрепить проверками V1–V3 валидатора (см. П2).

Задача: R1 (+ R2 для валидатора).

### Группа B — формы данных и контракт

Принцип решений группы: **если данные в контракте есть, но в другой форме — чинится спек** (переименование либо view-model с явным маппингом, как того уже требует MANUAL §6.5: DTO mapper → ScreenState); **если данных нет в принципе — регистрируется contract gap** (реестр — раздел 5). Правило для `source="api"`: поля модели обязаны совпадать с контрактной схемой точно, иначе маркер снимается и модель объявляется view-model.

#### B1. Screen 05 ждёт обёртку ответа, контракт отдаёт `Booking[]` — high

**Суть и последствия.** `05-upcoming-meetings.screen.md` ожидает `{bookings, timezone, calendarShareUrl}` (`onSuccessWhen="$result.bookings.length == 0:empty..."`), а `getAdminUpcomingBookings` возвращает голый массив `Booking[]`. Реализация по спеку обратится к несуществующему полю ответа.

**Решение.** Не gap, а композиция: `bookings` — из `getAdminUpcomingBookings`, `timezone` — из `getAdminSettings`; `UpcomingMeetingsData` объявляется view-model, собираемой из двух bindings. `calendarShareUrl` — настоящий gap (GAP-001, раздел 5): в контракте нет ни поля, ни публичного base URL. Альтернатива «поменять ответ контракта на обёртку» отвергнута: агрегирование — забота view-слоя, контракт менять из-за удобства одного экрана нельзя.

**План исправления.** 1) В спеке снять `source="api"` с `UpcomingMeetingsData`-обвязки, описать композицию из двух операций; 2) `onSuccessWhen` переписать на `$result.length`-семантику либо на поле view-model; 3) `shareCalendar` пометить `TODO-CONTRACT-GAP(GAP-001)`. Задача: R1.

#### B2. UISpec `Booking`/`Guest` ≠ контрактные `Booking`/`GuestDetails` — high

**Суть и последствия.** В screen 05 модели помечены `source="api"`, но не совпадают с контрактом ни по именам, ни по структуре: `startAt/endAt` vs `startAtUtc/endAtUtc`; вложенный `guest{name,email,comment}` vs плоские `guestName/guestEmail/guestNote`; `eventTypeTitle` в API отсутствует в принципе (контракт отдаёт только `eventTypeId`). Маркер `source="api"` прямо дезинформирует: генератор честно произвёл из него локальные интерфейсы (проверено прогоном), которые не совпадают с типами SDK.

**Решение.** Снять `source="api"`, объявить `BookingView`/`GuestView` view-model'ями с явной секцией маппинга из контрактного `Booking`. `eventTypeTitle` достижим client-side join'ом (`getAdminEventTypes` → словарь id→name) — фиксируется как derived-поле с документированным источником; параллельно необязательный GAP-002 (enrichment ответа). Альтернатива «переименовать поля под контракт и оставить source="api"» отвергнута: вложенный `guest` и `eventTypeTitle` всё равно не сойдутся — форма экрана законно отличается от DTO.

**План исправления.** 1) Переименовать модели в `*View`, убрать `source="api"`; 2) добавить маппинг-секцию (source-поле контракта для каждого view-поля); 3) `eventTypeTitle` описать как join; 4) зарегистрировать GAP-002. Задача: R1.

#### B3. Screen 03: вложенный Payload vs плоский `SetupRequest` — high

**Суть и последствия.** `completeSetup` шлёт `{profile: {...}, availability: {...}}`, а `completeAdminSetup` принимает плоский `SetupRequest {displayName, timeZone, availabilityRules, slotIntervalMinutes}`. Запрос по спеку не пройдёт Zod-валидацию backend.

**Решение.** Чистое переименование/переформатирование Payload в спеке под `SetupRequest` — все данные у экрана есть, меняется только форма.

**План исправления.** Переписать `<Payload>` в `03-onboarding-working-hours.screen.md` на плоские контрактные поля. Задача: R1.

#### B4. Screen 10: `title`/`publicId` vs `name`/`id` контракта — high

**Суть и последствия.** Форма `CreateEventTypeDraft {title, description, durationMinutes, publicId}` при контрактном `CreateEventTypeRequest {id, name, description, durationMinutes}`. Два поля из четырёх переименованы без какого-либо маппинга.

**Решение.** Привести имена полей Payload/Model к контрактным (`name`, `id`); русские подписи в UI остаются — это view-слой, контрактными становятся имена данных.

**План исправления.** Переименовать поля в `10-create-event-type.screen.md` (Model, Payload, `bind`-ссылки). Задача: R1.

#### B5. Screens 07/09: `OwnerSettingsDraft` ≠ `SetupRequest` — high

**Суть и последствия.** 3 из 4 полей переименованы (`timezone`↔`timeZone`, `intervals`↔`availabilityRules`, `slotStepMinutes`↔`slotIntervalMinutes`), а `WorkingInterval {id, days, startTime, endTime}` не совпадает по форме с `AvailabilityRule {daysOfWeek, startLocal, endLocal}`.

**Решение.** `OwnerSettingsDraft` остаётся view-model'ю (локальный `id` интервала — законная забота UI: stable key списка), но имена сближаются с контрактом, и добавляется явный маппинг на `SetupRequest`/`CalendarSettingsResponse`.

**План исправления.** 1) Переименовать поля Draft под контракт; 2) описать маппинг `WorkingInterval` ↔ `AvailabilityRule` (id — client-only); 3) обновить `bind`-ссылки в 07 и 09. Задача: R1.

#### B6. Screen 09: partial payload при PUT = full replace — critical

**Суть и последствия.** `saveProfileSettings` шлёт только `{displayName, timezone}`, а `updateAdminSettings` требует полный `SetupRequest`. Реализация «по спеку как есть» либо упадёт на Zod-валидации (нет обязательных полей), либо — при обходе типов — **затрёт `availabilityRules` и `slotIntervalMinutes` владельца**. Это единственная находка с риском потери данных.

**Решение.** Read-modify-write сценарий в спеке: экран загружает текущие настройки (`getAdminSettings`), сливает изменённые поля, отправляет полный `SetupRequest`. Это соответствует семантике контракта (PUT = full replace). PATCH-эндпоинт — необязательный GAP-003, не блокирующий. Альтернатива «добавить PATCH в контракт сейчас» отвергнута: workaround полноценно реализуем, контрактные правки — отдельное решение Contract Agent.

**План исправления.** 1) В `09-owner-profile-settings.screen.md` добавить загрузку настроек в StateMachine (state `loading` уже есть — уточнить источник); 2) Payload описать как полный `SetupRequest`, собранный из текущих настроек + правок; 3) зарегистрировать GAP-003. Задача: R1.

#### B7. Мёртвый биндинг `OwnerSetup.updateProfile` — high

**Суть и последствия.** Запись `<Binding action="saveOwnerProfile" operation="OwnerSetup.updateProfile" />` не соответствует ничему: отдельной операции обновления профиля в контракте нет, а action `saveOwnerProfile` не является api-действием ни в одном экране (в screen 02 `continueOnboarding` — чистая навигация). Мёртвая запись поддерживает иллюзию существующего endpoint'а.

**Решение.** Удалить биндинг. Профиль сохраняется целиком через `completeAdminSetup` (onboarding) или `updateAdminSettings` (настройки) — оба уже покрыты другими биндингами.

**План исправления.** Удалить строку из `api-bindings.xml`. Задача: R1.

#### B8. Механизм contract gaps предписан, но не существует — high

**Суть и последствия.** MANUAL §8 требует: «если operation отсутствует в основном TypeSpec — создать contract-gap»; `sources-of-truth.md` закрепляет то же. Фактически в ките ноль зарегистрированных gaps при ≥6 реальных расхождениях — механизм существует только как текст, без формата, места хранения и проверки. Расхождения копятся молча.

**Решение.** Ввести реестр `specs/ui/bindings/contract-gaps.xml` (тот же XML-стиль, парсится тем же `xml.etree`); в спеках — маркер `TODO-CONTRACT-GAP(GAP-XXX)`; в bindings допускается `<Binding action="..." gap="GAP-XXX" />` вместо `operation=`. Валидатор требует: «либо operation ∈ openapi, либо gap ∈ реестра» (V9). Отвергнуто: markdown-таблица (валидатором не сверить надёжно); ведение gaps в `tasks/` (gap живёт дольше задачи и нужен читателю спека на месте).

**План исправления.** 1) Создать `contract-gaps.xml` с GAP-001…003 (раздел 5); 2) проставить маркеры в затронутых экранах; 3) V9 в валидаторе. Задача: R1 (+R2).

### Группа C — внутренняя согласованность кита

#### C1. bindings ⇄ inline-операции рассинхронизированы — high

**Суть и последствия.** Два action с `operation=` прямо в экранах не имеют записей в `api-bindings.xml` (`saveProfileSettings` в 09, `submitEventType` в 10), а bindings объявляет действия, которых нет среди api-действий экранов (`saveOwnerProfile`, `createEventType` — в экране 10 действие называется `submitEventType`). «Источник истины связи UI↔API» (`sources-of-truth.md`) не покрывает фактическое использование — связь размазана на два места, которые никто не сверяет.

**Решение.** Следствие решения A1: единственная точка связи — bindings, inline запрещён, недостающие записи добавляются, лишние удаляются. Проверка V1 делает рецидив невозможным.

**План исправления.** 1) Добавить `<Binding action="saveProfileSettings" operation="updateAdminSettings" />` и `<Binding action="submitEventType" operation="createAdminEventType" />`; 2) удалить `createEventType` (и `saveOwnerProfile` — B7); 3) удалить inline `operation=` (A1). Задача: R1.

#### C2a. `target="MeetingFiltersSheet"` — route и экран не существуют — critical

**Суть и последствия.** `openFilters` в screen 05 (`kind="navigation.sheet" target="MeetingFiltersSheet"`) ссылается на route, которого нет в `navigation.uispec.xml`, и экран/компонент фильтров не существует ни в каком виде (единственное упоминание во всём ките — этот атрибут). Сгенерированная навигация упадёт в runtime, либо агент молча выдумает экран фильтров — прямо запрещённый MANUAL §13 сценарий.

**Решение.** Решить судьбу фичи явно: либо удалить действие `openFilters` и иконку фильтра из header (фильтров нет в MVP и в макетах отдельного кадра нет), либо описать экран фильтров полноценным `*.screen.md` + route. Рекомендация — удалить: функция не заявлена ни в одной задаче и не входит в MVP.

**План исправления.** 1) Удалить `openFilters` из Actions и `rightActions` header в `05-upcoming-meetings.screen.md`; 2) V4 в валидаторе (targets ↔ navigation). Задача: R1.

#### C2b. Route `EventTypesFromSettings` — сирота — medium

**Суть и последствия.** Route объявлен в `navigation.uispec.xml:21`, но ни один `target=` его не использует: screen 08 ведёт в `EventTypes` — route из чужой вкладки (`MeetingsTab`). Либо кроссировка вкладок работает «в обход» заведённого route, либо это мёртвый артефакт; читатель навигации не может понять, какой вариант задуман.

**Решение.** Выбрать одно: если переход из настроек должен открывать список внутри `SettingsTab` — перевести `target` screen 08 на `EventTypesFromSettings`; если задумана кросс-вкладочная навигация — удалить сироту. Рекомендация — первый вариант (сохраняет контекст вкладки, route уже заведён).

**План исправления.** 1) В `08-owner-settings.screen.md` заменить `target="EventTypes"` → `EventTypesFromSettings` (или удалить route); 2) V5 в валидаторе (route-сироты). Задача: R1.

#### C3. `onSuccess` перегружен: то state-id, то route-id — medium

**Суть и последствия.** В 07 `onSuccess="saved"` — это state; в 03/10/14 `onSuccess="OwnerMeetings"/"EventTypes"/"GuestBookingConfirmation"` — это route. Семантика различается только по совпадению значения с одним из словарей; ни MANUAL, ни валидатор, ни генератор двух случаев не различают. При коллизии имён (state и route с одним id) поведение неопределимо в принципе.

**Решение.** Разделить атрибут: `onSuccessState` и `onSuccessRoute` (симметрично — `onErrorState`). Атрибут самодокументируется, валидатор проверяет каждый по своему словарю (V6), генератор строит разный код (dispatch vs navigate) без эвристик. Отвергнуто: префиксы `state:`/`route:` в одном атрибуте — строковый мини-DSL, требующий парсера и документации; оставить перегрузку + эвристику — коллизия остаётся возможной.

**План исправления.** 1) Переименовать атрибуты во всех экранах (4 использования route-варианта, 1 state-вариант + `onError`); 2) MANUAL §6.4 — описать оба; 3) V6 в валидаторе. Задача: R1 (+R3 для MANUAL).

#### C4. MANUAL не документирует половину используемого DSL — medium

**Суть и последствия.** §6.4 описывает kind'ы `navigation.push/sheet`, `native.share`, `api.query/command`, `local.*` — а спеки реально используют ещё `navigation.back`, `navigation.reset`, `navigation.tab`, `local.dispatch`, `local.submit`, `local.transition`. Атрибуты `onSuccessWhen`, `onError`, `preserveContent`, `disabledWhen`, встречающиеся почти в каждом файле, не упомянуты ни разу. Парадокс: skill-референс (`references/uispec-language.md`) описывает язык полнее, чем канонический MANUAL кита. Агент, работающий строго по MANUAL, не сможет ни валидировать, ни генерировать половину конструкций.

**Решение.** Дописать MANUAL §6.4 до фактической грамматики (все kind'ы + все атрибуты Action с семантикой каждого); skill-references сократить до процесса и ссылки на MANUAL (см. D5). Канон — MANUAL: он лежит рядом со спеками и назван источником в AGENTS.md; skill — артефакт одного харнесса.

**План исправления.** 1) Инвентаризация фактических kind/атрибутов по спекам (grep); 2) переписать §6.4; 3) V7 валидатора закрепляет allowlist. Задача: R3.

#### C5. Схема имён файлов: MANUAL ≠ генератор — medium

**Суть и последствия.** MANUAL §6.2 для экрана `owner.upcoming-meetings` требует `UpcomingMeetingsScreen.generated.tsx`; фактический генератор именует по route id: `OwnerMeetings.generated.tsx` (подтверждено прогоном). Первая же реальная генерация в клиент создаст файлы, противоречащие документации, либо агент начнёт переименовывать вручную.

**Решение.** Привести MANUAL к фактическому поведению генератора (имя = route id): генератор работает, файлов в клиенте ещё нет — менять документацию дешевле, а после устранения route-сироты (C2b) соответствие route↔screen становится 1:1 и правило непротиворечиво.

**План исправления.** Переписать §6.2 с примером `OwnerMeetings.*`. Задача: R3.

#### C6. `uispec.config.json` и `uispec.xsd` мертвы — low

**Суть и последствия.** `uispec.config.json` декларирует пути и targets, но не читается ни одним из трёх скриптов (пути захардкожены, `ui_root` вычисляется эвристикой `target.parent.parent`). `uispec.xsd` — заглушка (корень + `xs:any processContents="lax"`), не подключённая ни к какому коду; проверить её нечем в рамках stdlib (`xml.etree` не умеет XSD). Оба файла изображают конфигурацию и схему, которых нет — читатель кита получает ложное представление о механике.

**Решение.** Config — подключить: все три скрипта получают `--config` (default `uispec.config.json`) и берут из него пути (+ новые ключи `navigation`, `contractGaps`, `openapi`) — ~15 строк, устраняет эвристики; config уже описывает ровно те пути, которые скрипты дублируют. XSD — удалить: один исполняемый источник грамматики (валидатор) честнее двух, из которых один мёртв; содержательное правило (`version` обязателен) переносится в валидатор.

**План исправления.** 1) `--config` в трёх скриптах; 2) удалить `specs/ui/schema/uispec.xsd`, обновить `schema/README.md`; 3) проверку `version` — в валидатор. Задача: R2.

#### C7. FRAME_MAP покрывает 7 из 15 экранов; дубль PNG — low

**Суть и последствия.** `FRAME_MAP.md` сопоставляет кадры только файлам 01–07 (08–15 покрыты одной фразой-оговоркой). `ui-screen-mockups/screens.png` — побайтовый дубль `assets/owner-mobile-flow.png` (md5 совпадает), не упомянутый ни в одном документе: две копии одного макета неизбежно разойдутся при обновлении.

**Решение.** Дополнить FRAME_MAP экранами 08–11 и явным разделом «guest 12–15: reference-фреймов нет, spec-first»; каталог `ui-screen-mockups/` удалить (единственный источник — `specs/ui/assets/`).

**План исправления.** 1) Обновить FRAME_MAP.md; 2) удалить `ui-screen-mockups/`. Задача: R3.

#### C8. Мёртвые registry-теги — low

**Суть и последствия.** `Screen`, `SafeArea`, `Stack`, `Overlay` объявлены в registry, но не используются ни одним спеком. При этом `Stack` и `Overlay` заявлены в MANUAL §5 как flow-layout примитивы — непонятно, резерв это или мусор.

**Решение.** `Stack`/`Overlay` оставить с пометкой `status="reserved"` (согласованы с MANUAL §5); `Screen`/`SafeArea` удалить (нигде не упомянуты).

**План исправления.** Правка `components.registry.xml` (+ атрибут status в грамматику registry). Задача: R3.

#### C9. Правило «повторяющиеся размеры → токены» не соблюдается и не проверяется — low

**Суть и последствия.** MANUAL §4 требует токенизировать повторяющиеся размеры; фактически `height="4"` (drag handle) повторяется в 3 файлах, `height="112"` (EventTypeCard) в 2, `height="72"` трижды в одном экране — литералами, соответствующих токенов в `sizes.tokens.xml` нет. Правило существует только на бумаге; изменение размера потребует ручной правки по всем вхождениям.

**Решение.** Ввести `--lint`-режим валидатора (литерал ≥3 вхождений → WARN «вынеси в токен»), вне основного exit code; токенизировать текущие повторы (`size.dragHandle.height`, `size.card.eventType` и т.п.).

**План исправления.** 1) lint-проверка в валидаторе; 2) добавить токены и заменить литералы. Задача: R2 (+точечные правки спеков в R1).

#### C10. Guest-экраны `draft` проходят пайплайн наравне с `approved` — low

**Суть и последствия.** Экраны 12–15 имеют `status: draft` и не имеют `reference`/`referenceFrames` (в отличие от `approved` 01–11), но ни валидатор, ни генератор статус не читают: черновик неотличим от согласованного спека для всего тулинга.

**Решение.** `--strict`-флаг валидатора: draft-файлы не получают `OK` (печатаются сводкой), генератор предупреждает при генерации из draft. Статусы переводит пользователь — тулинг лишь делает их видимыми.

**План исправления.** V10 в валидаторе + сводка статусов в выводе. Задача: R2.

#### C11. Helper-функции нигде не объявлены — medium

**Суть и последствия.** Спеки вызывают `{formatTime(...)}`, `{formatUtcOffset(...)}`, `{groupBookingsByOwnerDate(...)}` в bind-выражениях — ни реестра, ни сигнатур, ни семантики этих функций нет нигде в ките. Каждый реализующий агент выдумает их заново, по-своему (особенно опасно для `groupBookingsByOwnerDate` — там вся логика группировки по дате в timezone владельца).

**Решение.** Секция `<Helpers>` в `components.registry.xml` (имя, сигнатура, семантика, модуль-владелец); валидатор V8 сверяет вызовы с реестром (WARN).

**План исправления.** 1) Инвентаризация всех `{fn(...)}` по спекам; 2) реестр helpers; 3) V8. Задача: R1 (реестр) + R2 (проверка).

#### C12. `generation-report.md` предписан, не существует — low

**Суть и последствия.** MANUAL §12 требует фиксировать расхождения визуальной сверки в `generation-report.md` — файла нет, формат не задан. Пока генерации в клиент не было, это честно; но правило не говорит, когда и где файл появляется.

**Решение.** Уточнить §12: отчёт создаётся при первой реальной генерации экрана, путь — рядом с генерируемым экраном (или в task-директории); задним числом не создавать.

**План исправления.** Правка MANUAL §12. Задача: R3.

#### C13. Валидатор слеп ко всем стыкам; skill-checklist заявляет несуществующую проверку — high

**Суть и последствия.** `validate_uispec.py` проверяет только внутренности одного файла (XML, теги ↔ registry, `$`-токены, action-ссылки в 6 фиксированных атрибутах, StateView ↔ states, пару accessibility-правил). Он не читает: контракт/openapi (→ A1, B*), `navigation.uispec.xml` (→ C2), `api-bindings.xml` (→ C1), `uispec.config.json`, XSD; не проверяет `onSuccess`/`onSuccessWhen`, типы Property/Field (→ C14), действия внутри псевдо-JSON атрибутов (`rightActions`). Результат «31/31 OK, 0 warnings» создаёт ложную уверенность в согласованности. Отдельно: `references/validation-checklist.md` skill'а заявляет пункт «API operations resolve in TypeSpec or are reported as gaps» — проверку, которой в коде **нет**; агент, доверившийся чек-листу, считает стык проверенным.

**Решение.** Расширить валидатор набором V1–V11 + `--lint` (полная спецификация — Приложение П2). Все проверки на stdlib; источник операций — line-scan `operationId:` по `packages/contracts/generated/openapi.yaml` (файл в git, формат стабилен — эмиттер; парсинг `.tsp` невозможен на stdlib и не нужен: openapi.yaml — его полное машинное представление). Из skill-checklist убрать ложный пункт (после V2 он станет правдой в формулировке «resolve in generated openapi.yaml»).

**План исправления.** 1) Реализовать V1–V11 + lint; 2) негативные фикстуры на каждый класс (сломанный binding, чужой operationId, несуществующий route, draft без strict); 3) поправить checklist. Задача: R2.

#### C14. Необъявленные типы → сгенерированный TS не компилируется — high

**Суть и последствия.** Screen 10 объявляет `<Property name="fieldErrors" type="FieldError[]">` без модели `FieldError` в `Data`. Валидатор типы Property/Field не проверяет (31/31 OK), генератор честно эмитит висячую ссылку: `tsc --strict` даёт `error TS2304: Cannot find name 'FieldError'` ×3 (подтверждено прогоном). Первый же запуск пайплайна «спека → каркас → компиляция» падает.

**Решение.** Двумя слоями: в спеке — объявить модель `FieldError {field, message}` (или заменить тип на существующий); в валидаторе — проверка «каждый не-примитивный тип Property/Field резолвится в Model/Enum файла или в контрактную схему» (часть V11).

**План исправления.** 1) Добавить `FieldError` в Data screen 10; 2) type-resolution проверка в валидаторе. Задача: R1 (спек) + R2 (валидатор).

#### C15. Зрелость генератора — medium

**Суть и последствия.** Подтверждено прогонами: (а) все `Param` действий типизируются как `unknown` (`shareCalendar.url`, `openBooking.bookingId`) — union действий бесполезен для типобезопасного dispatch; (б) `default="true"/"[]"` игнорируется — дефолты состояний теряются; (в) для `source="api"`-моделей генерируются **локальные дубли интерфейсов** вместо импорта типов из `@minical/api-client` — два источника одного типа, расходящиеся при первой правке контракта; (г) TSP-фрагмент screen 05 не компилируется standalone (`Booking[]` — висячая ссылка на пропущенную api-модель): поведение «merge after review» задумано, но нигде не документировано; (д) branded-типы (`UtcDateTime`, `Url`) переобъявляются в каждом файле.

**Решение.** Точечные доработки генератора: типы Param из атрибута `type` (добавить его в грамматику); поддержка `default`; для `source="api"` — `import type {...} from '@minical/api-client'` вместо дубля; в шапку TSP-фрагмента — комментарий о нерезолвящихся ссылках; branded-типы — в общий `uispec-runtime.ts`. Отвергнуто: «дописать генератор до всех обещаний MANUAL §1 (Storybook, Jest/Maestro)» — YAGNI до реальной потребности (см. D5).

**План исправления.** Перечисленные пять правок `generate_scaffold.py` + отражение в MANUAL §7. Задача: R2.

### Группа D — процесс и инфраструктура

#### D1. Валидация UISpec не входит ни в один gate — medium

**Суть и последствия.** «Обязательные проверки» AGENTS.md (`contracts:format:check`, `generate:check`, `typecheck`, `npm test`) не задевают кит вообще; `docs/` вне git, поэтому CI недоступен в принципе. Единственная защита — ручной запуск валидатора и дисциплина агентов; находки A–C прожили в ките незамеченными именно поэтому.

**Решение.** Трёхслойно: 1) корневой npm-скрипт с existence-guard — `"uispec:validate": "test ! -d docs/ui-spec-kit || python3 docs/ui-spec-kit/tools/uispec/validate_uispec.py --config docs/ui-spec-kit/uispec.config.json"` — и включение его шагом в `npm test` (в свежем клоне без `docs/` шаг честно скипается, локально — реально валидирует); 2) пятая строка в «Обязательные проверки» AGENTS.md с пометкой «при изменениях в `docs/ui-spec-kit/` или UI-коде»; 3) пункт в чек-лист `tasks/_template/plan.md`. Git-хук невозможен — файлы не в индексе.

**План исправления.** Правки `package.json`, `AGENTS.md`, `tasks/_template/plan.md` — единственная задача, трогающая отслеживаемые файлы, с аккуратным ревью. Задача: R4 (после R2 — скрипт должен звать финальный валидатор).

#### D2. Дубль скриптов в ките и skill с ручной синхронизацией — high

**Суть и последствия.** `docs/ui-spec-kit/tools/uispec/*.py` и `.opencode/skills/uispec-generator/scripts/*.py` — две байт-в-байт копии, синхронизируемые вручную (так и записано в frontend-agent.md; в task-front-ui-001 правка `$route`-allowlist уже делалась в оба места руками). Первый же забытый второй файл даст два валидатора с разными правилами — и никакой автоматики, которая это заметит.

**Решение.** Симлинк `.opencode/skills/uispec-generator/scripts → ../../docs/ui-spec-kit/tools/uispec` (канон — в ките, рядом со спеками). Паттерн уже проверен в проекте на `.claude/skills → ../.opencode/skills` и описан в AGENTS.md; оба каталога вне git и живут только в локальной копии владельца. Отвергнуто: sync-скрипт/чексум — лишний механизм; «канон + копия с пометкой» — оставляет drift.

**План исправления.** 1) Заменить каталог `scripts/` симлинком; 2) строка про симлинк в таблицу харнессов AGENTS.md (R4). Задача: R2.

#### D3. `architecture.md` не знает о guest-ветке кита — medium

**Суть и последствия.** `docs/architecture.md:107` описывает кит как «UISpec owner-flow…», хотя guest-экраны 12–15, GuestStack и биндинги гостя уже на диске (task-front-ui-001). Читатель архитектуры получает устаревшую картину охвата UISpec.

**Решение.** Дописать guest-ветку в описание кита (файл локальный, фиксация факта правки — в result.md соответствующей задачи).

**План исправления.** Правка `docs/architecture.md`. Задача: R3.

#### D4. `task-front-ui-001`: реализация до согласования — medium

**Суть и последствия.** `plan.md` задачи показывает все пункты `завершено`, `result.md` описывает полностью выполненную работу (guest-экраны, navigation, bindings, registry, правка валидатора), и всё это физически на диске — но `status: черновик` во всех четырёх файлах. По правилу 11 AGENTS.md работа формально не согласована, при этом брифы `front-guest-002…005` уже ссылаются на её результаты. Процессный дефект: следующие задачи строятся на несогласованном фундаменте.

**Решение.** Статусы самостоятельно не трогать (их ставит только пользователь). Вынести пользователю явное решение: принять работу как есть / принять после доработок по итогам этого аудита (R1 существенно правит именно guest-артефакты) / вернуть на переработку. Рекомендация: рассмотреть приёмку после R1, одним решением.

**План исправления.** Решение принято и затем уточнено (8.2): происхождение задачи — выполнение агентом вне активации (подтверждено метками времени, см. 8.2-уточнение); документы задачи приводятся в честное состояние в замыкающей сверке R6, статус — решение пользователя. Задача: R6.

#### D5. MANUAL обещает нереализованные outputs; два неидентичных описания DSL — medium

**Суть и последствия.** MANUAL §1 обещает генерацию route params, Storybook fixtures, Jest/Maestro skeletons — генератор делает три файла (types / tsx-заглушка / tsp-фрагмент). Одновременно skill-references (`uispec-language.md`, `generation-rules.md`) описывают DSL полнее и местами иначе, чем MANUAL. Два неидентичных описания одного языка + обещания, которым тулинг не соответствует, = систематическое введение агентов в заблуждение.

**Решение.** MANUAL — единственный канон грамматики и правил генерации: §1 переписать по фактике (нереализованное — явно пометить как roadmap); skill сократить до процесса (workflow, чек-лист шагов) со ссылкой на MANUAL. Дописывать генератор до обещаний — YAGNI без реальной потребности.

**План исправления.** 1) Переписать MANUAL §1; 2) сократить skill-references до процесса; 3) синхронизировать формулировки checklist (см. C13). Задача: R3.

## 5. Реестр contract gaps (первичное наполнение)

Формат: `specs/ui/bindings/contract-gaps.xml`, записи `<Gap id status screens>` с полями `Missing` / `Workaround` / `Proposal` / `Task`. Статусы: `open → accepted | rejected → resolved`. Валидатор (V9) сверяет маркеры `TODO-CONTRACT-GAP(GAP-XXX)` и `<Binding gap="...">` с реестром и печатает сводку open-gaps.

| ID | Суть | Workaround | Предложение контракту | Блокирует |
|---|---|---|---|---|
| GAP-001 | `calendarShareUrl` (screen 05): в контракте нет ни поля, ни публичного base URL — клиенту неоткуда взять ссылку для share | действие `shareCalendar` помечено gap-маркером, не генерируется | **решено 2026-08-05 (см. 8.4)**: поле `publicUrl: url` в `CalendarSettingsResponse`, значение из env backend — задача R5; статус gap → `accepted` | да — до выполнения R5 |
| GAP-002 | `eventTypeTitle` в списке встреч: API отдаёт только `eventTypeId` | client-side join через `getAdminEventTypes` | enrichment: название event type в ответе bookings | нет (low) |
| GAP-003 | Partial update настроек: контракт поддерживает только PUT = full replace | read-modify-write на клиенте (B6) | опциональный `PATCH /admin/settings` | нет (low) |

## 6. Roadmap исправлений

**Шаг 0 — решения пользователя**: выполнен 2026-08-05, все развилки П3 закрыты (раздел 8). Пошаговый исполняемый план задач — [`ROADMAP.md`](ROADMAP.md).

| Задача | Состав | Роль | Зависимости |
|---|---|---|---|
| R1 — правка спеков | A1 (словарь в bindings, удаление inline `operation=`), B1–B8 (формы, view-models, маппинги, read-modify-write в 09, реестр gaps + маркеры), C1, C2a/C2b, C3 (атрибуты в спеках), C14 (модель `FieldError`), C11 (реестр helpers), минимальные правки MANUAL §6.4/§8 | Frontend/UISpec (напр. `task-front-ui-002`) | — |
| R2 — инструменты | Валидатор V1–V11 + `--lint`/`--strict` + негативные фикстуры, `--config` во всех трёх скриптах, удаление XSD, симлинк вместо дубля скриптов (D2), правка skill-checklist (C13), доработки генератора (C15) | та же | после R1 |
| R3 — документация | MANUAL (§1 outputs→roadmap, §4, §6.2 naming, §6.4 полный DSL, §12), skill-references → процесс (D5), architecture.md (D3), FRAME_MAP + удаление PNG-дубля (C7), чистка registry (C8), §12 (C12) | та же | после R1, ∥ R2 |
| R4 — процесс в git | `package.json` (`uispec:validate` с guard + в `npm test`), AGENTS.md (пятая проверка, строка про симлинк), чек-лист `tasks/_template/plan.md` (D1) | Harness/Infra; **единственная задача с отслеживаемыми файлами** — аккуратное ревью | после R2 |
| R5 — Contract Agent | Реализация **принятого** GAP-001: `publicUrl` в `CalendarSettingsResponse` (решение 8.4) | Contract Agent, процесс по `contract-pipeline.md` | после R1 (реестр gaps создан) |
| R6 — Замыкающая сверка | Прогон по всем незавершённым задачам `tasks/*`: несостыковки их brief/adr/plan/result с исправленным китом (словарь операций, формы данных, сущности); честное состояние документов `task-front-ui-001` (8.2-уточнение) | Harness, основная сессия | после R1–R5 |

Обоснование атомарности R1: словарь операций один — половинная замена оставит кит в худшем состоянии, чем сейчас (два словаря одновременно).

Acceptance R2: новый валидатор даёт 0 errors на спеках после R1 и ловит каждый класс находок на негативных фикстурах.

## 7. Приложения

### П1. Таблица соответствия операций (словарь UISpec → фактический контракт)

| UISpec (bindings/inline) | operationId = функция SDK | HTTP |
|---|---|---|
| `OwnerSetup.getState` | `getAdminSetup` | GET /admin/setup |
| `OwnerSetup.complete` | `completeAdminSetup` | PUT /admin/setup |
| `OwnerSetup.updateProfile` | **нет соответствия** — биндинг мёртвый (B7) | — |
| `OwnerBookings.listUpcoming` | `getAdminUpcomingBookings` | GET /admin/bookings |
| `OwnerEventTypes.list` | `getAdminEventTypes` | GET /admin/event-types |
| `OwnerEventTypes.create` | `createAdminEventType` | POST /admin/event-types |
| `OwnerSettings.get` | `getAdminSettings` | GET /admin/settings |
| `OwnerSettings.replace` | `updateAdminSettings` | PUT /admin/settings |
| `PublicEventTypes.list` | `getPublicEventTypes` | GET /event-types |
| `PublicSlots.list` | `getPublicSlots` | GET /slots |
| `PublicBookings.create` | `createPublicBooking` | POST /bookings |

Операция контракта без UI: `getHealth` (GET /health) — ожидаемо.

### П2. Спецификация проверок валидатора

| # | Проверка | Источник данных | Уровень |
|---|---|---|---|
| V1 | Каждый `Action kind="api.*"` имеет ровно один Binding; каждый `Binding.action` существует; api-action id глобально уникальны | спеки + api-bindings.xml | ERROR |
| V2 | `Binding.operation` ∈ множеству `operationId` | line-scan `operationId:` по `packages/contracts/generated/openapi.yaml` | ERROR |
| V3 | Inline `operation=` в спеках запрещён | спеки | ERROR |
| V4 | `target=` у `navigation.*` резолвится в Route/Tab id | navigation.uispec.xml | ERROR |
| V5 | `Route.screen` существует среди `Meta.id`; route без использований и не initial — сирота | navigation + спеки | ERROR / WARN |
| V6 | `onSuccessState`/`onErrorState` ∈ states экрана; `onSuccessRoute` ∈ routes | спеки + navigation | ERROR |
| V7 | `kind` из allowlist; неизвестный атрибут `<Action>` | грамматика MANUAL | ERROR / WARN |
| V8 | Вызовы `{fn(...)}` ∈ реестру `<Helpers>` | components.registry.xml | WARN |
| V9 | Каждый `TODO-CONTRACT-GAP(GAP-XXX)` и `Binding gap=` имеют запись в реестре; сводка open-gaps | contract-gaps.xml | ERROR + сводка |
| V10 | Сводка `status:` frontmatter; `--strict` не пускает draft в OK | frontmatter | режим |
| V11 | Поля `source="api"`-моделей ⊆ properties контрактной схемы (атрибут `schema="Booking"`); не-примитивные типы Property/Field резолвятся в Model/Enum файла или контрактную схему | openapi.yaml (line-scan `components.schemas`) + спеки | WARN / ERROR |
| lint | Повторяющийся литеральный размер (≥3 вхождений) → «вынеси в токен» | спеки + tokens | WARN, вне exit code |

Сознательно не делается: парсинг `.tsp` (нечем на stdlib; openapi.yaml — полное машинное представление контракта) и XSD-валидация (stdlib не умеет; XSD удаляется, см. C6).

### П3. Открытые вопросы пользователю

**Все четыре вопроса решены пользователем 2026-08-05 — см. раздел 8.**

1. ~~**Словарь операций**: подтвердить переход на `operationId` как единственную схему имён (A1)~~ → решение 8.1.
2. ~~**task-front-ui-001 (D4)**: принять как есть / принять после R1 / вернуть на переработку~~ → решение 8.2.
3. ~~**`npm test`**: включать ли `uispec:validate` (с existence-guard) шагом в корневой `npm test` (R4)~~ → решение 8.3.
4. ~~**GAP-001 (`calendarShareUrl`)**: поле в контракте или клиентская конфигурация base URL~~ → решение 8.4.

## 8. Принятые решения (2026-08-05)

Решения приняты пользователем в сессии brainstorming по вопросам П3. Пошаговый исполняемый план — [`ROADMAP.md`](ROADMAP.md).

### 8.1. Словарь операций: operationId — канон

Принят рекомендованный вариант. `operationId` из `packages/contracts/generated/openapi.yaml` (совпадает 1:1 с именами TypeSpec-операций и функций SDK) — единственная схема имён для связи UISpec ↔ API. `api-bindings.xml` — единственная точка связи action → operation; inline `operation=` в экранах запрещается и удаляется; api-action id глобально уникальны между экранами. Отвергнуты: namespace + таблица маппинга (третий словарь без потребителя); изменение контракта под namespace (масштабные последствия ради косметики UI-слоя).

### 8.2. task-front-ui-001: приёмка после R1

Статусы задачи не трогаются до завершения R1. R1 исправляет в том числе guest-артефакты этой задачи (словарь операций, биндинги, onSuccess); после R1 `result.md` задачи актуализируется фактическим состоянием и пользователь одним решением переводит её в «согласовано». Обоснование: не согласовывать артефакты с известными дефектами и не гонять статусы дважды.

**Уточнение (2026-08-05, вторая итерация).** Проверка происхождения показала: вся директория `tasks/task-front-ui-001/` создана агентом 2026-08-05 12:12–12:16 одним прогоном (brief → adr → plan → result за ~4 минуты, синхронно с guest-экранами 12–15, правками navigation/bindings/валидатора и брифами `front-guest-001`/`front-owner-001` в 12:16–12:17); git-следов нет и быть не может — `tasks/` и `docs/` не отслеживаются. Задача не проходила пользовательский lifecycle вовсе — D4 подтверждена как выполнение целиком вне активации. Решение пересмотрено: отдельного шага приёмки нет; документы задачи приводятся в честное состояние в замыкающей сверке **R6** (см. [`ROADMAP.md`](ROADMAP.md)), решение о статусе — за пользователем. Дополнительно принято: работы R1–R6 выполняются напрямую, без создания task-директорий на каждую (чтобы не плодить сущности), с сохранением обязательных проверок.

### 8.3. npm-гейт: `uispec:validate` включается в `npm test`

В git уходит ~2 строки корневого `package.json`: скрипт `uispec:validate` с existence-guard (`test ! -d docs/ui-spec-kit || python3 …`) и его вызов шагом в `"test"`. Локально каждый `npm test` валидирует UISpec автоматически; в свежем клоне/CI без `docs/` — мгновенный skip (exit 0), python3 не требуется. Сама проверка всегда локальная: ни спеки, ни валидатор в git не попадают. Оформляется задачей R4 (после R2).

### 8.4. GAP-001: канонический share-URL генерирует backend

Принят серверный вариант по образцу Calendly (`scheduling_url`) / Cal.com (`WEBAPP_URL`): поле `publicUrl: url` добавляется в `CalendarSettingsResponse`, значение backend берёт из env деплоя (например `PUBLIC_WEB_URL` в Docker Compose — адрес web-сборки клиента). Обоснование: share-ссылка ведёт на гостевой web-клиент; Android-клиент не может узнать свой web-origin сам; будущие письма/подтверждения формирует сервер — источник должен быть единым. Следствия: GAP-001 → `accepted`; создаётся задача R5 (Contract Agent); экран 05 получает `publicUrl` тем же вызовом `getAdminSettings`, что и `timezone`; до выполнения R5 действие `shareCalendar` остаётся под gap-маркером. Отвергнута клиентская конфигурация: два источника URL (web/Android) и третий для будущих серверных писем.
