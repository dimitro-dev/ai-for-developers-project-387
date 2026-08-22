# TASK-infra-006 — CI: обязательные проверки и release-please на GitHub Actions

## Контекст и проблема

«Обязательные проверки» из `AGENTS.md` (форматирование TypeSpec, защита от drift generated-артефактов, typecheck, контрактный gate, backend- и клиентские тесты) сегодня выполняются только вручную на машине владельца. На GitHub-стороне репозитория (`origin` — GitHub) автоматики нет: единственный workflow — `hexlet-check.yml`, авточекер учебной платформы, который проектные проверки не запускает. Сломанный мёрдж в `main` обнаруживается только при следующем локальном прогоне.

Версионирование тоже ручное: корневой `package.json` заморожен на `0.1.0`, changelog не ведётся, хотя история коммитов уже дисциплинированно следует Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`) — то есть сырьё для автоматического changelog и вычисления версии в репозитории есть, а потребителя у него нет.

Особенность репозитория: каталоги `docs/`, `tasks/`, `.opencode/` в `.gitignore`, поэтому CI-клон их не содержит. Корневой `npm test` к этому уже готов — шаг `uispec:validate` штатно скипается без `docs/ui-spec-kit`.

## Цель

Каждый PR в `main` и каждый push в `main` автоматически проходят полный набор «Обязательных проверок» на GitHub Actions, а после мёрджа в `main` release-please поддерживает release-PR с накопленным changelog и предложенной версией; мёрдж release-PR публикует git-тег и GitHub Release.

## Зависимости

- `000` — toolchain, корневые скрипты и структура workspace (завершена).
- Существующие гейты приложений: `back-001` (`node --test`) и `front-guest-001` (jest-expo) — завершены; CI только запускает их, не создавая новых.
- Организационная: права администратора репозитория GitHub — для one-time настройки «Allow GitHub Actions to create and approve pull requests» (Settings → Actions → General).
- Ни одну задачу из очереди эта задача не блокирует и ничьего завершения не ждёт.

## Пользовательские сценарии

1. Разработчик открывает PR в `main` — на PR появляется чек CI со всеми обязательными проверками; красный чек виден до мёрджа.
2. Владелец мержит изменения в `main` — CI повторяет проверки на результате мёрджа; release-please создаёт (или дополняет существующий) release-PR с changelog по conventional-коммитам и предложенной версией.
3. Владелец решает выпустить версию и мержит release-PR — создаются git-тег и GitHub Release, версия в корневом `package.json` и `CHANGELOG.md` обновлены этим же PR.
4. Коммиты типов, не влияющих на версию (`docs:`, `chore:`), накапливаются, но сами по себе релиз не предлагают — release-PR появляется при наличии `feat:`/`fix:` (или breaking change).

## Функциональные требования

- **FR1.** CI-workflow запускается на `pull_request` в `main` и на `push` в `main` и выполняет полный набор «Обязательных проверок» `AGENTS.md`: `contracts:format:check`, `generate:check`, `typecheck`, корневой `npm test`, `npm test -w @minical/api`, `npm test -w @minical/client`. Падение любой проверки делает прогон красным.
- **FR2.** Окружение прогона воспроизводит проектное: версия Node берётся из `.nvmrc`, зависимости ставятся чистой установкой (`npm ci`).
- **FR3.** CI работоспособен в клоне без локальных каталогов AI-процесса (`docs/`, `tasks/`, `.opencode/`): ни одна проверка не требует их наличия.
- **FR4.** Отдельный workflow release-please запускается только на `push` в `main` и создаёт/обновляет release-PR: один changelog (`CHANGELOG.md` в корне) и одна версия на весь репозиторий (корневой `package.json`), вычисленная по Conventional Commits.
- **FR5.** Мёрдж release-PR создаёт git-тег и GitHub Release с текстом changelog.
- **FR6.** `hexlet-check.yml` и `README.md` в `.github/workflows/` не изменяются и не удаляются.
- **FR7.** One-time настройка репозитория «Allow GitHub Actions to create and approve pull requests» выполнена и зафиксирована в `result.md` как prerequisite.

## Нефункциональные требования

- **NFR1.** Без новых записей в `dependencies`/`devDependencies` — вся автоматика живёт в YAML сторонних GitHub Actions, закреплённых мажорной версией (`actions/checkout`, `actions/setup-node`, `googleapis/release-please-action@v4`).
- **NFR2.** Секреты не требуются: release-please работает на стандартном `GITHUB_TOKEN` с явно объявленными permissions.
- **NFR3.** Устаревшие прогоны на той же ветке отменяются (concurrency), у джоб есть timeout — зависший шаг не сжигает минуты Actions.
- **NFR4.** Кэширование npm включено, но корректность от кэша не зависит.

## API impact

`NONE`

## Acceptance criteria

- **AC1.** PR в `main` получает чек CI; в логе прогона видны все шесть проверок FR1, выполненные именно в этом порядке. Искусственно сломанная проверка делает чек красным.
- **AC2.** Push в `main` запускает тот же набор проверок; на текущем `main` прогон зелёный.
- **AC3.** После мёрджа в `main` коммита `feat:` или `fix:` release-please создаёт release-PR (или обновляет существующий) с changelog и версией, согласованной с semver-семантикой типа коммита.
- **AC4.** Мёрдж release-PR приводит к git-тегу и GitHub Release; версия в корневом `package.json` и `CHANGELOG.md` соответствуют выпуску.
- **AC5.** `git diff` по `.github/workflows/hexlet-check.yml` и `.github/workflows/README.md` пуст — файлы Hexlet не тронуты.

## Non-goals

- Написание новых тестов (интеграционных, e2e) — CI запускает только существующие гейты.
- Branch protection / required status checks — возможная отдельная микрозадача.
- Manifest-режим release-please, версии и changelog per-workspace, публикация пакетов в npm.
- Персональный PAT для release-please: release-PR осознанно не получает чеков CI (он меняет только `CHANGELOG.md` и версию), а его содержимое всё равно проходит через ручной мёрдж владельцем.
- Сборка и публикация артефактов (APK — `infra-002`, Docker — `infra-001`), деплой.
- Изменение процесса коммитов: Conventional Commits уже практика проекта, линтер сообщений не вводится.

## Связанные документы

- [`AGENTS.md`](../../../AGENTS.md) — раздел «Обязательные проверки»: канонический список и условия применения.
- [`README.md`](../../../README.md) — команды и окружение, воспроизводимые в CI.
- `.github/workflows/hexlet-check.yml` — существующий workflow Hexlet, неприкасаемый (FR6).
- [release-please-action](https://github.com/googleapis/release-please-action) и [release-please](https://github.com/googleapis/release-please) — документация экшена и семантики release-PR.
- [`tasks/README.md`](../../README.md) — реестр задач и очередь работ.
