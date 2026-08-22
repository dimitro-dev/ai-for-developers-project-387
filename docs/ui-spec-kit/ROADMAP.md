# Roadmap исправлений UISpec Kit

Источник: [`AUDIT.md`](AUDIT.md) (находки A1–D5, решения — раздел 8). Все развилки закрыты пользователем 2026-08-05 — план готов к пошаговому исполнению.

## Как пользоваться

1. По решению пользователя (2026-08-05) работы R1–R6 выполняются **напрямую, без создания отдельных `tasks/task-<id>/` на каждую** — чтобы не плодить сущности. Прогресс фиксируется прямо в этом файле (отметки у пунктов); обязательные проверки перед фиксацией результата блока сохраняются: набор из `AGENTS.md` + прогон `validate_uispec.py`.
2. Детали каждой находки (суть, последствия, отвергнутые альтернативы) — в `AUDIT.md` по указанным ID; сюда вынесено только «проблема/решение» и состав работ.
3. Порядок обязателен: **R1 → R2 → (R3 ∥ R2) → R4; R5 — после R1; R6 — замыкающий, после остальных.**

```text
R1 (спеки) ──┬──> R2 (инструменты) ──> R4 (git: npm-гейт) ──┐
             ├──> R3 (документация, можно ∥ R2) ─────────────┼──> R6 (сверка невыполненных задач)
             └──> R5 (контракт: publicUrl) ──────────────────┘
```

---

## R1 — Привести спеки к контракту

Границы роли: Frontend Agent (`.opencode/agents/frontend-agent.md`), правки только в `docs/ui-spec-kit/specs/ui/**` + минимальные правки `MANUAL.md`. Зависимости: нет. **Атомарно: словарь операций один — половинная замена оставит кит в худшем состоянии.**

| # | Проблема | Решение |
|---|---|---|
| ✅ 1 (A1) | Все `operation=` используют выдуманный словарь (`OwnerSetup.getState`…), не резолвящийся ни в контракт, ни в SDK | В `bindings/api-bindings.xml` заменить значения на фактические `operationId` по таблице П1 `AUDIT.md`; из всех `<Action>` в экранах удалить inline `operation=` |
| ✅ 2 (B7, C1) | Мёртвый биндинг `OwnerSetup.updateProfile`; `saveProfileSettings` (s09) и `submitEventType` (s10) без биндингов; неиспользуемый `createEventType` | Удалить мёртвые записи; добавить `<Binding action="saveProfileSettings" operation="updateAdminSettings" />` и `<Binding action="submitEventType" operation="createAdminEventType" />` |
| ✅ 3 (B8) | Механизм contract gaps существует только как текст в MANUAL §8 | Создать `bindings/contract-gaps.xml` (формат — раздел 5 `AUDIT.md`): GAP-001 `publicUrl` (status=`accepted`, решение 8.4), GAP-002 `eventTypeTitle` (open, low), GAP-003 PATCH settings (open, low); маркеры `TODO-CONTRACT-GAP(GAP-XXX)` в затронутых экранах |
| ✅ 4 (B1) | Screen 05 ждёт `{bookings, timezone, calendarShareUrl}` — контракт отдаёт голый `Booking[]` | Описать view-model как композицию: `bookings` ← `getAdminUpcomingBookings`, `timezone` и `publicUrl` ← `getAdminSettings`; `onSuccessWhen` переписать под фактическую форму; `shareCalendar` — под маркер GAP-001 до R5 |
| ✅ 5 (B2) | `Booking`/`Guest` помечены `source="api"`, но не совпадают с контрактом (`startAt`≠`startAtUtc`, вложенный `guest`, несуществующий `eventTypeTitle`) | Снять `source="api"`, переименовать в `BookingView`/`GuestView`, добавить секцию маппинга из контрактного `Booking`; `eventTypeTitle` — derived через join `getAdminEventTypes` (id→name) |
| ✅ 6 (B3) | Screen 03: Payload `{profile, availability}` — контракт ждёт плоский `SetupRequest` | Переписать Payload на `{displayName, timeZone, availabilityRules, slotIntervalMinutes}` |
| ✅ 7 (B4) | Screen 10: `title`/`publicId` против контрактных `name`/`id` | Переименовать поля Model/Payload/`bind`-ссылок под `CreateEventTypeRequest` |
| ✅ 8 (B5) | Screens 07/09: `OwnerSettingsDraft` — 3 из 4 полей переименованы, `WorkingInterval` ≠ `AvailabilityRule` | Сблизить имена с контрактом (`timeZone`, `availabilityRules`, `slotIntervalMinutes`, `daysOfWeek`/`startLocal`/`endLocal`), Draft остаётся view-model (client-only `id` интервала), явный маппинг на `SetupRequest` |
| ✅ 9 (B6, critical) | Screen 09 шлёт partial payload — PUT затёр бы `availabilityRules` владельца | Read-modify-write в спеке: загрузка `getAdminSettings` → merge правок → полный `SetupRequest` в `updateAdminSettings` |
| ✅ 10 (C2a, critical) | `openFilters` (s05) ведёт в несуществующий `MeetingFiltersSheet` | Удалить действие `openFilters` и иконку фильтра из header (фичи нет в MVP и макетах) |
| ✅ 11 (C2b) | Route `EventTypesFromSettings` — сирота; s08 ходит в `EventTypes` чужой вкладки | В s08 заменить `target="EventTypes"` → `EventTypesFromSettings` (переход остаётся в SettingsTab) |
| ✅ 12 (C3) | `onSuccess` перегружен: то state-id, то route-id | Разделить на `onSuccessState`/`onSuccessRoute` (+ `onErrorState`) во всех экранах |
| ✅ 13 (C14) | `Property type="FieldError[]"` (s10) без модели — сгенерированный TS не компилируется (подтверждено tsc) | Объявить `Model FieldError {field, message}` в Data s10 |
| ✅ 14 (C11) | Helper-функции (`formatTime`, `groupBookingsByOwnerDate`…) нигде не объявлены | Секция `<Helpers>` в `registry/components.registry.xml`: имя, сигнатура, семантика (полная инвентаризация `{fn(...)}` по спекам) |
| ✅ 15 (C9, частично) | Повторяющиеся литеральные размеры (height=4/72/112) вопреки MANUAL §4 | Добавить токены в `sizes.tokens.xml` (dragHandle, карточки), заменить литералы |
| ✅ 16 | MANUAL §6.4/§8 противоречили бы новым спекам | Минимальная правка: §8 — «operation только через bindings, значение = operationId»; §6.4 — упомянуть `onSuccessState`/`onSuccessRoute` (полная переработка MANUAL — R3) |

