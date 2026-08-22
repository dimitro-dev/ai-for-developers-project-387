# Результат infra/001

## Итог

Локальный runtime-контур PostgreSQL на Docker Compose поднят и проверен: единственный сервис
`postgres` на образе `postgres:18`, две базы (`minical` и `minical_test`), healthcheck `pg_isready`,
именованный volume, четыре npm-скрипта `db:*` и отдельный CI-job `compose` рядом с `checks`.

Провайдер на хосте (macOS arm64, Homebrew): colima 0.10.3 (Virtualization.Framework, 4 CPU / 4 GB /
20 GB диска), docker CLI 29.7.2, Docker Engine в VM 29.5.2, Docker Compose 5.4.0. Обязательный шаг
установки — блок `cliPluginsExtraDirs` в `~/.docker/config.json`, без него `docker compose` не
находится. Образ — `postgres:18`, сервер отвечает как PostgreSQL 18.6 (Debian, aarch64), нативно,
без эмуляции.

Работа велась в изолированном worktree `../ai-for-developers-project-386-infra-001` на ветке
`task/infra-001-postgres-compose` по протоколу скилла `worktree-isolated-agent`; основное дерево
оставалось на `main`. Каталоги AI-процесса (`docs/`, `.opencode`, `CLAUDE.md`, `.mcp.json`,
`.claude`) проброшены симлинками, у worktree свой `npm ci`. Файлы контура и CI писала основная
сессия, документацию зоны и README — субагенты, прогоны контура и обязательный набор проверок —
отдельный проверяющий субагент; git-верификация коммитов и diff — основная сессия. Коммит на
завершённый пункт плана (P01 и P02 файлов не меняли и попали в один).

