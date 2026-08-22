---
status: согласовано
---

# TASK-002 — Контракт API MiniCal

## Контекст и проблема

После согласования доменной модели frontend и backend должны получить единый формальный HTTP-контракт. Ручной OpenAPI не используется: источником является TypeSpec, а остальные transport-артефакты генерируются.

## Цель

Сформулировать задачу Contract Agent и подготовить TypeSpec-спецификацию, которая покрывает необходимые API-сценарии владельца и гостя.

## Зависимости

- `000` — TypeSpec/codegen pipeline работает.
- `001` — доменные понятия и сценарии согласованы.

## Постановка Contract Agent

Прочитать согласованные `brief.md`, `adr.md`, `docs/domain-model.md`, `docs/domain-rules.md` и существующие `.tsp`-файлы. Изменять только ручной contract source и связанные конфигурации, разрешённые планом. Не реализовывать UI, backend handlers, database schema или Slot Engine. После изменений выполнить formatter, TypeSpec compile и полную генерацию, затем зафиксировать contract impact и generated diff.

## Требуемый API scope

### Владелец

- получить состояние первоначальной настройки;
- завершить первоначальную настройку календаря;
- получить настройки календаря;
- полностью обновить настройки календаря;
- получить список типов событий владельца;
- создать тип события;
- получить единый список предстоящих бронирований всех типов событий.

### Гость

- получить публичный список типов событий;
- получить свободные слоты выбранного типа события в серверном 14-дневном окне;
- создать анонимное бронирование с `GuestDetails`.

## Требования к контракту

1. Описать модели owner setup/calendar settings, availability, EventType, Slot, Booking и GuestDetails.
2. Клиент передаёт только `startAt`; `endAt` присутствует в response и вычисляется backend.
3. Клиент не передаёт `ownerId`, произвольные границы окна или `endAt`.
4. Для каждой операции описать method, route, параметры, request body, success response и применимые errors.
5. Использовать стабильные operation names и стабильные machine-readable error codes.
6. Покрыть минимум следующие ошибки:
   - validation error;
   - setup already completed;
   - calendar not configured — если операция требует setup;
   - EventType not found;
   - duplicate EventType id;
   - slot unavailable;
   - slot outside booking window;
   - slot not aligned или иной отдельный код для невалидного server slot.
7. Добавить документацию и representative examples, необходимые для generated OpenAPI и mock/testing.
8. Разнести TypeSpec по моделям и операциям без циклической/скрытой зависимости.
9. Сгенерировать:

```text
packages/contracts/generated/openapi.yaml
packages/api-client/src/generated/**
packages/backend-contract/src/generated/**
```

## Нефункциональные требования

- TypeSpec остаётся единственным ручным HTTP-контрактом.
- Generated-файлы не правятся вручную.
- API DTO не должны диктовать схему PostgreSQL.
- Контракт не должен обещать auth, отмену, перенос или функции вне MVP.
- Breaking changes должны быть перечислены в result.

## API impact

`CHANGE` — создаётся первый продуктовый HTTP-контракт MiniCal.

## Acceptance criteria

1. Все операции owner и guest scope представлены в `.tsp`.
2. TypeSpec форматируется и компилируется без предупреждений/ошибок, запрещённых конфигурацией.
3. Генерируется OpenAPI 3.x (определяется эмиттером).
4. Генерируются frontend SDK/types и backend runtime schemas/types.
5. Повторная генерация не создаёт незапланированный diff.
6. Все success/error responses различимы по status и/или стабильному code.
7. В generated API отсутствуют `ownerId` и клиентский `endAt` в create-booking request.
8. Operation names подходят для стабильных SDK-функций.
9. Result содержит список routes, models, errors и известных ограничений контракта.

## Non-goals

- backend implementation;
- database schema/migrations;
- frontend UI;
- проверка фактической бизнес-логики;
- auth;
- отмена/перенос и уведомления.

## Связанные документы

- [`../../docs/contract-pipeline.md`](../../docs/contract-pipeline.md)
- [`../../docs/domain-rules.md`](../../docs/domain-rules.md)
- `../../docs/domain-model.md` — создаётся и согласуется задачей `001`
- [`../../.opencode/agents/contract-agent.md`](../../.opencode/agents/contract-agent.md)
- [`../task-001/`](../task-001/)
