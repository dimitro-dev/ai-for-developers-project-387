# tests — проверки контракта и интеграции

Зона `tests/` отвечает за кросс-компонентные проверки контракта, доменного поведения и интеграции;
тесты приложений лежат рядом с кодом (`apps/api/src/**/*.test.ts`, `apps/client/src/**/*.test.ts(x)`)
и принадлежат своим зонам. `tests/contract-validation.test.ts` запускается целью `make contract-test`.

## Читать

```text
корневой AGENTS.md
согласованные документы активной задачи (гейты — в её task.yaml; см. tasks/AGENTS.md)
plan.md активной задачи
docs/domain-rules.md
docs/domain-model.md — инварианты, которые должны иметь проверяемое покрытие
docs/contract-pipeline.md
tests/contract-validation.test.ts — текущие границы контракта
релевантные implementation files
```

## Разрешено менять

```text
tests/**
contract tests
integration tests
E2E tests
test fixtures и test utilities
цели проверок в Makefile и CI — совместно с зоной infra/
состояние QA-пункта в plan.md
раздел проверок активного result.md
```

## Обязан

Проверить всё применимое к активной задаче:

- TypeSpec compile и generation drift;
- актуальность `expectedRoutes`/`expectedOperations` в `tests/contract-validation.test.ts` после
  изменений контракта — правку вносит эта зона по согласованию
  с [`packages/contracts/`](../packages/contracts/AGENTS.md);
- frontend/backend typecheck;
- реальные backend responses против контракта;
- onboarding хранится сервером;
- окно содержит ровно 14 локальных дат владельца;
- slot помещается в рабочее время и соответствует сетке;
- `endAt` вычисляет backend;
- разные Event Type конфликтуют при пересечении;
- соседние интервалы допустимы;
- конкурентные запросы создают не более одного Booking;
- изменение timezone/расписания не сдвигает существующие Booking;
- web/Android critical flow, если он затронут.

## Запрещено

- ослаблять тест ради прохождения дефектной реализации;
- подменять integration test mock-ом там, где проверяется constraint PostgreSQL;
- считать generated typecheck достаточным доказательством runtime validation;
- добавлять новое бизнес-правило только в тест;
- ставить `согласовано` самовольно: правило 11 корневого [`AGENTS.md`](../AGENTS.md), фиксация —
  только `scripts/task approve` после явного подтверждения владельца.

## При недостающем решении

Если ожидаемое поведение не зафиксировано в согласованных документах активной задачи, не закрепляй
свою трактовку тестом. Зафиксируй вопрос в `plan.md` и верни соответствующий гейт в `черновик`:
`scripts/task draft <id> <гейт>`, правила каскада — в [`tasks/flows/full.md`](../tasks/flows/full.md).

## Definition of Done

- acceptance criteria имеют проверяемое покрытие;
- критические negative/concurrency cases присутствуют;
- результаты команд записаны в `result.md`;
- flaky или непроверенные области перечислены явно;
- QA-пункт плана обновлён.
