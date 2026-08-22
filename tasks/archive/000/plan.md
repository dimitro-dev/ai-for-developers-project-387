---
status: согласовано
---

# План TASK-000

## Декомпозиция

| ID | Цель / проблема | Решение | Состояние |
|---|---|---|---|
| P01 | Зафиксировать фактическое состояние host-инструментов | Задокументировать в `result.md` проверенные версии: Node 26.0.0, npm 11.12.1, Git 2.50.1, Android SDK + Java 17; Docker/Compose отсутствуют — Docker-контур вынесен в отдельную задачу | завершено |
| P02 | Нет корневого workspace-контура | Корневой `package.json` с `workspaces: ["apps/*", "packages/*"]`, `.nvmrc` = 26, `engines >=24`, полный `.gitignore`, `package-lock.json` | завершено |
| P03 | Нет локального TypeSpec/codegen toolchain | devDependencies: `typescript`, `@typespec/compiler`, `@typespec/http`, `@typespec/openapi3`, `@hey-api/openapi-ts`, `zod`; корневые scripts `contracts:format`, `contracts:format:check`, `contracts:build`, `generate`, `generate:check` | завершено |
| P04 | Нет согласованной структуры каталогов | Создать `apps/*`, `packages/*`, `infra` по `docs/architecture.md`; пустые точки расширения сохранить через `.gitkeep`; проверить ссылки документации | завершено |
| P05 | Генерационная цепочка не проверена | Smoke `.tsp` (health-операция, без домена) → OpenAPI 3.1 в `packages/contracts/generated` → SDK в `packages/api-client/src/generated` → types + Zod в `packages/backend-contract/src/generated` | завершено |
| P06 | Нет клиентского scaffold | `apps/client`: Expo + TypeScript + `react-native-web`, без продуктовых экранов; web-сборка через `expo export`; Android debug-сборка через `expo prebuild` + Gradle на host Android SDK | завершено |
| P07 | Нет API smoke-пакета | `apps/api`: минимальный сервер на `node:http` + TypeScript с health-endpoint по smoke-контракту; build/typecheck проходят | завершено |
| P08 | Нет защиты от generated drift | Проверить: повторный `npm run generate` не создаёт diff; `generate:check` падает при ручной правке generated; format-check проходит | завершено |
| P09 | Команды bootstrap не документированы | README с точными командами установки, генерации, проверок и запуска; финализация `result.md` | завершено |

## Порядок и зависимости

```text
P01
 └─ P02
     ├─ P03
     │   └─ P05
     │       ├─ P06
     │       └─ P07
     └─ P04

P05 + P06 + P07
 └─ P08 → P09
```

## Блокеры и открытые вопросы

- Блокеров нет. Docker/Compose-контур (web, api, postgres) и android-builder вынесены в отдельные инфраструктурные задачи решением пользователя; smoke-компоненты task-000 запускаются напрямую через Node/npm.
- Вопросы прежней версии плана закрыты согласованным ADR: версия Node — 26 (`.nvmrc`, `engines >=24`); smoke-сервер — `node:http` без фреймворка; Android debug-сборка клиента выполняется в P06 на host toolchain.
