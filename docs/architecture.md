# Архитектура MiniCal

## Архитектурный стиль

На этапе MVP используется модульный монолит. Логические модули разделены в коде, но backend разворачивается одним API-процессом.

```text
React Native / React Web
        │ generated SDK
        ▼
Backend REST API
        │
        ├── owner setup / calendar settings
        ├── event types
        ├── availability / slot engine
        └── bookings
        │
        ▼
PostgreSQL
```

## Компоненты

### Client

Один TypeScript-кодовый контур:

- React Native для Android;
- React Web для публичной страницы и admin UI;
- iOS запускается локально на macOS, если native toolchain доступен.

Клиент отвечает за UI, навигацию и отображение состояний. Он не является источником истины для слотов, `endAt` или занятости.

### Backend API

Backend отвечает за:

- singleton-профиль владельца;
- onboarding и настройки календаря;
- EventType;
- расчёт 14-дневного окна и слотов;
- повторную проверку бронирования;
- вычисление `endAt`;
- преобразование доменных ошибок в HTTP-ответы.

### PostgreSQL

Хранит постоянное состояние и защищает инварианты:

- уникальный публичный `EventType.id`;
- UTC timestamps встреч;
- snapshot данных гостя;
- глобальный запрет пересечения активных бронирований.

Схема, миграции и constraints живут в зоне
[`packages/database/`](../packages/database/AGENTS.md); backend подключается к базе только при
заданной `DATABASE_URL` и иначе работает на in-memory хранилище — режимы описаны
в [`apps/api/README.md`](../apps/api/README.md).

### Contract packages

```text
packages/contracts          TypeSpec и generated OpenAPI
packages/api-client         generated frontend SDK
packages/backend-contract   generated transport types и runtime schemas
```

API DTO, domain model и database schema — три разные модели, отождествлять их нельзя. Одна сущность
проходит цепочку представлений:

```text
CreateBookingRequest  — transport input
BookingCommand        — application command
Booking               — domain entity
bookings row          — persistence record
BookingResponse       — transport output
```

Слои зоны `apps/api/`, разводящие эти представления по каталогам, — в
[`apps/api/architecture.md`](../apps/api/architecture.md).

## Локальный runtime

Compose-контур зоны `infra/` — два сервиса:

```text
api container       API и оба web-бандла одним процессом; за профилем `app`
postgres container  поднимается всегда
```

Отдельного `web`-контейнера нет: бандлы раздаёт тот же процесс. Профиль держит приложение вне
жизненного цикла базы — подъём PostgreSQL не тянет сборку образа.

Build-time:

```text
android-builder container → APK artifact
```

Android Emulator работает на хосте и обращается к gateway через адрес хоста эмулятора. iOS toolchain не запускается в Linux Docker.

Сервис `api` — **образ приложения** задачи `infra/009`: один образ, в котором процесс API отдаёт
с одного порта и REST-операции, и оба собранных web-бандла клиента — гостевой с `/`, владельческий
с `/admin`. Второго веб-сервера в нём нет. Помимо контура образ собирается своей целью
(`make image-build`) и запускается локально `make image-run`. Переменные окружения, порядок
публикации и её ограничения — в [`infra/README.md`](../infra/README.md).

## Security boundary

В MVP нет auth. Поэтому admin API и UI допустимы только для локальной учебной среды. Публикация в интернет требует отдельного решения по доступу и не может считаться безопасной за счёт пути `/admin`.

## Слой команд

Команда определена ровно один раз — рецептом цели в `Makefile`. Слоёв три:

```text
make/common.mk     корень репозитория, PATH до node_modules/.bin, механика help
Makefile           операции уровня репозитория и фан-аут по зонам
<зона>/Makefile    глаголы своей зоны
```

Список зон фан-аута не перечисляется руками: корневой `Makefile` собирает его из фактически
существующих `Makefile` в `apps/*`, `packages/*`, `infra/`, `tests/` и `tasks/`. Зона, получившая
`Makefile`, попадает в фан-аут сама; каталог верхнего уровня за пределами этого шаблона нужно
добавить в него явно. `Makefile` есть только у зон с запускаемой работой — у `tests/`
и `packages/slot-engine/` его нет, и в фан-ауте они не участвуют.

Каждая зона **с `Makefile`** обязана определять `typecheck`, `test` и `gates` — даже пустыми:
у `make` нет аналога `--if-present`, и отсутствие цели в такой зоне должно быть видимой ошибкой
конфигурации, а не молчаливым пропуском. Специфические глаголы (`dev`, `start`, `web`, `up`)
живут только там, где осмысленны. Аргументы CLI задач через `make` не проходят — у него свой
исполняемый вход `scripts/task`, не знающий грамматики команд.

