---
status: согласовано
---

# План TASK-003

## Декомпозиция

| ID | Цель / проблема | Решение | Проверка | Состояние |
|---|---|---|---|---|
| P01 | **Извлечь эталон проверки** — зафиксировать все сценарии и инварианты | Собрать список 11 сценариев (owner: 6, guest: 5) из brief и доменные правила из domain-rules.md для сверки контракта | Чеклист зафиксирован в result.md | завершено |
| P02 | **Traceability matrix** — привязать каждый сценарий к конкретной операции и моделям | Построить таблицу `# → сценарий → шаг → TypeSpec operation → request model → response model → error cases → статус` (формат из ADR п.1) | Таблица заполнена, все строки со статусом `pass`/`gap` | завершено |
| P03 | **Source + OpenAPI converge** — убедиться, что .tsp компилируется и генерация не создаёт drift | Выполнить `npm run contracts:build` и `npm run generate:check`; просмотреть OpenAPI routes/models | Обе команды завершаются успешно, diff нет | завершено |
| P04 | **Typecheck generated packages** — SDK и схемы пригодны для frontend/backend | Выполнить `npm run typecheck --workspaces --if-present` | typecheck без ошибок во всех 4 workspaces | завершено |
| P05 | **Error variants** — проверить, что каждый сценарий имеет все нужные error responses | Сопоставить 11 error кодов из errors.tsp со сценариями (ValidationError → create/update, CalendarNotConfigured → pre-onboarding, SlotUnavailable → конфликт, EventTypeNotFound → невалидный id и т.д.); проверить наличие 400/404/409/428 | Каждый error code привязан к сценарию, отсутствующие — gap | завершено |
| P06 | **Prohibited fields** — контракт не содержит запрещённых полей/функций | Проверить 5 пунктов из ADR п.6: (1) auth/session нет, (2) `ownerId` нет в request, (3) `endAt` нет в CreateBookingRequest, (4) нет произвольных `from`/`to`, (5) нет endpoint/полей вне MVP | Все 5 пунктов проверены в .tsp, OpenAPI и скриптом P11 | завершено |
| P07 | **Contract vs implementation** — отделить что доказывает контракт, а что — только backend/domain тесты | Составить список инвариантов, которые НЕ доказываются схемой OpenAPI: пересечения Booking, 14-дневное окно, slot alignment, вычисление endAt, изменение настроек не сдвигает существующие Booking, конкурентная защита (PG exclusion constraint) | Список зафиксирован в result.md как «требует backend/domain тестов» | завершено |
| P08 | **Gaps → 002** — обнаруженные пробелы не чинить скрыто | При блокирующем gap: зафиксировать в result, вернуть 002 в черновик, обновить план 002. При non-blocking: зафиксировать как known limitation | Блокирующих gaps нет, non-blocking limitations зафиксированы в result | завершено |
| P09 | **Mock smoke** — если pipeline предоставляет mock | Запустить mock сервер (если доступен), выполнить smoke-запросы к ключевым эндпоинтам: health, getPublicEventTypes, getAdminSetup, getPublicSlots | Pipeline не предоставляет mock сервера — P09 пропущен | завершено |
| P10 | **Gate result** — сформировать отчёт и решение о готовности к реализации | Заполнить result.md: traceability matrix, результаты всех проверок, pass/fail по acceptance criteria, gaps или «готов к реализации» | result.md заполнен, итог явный | завершено |
| P11 | **OpenAPI structural validation** — программная проверка контракта (тест) | Написать скрипт `tests/contract-validation.test.ts`, который: (1) загружает openapi.yaml, (2) проверяет наличие всех 11 обязательных routes, (3) проверяет отсутствие endAt в create-booking request body schema, (4) проверяет что каждый error code присутствует в ответах | `node --experimental-strip-types tests/contract-validation.test.ts` проходит без ошибок | завершено |
| P12 | S3/S4 (отсутствие ограничений длины строк и email-валидации) закрываются в контракте дешевле, чем переносом в known limitations | Добавить `@minLength`/`@maxLength`/`@pattern` на user-input и snapshot поля, заменить `Booking.id: string` на `Uuid`; P08 продолжает действовать для остальных non-blocking рисков | `contracts:build` + `generate:check` + `typecheck` без ошибок | завершено |

## Порядок и зависимости

```text
P01 → P02
P03 ─────────────────────┐
P04 ─────────────────────┤
P11 ─── (зависит от P03)─┤
                         ├─→ P05 → P06 → P07 → P08 → P09 → P10
P02 ─────────────────────┘
```

P03/P04/P11 независимы, выполняются параллельно. P05 стартует после P02+P03. P10 — финальный.

## Принятые решения

- **Формат traceability matrix:** таблица в result.md (см. ADR п.1).
- **OpenAPI validation test:** `tests/contract-validation.test.ts` — простой скрипт на TypeScript, запускаемый через `npx tsx`. Набор минимальный: routes, prohibited fields, error codes.
- **Mock smoke:** если pipeline не предоставляет mock сервера — P09 пропускается с пометкой в result.
- **Drift check:** `npm run generate:check` — штатная команда, дублировать не нужно.
- **QA Agent** — ответственный исполнитель, Contract Agent привлекается только для правки .tsp.
- **Тип проверки error codes:** достаточно наличия модели в TypeSpec + привязки к operation; runtime-корректность сообщений — имплементация.
- **Отклонение от P08 (задокументировано честно):** для рисков S3/S4 (отсутствие ограничений длины строк и email-валидации) исполнитель сначала классифицировал их как non-blocking known limitation по правилу P08, но затем всё же исправил напрямую в `.tsp` — это правка контракта, не предусмотренная исходной декомпозицией (в plan.md не было пункта, разрешающего менять `.tsp` в рамках QA-задачи). Отклонение зафиксировано пунктом P12 и коммитом `ad9dbcf`. Правило P08 продолжает действовать для остальных non-blocking рисков (S1, S2, S5–S8), не тронутых этой правкой. Оставшиеся пробелы контракта (числовые ограничения, `@minItems`, `IanaTimeZone` pattern, query-параметры и т.д.) вынесены в `task-006`.
