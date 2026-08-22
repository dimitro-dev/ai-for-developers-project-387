# Результат process/001 — переработка процесса задач

## Итог

Процесс задач переведён на новую механику целиком, за одну задачу:

- каталог `tasks/` реструктурирован: типы-директории (`contract/`, `infra/`, `back/`,
  `front/{ui,guest,owner}/`, `process/`), задачи `<номер>-<слаг>/`, дотиповые `000`–`006` в
  `archive/`, канонический id = путь без слага; 16 задач под управлением, история старых id — в
  legacy-таблице REGISTRY (включая переименования `004`/`005`/`INFRA-001` и декомпозицию
  `front-001`);
- канон состояния задачи — `task.yaml`: гейты со статусами, датами и checksum согласованных
  документов, зависимости, очередь, рабочий контекст (ветка/worktree/MR/uispec); единственный
  писатель — CLI, ручные правки ловятся `selfHash`; документы задач — чистый Markdown без
  frontmatter;
- CLI `tasks/tools/` (TypeScript, без зависимостей кроме `yaml`): status/list/new/approve/draft/
  promote/set/unset/check/registry/repair/init/migrate; конфиг `tasks.config.json` — инструмент
  project-agnostic; 210 тестов на фикстурах + smoke по живому дереву;
- два трека: full (4 гейта) и lite (один `task.md`, гейты setup/result, критерии выбора,
  `promote`); правила — `tasks/flows/{full,lite}.md`, точка входа — `tasks/AGENTS.md`-маршрутизатор;
- `REGISTRY.md` генерируется (`task registry`), свежесть — часть `task check`, который встроен в
  корневой `npm test`;
- роли `.opencode/agents/` растворены во вложенные `AGENTS.md` зон; корневой `AGENTS.md`
  переработан (bootstrap через `task status`, «Навигация», правило прохода вглубь, карта зон);
- скилл `taskmaster` (автоподхват по триггер-фразам, подтверждён живой сессией Claude Code);
  протокол `worktree-isolated-agent` дополнен фиксацией workspace в `task.yaml`;
- `tasks/` включён в git (решение владельца 2026-08-16, ADR §10): `task:check` в CI — настоящий
  гейт; жизненный цикл этой задачи виден в истории коммитов ветки.

Механика обкатана на самой задаче: жизненный цикл process/001 после миграции вёлся только через
CLI, включая живой цикл `draft` → правка → `approve` при поправке ADR §10.

## Что изменено

**В git** (ветка `task/process-001-tasks-rework`, 8 коммитов): `package.json` (скрипты `task*`,
`task:check` в `npm test`), `.gitignore` (минус `/tasks/`; также локальный `.git/info/exclude`),
весь каталог `tasks/` (инструмент, конфиг, шаблоны, flows, AGENTS-маршрутизатор, REGISTRY,
16 мигрированных задач, архив), корневые `AGENTS.md` и `README.md`, `apps/api/AGENTS.md`,
`apps/client/AGENTS.md`, новые `packages/contracts/AGENTS.md`, `packages/database/AGENTS.md`,
`infra/AGENTS.md`, `tests/AGENTS.md`.

**Вне git** (локальные): правки `docs/sources-of-truth.md`, `docs/architecture.md`,
`docs/domain-model.md`, `docs/contract-pipeline.md`, `docs/ui-spec-kit/MANUAL.md`; удалена
`.opencode/agents/`; создан скилл `.opencode/skills/taskmaster/`; дополнен
`worktree-isolated-agent`; удалён `tasks/README.md` (содержимое распределено:
AGENTS/flows/REGISTRY/task.yaml).

Резервная копия дерева до миграции — в scratchpad сессии (`tasks-backup-pre-migrate`).

## Контракт и generated-артефакты

Не затронуты: HTTP-контракт, generated-пакеты и код приложений не менялись
(`generate:check` зелёный).

## База данных и миграции

Не затронуты.

## Выполненные проверки

Полный набор прогнан Sonnet-субагентом 2026-08-16 (протокол — отчёт verify-p23), все зелёные:

| Команда | Результат |
|---|---|
| `npm run contracts:format:check` | зелёный (9 файлов) |
| `npm run generate:check` | зелёный, diff в generated отсутствует |
| `npm run typecheck` | зелёный (4 workspaces) |
| `npm test` | зелёный: uispec:validate + task:check (16 задач, 0 ошибок) + контрактный gate |
| `npm run uispec:validate` | зелёный: 38 файлов, errors=0 |
| `npm test -w @minical/api` | зелёный: 71 тест |
| `npm test -w @minical/client` | зелёный: 23 suites, 192 теста |
| `npm run task:test` | зелёный: 210 тестов, 41 suite, включая smoke по живому дереву |
| `npm run task:typecheck` | зелёный |