Секции `scripts` в `package.json` пусты. Единственное исключение — корневой `"test": "make test"`
как страховка для непрозрачного авточекера учебной платформы; причина зафиксирована ключом `"//"`
того же манифеста.

## Структура репозитория

Фактическое состояние с назначением каждого каталога. Не создавай параллельную альтернативную
структуру без изменения `adr.md` активной задачи.

```text
minical/
├── AGENTS.md                  точка входа AI-сессии: правила, bootstrap, карта зон
├── CLAUDE.md                  только ссылка на AGENTS.md (локальный, в .gitignore)
├── .mcp.json                  канонический реестр MCP-серверов (локальный, в .gitignore)
├── README.md                  что за проект, требования к машине, установка, запуск
├── Makefile                   операции уровня репозитория и фан-аут по зонам
├── make/common.mk             общая часть всех Makefile
├── scripts/                   task — вход к CLI задач; lint-docs — гейт контракта размещения
├── package.json               npm workspaces: apps/*, packages/*; scripts пуст, кроме test
├── tsconfig.base.json         общая TS-база: ES2022, NodeNext, strict
├── .nvmrc                     Node 26 (engines: >=24)
├── Dockerfile                 образ приложения: два web-бандла клиента + API одним процессом;
│                              в корне, потому что платформа публикации собирает из корня
│                              контекста (исключение зафиксировано в sources-of-truth.md)
├── .dockerignore              состав контекста сборки образа
├── .github/workflows/         hexlet-check.yml — внешний чек учебной платформы, не
│                              редактируется; ci.yml — обязательные проверки на PR/push
│                              в `main`; release-please.yml — release-PR
├── apps/
│   ├── api/                   @minical/api — REST API: 12 операций контракта на Express 5,
│   │   │                       порт 3001; хранилище двухрежимное — in-memory по умолчанию,
│   │   │                       PostgreSQL при заданной DATABASE_URL; запускается из
│   │   │                       исходников, сборки в dist нет
│   │   ├── AGENTS.md           контракт зоны
│   │   ├── architecture.md     слои, точка валидации, таблица статусов, middleware
│   │   ├── README.md           запуск, переменные окружения, поведение состояния
│   │   ├── Makefile            typecheck, test, gates, start, dev
│   │   ├── package.json / tsconfig.json    noEmit + allowImportingTsExtensions
│   │   └── src/                server.ts, config.ts, app.ts,
│   │                           http/ (routes, handlers, parse, present, errors, security),
│   │                           usecases/ (owner, booking),
│   │                           domain/ (model, errors, slots, timezone),
│   │                           store/ (repositories, memory, postgres),
│   │                           тесты рядом с кодом: *.test.ts
│   └── client/                @minical/client — Expo 57, React Native 0.86, react-native-web;
│       │                       гостевой фундамент: дизайн-система, generated SDK, навигация
│       ├── AGENTS.md          контракт зоны
│       ├── README.md          режимы запуска, переменные EXPO_PUBLIC_*, сборка APK
│       ├── Makefile           typecheck, test, gates, start, web, android, ios, build
│       ├── CLAUDE.md          @AGENTS.md
│       ├── package.json       jest-конфиг (preset jest-expo, alias @/*)
│       ├── app.config.ts      experiments.baseUrl из EXPO_WEB_BASE_URL — базовый префикс
│       │                       web-экспорта (владельческий бандл раздаётся с /admin)
│       ├── app.json / App.tsx / index.ts / assets/    App.tsx — bootstrap: configureApiClient →
│       │                       GuestFlowProvider → NavigationContainer (без linking) → GuestStack
│       ├── .claude/settings.json    включённый плагин expo
│       ├── tsconfig.json      наследует expo/tsconfig.base, а не корневую базу; свой TypeScript
│       │                       ~6.0.3; paths "@/*" → ./src/* (без baseUrl — он deprecated в TS 6)
│       └── src/               api/ (config, errors → канон $error),
│                               design-system/ (tokens, theme, layout/, components/),
│                               features/guest/ (model, usecases, state, lib, screens — стабы),
│                               navigation/ (GuestStack, GuestStackParamList),
│                               shared/ui-state/ (StateView, Repeat),
│                               тесты рядом с кодом: *.test.ts(x)
├── packages/
│   ├── contracts/             @minical/contracts — единственный ручной источник HTTP-контракта
│   │   ├── AGENTS.md                   контракт зоны и generation pipeline
│   │   ├── Makefile                    format, format-check, build, typecheck, test, gates
│   │   ├── src/main.tsp                @service, @info(version), импорты
│   │   ├── src/models/                 common, errors, owner, event-type, booking
│   │   ├── src/operations/             health, admin, public
│   │   ├── tspconfig.yaml              эмиттер @typespec/openapi3 → generated/openapi.yaml
│   │   └── generated/openapi.yaml      фактически OpenAPI 3.0.0 (версия в конфиге не зафиксирована)
│   ├── api-client/            @minical/api-client — generated frontend SDK (@hey-api/client-fetch)
│   ├── backend-contract/      @minical/backend-contract — generated types + Zod schemas
│   ├── slot-engine/           .gitkeep — появится в отдельной задаче
│   └── database/              @minical/database — SQL-миграции, forward-only раннер
│                              (advisory lock, таблица schema_migrations) и integration-тесты
│                              схемы против реальной PostgreSQL
├── tests/
│   ├── AGENTS.md              контракт зоны проверок: контрактные, доменные, интеграционные, E2E
│   └── contract-validation.test.ts   контрактный гейт
├── infra/                     Docker/Compose локального контура; владелец корневого Dockerfile
│   ├── AGENTS.md              контракт зоны
│   ├── README.md              установка провайдера, контур PostgreSQL, Prism-мок,
│   │                          образ приложения и порядок публикации
│   └── Makefile               up, down, logs, reset, config, image-build, image-run
├── tasks/                     процесс задач; в git
│   ├── AGENTS.md              маршрутизатор каталога: карта, команды CLI, словарь
│   ├── REGISTRY.md            генерат `task registry`: реестр по типам, очередь работ, legacy-id
│   ├── Makefile               typecheck, test, gates для CLI задач
│   ├── flows/                 full.md, lite.md — правила треков, гейтов и откатов
│   ├── tasks.config.json      типы, статусы, состояния пунктов, треки, hash-стратегии
│   ├── _template/             full/ (brief, adr, plan, result), lite/ (task.md)
│   ├── tools/                 CLI: task.ts, lib/, tests/
│   ├── archive/               000…003, 006 — дотиповая эпоха, как есть, не трогается
│   ├── contract/              001-guest-flow-extensions/
│   ├── infra/                 001-postgres-compose/ … 006-ci-release-please/
│   ├── back/                  001-api-skeleton/, 002-database-persistence/, 003-slot-engine-package/
│   ├── front/                 ui/, guest/, owner/ — например front/guest/002-guest-screens/
│   └── process/               001-tasks-rework/ … 003-docs-commands-rework/
├── docs/                      документы проекта; в git
└── .opencode/                 скиллы AI-процесса, не в git
```

