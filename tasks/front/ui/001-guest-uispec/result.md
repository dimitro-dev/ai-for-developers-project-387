# Результат TASK-FRONT-UI-001

## Происхождение

Директория `tasks/task-front-ui-001/` (brief.md, adr.md, plan.md, result.md) создана агентом 2026-08-05 в промежутке 12:12–12:16 одним непрерывным прогоном (файловые метки: brief 12:12:12, adr 12:15:55, plan 12:16:04, result 12:16:18), синхронно с гостевыми артефактами кита (экраны 12–15, GuestStack, guest-bindings, регистрация SlotItem, правка allowlist валидатора `$route`) и с брифами `task-front-guest-001`/`task-front-owner-001`, созданными тем же прогоном в 12:16–12:17. Работа не проходила пользовательский lifecycle: brief/adr/plan не были согласованы пользователем до того, как физически появился результат — все четыре файла задачи и артефакты кита возникли одновременно, за один прогон.

Установлено при аудите UISpec Kit (`docs/ui-spec-kit/AUDIT.md`, находка D4, уточнение 8.2) и подтверждено повторно при замыкающей сверке R6 по файловым меткам (иных следов нет: `tasks/` и `docs/` не отслеживаются git).

Решение пользователя (AUDIT.md 8.2, вторая итерация): отдельного шага приёмки не вводится; документы задачи приводятся в честное состояние здесь, в R6; статус задачи (`черновик`/`согласовано`) — решение пользователя, не этого документа.

## Фактическое состояние после исправлений кита (R1–R3)

Гостевые артефакты этого прогона попали под общие правки кита наравне с owner-веткой:

- **Словарь операций (R1, AUDIT A1/8.1).** На момент создания `api-bindings.xml` связывал guest-действия с выдуманными именами (`PublicEventTypes.list`, `PublicSlots.list`, `PublicBookings.create` — см. adr.md п.4 в исходной редакции), не резолвящимися ни в контракт, ни в SDK. R1 заменил значения `operation=` на фактические `operationId`: `loadPublicEventTypes` → `getPublicEventTypes`, `loadPublicSlots` → `getPublicSlots`, `createBooking` → `createPublicBooking`. Action id не менялись. Привязка к реальной операции контракта уже выполнена — отдельная задача реализации (`front-guest-*`) для этого не нужна, в отличие от того, что предполагали исходные adr.md/brief.md.
- **Дубль скриптов → symlink (R2, D2).** `.opencode/skills/uispec-generator/scripts` теперь символическая ссылка на `docs/ui-spec-kit/tools/uispec`, а не вторая копия файла. Правка allowlist валидатора (`$route` в списке reference-корней), сделанная в рамках этой задачи, физически сохранилась и подтверждается текущим `validate_uispec.py` — но модель «две копии, синхронизируемые вручную», описанная в исходных adr.md/plan.md/result.md, больше не существует.
- **MANUAL.md документирует `$route.params.*` (R3, C4).** Ограничение «поддержка добавлена в валидатор, но не описана в MANUAL.md» снято: MANUAL §6.4 в текущей редакции прямо называет `$route.params.*` источником `bind`-выражений.
- **Формы данных гостевых моделей не потребовали правок группы B.** `EventType`/`Slot`/`GuestDetails`/`Booking` в экранах 12–15 уже на момент создания повторяли контрактные поля дословно (FR5 выполнен и остаётся верным). Owner-экран `06-event-types.screen.md`, на несовпадение полей которого ссылался ADR при обосновании отдельной гостевой ветки данных, сам был приведён к контрактным `name`/`id` в R1 (класс B4) — конкретная иллюстрация в ADR устарела, хотя решение (гостевые данные буквально по контракту, без owner-соглашений об именовании) не пересматривается.
- **Без изменений.** GuestStack (4 маршрута), 3 guest-binding'а, регистрация `SlotItem` — сохранились без структурных правок; совпадают с записью реестра `tasks/README.md`.

## Итог

`docs/ui-spec-kit/` расширен гостевой веткой публичного сценария: 4 гостевых экрана, guest-стек в navigation, 3 guest-привязки в api-bindings (сейчас — с настоящими `operationId`, после R1) и компонент слота. Набор спек валиден: на момент создания задачи — `Validated 31 files; errors=0` старым (слепым) валидатором; после R2 тот же результат подтверждён новым валидатором с проверками V1–V11. Реализация в `apps/client` не выполнялась (scope — только UISpec).

## Что изменено

Изначально (этим прогоном):

