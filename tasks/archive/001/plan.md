---
status: согласовано
---

# План TASK-001

## Декомпозиция

| ID | Цель / проблема | Решение | Состояние |
|---|---|---|---|
| P01 | Термины разбросаны по обсуждению и domain rules | Собрать глоссарий и проверить отсутствие конфликтующих названий | завершено |
| P02 | Не определена ответственность владельца | Описать `CalendarOwner`, настройки timezone/availability и singleton-инвариант | завершено |
| P03 | Не определена модель вида встречи | Описать `EventType`, идентичность, поля и связь с владельцем | завершено |
| P04 | Slot можно ошибочно считать persisted entity | Описать вычисляемую природу Slot, временные границы, slotInterval alignment и отсутствие резерва | завершено |
| P05 | Не определена подтверждённая занятость | Описать `Booking`, lifecycle, `endAt`, глобальные пересечения и GuestDetails snapshot. Без отдельного статуса (exists = confirmed). | завершено |
| P06 | Нет формального гостевого flow | Описать public guest scenario, happy path и доменные ошибки: `SlotUnavailable`, `SlotOutsideWindow`, `SlotNotAligned`, `EventTypeNotFound`, `CalendarNotConfigured`, `OnboardingAlreadyCompleted`, `InvalidEventTypeId`, `DuplicateBookingId` | завершено |
| P07 | Нужна граница моделей | Добавить mapping `domain ↔ transport ↔ persistence` без преждевременной схемы БД | завершено |
| P08 | Новый документ должен стать доступным агентам | Обновить sources-of-truth и карту чтения в AGENTS.md | завершено |
| P09 | Нужно проверить полноту | Провести self-review против brief и `docs/domain-rules.md`, заполнить result | завершено |

## Порядок и зависимости

```text
P01
 ├─ P02
 ├─ P03
 ├─ P04
 └─ P05

P02 + P03 + P04 + P05
 └─ P06 → P07 → P08 → P09
```

## Решённые вопросы (согласовано с пользователем)

| Вопрос | Решение |
|---|---|
| Статус Booking | Не нужен. Существование записи = подтверждена. |
| AvailabilityRule | Value Object внутри настроек CalendarOwner. |
| Доменные ошибки vs HTTP | В `domain-model.md` только семантические ошибки домена. HTTP mapping и коды — в task-002. |
