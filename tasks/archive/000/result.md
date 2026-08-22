---
status: согласовано
---

# Результат TASK-000

## Итог

Каркас monorepo подготовлен полностью: npm workspaces, локальный TypeSpec/codegen toolchain, проверенная генерационная цепочка, Expo-клиент (web-сборка и Android debug APK проходят), smoke API-сервер, защита от generated drift и README с командами bootstrap. Все пункты плана завершены.

## Что изменено

- Корень: `package.json` (workspaces `apps/*`, `packages/*`, scripts pipeline), `package-lock.json`, `.nvmrc` (26), `tsconfig.base.json`, `.gitignore`, `README.md`.
- `packages/contracts` — ручной smoke-контракт `src/main.tsp` (health-операция, без домена), `tspconfig.yaml`, generated `generated/openapi.yaml`.
- `packages/api-client` — конфиг `openapi-ts.config.ts`, generated fetch SDK в `src/generated/**`.
- `packages/backend-contract` — конфиг `openapi-ts.config.ts`, generated types + Zod schemas в `src/generated/**`, зависимость `zod`.
- `apps/api` — smoke HTTP-сервер на `node:http` + TypeScript, endpoint `GET /health` по smoke-контракту.
- `apps/client` — Expo SDK 57 + TypeScript + `react-native-web` scaffold без продуктовых экранов (шаблон blank-typescript; удалён шаблонный `LICENSE`).
- `packages/slot-engine`, `packages/database`, `infra` — пустые точки расширения с `.gitkeep`.

## Установленные инструменты и версии

Host (проверено):

| Инструмент | Версия |
|---|---|
| Node.js | 26.0.0 |
| npm | 11.12.1 |
| Git | 2.50.1 (Apple Git-155) |
| Java | 17.0.6 LTS |
| Android SDK | `~/Library/Android/sdk` (build-tools, emulator) |
| Docker / Compose | отсутствуют — Docker-контур вынесен в отдельную задачу |

Project devDependencies (фиксируются `package-lock.json`):

| Пакет | Версия |
|---|---|
| typescript | ^5.9.3 (5.9.3) |
| @typespec/compiler, http, openapi3 | ^1.14.0 |
| @hey-api/openapi-ts | ^0.99.0 |
| @types/node | ^26.1.2 |
| expo (apps/client) | ~57.0.8, react-native 0.86.0, react 19.2.3 |

Примечание: npm по умолчанию поставил TypeScript 7.0.2 — он несовместим с compiler API, который использует `@hey-api/openapi-ts`; версия зафиксирована на `^5.9.0`.

## Созданная структура проекта

Соответствует `docs/architecture.md`: `apps/client`, `apps/api`, `packages/contracts|api-client|backend-contract|slot-engine|database`, `infra`, плюс существующие `docs`, `tasks`, `agents`. Пустые каталоги сохранены через `.gitkeep`.

## Контракт и generated-артефакты

- Ручной источник: `packages/contracts/src/main.tsp` — smoke-операция `getHealth` (`GET /health`), доменной спецификации нет.
- `npm run generate`: TypeSpec → `packages/contracts/generated/openapi.yaml` (OpenAPI 3.1) → `packages/api-client/src/generated/**` (fetch SDK) → `packages/backend-contract/src/generated/**` (types + Zod).
- Generated-файлы создаются только pipeline-командами; повторная генерация не даёт diff.

## Docker и локальный runtime

Docker/Compose-контур вынесен в отдельную инфраструктурную задачу решением пользователя (см. brief п. 10, ADR решение 8). Smoke-компоненты запускаются напрямую через Node/npm; команды в README.

## Выполненные проверки

| Проверка | Команда | Результат |
|---|---|---|
| Установка из lockfile | `npm ci` / `npm install` | OK |
| Формат контракта | `npm run contracts:format:check` | OK |
| Компиляция контракта | `npm run contracts:build` | OK (tsp 1.14.0) |
| Полная генерация | `npm run generate` | OK, все три артефакта |
| Отсутствие drift | `npm run generate:check` после коммита | exit 0 |
| Drift ловится | правка `.tsp` без перегенерации → `generate:check` | exit 1 (ожидаемо), после отката exit 0 |
| Typecheck workspaces | `npm run typecheck` | OK (api-client, backend-contract, api, client) |
| Сборка API | `npm run build -w @minical/api` | OK |
| Работа API | `curl http://localhost:3001/health` | `{"status":"ok","uptimeSeconds":0.942}` |
| Web-сборка клиента | `npx expo export --platform web` | OK, bundle 332KB в `apps/client/dist` |
| Android debug-сборка | `expo prebuild` + `gradlew assembleDebug` (JDK 17, host Android SDK) | OK, exit 0; `apps/client/android/app/build/outputs/apk/debug/app-debug.apk` (130MB) |

## Отклонения от brief / ADR / plan

Нет. Изменения scope (Docker и android-builder в отдельные задачи, полный RN/Web scaffold) согласованы пользователем и внесены в brief/ADR/plan до реализации.

## Известные ограничения и риски

- Docker/Compose-контур и локальный runtime (web+api+postgres) отсутствуют до выполнения отдельной Docker-задачи; для будущего backend с PostgreSQL она обязательна.
- Smoke-контракт и smoke-сервер временные: заменяются в task-002 и backend implementation task без изменения корневых команд.
- `apps/api` не импортирует `@minical/backend-contract` (self-contained smoke); обязательная валидация transport input generated-схемами начнётся с прикладного backend.
- TypeScript в `apps/client` — 6.x (требование шаблона Expo SDK 57), в корне — 5.9.x (совместимость hey-api); версии не конфликтуют благодаря per-workspace resolution.
- iOS не проверялся.

## Описание для MR

### Summary

Bootstrap каркаса MiniCal (task-000): npm workspaces monorepo, локальный TypeSpec → OpenAPI → codegen pipeline со smoke-контрактом, Expo RN/Web клиентский scaffold, smoke API-сервер, drift-защита generated-файлов, README с командами.

### Changes

- Root workspace: `package.json` + lockfile, `.nvmrc`, `tsconfig.base.json`, `.gitignore`, README.
- `packages/contracts`: TypeSpec smoke-контракт + generated OpenAPI 3.1.
- `packages/api-client`, `packages/backend-contract`: конфиги codegen + generated SDK/types/Zod.
- `apps/api`: smoke `node:http` сервер с `GET /health`.
- `apps/client`: Expo SDK 57 + react-native-web scaffold.
- `packages/slot-engine`, `packages/database`, `infra`: `.gitkeep`.
- Документы task-000: brief/ADR/plan согласованы, result заполнен.

### Verification

`npm ci`, `npm run generate:check`, `npm run typecheck`, `npm run build`, запуск API + `curl /health`, `expo export --platform web`, Android debug-сборка (см. таблицу проверок).

### Known limitations

Docker runtime и android-builder — отдельные задачи; smoke-артефакты временные; iOS не проверялся.
