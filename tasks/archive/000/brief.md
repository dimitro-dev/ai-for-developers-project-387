---
status: согласовано
---

# TASK-000 — Подготовка пустого проекта

## Контекст и проблема

Репозиторий MiniCal пока пуст. До описания домена и API необходимо подготовить воспроизводимое окружение, установить проектные инструменты локально, проверить генерационный pipeline и создать согласованную структуру каталогов.

## Цель

Получить минимальный каркас monorepo, из которого следующие агенты могут независимо развивать контракт, frontend, backend и инфраструктуру без повторной ручной настройки.

## Зависимости

Нет. Это первая задача проекта.

## Пользовательские сценарии

Продуктовых пользовательских сценариев нет — задача инфраструктурная. Потребители результата — агенты следующих задач:

- агент из чистого checkout выполняет документированную последовательность (`npm ci` → `npm run generate` → smoke checks) и получает работающее окружение без ручной донастройки;
- Contract Agent начинает task-002 без установки глобального TypeSpec CLI;
- Infrastructure Agent в отдельной Docker-задаче опирается на готовый workspace и документированные команды bootstrap.

## Функциональные требования

1. Проверить доступность обязательных host-инструментов:
   - Node.js и npm;
   - Git;
   - Docker Engine или Docker Desktop;
   - Docker Compose plugin;
   - Android toolchain — если в текущем окружении планируется проверка APK.

   Если обязательный инструмент отсутствует или несовместим, агент не продолжает молча: он предлагает пользователю вариант установки или настройки, безопасный для проекта и хоста, с обоснованием, и выполняет его только после явного подтверждения пользователя. До подтверждения зависимые пункты плана считаются заблокированными и фиксируются в `plan.md` и `result.md`.

2. Зафиксировать поддерживаемую версию Node.js в репозитории и реальные версии npm-зависимостей в lockfile.
3. Инициализировать корневой npm workspace.
4. Установить локальные project dependencies, необходимые для:
   - TypeScript;
   - TypeSpec compiler;
   - HTTP и OpenAPI TypeSpec libraries;
   - OpenAPI code generation для frontend;
   - transport types/runtime schemas для backend.
5. Не полагаться на глобально установленный TypeSpec CLI: все обязательные команды должны выполняться через scripts проекта.
6. Создать целевую структуру каталогов из `docs/architecture.md`, включая как минимум:

```text
apps/client
apps/api
packages/contracts
packages/api-client
packages/backend-contract
packages/slot-engine
packages/database
infra
docs
tasks
agents
```

7. Подготовить минимальный smoke-контракт TypeSpec, не содержащий доменной спецификации MiniCal, и проверить цепочку:

```text
TypeSpec → OpenAPI 3.1 → frontend generated types/SDK → backend generated types/schemas
```

8. Подготовить корневые команды сборки и проверки generated drift.
9. Развернуть в `apps/client` полноценный React Native / React Web scaffold (Android и web; iOS проверяется локально при доступном toolchain) без продуктовых экранов; для `apps/api` подготовить минимальный smoke-пакет с build/typecheck. Бизнес-endpoints не реализовывать.
10. Docker/Compose-контур в рамках task-000 не готовится: решением пользователя он вынесен в отдельную инфраструктурную задачу. Smoke-компоненты задачи запускаются напрямую через Node/npm.
11. Описать в README точные команды установки, генерации, проверки и локального запуска.

## Нефункциональные требования

- Чистый checkout должен восстанавливаться через lockfile и одну документированную последовательность команд.
- Generated-файлы создаются только командами pipeline.
- Пустые каталоги, которые ещё не содержат реализации, должны сохраняться в Git предсказуемым способом.
- Зависимости разных workspaces не должны дублироваться без причины.
- Секреты и локальные machine-specific пути не коммитятся.

## API impact

`NONE` — создаётся только smoke-контракт для проверки toolchain. Доменный API MiniCal описывается в `002`.

## Acceptance criteria

1. Структура репозитория соответствует согласованному архитектурному контуру.
2. `npm ci` или эквивалентная документированная команда успешно восстанавливает зависимости из lockfile.
3. Корневая команда генерации создаёт OpenAPI, frontend-артефакты и backend-артефакты.
4. Повторная генерация без изменения исходников не создаёт diff.
5. TypeScript typecheck smoke-пакетов проходит.
6. Клиентский scaffold собирается: web-сборка проходит; Android debug-сборка выполняется при доступном host Android toolchain, результат фиксируется в `result.md`.
7. TypeSpec formatter/compile проходят.
8. Проверки окружения и все выполненные команды зафиксированы в `result.md`.
9. Следующая задача может начать работу без установки глобального TypeSpec CLI.

## Non-goals

- описание доменных сущностей MiniCal;
- продуктовый TypeSpec-контракт;
- Slot Engine;
- PostgreSQL schema продукта и миграции;
- полноценные owner/guest UI;
- реализация бронирования;
- Docker/Compose runtime-контур (web, api, postgres) — отдельная инфраструктурная задача;
- Docker-образ android-builder и автоматизированная сборка APK — отдельная инфраструктурная задача;
- production deployment.

## Связанные документы

- [`../../docs/architecture.md`](../../docs/architecture.md)
- [`../../docs/contract-pipeline.md`](../../docs/contract-pipeline.md)
- [`../../.opencode/agents/infrastructure-agent.md`](../../.opencode/agents/infrastructure-agent.md)
- [`../../.opencode/agents/contract-agent.md`](../../.opencode/agents/contract-agent.md)