Acceptance criteria:

- AC1 ✅ `task status` без id — 6 незавершённых со стадиями; по id и по legacy-id
  (`front-guest-002`) — детальный вывод завершённой задачи.
- AC2 ✅ 16 задач мигрированы, `task check` — 0 ошибок, 0 предупреждений; REGISTRY.md — реестр по
  типам, очередь (14 записей), legacy-таблица (23 записи); старых `tasks/task-*` не осталось.
- AC3 ✅ new/approve/draft/promote покрыты фикстурными тестами; живой эксперимент: ручная правка
  `task.yaml` → `check` красный (selfHash) → `git restore` → зелёный. Каскад `draft` и повторный
  `approve` проверены вживую на самой process/001 (поправка ADR §10).
- AC4 ✅ полный набор зелёный; guard-скрипты сохранены для клонов без `tasks/`.
- AC5 ✅ `task:test` зелёный, smoke не скипается.
- AC6 ✅ скилл `taskmaster` подхвачен живой сессией Claude Code через симлинк `.claude/skills`
  (виден в списке скиллов, description с триггерами); полный прогон автозапуска — в следующей
  сессии.
- AC7 ✅ шесть зональных AGENTS.md на местах, `.opencode/agents/` удалена, корневой AGENTS.md
  переработан.
- AC8 ✅ в живых документах не осталось `tasks/task-` и `tasks/README` (грепы чистые);
  исторические AUDIT/ROADMAP/CHANGELOG/комментарии в коде не тронуты (ADR §6).

## Отклонения от brief / ADR / plan

- ADR §10 (появился по ходу): `tasks/` включён в git — поправка проведена штатным циклом
  `draft` → правка → `approve` с каскадом; NFR2 brief обновлён соответственно.
- P01: встраивание `task:check` в `npm test` перенесено в P14 (до миграции гейт был бы красным
  на старой структуре) — зафиксировано в plan до согласования.
- `legacyId` расширен до «строка или список» (у `infra/001` два исторических id) — уточнение P02
  по итогам ревью.
- Открытый вопрос plan («устойчивость ignore-state-column к ширине колонок») закрыт реализацией:
  строка пункта пересобирается канонически, ширина колонок не влияет.

## Известные ограничения и риски

- CLI — несущее звено процесса: его баг блокирует смену статусов (смягчение: 210 тестов,
  `task repair`, документы остаются читаемым Markdown).
- `docs/` и `.opencode/` по-прежнему вне git: `uispec:validate` в CI скипается. Переезд
  `docs/ui-spec-kit/` в git — согласованная будущая задача (решение владельца 2026-08-16).
- Интерактивный `task init`-визард и вынос инструмента в отдельный пакет — вне scope
  (non-goals brief), путь открыт: инструмент config-driven.
- Полная проверка автозапуска скилла `taskmaster` по триггер-фразам — в первой новой сессии.

## Описание для MR

### Summary

Переработка процесса задач: каталог `tasks/` реструктурирован по типам и включён в git, канон
состояния задач — `task.yaml` с единственным писателем-CLI, два трека жизненного цикла
(full/lite), генерируемый реестр, растворение ролей во вложенные `AGENTS.md`, скилл `taskmaster`.

### Changes

- `tasks/`: CLI-инструмент (`tools/`, 210 тестов), конфиг, шаблоны треков, flows, AGENTS-маршрутизатор,
  REGISTRY.md (генерат), 16 мигрированных задач + архив дотиповых;
- `package.json`: скрипты `task`, `task:check` (встроен в `npm test`), `task:test`, `task:typecheck`;
- `.gitignore`: `tasks/` больше не игнорируется;
- корневой `AGENTS.md`: bootstrap через `task status`, «Навигация», карта зон, блок «Изменяется
  только инструментом»;
- зональные `AGENTS.md`: `apps/api`, `apps/client` дополнены; `packages/contracts`,
  `packages/database`, `infra`, `tests` созданы;
- `README.md`: процесс задач и команды `task*`.

### Verification

Полный набор «Обязательных проверок» зелёный локально (см. «Выполненные проверки»); `task check`:
16 задач, 0 ошибок; `task:test`: 210 тестов. В CI `task:check` выполняется по-настоящему
(tasks/ в клоне), `uispec:validate` штатно скипается (docs/ локальны).

### Known limitations

`docs/` и `.opencode/` остаются вне git (переезд ui-spec-kit — будущая задача); правки локальных
документов процесса в diff этого MR не видны.
