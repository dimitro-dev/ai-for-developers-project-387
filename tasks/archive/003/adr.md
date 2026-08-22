---
status: согласовано
---

# Architecture decision — TASK-003

## Контекст

Перед implementation нужна проверяемая граница, показывающая, что API-контракт достаточен для пользовательских сценариев, но не подменяющая backend/domain tests.

## Решение

Ответственный исполнитель — QA Agent согласно `.opencode/agents/qa-agent.md`.

1. Использовать сценарную traceability matrix как основной метод проверки полноты. Формат — таблица в `result.md`:
   ```
   | # | Сценарий | Шаг | TypeSpec operation | Request model | Response model | Error cases | Статус |
   ```
2. Проверять одновременно TypeSpec source, generated OpenAPI и оба generated packages:
   - `packages/api-client` (frontend SDK);
   - `packages/backend-contract` (backend transport types/schemas).
3. Выполнять compile/generation/typecheck для каждого пакета и, при наличии, mock smoke.
4. Явно разделить:
   - contract guarantees — формы запросов/ответов, routes, statuses;
   - implementation guarantees — 14-дневное вычисление, server recheck, отсутствие пересечений.
5. При блокирующем gap возвращать `002` на доработку вместо локального обхода.
6. Проверить отсутствие в контракте запрещённых полей/функций:
   - auth/session (любые заголовки/параметры/модели);
   - `ownerId` во входящих запросах клиента;
   - `endAt` в create-booking request;
   - произвольные `from`/`to` для 14-дневного публичного окна;
   - любые endpoint/поля вне MVP.
7. Проверить наличие всех обязательных error responses:
   - 400 Validation Error;
   - 409 Slot Unavailable (занят/невалиден);
   - 404 Resource Not Found;
   - onboarding-check возвращает 400 `CalendarNotConfigured`; отдельный статус 428 Owner Not Onboarded сознательно не используется — это редко поддерживаемый клиентами код, а различимость случая обеспечивает стабильный `code` в теле ответа, а не HTTP-статус. Решение принято ещё в `task-002` и подтверждено при верификации в `task-003` (см. `result.md`, раздел «Отклонения от brief / ADR / plan»).
   Каждый error должен иметь стабильный `code` и человекочитаемый `message`.

## Затронутые компоненты

```text
tasks/task-003/result.md
contract validation scripts/tests — если предусмотрены plan
packages/contracts/generated/openapi.yaml
packages/api-client/src/generated/**
packages/backend-contract/src/generated/**
```

## Последствия и компромиссы

Положительные:

- frontend/backend не стартуют по неполному контракту;
- пробелы обнаруживаются до дорогой реализации;
- отчёт отделяет schema coverage от бизнес-корректности.

Ограничения:

- mock server не доказывает работу реального backend;
- OpenAPI не может выразить все временные и конкурентные инварианты;
- traceability требует ручной семантической проверки.

## Рассмотренные альтернативы

### Считать `tsp compile` достаточной проверкой

Отклонено: компилятор не знает пользовательские сценарии.

### Проверять контракт только после реализации

Отклонено: теряется преимущество независимой разработки frontend/backend.

### Исправлять gaps непосредственно QA Agent

Отклонено: ownership TypeSpec остаётся у Contract Agent и task lifecycle.

## Совместимость и миграция

Изменений runtime нет. Если QA обнаруживает gap, соответствующие документы `002` возвращаются в `черновик`, generated artifacts обновляются и проверка повторяется.
