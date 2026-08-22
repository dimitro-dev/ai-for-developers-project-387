# MiniCal Domain Model

> Документ создан в рамках task-001. Является источником истины для доменных понятий MiniCal — **что существует**: сущности, VO, поля, кардинальности и инварианты. Поведение — что происходит при onboarding, в расписании, в окне записи и при бронировании — в [`docs/domain-rules.md`](domain-rules.md).  
> Согласован с [`docs/domain-rules.md`](domain-rules.md) и [`docs/architecture.md`](architecture.md).

Каждый инвариант формулируется здесь ровно один раз — в разделе своей сущности, с номером вида `I<номер>`. §10 — реестр этих номеров; остальные документы ссылаются на номер, а не пересказывают формулировку.

---

## 1. Глоссарий

| Термин | Описание | Тип |
|---|---|---|
| **CalendarOwner** | Единственный владелец календаря; singleton. Хранит профиль и настройки. | Aggregate Root (Entity) |
| **CalendarSettings** | Настройки владельца: timezone, рабочие дни/интервалы, slotInterval. | Value Object |
| **AvailabilityRule** | Один рабочий интервал в рамках дня (например, 09:00–17:00). Часть CalendarSettings. | Value Object |
| **EventType** | Вид встречи, создаваемый владельцем. Имеет стабильный публичный id. | Entity |
| **Slot** | Вычисляемый доступный временной интервал на основе настроек и занятости. Не хранится. | Value Object (computed) |
| **Booking** | Подтверждённая встреча. Фиксирует занятость и snapshot данных гостя. | Entity |
| **GuestDetails** | Контактные данные гостя (name, email, note). Snapshot внутри Booking. | Value Object |
| **SlotIntervalMinutes** | Шаг сетки слотов в минутах (например, 15, 30). Часть CalendarSettings. | Value Object |
| **BookingWindow** | 14 последовательных локальных дат владельца: [today, today+13]. | Value Object (computed) |
| **EndAt** | Момент окончания встречи; вычисляется сервером как `startAt + durationMinutes`. | Computed |

---

## 2. CalendarOwner (Aggregate Root)

### Ответственность
- Представляет единственного владельца календаря.
- Хранит профильные данные (`displayName`) и настройки календаря.
- Является singleton (I1).

### Жизненный цикл
1. **Не настроен** — после первого развёртывания, до завершения onboarding.
2. **Настроен** — после того, как владелец задал `displayName`, `timeZone`, рабочие дни/интервалы и `slotIntervalMinutes`.

### Инварианты
- **I1.** Не может быть более одного CalendarOwner.
- **I5.** Onboarding выполняется однократно. Повторный запрос настройки вызывает ошибку `OnboardingAlreadyCompleted` (§12).
- Поля `timeZone`, рабочие дни/интервалы и `slotIntervalMinutes` обязательны для завершения onboarding.

### Поля (domain)

```text
- displayName: string
- timeZone: IanaTimeZone
- availabilityRules: AvailabilityRule[]       — минимум 1 правило
- slotIntervalMinutes: positive int           — делитель 60 (15, 20, 30, 60)
- onboardingCompleted: boolean
```

---

## 3. CalendarSettings (Value Object)

### Ответственность
- Группирует настройки, влияющие на генерацию слотов.
- Замещается целиком при изменении (не patch отдельных полей владельцем).

### Состав

```text
- timeZone: IanaTimeZone
- availabilityRules: AvailabilityRule[]
- slotIntervalMinutes: positive int
```

### Инварианты
- Хотя бы один `AvailabilityRule` должен быть определён.
- `slotIntervalMinutes` должен цело делиться на 60 и быть ≥ 15 (принятое в MVP минимальное значение).

> Контракт выражает этот инвариант лишь частично: в `.tsp` стоят `@minItems(1)` для `availabilityRules` и `@minValue(15)`/`@maxValue(60)` для `slotIntervalMinutes`, а кратность 60 keyword'ами JSON Schema в OpenAPI 3.0 не выражается. Значения `25` и `40` проходят transport-валидацию и обязаны отсекаться backend/domain-проверкой. Решение зафиксировано в `tasks/archive/006/adr.md`.

---

## 4. AvailabilityRule (Value Object)

### Ответственность
- Описывает один повторяющийся рабочий интервал: дни недели, локальное время начала и окончания.

### Поля

```text
- daysOfWeek: Set<DayOfWeek>   — один или несколько дней
- startLocal: LocalTime        — начало рабочего дня
- endLocal: LocalTime          — окончание рабочего дня
```

