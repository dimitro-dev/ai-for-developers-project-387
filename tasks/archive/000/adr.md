---
status: согласовано
---

# Architecture decision — TASK-000

## Контекст

Нужен воспроизводимый старт пустого TypeScript-проекта: monorepo, объединяющий React Native/Web клиент, backend, TypeSpec contract pipeline и Docker, без продуктовой логики. Согласованный brief требует полный RN/Web scaffold клиента, локальный TypeSpec toolchain и Docker/Compose-контур; android-builder вынесен в non-goals.

Проверенное host-окружение (macOS): Node 26.0.0, npm 11.12.1, Git 2.50.1, Android SDK + Java 17 — доступны; Docker и Docker Compose — отсутствуют.

## Решение

1. Monorepo на npm workspaces с единым lockfile: корневой `package.json` с `workspaces: ["apps/*", "packages/*"]`.
2. Обязательные CLI (TypeSpec, codegen, TypeScript) — локальные devDependencies, запуск только через npm scripts. Глобальные установки (включая обнаруженный `/opt/homebrew/bin/tsp`) не используются.
3. Контрактная цепочка по `docs/contract-pipeline.md`: TypeSpec — ручной источник; `@typespec/openapi3` эмитит OpenAPI 3.1; `@hey-api/openapi-ts` генерирует frontend SDK (`packages/api-client`) и backend types + Zod schemas (`packages/backend-contract`).
4. На bootstrap-этапе — только smoke-контракт без доменной модели; продуктовый API описывает task-002.
5. `apps/client` — Expo (актуальный стабильный SDK) + TypeScript + `react-native-web`: один кодовый контур для Android и web без продуктовых экранов; iOS проверяется локально при доступном toolchain. Android debug-сборка — `expo prebuild` + Gradle с host Android SDK; web-сборка — `expo export`.
6. `apps/api` — минимальный smoke HTTP-сервер на `node:http` + TypeScript, без фреймворка. Выбор backend-фреймворка — прикладное решение будущей backend implementation task; bootstrap его не предрешает.
7. Node.js: поддерживаемая major-версия — 26 (реально установлена и проверяется на хосте); фиксируется файлом `.nvmrc`, в `engines` допускается `>=24` (Active LTS) для совместимости с CI. Точные версии зависимостей фиксирует `package-lock.json`.
8. Docker Compose остаётся целевым интерфейсом локального runtime по `docs/architecture.md`, но подготовка Dockerfile/Compose целиком вынесена из task-000 в отдельную инфраструктурную задачу (решение пользователя; Docker на хосте отсутствует). Smoke-компоненты task-000 запускаются напрямую через Node/npm. Кандидат-провайдер для будущей Docker-задачи — colima + docker CLI + compose plugin (свободная лицензия); предложение установки — по fallback-правилу brief.
9. Образ android-builder и сборка APK в Docker — вне scope task-000 (non-goal brief); отдельная инфраструктурная задача.
10. Структура каталогов создаётся заранее по `docs/architecture.md`; пустые каталоги сохраняются через `.gitkeep`; placeholder-код не смешивается с будущей доменной реализацией.

## Затронутые компоненты

```text
root package.json, package-lock.json, .nvmrc
apps/client
apps/api
packages/contracts
packages/api-client
packages/backend-contract
packages/slot-engine
packages/database
infra
README.md
```

## Последствия и компромиссы

Положительные:

- новая сессия или агент получает готовую воспроизводимую среду;
- frontend/backend codegen проверяется до появления большого контракта;
- глобальные версии CLI не влияют на build;
- RN/Web scaffold сразу даёт реальные build-цели для Android и web, а не временные заглушки;
- структура проекта фиксируется до параллельной разработки.

Ограничения:

- Expo-scaffold заметно увеличивает объём task-000 и время сборки;
- smoke-сервер на `node:http` будет заменён при выборе backend-фреймворка;
- Docker-контур отложен в отдельную задачу: локальный runtime через Compose появится только после неё, до тех пор запуск — напрямую через Node/npm;
- Node 26 — Current, а не LTS: отдельные пакеты могут предупреждать про `engines`; допускается переход на LTS 24 без пересмотра ADR (`engines >=24`);
- bootstrap не доказывает корректность будущей бизнес-логики.

## Рассмотренные альтернативы

### Несколько независимых репозиториев

Отклонено: усложняет синхронизацию контракта и generated packages для учебного проекта.

### Вызывать TypeSpec-компилятор, установленный на машину отдельно от проекта

Отклонено. TypeSpec обязателен и используется по флоу `docs/contract-pipeline.md`: Contract Agent меняет `.tsp` и запускает `npm run contracts:build` / `npm run generate`, остальные агенты потребляют generated-артефакты и проверяют drift через `npm run generate:check`. Принято, что эти команды используют компилятор из зависимостей проекта: он устанавливается в `node_modules` при `npm ci`, его точная версия записана в `package-lock.json`, поэтому один и тот же `.tsp` генерирует одинаковые файлы на любой машине и в CI. Если вместо этого звать `tsp`, установленный на конкретный компьютер (например, `/opt/homebrew/bin/tsp`), версии на машинах разойдутся: одинаковый контракт даст разные generated-файлы, `generate:check` будет падать из-за версий, а не реальных правок, а каждое новое окружение потребует ручной установки.

### Сразу описать весь продуктовый API

Отклонено: доменная модель фиксируется отдельной задачей (001/002).

### Bare React Native + отдельное web-приложение

Отклонено: два независимых контура сборки и дублирование настройки; Expo с `react-native-web` даёт Android и web из одного кода, что соответствует архитектуре «единый клиент».

### Fastify/Express для smoke API

Отклонено на этом этапе: выбор фреймворка — прикладное решение backend task; smoke-серверу достаточно `node:http`.

### Docker Desktop / OrbStack вместо colima

Работоспособны, но имеют лицензионные ограничения для коммерческого использования; colima — свободная альтернатива с тем же docker CLI/Compose-интерфейсом. Финальный выбор провайдера остаётся за пользователем.

## Совместимость и миграция

Проект пустой; миграции существующего кода нет. Smoke-контракт и smoke-сервер заменяются последующими задачами без изменения корневых команд pipeline. Установка colima не затрагивает файлы проекта и обратима (`brew uninstall colima`).