Acceptance: `python3 tools/uispec/validate_uispec.py specs/ui` — 0 ошибок (старый валидатор); ручная сверка каждого `operation=` в bindings с П1; ни одного inline `operation=` в экранах (grep).

**✅ R1 выполнен 2026-08-05.** Acceptance пройден: валидатор `Validated 31 files; errors=0`, 0 warnings; grep — ни одного inline `operation=` и ни одного вхождения старого словаря; все 10 операций bindings ⊆ `operationId` контракта (сверено с П1); 16 api-действий экранов ↔ 16 биндингов 1:1. Заметки исполнения:

- введены машиночитаемые атрибуты под будущую V11: `schema=` на `source="api"`-моделях, `from="Схема.поле"` / `derived="true"` на полях view-model, `gap="GAP-XXX"` на затронутых действиях/полях;
- дополнительно исправлены случаи тех же классов, не названные в аудите пофайлово: экран 06 — `EventType source="api"` с `title`/`publicId` против контрактных `name`/`id` (класс B4); экран 08 — `OwnerSettingsSummary source="api"` с derived-полем (класс B2/B5, поле `slotStepMinutes` нигде не использовалось и удалено); экран 02 — `FieldError[]` без модели (класс C14); экран 01 — `$result.completed` против контрактного `onboardingCompleted`; экран 07 — кросс-вкладочный `target="EventTypes"` → `EventTypesFromSettings` (класс C2b);
- скелетоны settings-row в экране 08: литерал 72 заменён токеном `$size.row.settings.height` (= 64) — выровнено с `minHeight` component-спеки settings-row;
- в реестр helpers добавлены новые `toAvailabilityRules` (маппинг WorkingInterval → AvailabilityRule) и `formatAvailabilitySummary` (подпись графика в settings row);
- модели `Weekday`/`WorkingInterval`/`OwnerProfileDraft` продублированы в файлы-потребители (03/04/07) — каждый спек самодостаточен для генератора (класс C14/C15).

