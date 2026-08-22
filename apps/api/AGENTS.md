# apps/api — REST backend MiniCal

Зона `apps/api/` отвечает за REST transport, application/domain logic и server-side validation —
все 12 операций HTTP-контракта MiniCal. Устройство зоны — [`architecture.md`](architecture.md),
запуск и переменные окружения — [`README.md`](README.md).

## Читать

```text
apps/api/architecture.md — фреймворк, слои и границы, точка валидации, ошибки, middleware, strip-only
apps/api/README.md — запуск, PORT и PUBLIC_WEB_URL, поведение in-memory состояния
корневой AGENTS.md
согласованные документы активной задачи (гейты — в её task.yaml; см. tasks/AGENTS.md)
plan.md активной задачи
docs/domain-rules.md
docs/domain-model.md — сущности, VO, кардинальности и инварианты
docs/contract-pipeline.md
generated backend transport schemas/types
```

## Разрешено менять

```text
apps/api/**
packages/slot-engine/**
backend unit/integration tests
ручной код packages/backend-contract/src/** вне generated/
состояние своего пункта в plan.md
backend-раздел активного result.md
```

Repository-код внутри `apps/api/**` — общая граница с зоной
[`packages/database/`](../../packages/database/AGENTS.md): схема, миграции и constraints принадлежат
`packages/database/`, вызывающий их код — `apps/api/`. Форма repository API согласуется между двумя
зонами до реализации, чтобы правки не пересекались.

## Обязан

- валидировать реальные HTTP-входы на runtime-границе;
- реализовывать только документированные операции и ответы;
- map-ить transport DTO в application/domain models;
- использовать серверное время;
- вычислять `endAt` по текущей длительности Event Type;
- повторно проверять слот внутри команды создания Booking;
- преобразовывать доменные ошибки в документированные HTTP errors;
- использовать PostgreSQL constraint как последнюю защиту от гонки.

## Запрещено

- менять `.tsp` или generated-файлы;
- принимать от клиента `ownerId` или authoritative `endAt`;
- возвращать незадокументированные поля/status/error codes;
- использовать только предварительный `SELECT` как защиту от double booking;
- копировать transport DTO напрямую в persistence без mapping;
- добавлять несуществующие интеграции MVP;
- ставить `согласовано` самовольно: правило 11 корневого [`AGENTS.md`](../../AGENTS.md), фиксация —
  только `scripts/task approve` после явного подтверждения владельца.

## При недостающем решении

Зафиксировать блокирующий пункт и требуемое изменение в `plan.md` активной задачи, затем передать
contract-работу в зону [`packages/contracts/`](../../packages/contracts/AGENTS.md).

## Definition of Done

- handler соответствует generated contract;
- domain rules покрыты тестами;
- runtime validation включена;
- documented errors воспроизводимы;
- `make -C apps/api gates` и `make gates` в корне зелёные (перечень проверок фазы «Проверка» живёт
  только в цели `gates` корневого `Makefile`);
- пункт плана и backend-раздел `result.md` обновлены.
