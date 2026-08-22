# Результат TASK-infra-006

## Итог

CI и release-please работают в GitHub. Два workflow влиты в `main` (PR #5, коммит `09457c0`): `ci.yml` гоняет все «Обязательные проверки» AGENTS.md на PR в `main` и push в `main`; `release-please.yml` ведёт release-PR. Все acceptance criteria подтверждены живыми прогонами, включая проверку красноты намеренной поломкой. Первый релиз выпущен: тег `v0.2.0`, GitHub Release от 2026-08-15, `CHANGELOG.md` по всей истории проекта (12 feat + 1 fix), версия в корневом `package.json` — `0.2.0`. `hexlet-check.yml` не тронут.

## Что изменено

- `.github/workflows/ci.yml` — новый: триггеры `pull_request`/`push` на `main`; одна джоба `checks` (ubuntu-latest, timeout 15 мин, concurrency по `github.ref` с cancel-in-progress); шаги `actions/checkout@v7` → `actions/setup-node@v7` (`node-version-file: .nvmrc`, `cache: npm`) → `npm ci` → шесть проверок в порядке AGENTS.md.
- `.github/workflows/release-please.yml` — новый: только `push` в `main`; permissions `contents/pull-requests/issues: write`; единственный шаг `googleapis/release-please-action@v4` (`release-type: node`, zero-config, `GITHUB_TOKEN`, без checkout).
- `AGENTS.md` — `.github/workflows/` добавлен в дерево репозитория; в «Обязательных проверках» упомянуты CI и release-please.
- `docs/architecture.md` (локальный, вне git) — строка о `.github/workflows/` актуализирована.
- Настройка репозитория «Allow GitHub Actions to create and approve pull requests» включена владельцем (prerequisite P01).
- Производные процесса, не правки задачи: пустой коммит `3ff4d86` с футером `Release-As: 0.2.0`; релизный мёрдж `d73aa43` (PR #6, автор release-please) создал `CHANGELOG.md` и бамп `package.json`/`package-lock.json` до `0.2.0`.

Реализация выполнялась в изолированном worktree по протоколу `worktree-isolated-agent`: файлы писал агент Opus (один коммит, git-верификация оркестратором: 1 коммит, 3 файла, +52/−0), проверки гонял агент Sonnet с контрольным перепрогоном оркестратора. Worktree убран после мёрджа, remote-ветка задачи удалена.

## Контракт и generated-артефакты

Не менялись. `generate:check` зелёный локально и в CI — drift отсутствует.

## База данных и миграции

Не применимо.

## Выполненные проверки

Локально (изолированный worktree, свой `npm ci`):

- YAML-парсинг всех трёх workflow пакетом `yaml` — OK;
- `npm run contracts:format:check`, `npm run generate:check`, `npm run typecheck` — OK;
- `npm test` — контрактный gate OK; `uispec:validate` прошёл по-настоящему (38 файлов, errors=0), так как `docs/` доступен в worktree через симлинк;
- `npm test -w @minical/api` — 71/71; `npm test -w @minical/client` — 74/74;
- `git status` чист до и после `generate:check`.

Живые прогоны (GitHub Actions):

- **AC1**: PR #5 — чек `ci / checks` зелёный за 45 с, в логе все шесть проверок строго в порядке AGENTS.md. Намеренная поломка формата `.tsp` (`5d1cd72`) — красный за 26 с ровно на `contracts:format:check`, последующие шаги скипнуты; после отката force-push — снова зелёный (43 с).
- **AC2**: push в `main` (`09457c0`, `3ff4d86`, `d73aa43`) — `ci` зелёный на каждом.
- **AC3**: release-please создал PR #6 с первого запуска (заодно эмпирически подтверждён P01): changelog по всей истории, состав файлов — `CHANGELOG.md`, `package.json`, `package-lock.json`. После `Release-As: 0.2.0` PR пересобран на `0.2.0`.
- **AC4**: мёрдж PR #6 (`d73aa43`) → тег `v0.2.0` и GitHub Release опубликованы 2026-08-15; версия и changelog в `main` соответствуют выпуску.
- **AC5**: diff по `.github/workflows/hexlet-check.yml` и `.github/workflows/README.md` пуст; hexlet-прогоны зелёные на всех событиях.

## Отклонения от brief / ADR / plan

1. **Первый release-PR предложил `1.0.0`, а не `0.2.0`** — документированный дефолт release-please для первого релиза без тегов (initial version); прогноз ADR о вычислении версии из коммитов для первого релиза не сбылся. Решение владельца: футер `Release-As: 0.2.0` пустым коммитом — zero-config сохранён, конфиг-файлы не заводились.
2. **Откат поломки в P07 — `reset --hard` + force-push вместо revert-коммита**: история `main` не получила мусорных коммитов; суть проверки не изменилась.
3. **Уточнение к компромиссу ADR «release-PR без чеков CI»**: GitHub ставит прогон `ci` на release-PR в состояние «awaiting approval» — кнопка «Approve workflows to run» запускает его вручную. Чеки на release-PR доступны по клику, компромисс мягче, чем принималось.
4. **`gh` CLI потребовал разовой авторизации владельцем** в ходе P07 (планом не предусматривалось) — далее PR, наблюдение за чеками и проверка релиза выполнялись через `gh`.

## Известные ограничения и риски

- `uispec:validate` в CI-клоне штатно скипается (нет `docs/`) — CI-гейт слабее локального набора; валидация UISpec остаётся локальной обязанностью (зафиксировано в AGENTS.md).
- Zero-config на `0.x`: breaking-коммит (`!`) поднимет версию сразу до `1.0.0`; удержание `0.x` (`bump-minor-pre-major`) — отдельное решение с добавлением конфиг-файлов release-please.
- Чеки CI на release-PR требуют ручного «Approve workflows to run» после каждого обновления PR ботом.
- Экшены закреплены мажорами (`checkout@v7`, `setup-node@v7`, `release-please-action@v4`): минорные обновления подтягиваются автоматически; аудит supply chain вне scope.

## Описание для MR

Выполнено в PR #5 (влит FF в `main`).

### Summary

task-infra-006 — CI на GitHub Actions и release-please: «Обязательные проверки» AGENTS.md на каждом PR/push в `main`, автоматический release-PR с changelog и версией по Conventional Commits.

### Changes

- Новый `.github/workflows/ci.yml` — одна джоба со всеми шестью проверками, Node из `.nvmrc`, npm-кэш, concurrency, timeout 15 мин.
- Новый `.github/workflows/release-please.yml` — `googleapis/release-please-action@v4`, `release-type: node`, одна версия на репозиторий, `GITHUB_TOKEN`.
- `AGENTS.md` — дерево и раздел «Обязательные проверки» актуализированы.
- `hexlet-check.yml` не изменён.

### Verification

Локальный полный прогон проверок в изолированном worktree; живые прогоны: зелёный чек на PR (все шаги по порядку), красный на намеренной поломке формата, зелёный после отката; `ci` и `release-please` зелёные на push в `main`; release-PR создан, после `Release-As: 0.2.0` пересобран; мёрдж release-PR дал тег `v0.2.0` и GitHub Release.

### Known limitations

`uispec:validate` скипается в CI-клоне; breaking-коммит на zero-config уводит с `0.x` на `1.0.0`; чеки на release-PR — по ручному approve.
