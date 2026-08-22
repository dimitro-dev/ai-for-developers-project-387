# AGENTS.md — MiniCal

Короткая точка входа для новой AI-сессии. Сначала определи активную задачу командой
`scripts/task status`, затем загружай только связанные документы и `AGENTS.md` тех зон,
которые будешь менять.

## Проект

MiniCal — учебный сервис бронирования без регистрации и авторизации:

- единый React Native / React Web клиент (`apps/client/`): Android и web обязательны, iOS проверяется локально на macOS при доступном toolchain;
- REST backend (`apps/api/`) — источник истины для настроек календаря, слотов и бронирований;
- PostgreSQL — постоянное состояние и защита бизнес-инвариантов;
- Docker Compose — локальный runtime (`infra/001`); отдельный Docker builder собирает Android APK (`infra/002`).

## Правила проекта

1. Владелец календаря один; гость не создаёт аккаунт, его данные сохраняются внутри Booking.
2. Не добавляй auth, роли, несколько владельцев или функции вне MVP без отдельной задачи.
3. Пересекающиеся Booking запрещены глобально, в том числе для разных Event Type.
4. Слоты и `endAt` определяет backend; клиент не является источником истины.
5. HTTP-контракт вручную меняется только в `packages/contracts/src/**/*.tsp`.
6. Generated-файлы не редактируются вручную.
7. Вся работа ведётся внутри `tasks/<тип>/<номер>-<слаг>/` по треку `full` или `lite`; состав документов, гейты и команды — в [`tasks/AGENTS.md`](tasks/AGENTS.md).
8. Не меняй согласованные требования или архитектуру скрыто в коде. Верни соответствующий гейт в `черновик` (`scripts/task draft <id> <гейт>`) и обнови зависимые документы.
9. Admin без auth предназначен только для локальной учебной среды.
10. Работай в границах места: в директории со своим `AGENTS.md` действуют его правила — прочитай его до первой правки.
11. Статус `согласовано` ставится только после явного подтверждения пользователя или назначенного reviewer и фиксируется командой `scripts/task approve <id> <гейт>`.
12. Каждый факт имеет один дом: команда — рецепт цели в `Makefile`, остальное — по контракту размещения в [`docs/sources-of-truth.md`](docs/sources-of-truth.md). Повторное упоминание — ссылка, а не пересказ.

## Bootstrap новой сессии

1. Прочитай этот файл.
2. Проверь `git status`, текущую ветку и незавершённые изменения.
3. `scripts/task status [id]` — id из запроса пользователя; без id команда покажет незавершённые задачи, и если активная одна — сразу её. В выводе: трек, стадия, активный гейт, прогресс пунктов, зависимости, workspace.
4. Прочитай [`tasks/AGENTS.md`](tasks/AGENTS.md), если его ещё нет в контексте, затем flow трека задачи: [`flows/full.md`](tasks/flows/full.md) или [`flows/lite.md`](tasks/flows/lite.md).
5. Прочитай документы задачи: full — `brief.md` → `adr.md` → `plan.md` → `result.md`; lite — `task.md`. Активный документ — тот, чей гейт первым стоит в `черновик`; его называет `task status`.
6. Открой `AGENTS.md` зон, которые будешь менять, и только релевантные глобальные документы.
7. Во время реализации веди состояния пунктов в `plan.md` (или чеклисте `task.md`), а выполненное и проверки — в разделе результата. Статусы гейтов меняет только CLI.

Шаги 3–6 выполняет скилл `taskmaster`: `/taskmaster` или автозапуск по триггерам («продолжи задачу», «что по задаче X»).

Новая задача заводится командой `scripts/task new <тип> <слаг> [--lite] [--stub]` — каталог и шаблон разворачивает CLI, вручную `_template/` не копируется. Трек выбирается по критериям в [`flows/lite.md`](tasks/flows/lite.md), утверждает владелец. Что делать дальше по проекту — очередь работ в [`tasks/REGISTRY.md`](tasks/REGISTRY.md).

Правила доставляются по месту: корневой файл описывает только глобальное, остальное — во вложенных `AGENTS.md` (карта в разделе «Зоны и их AGENTS.md»). Зональный файл уточняет корневые правила, а не отменяет их.

## Команды и проверки

Строка команды живёт только в `Makefile` — корневом или зональном. `make help` печатает доступные
цели с описаниями, `make -C <зона> help` — цели зоны, `make` без аргументов делает то же, что
`make help`. CLI задач вызывается напрямую: `scripts/task <команда>`.

Полный набор фазы «Проверка» — одна команда `make gates`; что в неё входит, определено только
рецептом этой цели, и тот же набор выполняет CI. При завершении отдельного пункта плана полный
прогон не нужен — достаточно гейтов затронутой зоны: `make -C <зона> gates`.

