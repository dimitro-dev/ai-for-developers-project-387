# @minical/contracts — HTTP-контракт

Зона `packages/contracts/` отвечает за HTTP-контракт MiniCal и производные generated-артефакты.
`packages/contracts/src/**/*.tsp` — единственный ручной источник контракта (правило 5 корневого
[`AGENTS.md`](../../AGENTS.md)); всё остальное в цепочке — генерат.

## Читать

```text
корневой AGENTS.md
согласованные документы активной задачи (гейты — в её task.yaml; см. tasks/AGENTS.md)
plan.md активной задачи
docs/contract-pipeline.md
docs/domain-rules.md — если API выражает доменное правило
docs/domain-model.md — сущности, VO и инварианты, которые API выражает транспортно
packages/contracts/src/**/*.tsp
tests/contract-validation.test.ts — перед изменением набора маршрутов или операций
```

## Разрешено менять

```text
packages/contracts/src/**/*.tsp
TypeSpec project config и цели Makefile зоны — только если это предусмотрено ADR/plan активной задачи
состояние своего пункта в plan.md
contract-раздел активного result.md
```

Generated-файлы разрешено обновлять только запуском generation pipeline.

## Обязан

- описать route, method, параметры, body и все ответы;
- использовать стабильные operation names и error codes;
- добавить transport validation constraints и документацию;
- сохранять обратную совместимость, если задача не требует breaking change;
- прогнать форматирование, компиляцию и полную генерацию (`make -C packages/contracts format`,
  `make generate`);
- просмотреть generated diff;
- при добавлении или удалении операции согласовать с зоной [`tests/`](../../tests/AGENTS.md) правку
  `expectedRoutes`/`expectedOperations` в `tests/contract-validation.test.ts`: gate сверяет их
  количество на равенство и иначе падает;
- явно зафиксировать contract impact в `result.md`.

## Запрещено

- реализовывать UI, handlers, domain services или database schema;
- редактировать generated OpenAPI/SDK/schemas вручную;
- описывать ORM как копию API DTO;
- скрыто менять бизнес-правило через форму контракта;
- добавлять endpoint или поле, которых нет в согласованных документах задачи;
- ставить `согласовано` самовольно: правило 11 корневого [`AGENTS.md`](../../AGENTS.md), фиксация —
  только `scripts/task approve` после явного подтверждения владельца.

## При недостающем решении

Эскалации остальных зон приходят в `packages/contracts/`, но своих решений зона тоже не выдумывает.
Если требуемая форма API не выводится из согласованных документов активной задачи — например, не
решено, какой статус или error code соответствует доменному случаю, нужен ли новый endpoint, или
является ли изменение breaking, — не выбирай вариант молча. Зафиксируй вопрос в `plan.md` и верни
соответствующий гейт в `черновик`: `scripts/task draft <id> <гейт>`, правила каскада —
в [`tasks/flows/full.md`](../../tasks/flows/full.md), иерархия источников правды —
в `docs/sources-of-truth.md`. Эскалация, пришедшая из `apps/api/` или `apps/client/`, тоже не
является основанием менять контракт: основанием является согласованный документ задачи.

## Definition of Done

- `make -C packages/contracts gates` и `make gates` в корне зелёные;
- generated OpenAPI, frontend SDK и backend schemas обновлены;
- каждый ожидаемый ответ документирован;
- generated diff соответствует brief/ADR задачи;
- пункт плана и contract-раздел `result.md` обновлены.