```text
docs/ui-spec-kit/specs/ui/screens/12-public-event-types.screen.md        (новый)
docs/ui-spec-kit/specs/ui/screens/13-public-slots.screen.md              (новый)
docs/ui-spec-kit/specs/ui/screens/14-guest-booking-form.screen.md        (новый)
docs/ui-spec-kit/specs/ui/screens/15-booking-confirmation.screen.md      (новый)
docs/ui-spec-kit/specs/ui/components/slot-item.component.md              (новый)
docs/ui-spec-kit/specs/ui/navigation/navigation.uispec.xml               (+GuestStack: 4 route)
docs/ui-spec-kit/specs/ui/bindings/api-bindings.xml                      (+3 binding, тогда — на выдуманный словарь)
docs/ui-spec-kit/specs/ui/registry/components.registry.xml               (+<SlotItem>)
docs/ui-spec-kit/tools/uispec/validate_uispec.py                         (+$route в allowlist reference-корней)
.opencode/skills/uispec-generator/scripts/validate_uispec.py             (тогда — вторая копия, правилась вручную)

tasks/task-front-ui-001/                                                 (brief, adr, plan, result)
tasks/README.md                                                          (конвенция имён, таблицы front-ui/front-guest/front-owner, front-001 — декомпозирована, план разработки)
tasks/task-front-001/brief.md                                            (Non-goals → task-front-owner-001; пометка о декомпозиции)
```

Позже, вне этой задачи, теми же файлами прошли: R1 (словарь операций в bindings и экранах, `06-event-types.screen.md`), R2 (symlink вместо второй копии `validate_uispec.py`, новый валидатор), R3 (MANUAL.md).

## Контракт и generated-артефакты

Не изменялись этой задачей. API impact `NONE`. Гостевые операции `getPublicEventTypes`/`getPublicSlots`/`createPublicBooking` и модели `EventType`, `Slot`, `GuestDetails`, `Booking` — из существующего контракта `002`/`003`/`006`.

## База данных и миграции

Не затрагивались.

## Выполненные проверки

На момент создания задачи:
```text
cd docs/ui-spec-kit && python3 tools/uispec/validate_uispec.py specs/ui
→ Validated 31 files; errors=0 (без warnings)

python3 tools/uispec/generate_scaffold.py ... (smoke на 12–15 экранах и slot-item)
→ все 5 новых файлов генерируют каркасы без ошибок (во временный каталог, не коммитится)
```

(Проверка `diff` между «двумя копиями» validate_uispec.py из исходной редакции убрана — копий не было уже на момент проверки в этой сверке; актуальность синхронизации теперь гарантирует symlink R2, не diff.)

Корневые контрактные gate (`contracts:format:check`, `generate:check`, `typecheck`, `npm test`) неприменимы: `.tsp` и generated-файлы не менялись, `docs/` и `tasks/` не входят в git.

## Отклонения от brief / ADR / plan

- Единственное отклонение на момент создания: расширен allowlist `validate_uispec.py` корнем `$route`.
- Дополнительно (зафиксировано этой сверкой, R6): исходные adr.md/plan.md описывали правку как «синхронизацию двух копий скрипта» — начиная с R2 это архитектурно неверно (symlink).
- Задача не проходила пользовательский lifecycle до появления результата (см. «Происхождение»).

## Известные ограничения и риски

- Маппинг `EventTypeCard` в гостевом списке (`name → title`, `publicId=""`) — решение на уровне спеки, компонент не дорабатывался; актуально до `front-guest-002`.
- `slot-item` — компонент со `status: draft`; реализация в дизайн-системе выполняется в `front-guest-003`.
- ~~Гостевые экраны используют `$route.params.*`, не описанный в MANUAL.md~~ — снято: MANUAL §6.4 документирует `$route.params.*` после R3.

## Описание для MR

### Summary

Локальное изменение (docs/, tasks/ не в git) — гостевой UISpec публичного сценария для последующей реализации в `front-guest-002…005`. Задача создана вне пользовательского lifecycle (см. «Происхождение»); документы приведены в честное состояние в рамках замыкающей сверки R6.

### Changes

- 4 гостевых экрана + компонент слота в `docs/ui-spec-kit/specs/ui/`.
- Guest-стек в navigation, 3 binding'а (сейчас — на настоящие `operationId`), регистрация SlotItem.
- Расширение allowlist валидатора корнем `$route` (сейчас — единственная копия, доступная через symlink R2).
- Реестр задач: тип `front-ui`, таблицы `front-guest`/`front-owner`, декомпозиция `front-001`.

### Verification

- `validate_uispec.py`: `Validated 31 files; errors=0` (воспроизводимо и на текущем, более строгом валидаторе после R2).
- Smoke `generate_scaffold.py` на 5 новых файлах (на момент создания).

### Known limitations

- UISpec создан без реализации и без визуальной сверки с макетами (гостевых reference PNG в ките нет).
- Часть исходных описаний (словарь операций, синхронизация скриптов, ограничение MANUAL) устарела и актуализирована этой сверкой (R6) — см. «Фактическое состояние после исправлений кита».