## R2 — Инструменты: валидатор, config, дубль скриптов

Границы роли: Frontend Agent. Зависимости: **после R1** (проверки пишутся под новый словарь).

| # | Проблема | Решение |
|---|---|---|
| ✅ 1 (C13) | Валидатор слеп ко всем стыкам: 31/31 OK при битых operation/target/bindings | Реализовать проверки V1–V11 + `--lint` + `--strict` по спецификации П2 `AUDIT.md` (источник операций — line-scan `operationId:` по `packages/contracts/generated/openapi.yaml`, stdlib-only) |
| ✅ 2 (C6) | `uispec.config.json` не читается ни одним скриптом; пути захардкожены | Всем трём скриптам — `--config` (default `uispec.config.json`); новые ключи `navigation`, `contractGaps`, `openapi` |
| ✅ 3 (C6) | `uispec.xsd` — декоративная схема, не подключена ни к чему, проверить нечем | Удалить `specs/ui/schema/uispec.xsd`; проверку `version=` корня — в валидатор; обновить `schema/README.md` |
| ✅ 4 (D2) | Скрипты продублированы байт-в-байт в `.opencode/skills/uispec-generator/scripts/`, синхронизация ручная | Заменить каталог симлинком на `docs/ui-spec-kit/tools/uispec` (паттерн `.claude/skills` уже проверен в проекте) |
| ✅ 5 (C13) | `references/validation-checklist.md` skill'а заявляет несуществующую проверку «operations resolve in TypeSpec» | Переформулировать пункт под реальную V2 («resolve in generated openapi.yaml») |
| ✅ 6 (C15) | Генератор: `unknown`-параметры Action, игнор `default=`, локальные дубли SDK-типов, TSP-фрагмент с висячими ссылками, дубли branded-типов | Пять точечных правок `generate_scaffold.py` (типы Param из атрибута `type`, поддержка `default`, `import type` из `@minical/api-client` для `source="api"`, комментарий о нерезолвящихся ссылках в TSP, общий `uispec-runtime.ts`) |
| ✅ 7 (C10) | Draft-экраны неотличимы от approved для тулинга | `--strict`: draft не получает OK; сводка статусов в выводе (V10) |

Acceptance: новый валидатор — 0 errors на спеках после R1; ловит каждый класс находок на негативных фикстурах (битый binding, чужой operationId, несуществующий route/target, draft при `--strict`, необъявленный тип Property); `generate_scaffold.py` на экранах 05/10/14 даёт компилируемый strict-TS.

**✅ R2 выполнен 2026-08-05.** Acceptance пройден: валидатор на реальном ките `Validated 31 files; errors=0` (0 warnings, `--lint` молчит — повторы токенизированы в R1); негативные фикстуры `tools/uispec/tests/run_tests.py` — 17/17 PASS (по кейсу на каждый класс V1–V11 + version + draft/strict); каркасы 05/10/14 компилируются `tsc --strict` без ошибок (source="api" → `import type` из `@minical/api-client`, view-model — без импорта). Заметки исполнения:

- `--config` получили все три скрипта; `uispec.config.json` пополнен ключами `navigation`, `contractGaps`, `openapi`;
- `--strict` даёт exit 1 при draft-файлах (сейчас их 5: экраны 12–15 и slot-item) — в npm-гейт R4 идёт вызов без `--strict`;
- всем `<Param>` в спеках добавлен атрибут `type=` (новая грамматика: без атрибута параметр остаётся `unknown`);
- симлинк `.opencode/skills/uispec-generator/scripts → ../../../docs/ui-spec-kit/tools/uispec` создан и проверен прогоном через путь скилла;
- при одиночном файле (`validate_uispec.py <file>`) кросс-файловые проверки V5 и «Binding-сирота» из V1 отключаются — они валидны только на полном наборе.

## R3 — Документация кита

Границы роли: Frontend Agent. Зависимости: после R1, можно параллельно с R2.