### Инварианты
- `startLocal` < `endLocal`.
- Интервал полуоткрытый: `[startLocal, endLocal)`.
- Вместимость слота в этот интервал — I7 (§6).

---

## 5. EventType (Entity)

### Ответственность
- Определяет вид встречи: название, описание и продолжительность.
- Имеет стабильный публичный id, задаваемый владельцем.

### Идентичность
- Поле `id` (string) — уникальный стабильный идентификатор, выбираемый владельцем.

### Поля

```text
- id: string                   — уникальный, стабильный
- name: string
- description: string?
- durationMinutes: positive int
```

### Инварианты
- **I11.** `id` уникален в пределах владельца.
- `durationMinutes` > 0.

### Жизненный цикл
- Создаётся владельцем.
- Существует независимо от Booking.
- Что происходит с существующими Booking при удалении типа — [`domain-rules.md`](domain-rules.md) §3.

---

## 6. Slot (Value Object — computed)

### Ответственность
- Представляет **возможный** временной интервал для бронирования.
- Не хранится как запись — вычисляется на лету.

### Вычисляемые поля

```text
- startAtUtc: Instant          — начало интервала в UTC
- endAtUtc: Instant            — = startAtUtc + durationMinutes EventType
- eventTypeId: string          — для какого EventType рассчитан
```

### Правила вычисления
1. **Окно (I6)** — 14 локальных календарных дат владельца: `[today, today+13]` в timezone владельца.
2. **Сетка (I8)** — начало слота должно быть кратно `slotIntervalMinutes` относительно начала рабочего дня.
3. **Рабочее время (I7)** — слот целиком помещается в рабочий интервал `[AvailabilityRule.startLocal, AvailabilityRule.endLocal)`.
4. **Занятость** — слот не пересекается ни с одним существующим Booking: I2 (§7).
5. **Прошлое (I9)** — слоты, начавшиеся в прошлом (серверное время), исключаются.

### Инварианты
- **I6.** Окно — ровно 14 локальных дат `[today, today+13]` (правило 1).
- **I7.** Слот целиком помещается в рабочий интервал (правило 3).
- **I8.** Начало слота кратно `slotIntervalMinutes` (правило 2).
- **I9.** Слоты в прошлом исключаются (правило 5).
- **I10.** GET slots не резервирует время; единственный способ создать занятость — POST booking (§7).

---

## 7. Booking (Entity)

### Ответственность
- Фиксирует подтверждённую встречу.
- Является единственным источником занятости.

### Поля

```text
- id: string                           — уникальный идентификатор (UUID)
- eventTypeId: string                  — ссылка на EventType
- eventTypeName: string                — snapshot названия EventType на момент бронирования
- startAtUtc: Instant                  — начало встречи (UTC)
- endAtUtc: Instant                    — вычислено сервером (UTC)
- guestName: string
- guestEmail: string
- guestNote: string?
- createdAtUtc: Instant                — момент создания
```

### Инварианты
- **I2. Глобальная занятость** — Booking пересекается с другим Booking, если:
  ```
  A.startAtUtc < B.endAtUtc AND B.startAtUtc < A.endAtUtc
  ```
  Пересечение запрещено независимо от EventType.
- **I3. Полуоткрытый интервал** — `[startAtUtc, endAtUtc)`. Соседние интервалы допустимы: `10:00–11:00` и `11:00–11:30` не пересекаются.
- **I4. `endAtUtc` вычисляется сервером** — клиент не передаёт его:
  ```
  endAtUtc = startAtUtc + EventType.durationMinutes
  ```
- **I15. `eventTypeName` — snapshot названия типа** — фиксируется в момент создания брони:
  переименование или удаление EventType существующие брони не меняет. Обе booking-операции
  отдают сохранённое значение записи, а не join с текущими типами.
- **id** генерируется сервером (UUID) либо передаётся клиентом (идемпотентность).

### Жизненный цикл
- Создаётся через POST booking.
- **I14.** В MVP статусов нет: существование записи = подтверждённая встреча.
- Отмена и перенос — вне MVP ([`domain-rules.md`](domain-rules.md) §10).

---

## 8. GuestDetails (Value Object — snapshot)

### Ответственность
- Хранит контактные данные гостя на момент бронирования.

### Поля

```text
- name: string
- email: string
- note: string?
```