## Навигация

`.opencode/`, `CLAUDE.md` и `.mcp.json` не хранятся в git и доступны только в локальной рабочей
копии — ссылки на них работают лишь там. `tasks/` и `docs/` приезжают с клоном.

| Нужно | Открой / запусти |
|---|---|
| Продолжить работу, понять стадию и активный гейт задачи | `scripts/task status [id]` |
| Узнать, какой командой что запускается | `make help`, в зоне — `make -C <зона> help` |
| Правила процесса задач: структура, команды CLI, словарь | [`tasks/AGENTS.md`](tasks/AGENTS.md) |
| Правила трека: документы, гейты, откаты, чек-лист закрытия | [`tasks/flows/full.md`](tasks/flows/full.md), [`tasks/flows/lite.md`](tasks/flows/lite.md) |
| Реестр задач, очередь работ, старые id | [`tasks/REGISTRY.md`](tasks/REGISTRY.md) |
| Завести задачу | критерии трека в [`flows/lite.md`](tasks/flows/lite.md) → `scripts/task new <тип> <слаг>` |
| Изменить onboarding, расписание, Event Type, Slot или Booking | [`docs/domain-rules.md`](docs/domain-rules.md) |
| Спроектировать API, backend, database или QA — сущности, VO, кардинальности, инварианты | [`docs/domain-model.md`](docs/domain-model.md) |
| Работать со структурой репозитория, слоем команд, границами компонентов или runtime | [`docs/architecture.md`](docs/architecture.md) |
| Понять, где чему место, и разрешить конфликт задачи, правил, TypeSpec и реализации | [`docs/sources-of-truth.md`](docs/sources-of-truth.md) |
| Изменить TypeSpec, API или generated packages | [`docs/contract-pipeline.md`](docs/contract-pipeline.md) |
| Реализовать экран owner-flow или guest-flow — внешний вид, состояния, токены | [`docs/ui-spec-kit/README.md`](docs/ui-spec-kit/README.md) и [`MANUAL.md`](docs/ui-spec-kit/MANUAL.md) |
| Узнать требования к окружению, установку и способы запуска | [`README.md`](README.md) |
| Изменить набор routes/операций контракта | [`tests/contract-validation.test.ts`](tests/contract-validation.test.ts) — гейт сверяет их точный список |
| Работать с React Native / Web клиентом | [`apps/client/AGENTS.md`](apps/client/AGENTS.md) |
| Работать над backend — фреймворк, middleware, структура | [`apps/api/AGENTS.md`](apps/api/AGENTS.md) |

## Зоны и их AGENTS.md

Отдельного механизма ролей нет: правила доставляются положением файла. Работаешь в зоне —
прочитай её `AGENTS.md` до первой правки. Зона держит до трёх файлов с фиксированными именами:
`AGENTS.md` — правила, `architecture.md` — устройство, `README.md` — эксплуатация; файл заводится
только при наличии содержимого.

| Зона | Файл | О чём |
|---|---|---|
| `apps/api/` | [`apps/api/AGENTS.md`](apps/api/AGENTS.md) | REST, слои, application logic, Slot Engine |
| `apps/client/` | [`apps/client/AGENTS.md`](apps/client/AGENTS.md) | React Native / Web UI по generated SDK и UISpec |
| `packages/contracts/` | [`packages/contracts/AGENTS.md`](packages/contracts/AGENTS.md) | TypeSpec-контракт и generation pipeline |
| `packages/database/` | [`packages/database/AGENTS.md`](packages/database/AGENTS.md) | PostgreSQL schema, migrations и constraints |
| `infra/` | [`infra/AGENTS.md`](infra/AGENTS.md) | Toolchain, Docker, Compose, CI и Android builder |
| `tests/` | [`tests/AGENTS.md`](tests/AGENTS.md) | Контрактные, доменные, интеграционные и E2E-проверки |
| `tasks/` | [`tasks/AGENTS.md`](tasks/AGENTS.md) | Процесс задач: структура, CLI, треки |

Harness отдельного файла не имеет: он следует этому файлу, lifecycle активной задачи и `AGENTS.md`
тех зон, которые затрагивает. Как скиллы и MCP попадают в сессию — в
[`docs/architecture.md`](docs/architecture.md).

## Generated: read-only

```text
packages/contracts/generated/**
packages/api-client/src/generated/**
packages/backend-contract/src/generated/**
```

## Изменяется только инструментом

Ниже — состояние процесса, а не текст: руками и через Edit не правится, единственный писатель —
`scripts/task`.

```text
tasks/**/task.yaml
tasks/REGISTRY.md
```
