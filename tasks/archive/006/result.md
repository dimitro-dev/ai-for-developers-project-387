---
status: согласовано
---

# Результат TASK-006

> Реализация выполнена и запушена коммитом `f029414` в ветке `task/006-contract-hardening` **до** согласования документов задачи. Этот отчёт описывает фактическое состояние кода, чтобы следующая сессия не переписала уже отгруженное. Задача согласована пользователем 2026-08-04; `status: согласовано` проставлен по явному подтверждению (правило 11 в `AGENTS.md`).

## Итог

Контракт получил числовые, коллекционные и строковые ограничения, которых не хватало после `task-002`/`task-003`; исправлен паттерн `IanaTimeZone`, отвергавший валидные зоны; gate-скрипт перестал давать вакуумный PASS; `apps/api/src/server.ts` приведён к контракту. Пункты P01–P14 закрыты, 18 файлов изменено.

## Что изменено

**TypeSpec (`packages/contracts/src/`):**
- `models/event-type.tsp` — `durationMinutes`: `@minValue(1)` `@maxValue(1440)` в `EventType` и `CreateEventTypeRequest` (было голое `int32`);
- `models/owner.tsp` — `slotIntervalMinutes`: `@minValue(15)` `@maxValue(60)` и `availabilityRules`: `@minItems(1)` в `CalendarSettings`, `SetupRequest`, `CalendarSettingsResponse`;
- `models/common.tsp` — паттерн `IanaTimeZone` расширен до `^[A-Za-z0-9+_-]+(/[A-Za-z0-9+_-]+){0,2}$`; сюда же перенесена `HealthResponse`;
- `models/errors.tsp` — `ErrorResponse.code`: `@maxLength(100)`;
- `operations/public.tsp` — `@maxLength(100)` на query-параметр `eventTypeId` в `getPublicSlots` (остаток риска S3 из `task-003`), добавлен ответ `400 ValidationError`;
- `operations/health.tsp` — только ссылается на модель, определение убрано;
- `main.tsp` — `info.version` `0.0.0` → `0.1.0` через `@info` (`@service` в TypeSpec 1.14 версию не принимает).

**Gate-скрипт `tests/contract-validation.test.ts`:**
- `checkOwnerId` была вакуумной: все request body в OpenAPI — `$ref`, а функция на `$ref` сразу возвращала `true` и не читала `components.schemas`, то есть печатала PASS, ничего не проверив. Теперь `$ref` резолвится рекурсивно с защитой от циклов;
- `assert` копит все провалы вместо `exit(1)` на первом;
- секции 428 и unbounded arrays переведены из `console.warn` в явные `assert`/`INFO`;
- добавлены проверки новых ограничений и `maxLength` у всех строковых query-параметров;
- убраны дублирующий литерал маршрутов и неиспользуемые переменные.

**Прочее:**
- `package.json` — `yaml` и `@typespec/openapi` объявлены явно (использовались из транзитивного резолва), добавлен npm-скрипт `test`;
- `apps/api/src/server.ts` — `/health` больше не возвращает лишнее `uptimeSeconds`, 404 приведён к форме `ErrorResponse`;
- `README.md` — «OpenAPI 3.1» → 3.0, npm 10+ → 11+, добавлен раздел про локальные `docs/`, `tasks/`, `.opencode/`.

## Контракт и generated-артефакты

Перегенерированы одной командой `npm run generate`, все три каталога сходятся с источником:

```text
packages/contracts/generated/openapi.yaml       openapi: 3.0.0, info.version 0.1.0
packages/api-client/src/generated/**            frontend SDK
packages/backend-contract/src/generated/**      types + Zod schemas
```

`npm run generate:check` diff не даёт — drift отсутствует.

## База данных и миграции

Не затрагивается — задача ограничена контрактом, gate-скриптом и минимальным `server.ts`, миграций БД нет.

## Выполненные проверки

Строки 1–6 — проверки, названные в сообщении коммита `f029414` дословно. Строки 7–13 отдельными пунктами в сообщении коммита не перечислены: они входят в прогон gate-скрипта (`npm test`, 139 PASS / 0 FAIL) и в нём же подтверждены, поэтому в колонке «коммит» указано «в составе gate», а не самостоятельный PASS. Колонка «повторно» — независимый прогон 2026-08-03 в рамках аудита AI-workflow.