Каждая задача — `<номер>-<слаг>/` с `task.yaml` (канон состояния) и документами своего трека.
Канонический id — путь без слага: `front/guest/002`, `infra/006`.

`packages/slot-engine` кода пока не содержит — только `AGENTS.md` зоны и `.gitkeep`. Не наполняй
его кодом без задачи, которая это предусматривает. `packages/database` активирован задачей
`back/002`, `infra/` наполнена `infra/001` (compose-контур, init-скрипт, переменные окружения)
и `infra/009` (образ приложения).

### Пакеты и границы

| Пакет | Роль | Кто меняет |
|---|---|---|
| `@minical/contracts` | Ручной TypeSpec и производный OpenAPI | по [`packages/contracts/AGENTS.md`](../packages/contracts/AGENTS.md) |
| `@minical/api-client` | Generated frontend SDK | никто вручную — только цель `make generate` |
| `@minical/backend-contract` | Generated transport types и runtime Zod-схемы | никто вручную — только цель `make generate` |
| `@minical/api` | REST, application logic, mapping transport ↔ domain ↔ persistence | по [`apps/api/AGENTS.md`](../apps/api/AGENTS.md) |
| `@minical/client` | UI, навигация, состояния экранов по generated SDK | по [`apps/client/AGENTS.md`](../apps/client/AGENTS.md) |

Backend валидирует входящий transport-запрос generated Zod-схемами: generated TypeScript-типы
не заменяют runtime-валидацию.

### Каталоги AI-процесса

