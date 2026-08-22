---
status: согласовано
---

# TASK-006 — Contract constraints hardening

## Контекст и проблема

Code review задач `000`–`003` показал, что контракт после TASK-003 (коммит `ad9dbcf`, string constraints на user-input/snapshot полях, `Booking.id → Uuid`) всё ещё содержит пробелы, часть из которых прямо упомянута в `task-003/result.md` как вынесенная сюда:

- числовые поля `durationMinutes` и `slotIntervalMinutes` не имели `@minValue`/`@maxValue` — принимали любое `int32`, включая отрицательные и абсурдно большие значения;
- `availabilityRules` не имел `@minItems(1)`, хотя doc-комментарий модели уже утверждал «At least one rule is required» — расхождение между документацией и схемой;
- `IanaTimeZone.pattern` (`^[A-Za-z]+/[A-Za-z_]+(/[A-Za-z_]+)?$`) отвергал валидные IANA-зоны без слэша или с цифрами/знаками (`UTC`, `America/Port-au-Prince`, `Etc/GMT+3`);
- `ErrorResponse.code` не был ограничен по длине;
- query-параметр `eventTypeId` в `getPublicSlots` не был ограничен по длине — остаток риска S3 из `task-003` (модельные поля были закрыты, query-параметры — нет);
- `getPublicSlots` не документировал ответ 400 `ValidationError`, хотя `createPublicBooking` его документирует;
- `HealthResponse` была определена в `operations/health.tsp` вместо `models/common.tsp`, что не соответствует принятому в проекте разделению models/operations;
- `@service` не указывал версию API (`info.version` генерировался как `0.0.0`);
- gate-скрипт `tests/contract-validation.test.ts`, созданный в `task-003`, имел функциональные дефекты: проверка отсутствия `ownerId` не резолвила `$ref` и была вакуумной (всегда PASS независимо от факта), `yaml` не был объявлен в зависимостях `package.json`, отсутствовал npm-скрипт `test`, а `assert` останавливал выполнение на первой же ошибке вместо сбора полного списка несоответствий;
- `apps/api/src/server.ts` разошёлся с контрактом: `GET /health` возвращал лишнее поле `uptimeSeconds`, отсутствующее в `HealthResponse`, а тело 404-ответа не соответствовало форме `ErrorResponse`;
- корневой `README.md` называл генерируемый формат «OpenAPI 3.1» (фактически генерируется 3.0) и не объяснял, что `docs/`, `tasks/`, `.opencode/` — локальные, не публикуемые в git каталоги AI-процесса.

## Цель

Закрыть перечисленные пробелы контракта и синхронизировать generated-артефакты, минимальный backend-стенд, gate-скрипт и README с фактическим контрактом — так, чтобы каждое ограничение, выразимое схемой OpenAPI, жило в `.tsp` как единственном источнике истины, а невыразимые ограничения были явно перечислены как предмет backend/domain тестов, а не подразумевались молча.

## Зависимости

- `002` — базовый контракт (модели, операции, error codes).
- `003` — verification/security audit, обнаруживший и явно вынесший сюда часть пробелов (S3 остаток; см. `task-003/result.md`, разделы «Известные ограничения и риски» и «Отклонения от brief / ADR / plan»).

## Пользовательские сценарии

Новых пользовательских сценариев эта задача не вводит. Это hardening существующих owner/guest сценариев из `task-001`/`task-003`: ужесточение валидации полей, которые эти сценарии уже используют (`CalendarSettings`/`SetupRequest`/`CalendarSettingsResponse` — сценарии O2/O3a/O3b; `getPublicSlots` — сценарий G2), плюс синхронизация технических артефактов (gate-скрипт, `server.ts`, README), не влияющая на пользовательский сценарий напрямую.

## Функциональные требования

