# План TASK-process-001

Основание: [brief.md](brief.md), [adr.md](adr.md), [design.md](design.md). Этапы: A — инструмент,
B — документы процесса, C — миграция, D — интеграция в репо, E — скиллы, F — проверка.

## Декомпозиция

| ID | Цель / проблема | Решение | Состояние |
|---|---|---|---|
| P01 | Каркаса инструмента нет; нужно место, конфиг и подключение к npm | `tasks/tools/task.ts` (argv → диспетчер, заглушки команд), `lib/config.ts` (чтение `tasks.config.json` + валидация схемы конфига с понятными ошибками), сам `tasks.config.json` (типы включая `front/*` и `process`, статусы, состояния пунктов, треки с гейтами и hash-стратегиями, numberWidth 3, registryFile), `tasks/tools/tsconfig.json` (extends `../../tsconfig.base.json`, noEmit — для LSP). В корневой `package.json`: `task`, `task:check`, `task:test` (паттерн `cd tasks/tools && node --experimental-strip-types --test` — позиционный путь в `node --test` на Node 26 не работает, ADR §1), `task:typecheck` (`tsc --noEmit -p tasks/tools`), все с guard `test ! -d tasks \|\|`; в цепочку корневого `test` `task:check` на этом шаге НЕ встраивается — до миграции он красный на старой структуре, встраивание в P14 | завершено |
| P02 | Канона состояния нет; нужен слой чтения/записи манифеста | `lib/manifest.ts`: схема task.yaml (id, slug, title, track, legacyId?, depends, queue, gates, workspace?, links?, uispec?, meta), парсинг через `yaml` из корневых devDeps, каноническая сериализация (стабильный порядок ключей), `meta.rev` + `meta.selfHash` (хэш нормализованного содержимого без meta), валидация схемы с запретом неизвестных полей. Тесты: roundtrip, selfHash ломается при ручной правке, неизвестное поле — ошибка | завершено |
| P03 | Резолв задач: id ↔ путь, номера | `lib/resolve.ts`: обход дерева по типам из конфига, разбор `<номер>-<слаг>`, канонический id = путь без слага, выдача следующего номера в типе, поиск по id/legacyId. Тесты: резолв обоих видов, вложенные типы `front/*`, дубль номера — негативная фикстура | завершено |
| P04 | Стадия задачи должна вычисляться, а не храниться | `lib/stage.ts`: функция гейты+пункты → стадия (заявлена/постановка/проектирование/реализация N из M/результат/завершена); парсер таблицы пунктов `\| ID \| Цель \| Решение \| Состояние \|` из plan.md и чеклиста lite. Тесты: матрица всех комбинаций статусов для обоих треков, реальный формат таблиц (примеры из инвентаризации) | завершено |
| P05 | Команды видимости: `status` и `list` | `task status <id>`: стадия, активный гейт, прогресс пунктов, depends с их стадиями, workspace с живой проверкой (`git branch --list`, существование worktree-пути и uispec-путей); `task status` без id: незавершённые задачи со стадиями, одна активная — детально; `task list [--type]`. Тесты на фикстурах | завершено |
| P06 | Смена статусов гейтов — атомарно и по правилам | `lib/gates.ts`: `approve <id> <gate>` (порядок гейтов, статус+approvedAt+sha256 одной записью; hash-стратегии `ignore-state-column` для plan.md и `until:## Чеклист` для lite-setup — из конфига; при approve result — предупреждение о неубранных workspace.branch/worktree и очистка блока workspace), `draft <id> <gate>` с каскадом (brief → adr, plan, result; setup → result). Тесты: порядок, каскад, checksum-дрифт ловится, смена состояний пунктов plan — легитимна | завершено |
| P07 | Мутации остальных полей — только через CLI | `task set <id> <путь> <значение>` / `task unset`: белый список полей (title, depends, queue.*, workspace.*, links.*, uispec), списки — CSV и `+элемент`/`-элемент`; запрет set для id/track/gates/meta. Тесты: допустимые и запрещённые поля, списковые операции | завершено |
| P08 | Создание задач и каталога | Шаблоны `_template/full/` (четыре документа без frontmatter) и `_template/lite/` (task.md с секциями и маркером `## Чеклист`); `task new <тип> <слаг> [--lite] [--stub]` (номер от resolve, скаффолд, task.yaml с гейтами в черновике; `--stub` — только task.yaml); `task init` (дефолтный конфиг + скелеты шаблонов, существующее не перезаписывает). Тесты: new/full, new/lite, stub, init, повторный init | завершено |
| P09 | Эскалация трека | `task promote <id>`: lite → full, секции task.md раскладываются по четырём файлам; если setup был согласован — все гейты full в `черновик` (ADR-решение design.md). Тесты: до и после setup-согласования | завершено |
| P10 | Реестр должен генерироваться | `lib/registry.ts`: `task registry` пишет REGISTRY.md целиком — реестр по типам (id, title, depends, стадия), очередь работ (порядок из queue.after/parallel + rationale), таблица legacy-id; детерминизм (одинаковый вход → байт-в-байт выход). Тесты: генерация на фикстурах, `--check`-режим (drift → ненулевой код) | завершено |
| P11 | Целостность всего дерева — одной командой | `task check`: валидация схемы всех task.yaml, id↔путь, дубли номеров, порядок статусов гейтов, checksum-дрифт документов, selfHash, свежесть REGISTRY.md, существование depends и uispec-путей, межзадачная инвалидация (approvedAt upstream позже downstream — предупреждение), lite с признаками full (чеклист > ~7 пунктов, упоминания contract/миграций — предупреждение); `task repair <id>` (пересчёт selfHash после ревью). В `task:test` — интеграционный smoke: прогон check по живому дереву tasks/, когда оно есть. Тесты: по негативной фикстуре на каждый инвариант | завершено |
| P12 | Правила треков должны читаться за одно открытие | `tasks/flows/full.md` (4 гейта, стадии, минимальные разделы четырёх документов — перенос из старого README, правила отката, фаза «Проверка» внутри стадии «результат», чек-лист закрытия задачи) и `tasks/flows/lite.md` (task.md, гейты setup/result, критерии выбора lite «хоть одно да — full», promote) | завершено |
| P13 | Точка входа в tasks/ | `tasks/AGENTS.md`-маршрутизатор: карта файлов и скриптов (что канон, что генерат), таблица команд CLI с «когда запускать», роутинг «нужно X → зайди в Y / запусти Z», словарь статусов/стадий/треков, правила «task.yaml и REGISTRY.md — только через CLI», «конфиг меняет только владелец» | завершено |
| P14 | Перенос 19 существующих задач без потери данных | `task migrate` (разовая команда, остаётся как документация): перенос директорий по таблице соответствия ниже; task.yaml из frontmatter (status → гейты) + данных README (depends только task-id — не-задачные условия остаются текстом, ADR §7; queue.after/parallel/rationale из «Плана разработки»; approvedAt из снимка для front-guest-001/002 и infra-006; legacyId всем); sha256 с текущего содержимого; удаление frontmatter из четырёх документов (extra-файлы не трогаются, ADR §9); у «заявленных» (front-owner-001, infra-001, infra-002) шаблонные adr/plan/result удаляются, brief сохраняется (ADR §4); переписывание внутренних ссылок `](../task-…` по карте из инвентаризации (dangling front-guest-003 — как есть); удаление task-front-001; стабы `back/002`, `back/003` с rationale из README. После зелёного `check` — встроить `task:check` в цепочку корневого `npm test` после `uispec:validate` (перенесено из P01). Критерий: `task check` зелёный, `task registry` создал REGISTRY.md, `npm test` зелёный с новой строкой | завершено |
| P15 | Старый README отслужил | Удалить `tasks/README.md`, предварительно сверив, что всё содержимое покрыто: AGENTS (роутинг, словарь), flows (lifecycle, разделы документов, откаты), REGISTRY (реестр, очередь, legacy-таблица включая историю 004/005/INFRA-001), task.yaml (данные) | завершено |
| P16 | Корневой AGENTS.md описывает старый процесс | Переработка: правило прохода вглубь по вложенным AGENTS.md; Bootstrap сессии через `npm run task -- status` / скилл; раздел «Что читать и когда» → «Навигация» в формате роутинга; дерево `tasks/` в структуре; «Обязательные проверки» + `task:check` (в npm test) + `task:test`/`task:typecheck` при изменениях tools; класс «изменяется только инструментом» (task.yaml, REGISTRY.md) рядом с «Generated: read-only»; карта вложенных AGENTS.md вместо таблицы «Специализированные агенты»; таблица скиллов + taskmaster; правка ~14 мест по чек-листу ресёрча (строки 12–219) | завершено |
| P17 | Роли backend/frontend доставляются плохо | `apps/api/AGENTS.md`: вкомпоновать backend-agent.md разделом «Роль и границы» вместо ссылочной строки (дублей нет — проверено); `apps/client/AGENTS.md`: влить frontend-agent.md (10KB, включая процесс UISpec-генерации), актуализировав устаревшее (байт-в-байт копии скриптов → симлинк, ADR §8); правило 11 — ссылкой на корневой AGENTS.md, не копией | завершено |
| P18 | Роли contract/database/qa/infra не имеют места | Создать `packages/contracts/AGENTS.md`, `packages/database/AGENTS.md`, `infra/AGENTS.md`, `tests/AGENTS.md` из соответствующих role-файлов (структура Назначение/Читать/Разрешено/Обязан/Запрещено сохраняется, пути и упоминания tasks/README актуализируются); удалить `.opencode/agents/` | завершено |
| P19 | Живые docs ссылаются на старые пути и роли | `docs/sources-of-truth.md`: таблица путей задач → новая схема, + строки «состояние задачи — task.yaml (пишет только CLI)», «REGISTRY.md — генерат»; `docs/architecture.md`: дерево tasks/ (строки 114–125), `adr.md обязателен` (163), упоминание `.opencode/agents` (98–102); `docs/domain-model.md:71` → `tasks/archive/006/adr.md`; `docs/contract-pipeline.md`: роли → зоны/AGENTS.md, правила возврата → flows; `docs/ui-spec-kit/MANUAL.md:286` → новая схема путей. Исторические AUDIT.md/ROADMAP.md/спеки/комментарии в коде/CHANGELOG — не трогаем (ADR §6) | завершено |
| P20 | Корневой README устареет | `README.md`: строки 101/105 (tasks/README → tasks/AGENTS.md, схема путей), секция «Команды» — строки `npm run task*` в существующем формате таблицы | завершено |
| P21 | Скилла быстрого включения нет | `.opencode/skills/taskmaster/SKILL.md`: frontmatter-description с триггер-фразами («продолжи задачу», «что по задаче X», «статус задач», «заведи задачу», «согласуй brief/plan/result», «что дальше по проекту», паттерн id `тип/номер`); тело: status → tasks/AGENTS.md → flow трека → активный документ; таблица «намерение → команда»; запрет Edit на task.yaml/REGISTRY.md; девятый скилл, коллизий нет | завершено |
| P22 | Протокол worktree не знает про task.yaml | В `worktree-isolated-agent/SKILL.md` шаг 2 дополнить: после создания worktree — `npm run task -- set <id> workspace.branch <ветка>` и `workspace.worktree <путь>`; в шаг уборки — `task unset <id> workspace` (или очистка при approve result) | завершено |
| P23 | Фаза «Проверка» и приёмка | Полный набор «Обязательных проверок» (включая новые `task:check` в npm test, `task:test`, `task:typecheck`); прогон AC1–AC8 из brief, в т.ч. AC6 — живая проверка скилла в сессии Claude Code (по id и автоподхватом); результаты в result.md | завершено |