| # | Проверка | Команда | Коммит | Повторно |
|---|---|---|---|---|
| 1 | Формат `.tsp` | `npm run contracts:format:check` | назван в коммите | PASS, exit 0 (`✔ 9 formatted`) |
| 2 | Идемпотентность генерации | `npm run generate` дважды | назван в коммите | — |
| 3 | Generation drift | `npm run generate:check` | — | PASS, exit 0, diff отсутствует |
| 4 | Typecheck 4 workspaces | `npm run typecheck` | назван в коммите | PASS, exit 0 |
| 5 | Gate-скрипт | `npm test` | 139 PASS / 0 FAIL | PASS, exit 0, 139 PASS / 0 FAIL |
| 6 | Негативный прогон gate | внедрить `ownerId` в request body | exit 1 | не повторялся |
| 7 | `durationMinutes` bounds | gate §10 | в составе gate | PASS |
| 8 | `slotIntervalMinutes` bounds | gate §10 | в составе gate | PASS |
| 9 | `availabilityRules` minItems | gate §10 | в составе gate | PASS |
| 10 | `ErrorResponse.code` maxLength | gate §10 | в составе gate | PASS |
| 11 | `eventTypeId` query maxLength | gate §10 + секция SECURITY | в составе gate | PASS |
| 12 | `info.version` != `0.0.0` | gate §10 | в составе gate | PASS |
| 13 | `/health` минимальное раскрытие | gate, секция SECURITY | в составе gate | PASS |
| 14 | `IanaTimeZone` pattern (`UTC`, `America/Port-au-Prince`, `Etc/GMT+3`) | ручная проверка regex | назван в коммите | не повторялся |
| 15 | `server.ts` health/404 sync | `curl /health` | `{"status":"ok"}` | не повторялся |
| 16 | `getPublicSlots` 400 ValidationError, расположение `HealthResponse`, README | review diff | не выделены в коммите отдельными проверками | подтверждено чтением текущих файлов |

## Отклонения от brief / ADR / plan

1. **Порядок процесса нарушен:** реализация выполнена до согласования brief/adr/plan, тогда как `tasks/README.md` строит порядок так, что документы гейтят работу. Формально правило не сломано — `tasks/README.md` говорит, что `status` отражает согласованность документа, «а не прогресс реализации», — но по смыслу процесса это инверсия, и она зафиксирована здесь и в `plan.md`, а не оставлена неявной.
2. **P13 выполнен частично:** упоминание «OpenAPI 3.1» исправлено только в `README.md`. Идентичное утверждение в `docs/contract-pipeline.md` осталось и было найдено позже аудитом AI-workflow — исправлено отдельно, вне этой задачи.

## Известные ограничения и риски

Унаследовано от `task-003` (см. `task-003/result.md`) и подтверждено в `adr.md` этой задачи как сознательно оставленное вне контракта:

- кратность `slotIntervalMinutes` числу 60 — не выразима keyword'ами JSON Schema в OpenAPI 3.0, предмет backend/domain теста. В контракте есть только `15..60`, поэтому значения вроде `25` и `40` проходят схему и должны отсекаться backend-ом;
- 14-дневное окно генерации слотов — корректность вычисления схемой не доказывается;
- глобальное отсутствие пересечений `Booking` — конкурентный инвариант, закрывается constraint-ом PostgreSQL, которого пока нет.

Дополнительно выявлено после коммита:

- gate-скрипт сверяет точный список 8 маршрутов и 11 `operationId` на равенство счётчиков, поэтому любая новая операция контракта обязана сопровождаться правкой `expectedRoutes`/`expectedOperations` — иначе `npm test` упадёт. Ответственность за эту синхронизацию закреплена в `.opencode/agents/contract-agent.md` и `qa-agent.md`.

## Описание для MR

### Summary

TASK-006: contract constraints hardening and gate script fixes.

### Changes

- Числовые и коллекционные ограничения: `durationMinutes` 1..1440, `slotIntervalMinutes` 15..60, `availabilityRules` minItems 1.
- `IanaTimeZone` pattern исправлен — старый отвергал `UTC`, `America/Port-au-Prince`, `Etc/GMT+3`.
- `ErrorResponse.code` и query-параметр `eventTypeId` ограничены по длине; `getPublicSlots` документирует `400 ValidationError`.
- `HealthResponse` перенесена в `models/common.tsp`; `info.version` = `0.1.0`.
- Gate-скрипт: резолвинг `$ref` (устранён вакуумный PASS проверки `ownerId`), накопление всех провалов, новые проверки ограничений.
- `yaml` и `@typespec/openapi` объявлены явно, добавлен npm-скрипт `test`.
- `apps/api/src/server.ts` и `README.md` приведены к контракту и фактам.

### Verification

`contracts:format:check`, `generate:check` (drift отсутствует), `typecheck` по 4 workspaces, `npm test` — 139 PASS / 0 FAIL, негативный прогон с внедрённым `ownerId` → exit 1, `curl /health` → `{"status":"ok"}`. Независимый повторный прогон 2026-08-03: все четыре команды exit 0.

### Known limitations

Кратность `slotIntervalMinutes` 60, 14-дневное окно и глобальный запрет пересечений `Booking` схемой не выражаются — остаются предметом backend/domain тестов и constraint-а PostgreSQL.