```text
docs/
├── domain-rules.md            поведение onboarding, расписания, слотов, Booking
├── domain-model.md            сущности, VO, кардинальности, инварианты
├── architecture.md            этот файл: стиль, компоненты, слой команд, структура, runtime
├── sources-of-truth.md        владение источниками правды, контракт размещения, иерархия
├── contract-pipeline.md       порядок изменения контракта и генерации
├── handoff/                   материалы передачи дизайна: guest-flow-design-brief.md
└── ui-spec-kit/               декларативная UISpec owner-flow и guest-flow
    ├── README.md / MANUAL.md / uispec.config.json
    ├── AUDIT.md / ROADMAP.md      аудит кита 2026-08-05 и исполненный план исправлений R1–R6
    ├── specs/ui/screens/          экраны owner-flow и guest-flow (*.screen.md) + FRAME_MAP.md
    ├── specs/ui/components/       компоненты (*.component.md)
    ├── specs/ui/tokens/           colors, typography, spacing, radii, sizes, motion
    ├── specs/ui/navigation/ registry/ bindings/ schema/ assets/
    │                              (bindings: api-bindings.xml — единственная связь action→operationId,
    │                               contract-gaps.xml — реестр расхождений с контрактом)
    └── tools/uispec/              валидатор (V1–V11, --config/--strict/--lint), генератор каркасов,
                                   tests/ — негативные фикстуры валидатора

.opencode/
└── skills/                    brainstorming, decomposition, grill-me, grilling, lean-code,
                               taskmaster, uispec-generator, verification-before-completion,
                               worktree-isolated-agent
```

### Как скиллы и MCP попадают в сессию

Проектные инструкции процесса физически лежат в `.opencode/`, и разные харнессы видят их
по-разному. Не рассчитывай на автоподхват — проверяй по этой таблице:

| Артефакт | OpenCode | Claude Code |
|---|---|---|
| `.opencode/skills/*/SKILL.md` — 9 скиллов; `scripts/` у `uispec-generator` — симлинк на `docs/ui-spec-kit/tools/uispec` (канон скриптов один, копии нет) | автоматически как skills | подхватываются через симлинк `.claude/skills → ../.opencode/skills` — проверено на живой сессии. Без симлинка `SKILL.md` читается как Markdown |
| `.mcp.json` в корне — канонический реестр MCP-серверов (формат `mcpServers`) | **не читается** (feature request закрыт как not planned): у OpenCode свой формат — секция `mcp` в `opencode.json`, записи зеркалирует владелец вручную | подхватывается автоматически как project-scope MCP; первое использование сервера требует одобрения пользователя |

Практические следствия:

- «обязательный скилл» во вложенном `AGENTS.md` означает обязательный *процесс* из `SKILL.md`;
  выполнить его вручную по шагам — полноценное соблюдение правила;
- `grill-me` помечен `disable-model-invocation: true`, поэтому в модельном списке скиллов его нет
  и агент сам его не вызовет — он запускается только пользователем через `/grill-me`. Остальные
  восемь доступны агенту;
- `tasks/` и `docs/` приезжают с клоном, а `.claude/`, `.opencode/` и `.mcp.json` — нет: в свежем
  клоне нет ни скиллов, ни симлинков, их восстанавливает владелец рабочей копии;
- MCP-серверы описываются только в `.mcp.json` — это единственный источник правды; зеркало
  в `opencode.json` обновляется следом за ним. Оба файла в `.gitignore` (внутри могут быть
  локальные пути и env-секреты), свежий клон MCP-серверов не получает;
- при добавлении новой зоны, скилла или MCP-сервера обнови таблицы здесь и карту зон в корневом
  [`AGENTS.md`](../AGENTS.md): манифеста, который бы их перечислял, нет.

## Поток создания бронирования

```text
1. Client получает слоты от API.
2. Гость выбирает startAt и вводит данные.
3. API валидирует transport request.
4. Backend заново получает EventType и настройки.
5. Backend вычисляет endAt и повторно проверяет слот.
6. PostgreSQL-транзакция пытается создать Booking.
7. Exclusion constraint является последней защитой от гонки.
8. API возвращает Booking либо документированную ошибку.
```

Шаги 6–7 описывают режим PostgreSQL; в режиме in-memory занятость держится только проверкой
шага 5, и защиты от гонки на уровне хранилища нет.

## Когда менять task ADR

`adr.md` обязателен для каждой задачи полного трека (`tasks/<тип>/<номер>-<слаг>/adr.md`) и должен явно подтвердить отсутствие архитектурного влияния либо зафиксировать решение; у lite-трека решение — секция в `task.md`. Особое внимание требуется, если предлагается:

- сменить архитектурный стиль;
- добавить auth или несколько владельцев;
- заменить PostgreSQL или способ защиты пересечений;
- изменить ownership источников правды;
- добавить внешний сервис или очередь;
- поменять contract-generation pipeline.