Допустимые состояния:

```text
в плане
выполняется
завершено
```

## Таблица соответствия миграции (P14)

| Старый id | Новый путь | Примечание |
|---|---|---|
| 000, 001, 002, 003, 006 | `archive/000` … `archive/006` | без переименования |
| contract-001 | `contract/001-guest-flow-extensions` | |
| infra-001 | `infra/001-postgres-compose` | заявлена: brief остаётся, пустышки удаляются |
| infra-002 | `infra/002-android-builder` | заявлена |
| infra-003 | `infra/003-http-security` | |
| infra-004 | `infra/004-contract-mock-prism` | |
| infra-005 | `infra/005-generated-entrypoints` | |
| infra-006 | `infra/006-ci-release-please` | |
| back-001 | `back/001-api-skeleton` | |
| — | `back/002-database-persistence` | стаб из очереди №9 |
| — | `back/003-slot-engine-package` | стаб из очереди №10 |
| front-ui-001 | `front/ui/001-guest-uispec` | |
| front-ui-002 | `front/ui/002-guest-uispec-rebuild` | |
| front-guest-001 | `front/guest/001-client-foundation` | |
| front-guest-002 | `front/guest/002-guest-screens` | |
| front-owner-001 | `front/owner/001-owner-screens` | заявлена |
| front-001 | — | удаляется (декомпозирована; запись в REGISTRY) |
| process-001 | `process/001-tasks-rework` | эта задача |