| # | Проблема | Решение |
|---|---|---|
| ✅ 1 (C4) | MANUAL §6.4 не документирует половину DSL (`navigation.back/reset/tab`, `local.*`-варианты, `onSuccessWhen`, `onError`, `preserveContent`, `disabledWhen`) | Дописать §6.4 до фактической грамматики (инвентаризация по спекам) |
| ✅ 2 (C5) | §6.2 требует `UpcomingMeetingsScreen.*` — генератор именует `OwnerMeetings.*` по route | Привести §6.2 к фактическому поведению генератора (имя = route id) |
| ✅ 3 (D5) | §1 обещает route params/Storybook/Jest-Maestro, которых генератор не делает; skill-references описывают DSL полнее MANUAL | §1 — фактические 3 output'а + roadmap-пометки; skill-references сократить до процесса со ссылкой на MANUAL как единственный канон грамматики |
| ✅ 4 (C12) | `generation-report.md` предписан §12, но не существует и момент создания не определён | Уточнить §12: создаётся при первой реальной генерации экрана, задним числом не создаётся |
| ✅ 5 (C7) | FRAME_MAP покрывает 01–07; `ui-screen-mockups/screens.png` — неучтённый побайтовый дубль | Дополнить FRAME_MAP экранами 08–11 + раздел «guest 12–15: spec-first, без кадров»; удалить `ui-screen-mockups/` |
| ✅ 6 (C8) | Registry-теги `Screen/SafeArea/Stack/Overlay` не используются | `Stack`/`Overlay` — пометка `status="reserved"` (заявлены в MANUAL §5); `Screen`/`SafeArea` — удалить |
| ✅ 7 (D3) | `docs/architecture.md:107` описывает кит только как owner-flow | Дописать guest-ветку в описание `ui-spec-kit/` |

Acceptance: каждая конструкция из спеков находит описание в MANUAL (выборочная сверка); в ките нет файлов-сирот.

**✅ R3 выполнен 2026-08-05.** Acceptance пройден: каждая конструкция спеков описана в MANUAL §6.4 (таблицы kind — 12 позиций и атрибутов — 18 позиций совпадают 1:1 с ACTION_KINDS/ACTION_ATTRS валидатора; выборочная сверка на экранах 10/13/15); файлов-сирот в ките нет. Заметки исполнения:

- MANUAL §1 — фактические outputs генератора (types/tsx/tsp + uispec-runtime.ts), нереализованное помечено «roadmap»; §6.2 — имя файлов = route id (`OwnerMeetings.*`); §12 — generation-report.md создаётся при первой реальной генерации в apps/client/, задним числом не создаётся;
- skill-references сокращены до процесса: uispec-language.md — таблица «вопрос → раздел MANUAL», generation-rules.md — фактический 4-шаговый workflow (python3); SKILL.md избавлен от устаревших обещаний (Storybook/fixtures, inline operation=), включая frontmatter description;
- известное ограничение (задокументировано в MANUAL честно): значения `before`/`after`/`afterWhen`/`onConflict`-хуков (`detectOverwrites`, `markPublicIdTouched`, `generatePublicId`) — свободные метки реализации, валидатором не резолвятся;

- **Отклонение от плана по C8**: аудит ошибочно записал `SafeArea` в неиспользуемые теги — фактически `<SafeArea>` используется в 7 спеках (проверено grep). Удалён только реально мёртвый `Screen`; `SafeArea` оставлена; `Stack`/`Overlay` получили `status="reserved"`;
- FRAME_MAP: на доске `owner-mobile-flow.png` ровно 8 кадров (2×4) — для экранов 08–11 выделенных кадров нет, задокументированы ближайшие родственные кадры без выдуманных соответствий; guest 12–15 — отдельный раздел «spec-first, без кадров»;
- `ui-screen-mockups/` удалён (md5-дубль подтверждён); упоминание в корневом `AGENTS.md` убрано main-сессией (строка дерева каталогов).

## R4 — Процесс в git: npm-гейт

Границы роли: Infrastructure Agent. Зависимости: **после R2** (скрипт зовёт финальный валидатор). **Единственный блок, трогающий отслеживаемые git-файлы** — аккуратное ревью. Решение 8.3 `AUDIT.md`.

