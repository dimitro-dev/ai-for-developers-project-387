# TypeSpec contract pipeline

## Цель

Обеспечить один ручной HTTP-контракт и независимую работу frontend и backend.

```text
согласованный brief + adr активной задачи
    ▼
Владелец контракта (`packages/contracts/AGENTS.md`) меняет TypeSpec
    ▼
TypeSpec compiler
    ▼
OpenAPI 3.0
    ├── frontend types + fetch SDK
    └── backend types + runtime schemas
    ▼
Frontend и backend реализуются параллельно
```

## Ручной источник контракта

Редактируется только:

```text
packages/contracts/src/**/*.tsp
```

TypeSpec описывает:

- operation name;
- HTTP method и route;
- path, query и header parameters;
- request и response models;
- status codes;
- стабильные error codes;
- transport-level validation и примеры.

TypeSpec не описывает:

- алгоритм слотов;
- транзакции;
- PostgreSQL schema и migrations;
- exclusion constraint;
- domain entities;
- UI и Docker runtime.

## Генерационная цепочка

Принятый pipeline:

```text
@typespec/openapi3
    TypeSpec → OpenAPI 3.0

@hey-api/openapi-ts
    OpenAPI → frontend TypeScript SDK
    OpenAPI → backend TypeScript types и Zod schemas
```

Версия OpenAPI в `packages/contracts/tspconfig.yaml` не зафиксирована: эмиттер `@typespec/openapi3` работает на default и выдаёт `openapi: 3.0.0` (первая строка generated-файла). Конструкции, доступные только в 3.1, использовать нельзя.

Целевые артефакты:

```text
packages/contracts/generated/openapi.yaml
packages/api-client/src/generated/**
packages/backend-contract/src/generated/**
```

Они не редактируются вручную ([`sources-of-truth.md`](sources-of-truth.md), «Производные артефакты») и целиком воспроизводятся одной корневой целью.

## Команды цепочки

Строки команд определены в `Makefile` корня и зоны `packages/contracts`; полный список с описаниями печатает `make help`. Цепочку обслуживают:

| Цель | Что делает |
|---|---|
| `make generate` | TypeSpec → OpenAPI → frontend SDK → backend schemas |
| `make generate-check` | повторяет генерацию и падает, если появился незакоммиченный generated diff |
| `make -C packages/contracts format` | форматирует исходники TypeSpec |
| `make -C packages/contracts format-check` | проверяет форматирование TypeSpec |
| `make -C packages/contracts build` | компилирует TypeSpec в `generated/openapi.yaml` |

## Порядок изменения API

1. Убедиться, что `brief.md` и `adr.md` активной задачи согласованы, а API impact отражён в `plan.md`.
2. Владелец контракта (`packages/contracts/AGENTS.md`) изменяет `.tsp`.
3. Запустить formatter и TypeSpec compile.
4. Перегенерировать OpenAPI, frontend SDK и backend schemas.
5. Просмотреть generated diff и определить breaking changes.
6. Обновить состояние contract-пункта в `plan.md`.
7. Только после этого приступают frontend-зона (`apps/client/AGENTS.md`) и backend-зона (`apps/api/AGENTS.md`).
8. Реальные responses проверяются против контракта (`tests/AGENTS.md`).

Если HTTP API не меняется, контрактная зона (`packages/contracts/AGENTS.md`) не участвует.

## Правила generated API

- operation names должны быть стабильными: они могут влиять на имена SDK-функций;
- frontend не создаёт ручные копии DTO и не пишет обходные URL;
- backend валидирует runtime input generated-схемами на transport boundary;
- generated TypeScript types не заменяют runtime validation;
- ORM и миграции не генерируются слепо из API DTO.

## Независимая разработка

Frontend-зона (`apps/client/AGENTS.md`) может работать по generated SDK и mock API до готовности backend.

Backend-зона (`apps/api/AGENTS.md`) использует тот же контракт, но отдельно реализует:

- application services;
- slot engine;
- repositories;
- транзакции и database constraints;
- mapping между transport, domain и persistence — границы этих моделей в [`domain-model.md`](domain-model.md) §13.

## Изменение, обнаруженное во время реализации

Реализующая сессия не редактирует TypeSpec самостоятельно. Она фиксирует блокирующее изменение в `plan.md` активной задачи и передаёт contract-пункт контрактной зоне (`packages/contracts/AGENTS.md`). Если изменение влияет на согласованный scope или архитектуру, применяются правила откатов — `tasks/flows/full.md` («Откаты»), выполняется `scripts/task draft`.