### Инварианты
- **I12.** `name` и `email` обязательны (в Booking — `guestName`, `guestEmail`).
- **I13.** Является snapshot внутри Booking, а не отдельной сущностью.
- Один гость (один email) может иметь несколько Booking в разное время.
- Изменение данных гостем после создания Booking — вне MVP ([`domain-rules.md`](domain-rules.md) §10).

---

## 9. Связи и кардинальности

```
CalendarOwner (1) ──── CalendarSettings (1)
     │
     ├── has many ── EventType (0..*)
     │
     └── has many ── Booking (0..*)
                           │
                           └── contains ── GuestDetails (1)
```

| Связь | Тип | Примечание |
|---|---|---|
| CalendarOwner → CalendarSettings | 1:1 | Настройки — часть агрегата |
| CalendarOwner → EventType | 1:N | Владелец создаёт типы событий |
| CalendarOwner → Booking | 1:N | Все бронирования принадлежат одному владельцу |
| EventType → Booking | 1:N | Один тип события может иметь много бронирований |
| Booking → GuestDetails | 1:1 | Snapshot данных гостя внутри бронирования |
| Slot → EventType | N:1 | Слот вычисляется для конкретного EventType |

---

## 10. Инварианты (полный список)

Реестр номеров. Формулировка каждого инварианта живёт в разделе-владельце — здесь только номер, краткое имя, уровень защиты и адрес формулировки. Ссылки вида `I<номер>` в любой документации разрешаются в эту таблицу.

### Глобальные

| # | Инвариант | Уровень защиты | Где сформулирован |
|---|---|---|---|
| I1 | CalendarOwner — singleton | Application + DB | §2 |
| I2 | Booking интервалы не пересекаются (глобально, все EventType) | Application + DB (exclusion constraint) | §7 |
| I3 | `[startAtUtc, endAtUtc)` — полуоткрытый интервал | Application | §7 |
| I4 | `endAtUtc` вычисляется сервером, не принимается от клиента | Application | §7 |
| I5 | Onboarding выполняется однократно | Application | §2 |

### Окно и слоты

| # | Инвариант | Уровень защиты | Где сформулирован |
|---|---|---|---|
| I6 | Окно — ровно 14 локальных дат: [today, today+13] | Application | §6 |
| I7 | Слот целиком помещается в рабочий интервал | Application | §6 |
| I8 | Начало слота кратно slotIntervalMinutes | Application | §6 |
| I9 | Слоты в прошлом исключаются | Application | §6 |
| I10 | GET slots не резервирует слот | Protocol (документация) | §6 |

### Данные

| # | Инвариант | Уровень защиты | Где сформулирован |
|---|---|---|---|
| I11 | EventType.id уникален | DB (unique) | §5 |
| I12 | guestName, guestEmail обязательны | Application + DB (not null) | §8 |
| I13 | GuestDetails — snapshot, не отдельный аккаунт | Domain model | §8 |
| I14 | Существование Booking = подтверждена (нет статусов) | Domain model | §7 |
| I15 | `Booking.eventTypeName` — snapshot названия типа, не join | Application + DB (not null) | §7 |

---

## 11. Публичный сценарий гостя

### Предусловия
- CalendarOwner настроен (onboarding завершён).
- Существует хотя бы один EventType.

### Шаги

#### Шаг 1: Получение типов событий
```
GET /event-types
→ [EventType, ...]
```
**Доменные ошибки:** `CalendarNotConfigured` — семантика в §12.

#### Шаг 2: Выбор EventType и получение слотов
```
GET /slots?eventTypeId={id}
→ [Slot, ...]   — свободные слоты на 14 дней
```
**Доменные ошибки:** `EventTypeNotFound` — семантика в §12.

#### Шаг 3: Создание бронирования
```
POST /bookings
{
  "eventTypeId": "string",
  "startAtUtc": "ISO instant",
  "id": "UUID?"           — опционально для идемпотентности
  "guest": {
    "name": "string",
    "email": "string",
    "note": "string?"
  }
}
→ Booking (201 Created)   — бронь создана этим запросом
→ Booking (200 OK)        — идемпотентный повтор: тот же id и эквивалентная нагрузка,
                            в теле ранее созданная бронь, ничего не создано
```

**Доменные ошибки** — `CalendarNotConfigured`, `EventTypeNotFound`, `SlotOutsideWindow`, `SlotNotAligned`, `SlotUnavailable`, `DuplicateBookingId`, `GuestNameRequired`, `GuestEmailRequired`; семантика каждой в §12.

### Постусловия
- Booking создан, время занято.
- Слот больше не возвращается в GET slots для любого EventType (следствие I2).