| # | Проблема | Решение |
|---|---|---|
| ✅ 1 (D1) | Валидация UISpec не входит ни в один gate; дисциплина держится на памяти агента | В корневой `package.json`: `"uispec:validate": "test ! -d docs/ui-spec-kit || python3 docs/ui-spec-kit/tools/uispec/validate_uispec.py --config docs/ui-spec-kit/uispec.config.json"` + вызов первым шагом в `"test"` |
| ✅ 2 (D1) | «Обязательные проверки» AGENTS.md не знают про UISpec | Пятая строка: `npm run uispec:validate` с пометкой «при изменениях в docs/ui-spec-kit/ или UI-коде apps/client/» |
| ✅ 3 (D2) | Таблица харнессов AGENTS.md не отражает симлинк скриптов из R2 | Добавить строку про симлинк `.opencode/skills/uispec-generator/scripts` |
| ✅ 4 (D1) | Чек-лист шаблона задач не упоминает UISpec-валидацию | Пункт в `tasks/_template/plan.md` (локальный файл) |

Acceptance: `npm test` в рабочей копии гоняет валидатор и падает на нарочно сломанной спеке; `npm test` во временном клоне без `docs/` проходит (skip); `git diff` содержит только `package.json` и `AGENTS.md`.

**✅ R4 выполнен 2026-08-05.** Acceptance пройден: `npm run uispec:validate` → errors=0; `npm test` гоняет валидатор первым шагом и падает на нарочно сломанной спеке (проверено с временной поломкой и откатом); guard `test ! -d docs/ui-spec-kit ||` даёт skip в клоне без docs/; `git diff` — только `package.json` и `AGENTS.md` (плюс локальный `tasks/_template/plan.md`, не в git); `npm run typecheck` зелёный. Правки git-файлов НЕ закоммичены — ждут ревью пользователя (ветка task/infra-004-mock).

## R5 — Контракт: publicUrl

Границы роли: Contract Agent (`.opencode/agents/contract-agent.md`), процесс — `docs/contract-pipeline.md`. Зависимости: после R1 (реестр gaps существует). Решение 8.4 `AUDIT.md`.

| # | Проблема | Решение |
|---|---|---|
| ✅ 1 (GAP-001) | Клиенту неоткуда взять публичный URL календаря для share (экран 05); Android не знает своего web-origin; будущие письма формирует сервер | Поле `publicUrl: url` в `CalendarSettingsResponse` (`packages/contracts/src/models/owner.tsp`) с doc-комментарием «канонический публичный адрес гостевого календаря; сервер берёт из env» |
| ✅ 2 | Generated-артефакты и gate разойдутся с контрактом | `npm run generate` (перегенерация openapi/SDK/Zod), актуализация `tests/contract-validation.test.ts` при необходимости, полный прогон обязательных проверок |
| ✅ 3 | Backend-реализация поля | В скоуп R5 **не входит**: `apps/api` пока smoke-заглушка; зафиксировать в result.md требование `PUBLIC_WEB_URL` env для будущей backend-задачи (и compose `task-infra-001`) |
| ✅ 4 (GAP-001) | Реестр gaps должен отражать выполнение | В `contract-gaps.xml`: GAP-001 → `resolved`, ссылка на задачу; снять маркер с `shareCalendar` в s05 |

Acceptance: `npm run contracts:format:check && npm run generate:check && npm run typecheck && npm test` — зелёные; `publicUrl` виден в `openapi.yaml` и типах SDK.

**✅ R5 выполнен 2026-08-05.** Acceptance пройден: `publicUrl: url` в `CalendarSettingsResponse` (`owner.tsp`), перегенерированы `openapi.yaml` (required + property), типы SDK (`publicUrl: string`) и Zod (`z.url()`); `contracts:format:check`, `npm test`, `typecheck`, `uispec:validate` — зелёные (`generate:check` покажет diff против HEAD до коммита — ожидаемо); GAP-001 → `resolved`, экран 05: `publicUrl` с `from="CalendarSettingsResponse.publicUrl"`, gap-маркер снят; в open остались GAP-002/GAP-003 (low, не блокируют).

**Требование для будущих задач (backend / infra):** значение `publicUrl` backend берёт из env `PUBLIC_WEB_URL` (канонический адрес web-сборки гостевого клиента). Учесть в задаче реализации `apps/api` (сейчас smoke-заглушка) и в Docker Compose `task-infra-001` (проброс переменной).

