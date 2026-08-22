---
status: согласовано
---

# TASK-003 — Проверка покрытия owner/guest сценариев

## Контекст и проблема

Успешная компиляция TypeSpec доказывает синтаксическую корректность, но не доказывает полноту API для пользовательских сценариев. Нужна отдельная проверка спецификации до начала frontend/backend implementation.

## Цель

Проверить, что TypeSpec и generated OpenAPI покрывают согласованные сценарии владельца и гостя, необходимые модели, ответы и отрицательные случаи.

## Зависимости

- `001` — согласованный домен и сценарии.
- `002` — согласованный и сгенерированный контракт.

## Проверяемые сценарии владельца

1. Узнать, завершён ли onboarding.
2. Сохранить первоначальные calendar settings.
3. Прочитать и изменить calendar settings.
4. Создать EventType.
5. Получить список EventType для административного UI.
6. Получить общий список предстоящих Booking с EventType и GuestDetails.

## Проверяемые сценарии гостя

1. Получить публичный список типов событий с названием, описанием и длительностью.
2. Выбрать EventType и получить только серверные слоты 14-дневного окна.
3. Создать Booking, передав `eventTypeId`, `startAt` и GuestDetails.
4. Получить success response с серверными `startAt`, `endAt` и данными встречи.
5. Получить документированную ошибку при занятом/невалидном слоте.

## Функциональные требования

1. Составить traceability matrix:

```text
user scenario step → TypeSpec operation → request model → response/error
```

2. Проверить source `.tsp` и generated OpenAPI, а не только один из артефактов.
3. Проверить наличие всех обязательных status/error variants.
4. Проверить, что generated frontend/backend code успешно создаётся и typechecks.
5. Проверить contract mock/smoke-вызовы, если pipeline предоставляет mock server.
6. Проверить отсутствие запрещённых полей и функций:
   - auth/session;
   - ownerId в client requests;
   - endAt в create-booking request;
   - произвольные from/to для публичного 14-дневного окна;
   - функции вне MVP.
7. Отделить «покрыто контрактом» от «должно быть проверено реализацией». Например, глобальное отсутствие пересечений является domain/backend invariant и не может считаться доказанным схемой OpenAPI.
8. Все обнаруженные пробелы вернуть в `002`; не исправлять их скрыто в QA-отчёте.

## Нефункциональные требования

- Проверка должна быть воспроизводимой командами проекта.
- Каждое замечание должно ссылаться на конкретный сценарий, operation/model или отсутствующий response.
- Result должен быть пригоден как gate перед параллельным запуском frontend/backend задач.

## API impact

`NONE` при успешной проверке. Найденные gaps инициируют возврат `002` в `черновик`.

## Acceptance criteria

1. Для каждого owner/guest шага есть однозначная operation и модель ответа.
2. Traceability matrix не содержит необоснованных пробелов.
3. Все обязательные error cases представлены в контракте.
4. TypeSpec compile и generation drift check проходят.
5. Generated frontend/backend packages typecheck.
6. Контракт не содержит запрещённых полей или scope creep.
7. Ограничения, которые проверяются только backend/domain tests, перечислены отдельно.
8. Result содержит итог `готов к реализации` либо конкретный список блокирующих gaps.

## Non-goals

- реализация UI и backend;
- проверка PostgreSQL constraint;
- concurrency test фактического Booking;
- E2E продукта;
- изменение доменных правил без отдельного согласования.

## Связанные документы

- [`../../docs/domain-rules.md`](../../docs/domain-rules.md)
- `../../docs/domain-model.md` — создаётся задачей `001`
- [`../../docs/contract-pipeline.md`](../../docs/contract-pipeline.md)
- [`../../.opencode/agents/qa-agent.md`](../../.opencode/agents/qa-agent.md)
- [`../task-002/`](../task-002/)