---

## 12. Доменные ошибки (каталог)

| Доменная ошибка | Семантика | Примечание |
|---|---|---|
| `CalendarNotConfigured` | Onboarding не завершён | Возникает в любом запросе, требующем настроек |
| `OnboardingAlreadyCompleted` | Повторная попытка onboarding | Owner flow, не guest |
| `EventTypeNotFound` | EventType.id не найден | |
| `SlotOutsideWindow` | startAt за пределами 14-дневного окна | Инвариант I6 |
| `SlotNotAligned` | startAt не кратен slotIntervalMinutes | Инвариант I8 |
| `SlotUnavailable` | Слот занят (конкурентный конфликт или двойная попытка) | Инвариант I2 |
| `DuplicateBookingId` | Тот же ключ `id`, другая полезная нагрузка; повтор с эквивалентной нагрузкой ошибкой не является | При идемпотентном создании: эквивалентный повтор возвращает `200` с ранее созданной бронью |
| `GuestNameRequired` | Имя гостя не передано | Инвариант I12 |
| `GuestEmailRequired` | Email гостя не передан или пуст | Инвариант I12 |
| `DuplicateEventTypeId` | EventType с таким id уже существует | Owner flow; инвариант I11 |
| `ValidationError` | Вход не удовлетворяет transport-ограничениям | Не доменная ошибка, а transport-уровень; в каталоге для полноты — контракт возвращает её наравне с остальными |

Каталог соответствует 11 error-моделям в `packages/contracts/src/models/errors.tsp`; коды в контракте — `SCREAMING_SNAKE_CASE` версии этих имён.

---

## 13. Границы моделей: domain ↔ transport ↔ persistence

Единственное описание разделения в проекте: остальные документы ссылаются на этот раздел, а не пересказывают его.

### Принцип разделения
Три модели имеют разные цели и **не обязаны** совпадать по структуре:

```
┌──────────────────────────────────────────────────────┐
│                   Domain Model                       │
│  Сущности и VO с бизнес-правилами и инвариантами     │
│  Не зависит от HTTP, JSON, SQL                       │
└──────────────────────┬───────────────────────────────┘
                       │ mapping
┌──────────────────────▼───────────────────────────────┐
│                Transport Model (DTO)                  │
│  То, что приходит/уходит через HTTP                  │
│  Валидация формата, сериализация, статусы            │
└──────────────────────┬───────────────────────────────┘
                       │ mapping
┌──────────────────────▼───────────────────────────────┐
│              Persistence Model (DB)                   │
│  Таблицы, колонки, constraints, индексы               │
│  Может отличаться для производительности              │
└──────────────────────────────────────────────────────┘
```

Один и тот же Booking проходит все три модели и ещё один промежуточный слой приложения:

```text
CreateBookingRequest  — transport input
BookingCommand        — application command
Booking               — domain entity
bookings row          — persistence record
BookingResponse       — transport output
```

### Примеры различий

| Понятие | Domain | Transport | Persistence |
|---|---|---|---|
| **EventType** | Сущность со стабильным id | `EventTypeResponse` — поля для показа | Таблица `event_types` |
| **Slot** | Value Object, вычисляемый | `SlotResponse` — start, end, eventType | Не хранится |
| **Booking** | Сущность с Business инвариантами | `CreateBookingRequest` / `BookingResponse` | Таблица `bookings` |
| **GuestDetails** | Snapshot внутри Booking | Поля `guest.name`, `guest.email` внутри JSON | Колонки той же таблицы |
| **AvailabilityRule** | VO с днями недели и временем | JSON-массив в CalendarSettings | JSON-колонка или отдельная таблица |
| **EndAt** | Вычисляется сервером | Отсутствует в запросе | Хранится как `end_at_utc` |
| **CalendarOwner / CalendarSettings** | Singleton-владелец и его настройки | `SetupRequest` (вход), `SetupStateResponse` (состояние onboarding), `CalendarSettingsResponse` (полные настройки) | Таблица владельца и настроек |

### Правила
1. Domain model не экспортируется напрямую в HTTP response.
2. Transport model может объединять/разделять поля для удобства API (например, `GuestDetails` → плоские поля `guestName` в JSON).
3. Persistence model может денормализовывать данные (GuestDetails внутри строки Booking).
4. Инварианты защищаются на уровне domain (приложение) и на уровне DB (constraints) — уровень для каждого указан в §10.
5. Slot engine работает с domain model, не с DTO.