Ветка влита в `main` rebase-мёрджем через [MR #12](https://github.com/dimitro-dev/ai-for-developers-project-386/pull/12);
worktree удалён, локальная и remote-ветки убраны, контур перезапущен уже из `main` и отвечает.

## Что изменено

| Файл | Что |
|---|---|
| `infra/compose.yml` | новый: `name: minical`, сервис `postgres` на `postgres:18`, порт `${POSTGRES_PORT:-5432}:5432`, именованный volume, healthcheck `pg_isready` (`interval` 5s, `timeout` 5s, `retries` 10, `start_period` 30s), монтирование `postgres/initdb` в `/docker-entrypoint-initdb.d`; политика перезапуска не задана |
| `infra/.env.example` | новый: пять переменных с теми же значениями, что и дефолты в `compose.yml` |
| `infra/postgres/initdb/01-test-database.sh` | новый: создаёт `${POSTGRES_TEST_DB:-minical_test}` при инициализации пустого каталога данных |
| `infra/.gitkeep` | удалён — каталог больше не пуст |
| `infra/AGENTS.md` | снято утверждение о пустом каталоге; DoD зоны разведён со scope задачи; добавлен раздел «Точка расширения» (ADR Р10) |
| `package.json` (корень) | четыре скрипта: `db:up`, `db:down`, `db:logs`, `db:reset` |
| `.github/workflows/ci.yml` | job `compose` на `ubuntu-latest`, параллельно job `checks` |
| `README.md` | разделы «Требования к окружению», «Команды», «Запуск», «Структура» |

Код приложений, контракт и generated-артефакты не затронуты.

## Контракт и generated-артефакты

Не затронуты: `packages/contracts/src/**/*.tsp` не менялся, перегенерация расхождений не дала
(`generate:check` зелёный).

## База данных и миграции

Схемы, миграций и seed-данных задача не вводит — только пустые базы:

- `minical` — база разработки, создаётся штатным entrypoint из `POSTGRES_DB`;
- `minical_test` — база для проверок `back/002`, создаётся init-скриптом.

Init-скрипты `/docker-entrypoint-initdb.d/` отрабатывают только при инициализации пустого каталога
данных: изменение набора баз требует `npm run db:reset`. Schema, миграции и exclusion constraint —
зона `back/002`; форму строки подключения выбирает она же.

## Выполненные проверки

### Обязательный набор (локально, в worktree со своим `npm ci`)

| Команда | Результат |
|---|---|
| `npm run contracts:format:check` | OK — 9 файлов `.tsp` отформатированы |
| `npm run generate:check` | OK — перегенерация без diff в generated |
| `npm run typecheck` | OK — `tsc --noEmit` во всех четырёх workspace |
| `npm test` | OK — `uispec:validate` + `task:check` + контрактный gate |
| `npm run uispec:validate` | OK — 38 файлов, errors=0 (в worktree доступен `docs/` через симлинк, поэтому шаг не скипался) |
| `npm test -w @minical/api` | OK — 71 тест |
| `npm test -w @minical/client` | OK — 23 сьюта, 192 теста |
| `npm run task:check` | OK — 19 задач, 0 ошибок, 0 предупреждений |

Первый прогон `npm test` упал на `task:check`: `REGISTRY.md` устарел после закрытия пунктов плана.
Реестр перегенерирован `npm run task -- registry`, повторный прогон зелёный. Обязательный набор
зависимости от Docker не приобрёл — команды выше Docker не используют.

### Проверки контура

Все обращения к базам — изнутри контейнера (`docker compose exec -T postgres psql`), `psql` на хост
не ставился.

| Что | Как проверено | Результат |
|---|---|---|
| AC2 | `docker compose -f infra/compose.yml config` из чистого checkout без `.env` | без ошибок и без предупреждений о неопределённых переменных |
| AC3, AC4 | `npm run db:up` | healthy за ~6 с (и на первом запуске после `pull`, и на существующем томе) |
| AC5 | `psql -U minical -d minical -c "select current_database(), version();"` | `minical`, PostgreSQL 18.6 (Debian 18.6-1.pgdg13+2, aarch64) |
| AC6 | `psql -U minical -d minical_test -c "select current_database();"` | `minical_test`; `\l` показывает обе базы, владелец `minical`, UTF8 / `en_US.utf8` |
| Каталог данных | `show data_directory;` | `/var/lib/postgresql/data` |
| Init-скрипт | `docker compose logs postgres` | строка `initdb: создана база minical_test` |
| AC7 | таблица с пробной строкой → `db:down` → `db:up` (цикл повторён дважды) | строка на месте, том переиспользован |
| AC8 | `db:reset` → `db:up` | том удалён и создан заново; в `minical` таблиц нет, `minical_test` пересоздана |
| Тома | `docker volume ls` после каждого шага | только `minical_postgres-data`; анонимные тома не появляются |
| AC9 | состав коммитов и `.gitignore` | в git только `infra/.env.example` с безопасными дефолтами; `infra/.env` не создавался, образов проект не собирает |
| CI (P07) | `docker compose config -q` локально; разбор `ci.yml` парсером YAML | job `compose` без `needs` — параллелен `checks`, 6 шагов |

### CI на PR ([#12](https://github.com/dimitro-dev/ai-for-developers-project-386/pull/12))

| Job | Результат |
|---|---|
| `compose` (новый) | зелёный, 24 с — уложился в бюджет 2–3 минуты из ADR Р9 |
| `checks` | зелёный, 57 с — критический путь проверок не удлинился, jobs идут параллельно |
| `build` (hexlet-check) | зелёный, 8 с; файл workflow не изменялся |

AC12 закрыт: job контура зелёный на PR, `.github/workflows/hexlet-check.yml` не тронут.

### Версии

colima 0.10.3 · docker CLI 29.7.2 · Docker Engine (VM) 29.5.2 · Docker Compose 5.4.0 ·
образ `postgres:18` → PostgreSQL 18.6 · macOS arm64, Homebrew.

## Отклонения от brief / ADR / plan

**Точка монтирования тома.** ADR Р4 предписывает именованный volume «под `/var/lib/postgresql/data`».
Фактически том монтируется в родительский `/var/lib/postgresql`, а каталог данных закреплён явной
переменной `PGDATA=/var/lib/postgresql/data`. Причина обнаружена при проверке: образ `postgres:18`
объявляет `VOLUME /var/lib/postgresql` и держит каталог данных по умолчанию в
`/var/lib/postgresql/18/docker`. При монтировании именованного тома внутрь задекларированного
каталога Docker дополнительно создаёт анонимный том на каждый цикл `up`/`down` — висячие тома
копятся и `down -v` их не убирает. Существо решения ADR сохранено: данные лежат по
`/var/lib/postgresql/data` в именованном томе `minical_postgres-data`, персистентность и полный
сброс проверены.

Других отклонений нет.

## Известные ограничения и риски

- **Мажор PostgreSQL сменится вскоре.** Контур закрепляет `postgres:18`; PostgreSQL 19 выходит в
  сентябре 2026. Переход требует `pg_upgrade` или dump/restore — отдельное решение.
- **Контур только для локальной учебной среды.** Пароль по умолчанию слабый, auth в MVP нет,
  наружу контур не публикуется.
- **Ручные вызовы Compose требуют `-f infra/compose.yml`** — файл живёт в зоне `infra/`, шпаргалки
  из интернета не работают дословно; штатный путь — npm-скрипты.
- **Init-скрипт не переигрывается** на существующем томе: изменение набора баз требует `db:reset`.
- **Docker нужен только контуру.** Обязательный набор проверок зависимости от Docker не приобрёл:
  полный локальный прогон на машине без Docker остаётся возможным, job `compose` изолирован от job
  `checks`.

## Описание для MR

### Summary

Локальный runtime-контур PostgreSQL на Docker Compose: сервис `postgres` (`postgres:18`), две базы
`minical` и `minical_test`, healthcheck, именованный volume, npm-скрипты `db:*`, CI-job `compose`.
Разблокирует `back/002` (персистентность) и даёт Docker Engine для `infra/002`.

### Changes

- `infra/compose.yml`, `infra/.env.example`, `infra/postgres/initdb/01-test-database.sh` — контур,
  переменные и создание тестовой базы;
- `package.json` — `db:up`, `db:down`, `db:logs`, `db:reset`;
- `.github/workflows/ci.yml` — job `compose` параллельно `checks`;
- `README.md` и `infra/AGENTS.md` — требования к хосту, установка провайдера, команды, запуск,
  сброс, точка расширения зоны.

### Verification

Обязательный набор локально зелёный: `contracts:format:check`, `generate:check`, `typecheck`,
`npm test` (включая `uispec:validate` — 38 файлов, errors=0 — и `task:check`), `npm test -w
@minical/api` (71 тест), `npm test -w @minical/client` (23 сьюта, 192 теста).

Контур проверен вживую: `config` без `.env` и без предупреждений; `db:up` доводит сервис до healthy
за ~6 с; обе базы отвечают изнутри контейнера; `data_directory` — `/var/lib/postgresql/data`; данные
переживают `db:down`/`db:up` (цикл повторён дважды), `db:reset` даёт чистые базы; анонимные тома не
накапливаются.

### Known limitations

Контур пригоден только для локальной учебной среды; мажор PostgreSQL зафиксирован на 18; init-скрипт
отрабатывает только на пустом томе; сервисы `api` и `web` в контур не входят — отдельная задача
вместе с `back/002`.
