---
status: согласовано
---

# План TASK-002

## Декомпозиция

| ID | Цель / проблема | Решение | Состояние |
|---|---|---|---|
| P01 | Нужно проверить входные решения | Прочитать domain model/rules и сверить список операций и моделей из brief; подтвердить scope | завершено |
| P02 | Нет общих transport primitives | Описать ids, local time, timezone fields, common response/error conventions | завершено |
| P03 | Нет моделей owner setup | Описать calendar settings, availability rules и setup state/request/response | завершено |
| P04 | Нет моделей EventType | Описать create/list representations и ограничения полей | завершено |
| P05 | Нет моделей Slot/Booking/GuestDetails | Описать slot window, create booking input и booking output без клиентского `endAt` | завершено |
| P06 | Нет единой модели ошибок | Описать стабильные error codes и status-specific response variants | завершено |
| P07 | Не описаны admin operations | Добавить setup/settings, event-types и upcoming bookings operations | завершено |
| P08 | Не описаны public operations | Добавить public event-types, slots и create booking operations | завершено |
| P09 | Не хватает examples/docs | Добавить representative examples и документацию операций/полей | завершено |
| P10 | Контракт должен стать generated packages | Выполнить format/compile/generate, проверить OpenAPI и SDK/schema diff | завершено |
| P11 | Нужен отчёт для следующей QA-задачи | Зафиксировать route/model/error inventory и открытые gaps в result | завершено |

## Порядок и зависимости

```text
P01
 └─ P02
     ├─ P03
     ├─ P04
     ├─ P05
     └─ P06

P03 + P04 + P05 + P06
 ├─ P07
 └─ P08

P07 + P08
 └─ P09 → P10 → P11
```

## Принятые решения

- **Response shape:** прямой массив для всех списков (без envelope).
- **GET /event-types/:id:** не нужен — гостевой flow получает данные из списка.
- **Error codes:** 9 отдельных кодов из brief; каждый имеет свою семантику, `SLOT_UNAVAILABLE` — только для конкурентного конфликта.
- **Pagination:** не требуется в MVP (14-дневное окно — до ~28 слотов на тип).
- **Namespace TypeSpec:** `MiniCal` (заменяет `MiniCalSmoke`).
- **Pattern operation names:** `{scope?}{action}{Entity}`.