## R6 — Замыкающая сверка невыполненных задач

Границы роли: Harness (основная сессия, по `AGENTS.md`). Зависимости: **после R1–R5**. Решение пользователя от 2026-08-05 (вторая итерация, см. `AUDIT.md` 8.2-уточнение).

**Проблема.** Все task-документы писались против кита ДО исправлений, а часть из них (`task-front-ui-001`, брифы `front-guest-001`/`front-owner-001`) создана агентом 2026-08-05 12:12–12:17 одним прогоном вне пользовательского lifecycle. После roadmap их содержимое разойдётся с исправленным китом: старый словарь операций, старые формы данных, утверждения об инструментах, которых больше нет.

**Решение — прогон по всем задачам со статусом ≠ «завершена»:**

1. Инвентаризация: реестр `tasks/README.md` + фактические директории `tasks/*` (сверить и сам реестр с директориями).
2. Для каждой незавершённой задачи сверить brief/adr/plan/result с исправленным китом: имена операций (только `operationId`), формы payload/моделей, упоминаемые экраны/routes/компоненты, утверждения о валидаторе/генераторе/схеме имён файлов.
3. Несостыковки исправить в task-документах; спорные места — списком пользователю на решение.
4. Отдельно `task-front-ui-001`: привести документы в честное состояние — result.md должен фиксировать фактическое происхождение работы (агент, 2026-08-05, вне активации) и финальное (после R1) состояние guest-артефактов; решение о статусе задачи — за пользователем.

Acceptance: ни один невыполненный task-документ не ссылается на удалённые/переименованные сущности кита; реестр задач совпадает с директориями; список правок и спорных мест зафиксирован и передан пользователю.

**✅ R6 выполнен 2026-08-05.** Acceptance пройден: grep по всем незавершённым задачам — ни одной ссылки на старый словарь/удалённые сущности (кроме исторических цитат «в исходной редакции» в result.md front-ui-001); реестр `tasks/README.md` совпадает с 19 директориями (`front-001` — задокументированно декомпозирована). Сверено 12 незавершённых задач. Правки: `task-back-001/brief.md` AC9 (состав `npm test`); `task-front-ui-001` — brief FR3, adr п.4/«копии скриптов», plan, result.md переписан в честное состояние (раздел «Происхождение» по D4/8.2 + «Фактическое состояние после R1–R3»). Чистые без правок: 6×front-guest, front-001, front-owner-001 (кроме одного спорного), infra-001/002/003.

**Спорные места — решены пользователем 2026-08-05 (принята рекомендация по всем пунктам), правки применены:**
1. `task-back-001` FR8: добавить env `PUBLIC_WEB_URL` (backend подставляет в `publicUrl` ответов settings/setup) + AC на присутствие `publicUrl` в `GET /admin/settings` — сейчас ни один AC это не покрывает.
2. `task-front-ui-001` adr (обоснование ADR): иллюстрация «owner-экран 06 использует title/publicId» устарела после R1 — переформулировать или оставить как историческую посылку.
3. Статус `task-front-ui-001` (сейчас `черновик` во всех 4 файлах) — приёмка за пользователем (D4/8.2).
4. `task-front-owner-001/brief.md:17`: зависимость «front-ui-задачи owner-ветки (спеки 01–11)» указывает на несуществующие задачи — owner-спеки старше конвенции `task-front-ui-*`.
5. Наблюдение (не разрыв с китом): `front-guest-001` FR2 задаёт base URL через `EXPO_PUBLIC_API_BASE_URL`, а `infra-004/result.md` — через `client.setConfig({ baseUrl })`; совместимо (env → setConfig), но стоит зафиксировать выбор в guest-001.

Итоги применения: (1) FR8 back-001 дополнен `PUBLIC_WEB_URL` + новый AC9 на `publicUrl` в `GET /admin/settings`; (2) иллюстрация в adr front-ui-001 актуализирована («на момент решения… устранено в R1»); (3) все 4 документа front-ui-001 переведены пользователем в `согласовано`, реестр — «завершена»; (4) зависимость в brief front-owner-001 переписана на факт (owner-спеки 01–11 существуют в ките, задачи-владельца нет); (5) FR2 guest-001 уточнён: env → `client.setConfig({ baseUrl })`.