## Порядок и зависимости

- A (P01–P11) строго до C (P14): миграция — команда инструмента. Внутри A: P02–P04 после P01;
  P05–P09 после P02–P04; P10–P11 последними (используют всё).
- B (P12–P13) — параллельно A, до C: к моменту миграции документы процесса должны существовать.
- C: P14 → P15.
- D (P16–P20) и E (P21–P22) — после C, между собой параллельны.
- F (P23) — последним.
- Гейт пункта: для P01–P11 — `task:test` + `task:typecheck` зелёные; для остальных — гейты
  затронутой области; полный набор — один раз в P23 (решение владельца 2026-08-16). Коммиты:
  `tasks/` — в git с 2026-08-16 (ADR §10), коммитится после миграции логичными порциями и далее
  попунктно вместе с остальными tracked-файлами (package.json, README.md, apps/*/AGENTS.md,
  новые AGENTS.md); `docs/` и `.opencode/` остаются вне git.
- Режим реализации (решение владельца 2026-08-15): пункты выполняются субагентами;
  основная сессия ставит задачу, валидирует результат (гейты пункта, ревью diff) и ведёт
  состояния пунктов — сама код/документы не пишет.

## Обязательные проверки

Полный список — в [`AGENTS.md`](../../../AGENTS.md), результаты фиксируются в `result.md`.

- [ ] `npm test` — контрактный gate + `uispec:validate` + (с P01) `task:check`
- [ ] `npm run task:test` и `npm run task:typecheck` — при каждом изменении `tasks/tools/`
- [ ] `npm run typecheck` — правки package.json/скриптов не должны его сломать
- [ ] `npm test -w @minical/api`, `npm test -w @minical/client` — не затрагиваются, прогон в фазе «Проверка» (P23)
- [ ] `npm run contracts:format:check`, `npm run generate:check` — не затрагиваются, прогон в P23

## Блокеры и открытые вопросы

- Слаги в таблице соответствия — предложение; согласовать вместе с планом.
- Стратегия `ignore-state-column` требует устойчивого парсинга таблицы plan.md — формат
  подтверждён инвентаризацией (везде идентичная 4-колоночная схема), но правило «checksum-дрифт»
  для строк с изменённой шириной колонок надо проверить на реальных файлах в P06.