1. Добавить `@minValue(1)` и `@maxValue(1440)` на `durationMinutes` (`EventType`, `CreateEventTypeRequest`).
2. Добавить `@minValue(15)` и `@maxValue(60)` на `slotIntervalMinutes` (`CalendarSettings`, `SetupRequest`, `CalendarSettingsResponse`).
3. Добавить `@minItems(1)` на `availabilityRules` (`CalendarSettings`, `SetupRequest`, `CalendarSettingsResponse`).
4. Расширить `@pattern` у `IanaTimeZone` с `^[A-Za-z]+/[A-Za-z_]+(/[A-Za-z_]+)?$` на `^[A-Za-z0-9+_-]+(/[A-Za-z0-9+_-]+){0,2}$`, чтобы принимать `UTC`, `America/Port-au-Prince`, `Etc/GMT+3` и отвергать явно невалидные строки.
5. Добавить `@maxLength(100)` на `ErrorResponse.code`.
6. Добавить `@maxLength(100)` на query-параметр `eventTypeId` операции `getPublicSlots`.
7. Добавить ответ `400 ValidationError` в операцию `getPublicSlots`.
8. Перенести модель `HealthResponse` из `operations/health.tsp` в `models/common.tsp`.
9. Указать `version: "0.1.0"` в `@service`/`@info` (вместо генерируемого `info.version: 0.0.0`).
10. Починить `tests/contract-validation.test.ts`: проверка `ownerId` должна резолвить `$ref` схем перед проверкой полей; объявить `yaml` в зависимостях `package.json`; добавить npm-скрипт `test`; собирать все несоответствия перед завершением вместо падения на первом `assert`.
11. Синхронизировать `apps/api/src/server.ts` с контрактом: `GET /health` — только поля `HealthResponse`, без `uptimeSeconds`; 404-ответ — в форме `ErrorResponse`.
12. Обновить `README.md`: «OpenAPI 3.1» → «OpenAPI 3.0»; добавить пояснение, что `docs/`, `tasks/`, `.opencode/` — локальные каталоги AI-процесса, не публикуемые в репозитории.

## Нефункциональные требования

- Все проверки воспроизводимы штатными командами проекта: `npm run contracts:build`, `npm run generate:check`, `npm run typecheck --workspaces --if-present`, `npm test`.
- Ужесточение схемы не должно ломать существующие валидные данные (existing valid payloads продолжают проходить новые ограничения).
- Правки контракта — только в `.tsp`; generated-артефакты — только через штатный pipeline генерации, без ручного редактирования.

## API impact

`CHANGE`. Контракт становится строже: сужаются допустимые множества значений ранее не валидированных полей и query-параметра, добавляется новый error response, перемещается модель между файлами (без изменения имени/формы — не breaking для потребителей), меняется `info.version`. Это ужесточение валидации, а не изменение существующего поведения для валидных данных.

## Acceptance criteria

1. `durationMinutes` ограничен `@minValue(1)`/`@maxValue(1440)` в `EventType` и `CreateEventTypeRequest`.
2. `slotIntervalMinutes` ограничен `@minValue(15)`/`@maxValue(60)` в `CalendarSettings`, `SetupRequest`, `CalendarSettingsResponse`.
3. `availabilityRules` имеет `@minItems(1)` в тех же трёх моделях.
4. `IanaTimeZone.pattern` принимает `UTC`, `America/Port-au-Prince`, `Etc/GMT+3`.
5. `ErrorResponse.code` ограничен `@maxLength(100)`.
6. Query-параметр `eventTypeId` в `getPublicSlots` ограничен `@maxLength(100)`.
7. `getPublicSlots` документирует ответ `400 ValidationError`.
8. `HealthResponse` определена в `models/common.tsp`; `operations/health.tsp` ссылается на неё, не определяет заново.
9. `info.version` в generated OpenAPI не равен `0.0.0`.
10. `tests/contract-validation.test.ts`: проверка `ownerId` резолвит `$ref`; `yaml` в зависимостях `package.json`; есть `npm run test`; скрипт не останавливается на первом несоответствии.
11. `apps/api/src/server.ts`: `/health` без `uptimeSeconds`; 404 в форме `ErrorResponse`.
12. `README.md`: «OpenAPI 3.0»; есть пояснение про локальные `docs/`/`tasks/`/`.opencode/`.
13. `npm run contracts:build`, `npm run generate:check`, `npm run typecheck --workspaces --if-present`, `npm test` — без ошибок.

## Non-goals

- Новые пользовательские сценарии owner/guest — не вводятся, только hardening существующих.
- Auth/pagination/rate limiting — вне scope, остаются в `task-infra-003` / known limitations.
- Domain/backend-инварианты, не выразимые схемой OpenAPI (кратность `slotIntervalMinutes` числу 60, 14-дневное окно, глобальное отсутствие пересечений `Booking`) — не имитируются в контракте фиктивными ограничениями; остаются предметом backend/domain тестов (см. `adr.md`).
- Изменение доменных правил без отдельного согласования.

## Связанные документы

- [`../task-002/`](../task-002/)
- [`../task-003/`](../task-003/) — раздел «Известные ограничения и риски», «Отклонения от brief / ADR / plan»
- [`../../docs/domain-rules.md`](../../docs/domain-rules.md)
- [`../../docs/contract-pipeline.md`](../../docs/contract-pipeline.md)
