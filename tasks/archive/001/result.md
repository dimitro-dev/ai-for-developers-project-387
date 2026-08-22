---
status: согласовано
---

# Результат TASK-001

## Итог

Создан документ `docs/domain-model.md`, описывающий доменные сущности, value objects, связи, инварианты, публичный сценарий гостя и границы между domain / transport / persistence моделями MiniCal. Все пункты плана P01–P09 выполнены.

## Что изменено

| Файл | Действие |
|---|---|
| `docs/domain-model.md` | **Создан** — полное описание доменной модели MiniCal |
| `docs/sources-of-truth.md` | **Изменён** — добавлена строка `domain-model.md` как источник правды для доменной модели |
| `tasks/task-001/adr.md` | **Изменён** — статус переведён в `согласовано` |
| `tasks/task-001/plan.md` | **Изменён** — статус переведён в `согласовано`; все пункты P01–P09 отмечены `завершено` |

AGENTS.md уже содержит ссылку на `docs/domain-model.md` в таблице «Что читать и когда» (строка 49), поэтому дополнительного обновления не потребовалось.

## Зафиксированные сущности и value objects

| Понятие | Тип | Раздел |
|---|---|---|
| CalendarOwner | Aggregate Root (Entity) | §2 |
| CalendarSettings | Value Object | §3 |
| AvailabilityRule | Value Object | §4 |
| EventType | Entity | §5 |
| Slot | Value Object (computed) | §6 |
| Booking | Entity | §7 |
| GuestDetails | Value Object (snapshot) | §8 |
| BookingWindow | Value Object (computed) | глоссарий |
| SlotIntervalMinutes | Value Object | глоссарий |

## Публичный сценарий гостя

Описан пошагово в §11:

1. **GET /event-types** — получение доступных типов событий
2. **GET /slots?eventTypeId=** — получение свободных слотов на 14-дневное окно
3. **POST /bookings** — создание бронирования с данными гостя

Для каждого шага перечислены доменные ошибки.

## Проверенные инварианты

| # | Инвариант | Уровень защиты |
|---|---|---|
| I1 | CalendarOwner — singleton | Application + DB |
| I2 | Booking интервалы не пересекаются (глобально) | Application + DB |
| I3 | `[startAtUtc, endAtUtc)` — полуоткрытый интервал | Application |
| I4 | `endAtUtc` вычисляется сервером | Application |
| I5 | Onboarding однократно | Application |
| I6 | Окно — ровно 14 локальных дат | Application |
| I7 | Слот целиком в рабочем интервале | Application |
| I8 | Начало слота кратно slotIntervalMinutes | Application |
| I9 | Слоты в прошлом исключаются | Application |
| I10 | GET slots не резервирует слот | Protocol |
| I11 | EventType.id уникален | DB |
| I12 | guestName, guestEmail обязательны | Application + DB |
| I13 | GuestDetails — snapshot, не аккаунт | Domain model |
| I14 | Существование Booking = подтверждена | Domain model |

## Каталог доменных ошибок

В §12 зафиксированы:
- `CalendarNotConfigured`, `OnboardingAlreadyCompleted`, `EventTypeNotFound`, `SlotOutsideWindow`, `SlotNotAligned`, `SlotUnavailable`, `DuplicateBookingId`, `GuestNameRequired`, `GuestEmailRequired`

## Влияние на последующий API design

- HTTP DTO **не обязаны** копировать domain model (явно указано в §13).
- Slot отсутствует в persistence — только вычисляется.
- GuestDetails хранится внутри Booking, не отдельной таблицей.
- `endAt` не принимается от клиента.
- Каждая доменная ошибка должна получить HTTP status code в task-002.

## Выполненные проверки

1. **Self-review против brief** — все 10 функциональных требований и 7 acceptance criteria покрыты.
2. **Согласованность с domain-rules.md** — проверены все 10 разделов правил, противоречий нет.
3. **Полнота глоссария** — все термины из brief и domain-rules включены и согласованы.
4. **Согласованность с ADR** — все 7 решений ADR отражены в модели.

## Отклонения от brief / ADR / plan

Отклонений нет.

### Правки по результатам ревью

| Файл | Что исправлено |
|---|---|
| `docs/domain-rules.md` | `Event Type` → `EventType` (3 вхождения); `SLOT_UNAVAILABLE` → `SlotUnavailable` |
| `docs/architecture.md` | `Event Type` → `EventType` (2 вхождения) |

Терминология приведена к единому формату, заданному в `docs/domain-model.md`.

## Известные ограничения и риски

1. **Документ не гарантирует runtime-проверки** — инварианты должны быть реализованы в коде и DB constraints.
2. **Singleton owner** — решение для MVP; multi-owner потребует новой задачи.
3. **Повторяющиеся контактные данные** — один гость (email) может иметь несколько Booking, данные дублируются.
4. **Нет статусов Booking** — отмена/перенос потребуют расширения модели.
5. **Нет буферов и minimum notice** — отложено до отдельного решения (domain-rules §10).

## Описание для MR

### Summary

Создана доменная модель MiniCal: `docs/domain-model.md`. Документ фиксирует сущности, value objects, инварианты, кардинальности, публичный сценарий гостя и границы между слоями (domain / transport / persistence). Обновлён `docs/sources-of-truth.md`.

### Changes

- `docs/domain-model.md` — новый документ (10 разделов + глоссарий)
- `docs/sources-of-truth.md` — добавлена строка для domain-model.md
- `tasks/task-001/adr.md` — согласован
- `tasks/task-001/plan.md` — согласован, все пункты выполнены

### Verification

- Self-review против brief.md (7 AC) — пройден
- Self-review против domain-rules.md (10 разделов) — противоречий нет
- Self-review против adr.md (7 решений) — отражены в модели

### Known limitations

Ограничения описаны в разделе «Известные ограничения и риски» выше.
