# Architecture decision — TASK-infra-006

## Контекст

Brief согласован 2026-08-15: обязательные проверки `AGENTS.md` должны выполняться на GitHub Actions для PR в `main` и push в `main`, release-please — вести release-PR с changelog и версией. Ограничения, влияющие на решение:

- `.github/workflows/hexlet-check.yml` — внешний генерируемый чек, редактировать и удалять нельзя (роль Infrastructure Agent, FR6 brief);
- CI-клон не содержит `docs/`, `tasks/`, `.opencode/` (в `.gitignore`) — проверки обязаны работать без них;
- секреты нежелательны (NFR2): вся автоматика — на стандартном `GITHUB_TOKEN`;
- Node 26 по `.nvmrc`, npm workspaces; полный набор тестов лёгкий (секунды), доминирует `npm ci`.

## Решение

**Два независимых workflow-файла** рядом с `hexlet-check.yml` — проверка кода и автоматизация релиза остаются раздельными процессами.

### `ci.yml`

- Триггеры: `pull_request` на `main` и `push` в `main`.
- **Одна джоба** `checks` на `ubuntu-latest`, шаги строго в порядке «Обязательных проверок» `AGENTS.md`:
  1. `actions/checkout`;
  2. `actions/setup-node` с `node-version-file: .nvmrc` и `cache: npm`;
  3. `npm ci`;
  4. `npm run contracts:format:check`;
  5. `npm run generate:check`;
  6. `npm run typecheck`;
  7. `npm test` (контрактный gate; `uispec:validate` в клоне без `docs/` штатно скипается);
  8. `npm test -w @minical/api`;
  9. `npm test -w @minical/client`.
- `concurrency` по `github.ref` с `cancel-in-progress: true` — устаревшие прогоны той же ветки отменяются.
- `timeout-minutes` на джобе (ориентир 15) — страховка от зависшего шага.

### `release-please.yml`

- Триггер: только `push` в `main`.
- Одна джоба из единственного шага `googleapis/release-please-action@v4` с `release-type: node`; checkout не нужен — экшен работает через GitHub API.
- `permissions`: `contents: write`, `pull-requests: write`, `issues: write` (лейблы release-PR).
- Токен — стандартный `GITHUB_TOKEN`. Zero-config: без `release-please-config.json` и manifest-файла; версия читается из корневого `package.json` (`0.1.0`), changelog — `CHANGELOG.md` в корне, одна версия на весь репозиторий.
- Prerequisite (one-time, вручную): Settings → Actions → General → «Allow GitHub Actions to create and approve pull requests».

Версии экшенов закрепляются мажорным тегом (`@v4` и текущие мажоры `checkout`/`setup-node`); точные мажоры фиксируются на реализации и в `result.md`.

## Затронутые компоненты

- `.github/workflows/ci.yml`, `.github/workflows/release-please.yml` — новые файлы; `hexlet-check.yml` и `README.md` рядом — без изменений.
- Корневые `package.json` (`version`) и `CHANGELOG.md` — начнут мутироваться release-PR'ами после внедрения (не правками этой задачи).
- `docs/architecture.md` — строка о `.github/workflows/` («внешний чек учебной платформы») становится неполной; обновление — пунктом плана.
- `AGENTS.md` — дерево репозитория не показывает `.github/`, а раздел «Обязательные проверки» не знает о CI; актуализация — пунктом плана.

## Последствия и компромиссы

- **Release-PR не получает чеков `ci.yml`**: события от `GITHUB_TOKEN` не запускают другие workflows. Принято осознанно — release-PR меняет только `CHANGELOG.md` и `version`, тестировать нечего, мёрдж выполняет человек. Побочный плюс: ветка `release-please--branches--main` и тег релиза не порождают холостых прогонов ни `ci.yml`, ни `hexlet-check`.
- **Красный `main` не останавливает release-please** — файлы независимы, `needs` между файлами невозможен. Контроль остаётся на человеке: статус `main` виден при мёрдже release-PR. Взамен — нет условной логики и молчаливой задержки release-PR из-за флака.
- **Одна джоба**: первый упавший шаг скрывает состояние последующих, в PR один чек, перезапуск только целиком. Принято: набор лёгкий, диагностика по логу тривиальна, а один `npm ci` вместо трёх экономит основное время прогона.
- **CI-гейт слабее локального**: `uispec:validate` в CI фактически скипается (нет `docs/`), поэтому валидация UISpec остаётся локальной обязанностью — это уже зафиксированная семантика скрипта, CI её не меняет.
- **Zero-config release-please на `0.x`**: по умолчанию `feat:` бампает minor (`0.1.0 → 0.2.0`), `fix:` — patch, а **breaking change (`!`) поднимет сразу `1.0.0`**. Принято: breaking-коммиты в проекте — редкое осознанное действие; если понадобится удержать `0.x` (`bump-minor-pre-major`), это отдельное решение с добавлением конфиг-файлов.
- **Первый release-PR соберёт changelog по всей истории**: релизных тегов в репозитории нет, точка отсчёта — начало истории. Принято как честная летопись проекта; поведение подтверждается на реализации, при неприемлемом результате запасной ход — `bootstrap-sha` в конфиге (то же отдельное решение, что и выше).

## Рассмотренные альтернативы

- **CI параллельными джобами** (contract / backend / client): гранулярные чеки и точечный перезапуск, но три `npm ci`, втрое больше YAML и нулевой выигрыш wall-clock на лёгких тестах. Отклонено.
- **Один общий workflow** (release-джоба с `needs: checks` и `if: push`): даёт «release-PR только при зелёном `main`», но вносит условную логику, смешивает ответственности и молчаливо задерживает release-PR при любом падении тестов. Отклонено.
- **PAT вместо `GITHUB_TOKEN`**: включил бы чеки CI на release-PR ценой создания, хранения и ротации персонального токена. Отклонено: содержимое release-PR не нуждается в тестах (см. brief, Non-goals).
- **Manifest-режим release-please** (версии per-workspace): пакеты не публикуются, независимые версии не нужны; лишние конфиги и шум в PR. Отклонено (закреплено в brief).
- **Триггер на push в любую ветку** (как у `hexlet-check`): быстрая обратная связь без PR, но холостые прогоны и двойной запуск на ветках с открытым PR. Отклонено на этапе brainstorming brief'а.

## Совместимость и миграция

Существующее поведение не меняется: `hexlet-check.yml` байт-в-байт нетронут, скрипты `package.json` не правятся, зависимости не добавляются. Workflows активируются фактом появления в `main`; до включения repo-настройки из prerequisite release-please будет падать с ошибкой прав — порядок внедрения (настройка → мёрдж workflows) фиксируется в plan. Откат — удаление двух файлов; уже созданный release-PR при этом достаточно закрыть, созданные теги/релизы остаются историей.
