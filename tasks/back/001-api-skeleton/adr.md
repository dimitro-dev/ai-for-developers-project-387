# Architecture decision — TASK-BACK-001

> **Возвращён в `черновик` 2026-08-08 задачей [`task-contract-001`](../../contract/001-guest-flow-extensions/)**
> (её FR12, решение Р10). Причина: входной контракт стал версии `0.2.0` — двенадцатая операция
> `getPublicCalendar`, обязательное `Booking.eventTypeName` (snapshot), второй успешный статус `200`
> у `createPublicBooking`, инвертированная семантика `DUPLICATE_BOOKING_ID`, `@minItems(1)` у
> `daysOfWeek`, `@minLength(1)` у ссылок на `eventTypeId`. Затронуты: «Контекст» (таблица фактов),
> Р1, Р2 (`V3` и вывод), Р3, Р5 (шаги 5 и 9), Р9 (`ROUTES` и состав тестов), «Последствия» п. 8,
> Q1, Q2, Q5, таблица «Contract gaps», «Подтверждения пользователя», «Совместимость и миграция».
> Содержание приведено в соответствие с новым контрактом; статус `согласовано` возвращает
> пользователь или назначенный reviewer (правило 11 `AGENTS.md`).

## Контекст

`brief.md` задачи согласован и фиксирует вход: 12 операций / 9 маршрутов (FR2), валидация
generated Zod-схемами (FR3), таблица `code → status` (FR4), репозитории над in-memory (FR5),
инварианты I1–I15 (FR6), тест покрытия контракта (FR7), конфигурация через env (FR8). Выбор
Express 5 и отказ от code-first схемной машинерии тоже сделаны в brief — ADR их не пересматривает.

Решать нужно то, что brief намеренно не решает: внутреннюю структуру `apps/api`, точку и способ
валидации, форму доменных ошибок, API репозиториев, границу slot-логики, механику работы с
таймзонами, режим запуска TypeScript и способ проверки покрытия маршрутов.

Что уже есть: `apps/api/src/server.ts` — smoke на `node:http` (только `GET /health`, порт из `PORT`),
без зависимостей и без `test`-скрипта; `packages/backend-contract/src/generated/` — типы и 46
Zod-схем (после `task-contract-001`); корневой `npm test` — `uispec:validate` плюс `node --experimental-strip-types
tests/contract-validation.test.ts`.

Фактическое состояние окружения проверено в этой рабочей копии, а не по памяти:

| Факт | Проверка | Результат |
|---|---|---|
| Node | `.nvmrc` / `node -v` | 26 / v26.0.0 |
| `Temporal` | `node -e`, в т.ч. с `--harmony-temporal` | `undefined` — API недоступно |
| Type stripping | `node file.ts` | работает без флага; `enum` → `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX`, parameter properties (`constructor(public x)`) отклоняются |
| `node --test` | прогон в песочнице | находит `**/*.test.ts` дефолтным discovery, импорт `./lib.ts` работает |
| Type stripping внутри `node_modules` | пакет физически в `node_modules` vs симлинк workspace | физический → `ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING`; симлинк (realpath вне `node_modules`) → работает |
| `@minical/backend-contract` | `import('@minical/backend-contract')` из корня | `ERR_MODULE_NOT_FOUND` — в package.json нет ни `exports`, ни `main` |
| `tsc` + `.ts`-specifier + `exports` на `.ts` | реплика workspace, NodeNext + `allowImportingTsExtensions` + `noEmit` | exit 0, Node тот же файл выполняет |
| Версии в реестре | `npm view` | `express` 5.2.1, `@types/express` 5.0.6; установленный `zod` — 4.4.3 |
| `z.iso.datetime()` | прогон на установленном zod | `...Z` и `...000Z` — ok; `+03:00` и naive-строка — отклоняются |
| ~~`eventTypeId: z.string().max(100)` → пустая строка **проходит** транспортную валидацию~~ | `safeParse('')` | **устарело после `task-contract-001`:** схема стала `z.string().min(1).max(100)`, пустая строка отвергается на транспортной границе (проверено `safeParse` в `task-contract-001/result.md`) |
| ~~`completeAdminSetup` — только 200/409; `updateAdminSettings` — 400 только `CalendarNotConfigured`~~ | обход `paths` из `generated/openapi.yaml` | **устарело после `task-contract-001`:** `completeAdminSetup` документирует `400 ValidationError`, `updateAdminSettings` — `anyOf[ValidationError, CalendarNotConfigured]` |

Последние две строки порождали расхождения с brief (Q1, Q2) и contract gaps G1, G2, G4. Все три
gap'а закрыты upstream задачей `task-contract-001`; Q1 и Q2 закрыты вместе с ними — см. «Вопросы к
brief». Строки оставлены зачёркнутыми, а не удалены: они объясняют, откуда взялись V1–V4 и G1–G4.

## Решение

Общая рамка: минимально достаточная структура под 12 операций (скилл `lean-code`), каждая новая
абстракция обоснована требованием brief или инвариантом `docs/domain-model.md`. Ни одной
абстракции «на будущее», кроме тех, что прямо требует FR5 (замена хранилища) и non-goal о
последующем выносе Slot Engine.

### Р1. Слоистость и структура `apps/api/src`

Четыре концерна, без DI-контейнера, без классов-сервисов, без интерфейсов там, где нет второй
реализации. Use-case — обычная функция `(deps, command) => result`.

```text
apps/api/src/
├── server.ts                 entry: loadConfig() → createMemoryStore() → createApp(deps) → listen
├── config.ts                 Р10: PORT, PUBLIC_WEB_URL
├── app.ts                    createApp(deps): express.json() → монтирование по ROUTES → 404 → error-middleware
├── http/
│   ├── routes.ts             ROUTES — декларативный реестр 12 операций (данные, без обработчиков)
│   ├── handlers.ts           handlers: Record<OperationId, (deps) => RequestHandler>
│   ├── parse.ts              parseOrThrow(schema, value) → VALIDATION_ERROR
│   ├── present.ts            domain → transport DTO
│   └── errors.ts             ERROR_STATUS, errorMiddleware, notFoundHandler
├── usecases/
│   ├── owner.ts              setup, settings, event types, upcoming bookings, публичный профиль
│   └── booking.ts            listSlots, createBooking
├── domain/
│   ├── model.ts              domain-типы и VO
│   ├── errors.ts             DomainError + коды
│   ├── slots.ts              чистый slot engine (Р5)
│   └── timezone.ts           Intl-примитивы (Р6)
└── store/
    ├── repositories.ts       интерфейсы (FR5)
    └── memory.ts             in-memory реализация
```

Правила границ:

- `domain/**` не импортирует `express`, `@minical/backend-contract`, `store/**` — только `node:*`
  и собственные модули. Это условие Р5.
- `usecases/**` знают `domain/**` и интерфейсы репозиториев, но не знают `express`: ни `req`, ни
  `res`, ни статусов.
- `http/**` — единственное место, где живёт transport: Zod-схемы, статусы, сериализация.
- `store/**` реализует интерфейсы и больше ничего не экспортирует наружу.

Расположение mapping:

| Направление | Где | Почему |
|---|---|---|
| transport request → command | `http/handlers.ts` | обработчик — единственный, кто знает DTO; command уходит в use-case уже плоским (`guest.name` → `guestName`, I13) |
| domain → transport response | `http/present.ts` | 5 функций (`eventType`, `slot`, `booking`, `settings`, `publicCalendar`), включая `Date → toISOString()` и подстановку `publicUrl` из конфига. `present.booking` отдаёт `eventTypeName` из сохранённого snapshot'а записи, а не join'ом с текущими типами (I15) |
| domain → persistence | отсутствует намеренно | в in-memory хранимая запись **есть** доменная сущность: третьей модели без схемы БД описывать нечего. Пометить `lean-code:`; реальный row-mapping появится внутри PG-репозитория (Р4, «Совместимость и миграция»). Запрет `backend-agent.md` («копировать transport DTO в persistence без mapping») соблюдён: transport→domain mapping существует и обязателен |

Use-case определён для всех операций, кроме `getHealth` (возвращает константу прямо в
обработчике). Уравнивать по «есть ли логика» не стал: `getAdminEventTypes` — почти проброс, но
`getPublicEventTypes` требует проверки настроенности, `getAdminUpcomingBookings` — фильтра и
сортировки; смешанная гранулярность дороже одного лишнего однострочного use-case.

Двенадцатая операция `getPublicCalendar` (`task-contract-001`, Р1) — use-case в `usecases/owner.ts`:
читает запись владельца, требует завершённого onboarding (`CALENDAR_NOT_CONFIGURED`) и отдаёт
единственное поле `displayName`. Презентер `present.publicCalendar` — отдельная функция, а не
`present.settings` с усечением: публичная проекция обязана быть узкой по построению, иначе будущее
поле `CalendarSettingsResponse` протечёт гостю (AC1 `task-contract-001` защищён проверкой гейта).

### Р2. Точка и способ Zod-валидации

Явный вызов в обработчике через один хелпер, не middleware-фабрика:

```ts
// http/parse.ts
export function parseOrThrow<T>(schema: ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (parsed.success) return parsed.data;
  const detail = parsed.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ');
  throw new DomainError('VALIDATION_ERROR', `Invalid request: ${detail}`);
}
```

Обоснование против middleware: middleware обязано положить результат в `req.body`/`req.query`, и
чтобы обработчик увидел уточнённый тип, нужен либо generic-параметр `Request<…, T>`, либо `as`.
Явный вызов даёт вывод типа из схемы без приведения и стоит одной строки на операцию — валидируются
только 5 из 12 (4 тела + 1 query).

Используются **операционные** схемы, а не модельные: `zCompleteAdminSetupBody`,
`zUpdateAdminSettingsBody`, `zCreateAdminEventTypeBody`, `zCreatePublicBookingBody`,
`zGetPublicSlotsQuery`. Они привязаны к `operationId`, поэтому будущее расхождение тела операции с
общей моделью подхватится автоматически. Самописных схем нет (FR3).

Порядок: **транспорт → домен**. Доменный код работает с уже разобранными значениями (например,
`new Date(startAtUtc)` предполагает валидный ISO-instant), а `VALIDATION_ERROR` по контракту —
транспортная ошибка. Обратный порядок заставил бы каждую доменную проверку заново защищаться от
мусора.

Ошибка парсинга JSON: `express.json()` бросает `SyntaxError` с `status: 400` и
`type: 'entity.parse.failed'`. Error-middleware распознаёт этот признак и отвечает
`400 VALIDATION_ERROR` — то же, что дал бы Zod на нераспарсенном теле. Пустое тело у `PUT`/`POST`
даёт `{}` и отклоняется схемой как отсутствие обязательных полей.

Доменная валидация настроек (сверх Zod), обе операции — `completeAdminSetup` и
`updateAdminSettings`, все четыре проверки → `VALIDATION_ERROR`:

| # | Проверка | Источник требования | Почему схемой не закрыто |
|---|---|---|---|
| V1 | `60 % slotIntervalMinutes === 0` | `domain-model.md` §3, `task-006/adr.md` п.2 | кратность не выразима keyword'ами OpenAPI 3.0: `25`, `40` проходят `@minValue(15)`/`@maxValue(60)` |
| V2 | `startLocal < endLocal` в каждом правиле | `domain-model.md` §4 | сравнение двух полей схемой не выражается |
| V3 | `daysOfWeek` непуст | `domain-model.md` §4 («один или несколько дней») | **обоснование через контракт снято:** `task-contract-001` (FR6) добавил `@minItems(1)`, `zAvailabilityRule` отвергает пустой массив на транспортной границе. `V3` остаётся доменной проверкой только для прямых вызовов use-case в обход HTTP; удалять её или оставить — решение реализации `back-001`, но через HTTP она недостижима |
| V4 | `timeZone` существует в ICU | `task-006/adr.md`, альтернатива «enum зон» | `zIanaTimeZone` — regex структуры: `Foo/Bar` проходит, а `Intl` на нём бросает `RangeError` (проверено) |

V4 — не украшение: без неё сохранённая мусорная зона превращает документированный
`getPublicSlots` в недокументированный `500`. Реализация — `isValidTimeZone()` в `domain/timezone.ts`
(`try { new Intl.DateTimeFormat('en-US', { timeZone }) }`).

V1–V4 отдают `400 VALIDATION_ERROR` на `completeAdminSetup` и `updateAdminSettings`, и этот ответ
теперь **документирован** контрактом (`task-contract-001`, FR5): расхождение G1 исчезло вместе со
своей причиной, Q1 закрыт.

Ответы на runtime не валидируются (цена без потребителя), но в backend-тестах тела ответов
проверяются схемами `zGetPublicSlotsResponse`, `zCreatePublicBookingResponse`,
`zGetAdminSettingsResponse` и т.д. — дешёвая проверка соответствия контракту в момент прогона.

### Р3. Модель доменных ошибок и отображение на HTTP

Доменный слой знает только `code`; статус знает только транспорт. Единая таблица в одном месте:

```ts
// http/errors.ts
export const ERROR_STATUS = {
  VALIDATION_ERROR: 400, CALENDAR_NOT_CONFIGURED: 400, SLOT_OUTSIDE_WINDOW: 400,
  SLOT_NOT_ALIGNED: 400, GUEST_NAME_REQUIRED: 400, GUEST_EMAIL_REQUIRED: 400,
  EVENT_TYPE_NOT_FOUND: 404,
  ONBOARDING_ALREADY_COMPLETED: 409, DUPLICATE_EVENT_TYPE_ID: 409,
  SLOT_UNAVAILABLE: 409, DUPLICATE_BOOKING_ID: 409,
} as const satisfies Record<DomainErrorCode, number>;
```

**Уточнение направления зависимостей (внесено при ревью `plan.md`, решение не меняется).** Union
`DomainErrorCode` объявляется в `domain/errors.ts` — там же, где `DomainError`, — а `http/errors.ts`
типизирует им таблицу через `satisfies`. Первоначальная запись выводила тип как
`keyof typeof ERROR_STATUS`, то есть домен импортировал бы тип из транспорта, что противоречит
правилам границ Р1 и удорожает вынос Slot Engine. Обе гарантии сохраняются: `satisfies` требует
статус для каждого кода и не пропускает лишние ключи, а литеральные значения не расширяются до
`number`.

`DomainError` — класс с полями `code: DomainErrorCode` и `message` (без parameter properties: они
не erasable-синтаксис, см. Р11). Use-case делает `throw new DomainError('SLOT_UNAVAILABLE', …)`,
error-middleware отвечает `res.status(ERROR_STATUS[err.code]).json({ code, message })` — ровно
форма `ErrorResponse`.

Почему таблица, а не статус в месте возникновения: FR4 — это таблица из 11 строк, и её проверяемость
важнее локальности. Статус, зашитый в `throw`, пришлось бы держать согласованным в 10 файлах, а
`EVENT_TYPE_NOT_FOUND` возникает в двух операциях (`getPublicSlots`, `createPublicBooking`) — с
таблицей это один и тот же 404 по построению.

Почему `throw`, а не Result-тип: у `createPublicBooking` девять точек раннего выхода; Result
заставил бы каждый вызов повторно разбирать объединение, а выигрыш в явности съедается тем, что
транспорт всё равно сводит всё к `{code, message}`. Express 5 сам пробрасывает отказ async-обработчика
в error-middleware (Р8), поэтому обёртки не нужны.

Что даёт типизация: `code` — ключ таблицы, поэтому недокументированный код невозможно сконструировать
(компилятор), и `as const` не даёт добавить код без статуса. Чего типизация **не** даёт:
пооперационные подмножества кодов из FR4 не выражены — ничто не мешает `getPublicEventTypes`
бросить `SLOT_UNAVAILABLE`. Осознанное ограничение: проверка держится на ревью и HTTP-тестах.

Различение шести 400 и двух 409 у `createPublicBooking` не требует отдельного механизма: статус берётся
из таблицы, а различает клиент по полю `code` — как и сказано в brief FR4.

Проверка настроенности календаря включается **точно** на тех операциях, где
`CALENDAR_NOT_CONFIGURED` документирован — после `task-contract-001` их шесть:
`getAdminSettings`, `updateAdminSettings`, `getPublicCalendar`,
`getPublicEventTypes`, `getPublicSlots`, `createPublicBooking`. У `getAdminEventTypes`,
`createAdminEventType`, `getAdminUpcomingBookings`, `getAdminSetup` документирован только 2xx,
поэтому проверки нет: список пустой, создание EventType до onboarding разрешено (Q6),
`getAdminUpcomingBookings` до onboarding отдаёт `[]`.

### Р4. Репозитории и in-memory хранилище (FR5)

Три интерфейса в `store/repositories.ts`, все методы асинхронные — иначе переход на PostgreSQL
переписал бы каждый use-case, что FR5 прямо запрещает.

```ts
export interface OwnerRepository {                       // I1: singleton по конструкции
  get(): Promise<OwnerRecord | null>;
  save(owner: OwnerRecord): Promise<void>;
}
export interface EventTypeRepository {
  list(): Promise<EventType[]>;
  findById(id: string): Promise<EventType | null>;
  create(eventType: EventType): Promise<void>;           // отказ: DUPLICATE_EVENT_TYPE_ID (I11)
}
export interface BookingRepository {
  findById(id: string): Promise<Booking | null>;
  listNotEndedBefore(instant: Date): Promise<Booking[]>; // getAdminUpcomingBookings
  listBusyIntervals(fromUtc: Date, toUtc: Date): Promise<TimeInterval[]>;
  create(booking: Booking): Promise<void>;               // отказ: SLOT_UNAVAILABLE | DUPLICATE_BOOKING_ID
}
```

Ключевые решения и их причины:

1. **Предикаты живут в репозитории, а не в use-case.** `listBusyIntervals(from, to)` и
   «пересечение внутри `create`» — это ровно то, что PostgreSQL выразит диапазонным запросом и
   exclusion constraint. Если бы use-case тянул все бронирования и фильтровал сам, миграция
   переписала бы прикладной слой.
2. **`create` — последняя линия защиты, а не наивный insert.** Репозитории асинхронные, значит между
   `findOverlapping`-подобной проверкой и вставкой есть `await`, то есть микротаск-граница, на которой
   два параллельных запроса могут переставиться. Поэтому in-memory `create` сам проверяет пересечение
   и уникальность id **без внутренних `await`** — единственная атомарная операция. Это выполняет
   требование `backend-agent.md` «не использовать только предварительный SELECT» уже на in-memory и
   даёт PG-репозиторию готовое место, где ошибку constraint нужно превратить в тот же `DomainError`.
   Предварительная проверка в use-case остаётся: она даёт корректный код (`DUPLICATE_BOOKING_ID`
   вместо `SLOT_UNAVAILABLE`) и внятное сообщение.
3. **`listBusyIntervals` возвращает `TimeInterval`, а не `Booking`** — slot engine не должен знать
   сущность Booking (Р5).
4. **Singleton владельца — переменная, а не коллекция.** `let owner: OwnerRecord | null = null` внутри
   замыкания фабрики: I1 нарушить структурно невозможно. В PG это одна строка с check-constraint.
5. **`GuestDetails` — плоский snapshot внутри `Booking`** (`guestName`, `guestEmail`, `guestNote?`),
   как в `domain-model.md` §7; отдельной коллекции гостей нет — это и есть I13.
6. **Хранилище — фабрика с замыканием** (`createMemoryStore(): Store`), а не модуль-синглтон с
   глобальным состоянием: каждый тест получает чистое хранилище без сброса глобалей.
7. **Возврат поверхностных копий** записей и новых массивов. Одна строка на метод, зато in-memory
   ведёт себя как PG (который всегда отдаёт свежие объекты), и мутация ответа не портит хранилище.
   `Date` мутабелен — без копии это ловушка, которая не воспроизведётся после миграции.
8. **Instant'ы хранятся как `Date`**, форматирование в ISO — только в `http/present.ts`; PG-драйвер
   отдаёт `Date` для `timestamptz`, поэтому форма записи не изменится.

При переходе на PostgreSQL меняется ровно `store/memory.ts` → `store/postgres.ts` плюс регистрация
в `server.ts`; `http/**`, `usecases/**`, `domain/**`, `ROUTES` и все тесты выше store-уровня остаются
нетронутыми.

### Р5. Границы Slot Engine внутри `apps/api`

Вынос в `packages/slot-engine` — non-goal brief, но `domain/slots.ts`, `domain/timezone.ts` и
`domain/model.ts` пишутся так, чтобы вынос был перемещением файлов: только `node:*`-импорты, никакого
`express`, никаких репозиториев, никаких `DomainError` (движок считает, интерпретирует use-case).

```ts
export interface TimeInterval { startAtUtc: Date; endAtUtc: Date }
export interface SlotGridInput {
  timeZone: string; availabilityRules: AvailabilityRule[];
  slotIntervalMinutes: number; durationMinutes: number; nowUtc: Date;
}
export function bookingWindowDates(timeZone: string, nowUtc: Date): LocalDate[]; // I6
export function candidateSlots(input: SlotGridInput): TimeInterval[];            // I3, I6, I7, I8, I9
export function overlaps(a: TimeInterval, b: TimeInterval): boolean;             // I2, I3
export function isBusy(slot: TimeInterval, busy: readonly TimeInterval[]): boolean;
```

Разделение «кандидаты» и «занятость» — не косметика, а условие корректных кодов ошибок:
`candidateSlots` держит I6/I7/I8/I9 и ничего не знает о бронированиях, `isBusy` держит I2/I3. Если
слить их в «свободные слоты», то занятый слот при `POST` дал бы `SLOT_NOT_ALIGNED` вместо
`SLOT_UNAVAILABLE`.

`getPublicSlots` = `candidateSlots(...)` минус `isBusy(...)`, где занятость берётся из
`listBusyIntervals(окно)`. Побочных эффектов нет (I10).

Порядок проверок в `createBooking` (порядок значим, каждый шаг — свой код):

```text
1. transport Zod (Р2)                                        → VALIDATION_ERROR
2. guestName / guestEmail непусты (I12)                      → GUEST_NAME_REQUIRED / GUEST_EMAIL_REQUIRED
3. owner.onboardingCompleted                                 → CALENDAR_NOT_CONFIGURED
4. eventTypes.findById                                       → EVENT_TYPE_NOT_FOUND
5. если id передан и найден (bookings.findById):
     нагрузка эквивалентна   → ранний УСПЕШНЫЙ выход: 200 с существующей бронью (не ошибка)
     нагрузка не эквивалентна → DUPLICATE_BOOKING_ID
6. startAtUtc < nowUtc или локальная дата вне окна (I6, I9)  → SLOT_OUTSIDE_WINDOW
7. startAtUtc не совпадает ни с одним candidateSlot (I7, I8) → SLOT_NOT_ALIGNED
8. isBusy по listBusyIntervals (I2, I3)                      → SLOT_UNAVAILABLE
9. endAtUtc = startAtUtc + durationMinutes (I4);
   eventTypeName = eventType.name (snapshot, I15); repo.create → SLOT_UNAVAILABLE | DUPLICATE_BOOKING_ID
```

Шаг 5 переопределён `task-contract-001` (Р4, Р5): нагрузки эквивалентны, когда `eventTypeId`,
`startAtUtc` и **каждое** поле `guest` равны как разобранные значения, а не как исходные строки
(один и тот же instant, записанный `…Z` и `….000Z`, — одна и та же нагрузка); `id` в сравнении не
участвует — он и есть ключ. Следствие для формы кода: use-case `createBooking` больше не может
возвращать просто `Booking` — обработчику нужно знать, какой статус ставить, поэтому возврат
становится различающим создание и повтор (`{ booking, replayed: boolean }` или эквивалент).
Успешный повтор — не ошибка, поэтому механику `throw DomainError` (Р3) он не использует.

Пояснения к порядку: шаг 5 стоит до 8, потому что запись с тем же id уже держит своё время и
проверка занятости дала бы менее точный `SLOT_UNAVAILABLE`; сравнение по ключу выполняется только
для того ключа, который пришёл в запросе, поэтому занятость слота от **другого** ключа
по-прежнему даёт `SLOT_UNAVAILABLE` — идемпотентность не маскирует конфликт. Шаг 6 стоит до 7, потому что кандидаты
уже исключают прошлое (I9) — без отдельной проверки прошлое время сегодняшней даты вернуло бы
`SLOT_NOT_ALIGNED`. «Вне рабочего интервала» отдельного кода в контракте не имеет и попадает в
`SLOT_NOT_ALIGNED` как «нет такого слота в сетке».

Проверка выравнивания — сравнение epoch-времени с множеством кандидатов, а не обратная арифметика по
сетке. Причина: один код считает слоты и для `GET`, и для `POST`, поэтому они не могут расходиться
(`domain-rules.md` §8 требует, чтобы `POST` заново пересчитывал по настройкам), и не нужен второй,
обратный путь конвертации instant → локальное время. Цена — генерация ≈14 дат × ~16 слотов ≈ 224
интервалов на запрос; для MVP это ничто.

Шаги 2, 8, 9 выполняют требование `backend-agent.md` «повторно проверять слот внутри команды
создания». Шаг 2 через HTTP недостижим (Zod отклонит раньше) — brief FR4 это уже зафиксировал; код
существует для полноты доменного слоя и покрывается unit-тестом, вызывающим use-case напрямую.

### Р6. Работа с датами и таймзонами

**Штатный `Intl`, без внешней библиотеки.** `Temporal` в Node 26 недоступен (проверено, в т.ч. с
`--harmony-temporal`), поэтому выбор был между самописными примитивами на `Intl` и `luxon` /
`date-fns-tz`.

Нужны ровно две операции, и обе локализованы в `domain/timezone.ts`:

```ts
export function localPartsOf(instant: Date, timeZone: string): LocalDateTime;
export function instantOfLocal(local: LocalDateTime, timeZone: string): Date | null;
export function isValidTimeZone(timeZone: string): boolean;
```

`instantOfLocal` — стандартный двухпроходный алгоритм (тот же, что внутри luxon): смещение зоны
получается как разница между «локальными частями, прочитанными как UTC» и самим instant'ом; первое
смещение даёт кандидата, второе — уточняет его на границе перехода. Затем round-trip: если обратное
форматирование не совпало с запрошенным локальным временем, такого времени в этой зоне не существует
и функция возвращает `null`.

Алгоритм проверен эмпирически в этой рабочей копии: `America/New_York` 09:00 в январе → `14:00Z`, в
июле → `13:00Z`; несуществующее `2026-03-08 02:30` → `null`; неоднозначное `2026-11-01 01:30` →
`05:30Z` (раннее, до-переходное смещение); `Asia/Kathmandu` (+05:45) → корректно.

Почему не `luxon`: он покрыл бы эти же два случая тем же способом, добавив рантайм-зависимость в
проект, где сейчас всего одна (`zod`). ~20 строк с явным round-trip-контролем дают то, чего библиотека
не даёт бесплатно: несуществующее локальное время видно в типе (`Date | null`) и не превращается
молча в сдвинутый слот. Ступени 3 и 7 лестницы `lean-code`. Пересмотреть решение уместно при выносе
`packages/slot-engine`, если там появится календарная арифметика сложнее суток и минут.

Политика DST фиксируется явно:

- несуществующее локальное время (весенний переход) → слота нет;
- неоднозначное локальное время (осенний переход) → более раннее смещение;
- вычисление окна и день недели — чистая календарная арифметика над тройкой Y-M-D через `Date.UTC`,
  без участия зоны (I6: 14 локальных дат `[today, today+13]`, `today` берётся `localPartsOf(now, tz)`);
- попадание слота в рабочий интервал (I7) считается в локальных минутах, а `endAtUtc` — абсолютным
  сдвигом (I4). В дни перехода это расходится: встреча 60 минут может закончиться на два часа
  «позже» по стенным часам. I4 остаётся авторитетным, расхождение принято как ограничение MVP
  (см. «Последствия»).

### Р7. Пересечение Booking (I2) на application-уровне

Формула из `domain-model.md` §7 и `domain-rules.md` §7, строгие сравнения — отсюда полуоткрытость
интервала (I3) и допустимость соседних `10:00–11:00` / `11:00–11:30`:

```ts
export function overlaps(a: TimeInterval, b: TimeInterval): boolean {
  return a.startAtUtc.getTime() < b.endAtUtc.getTime() && b.startAtUtc.getTime() < a.endAtUtc.getTime();
}
```

Проверка глобальна: `listBusyIntervals` не фильтрует по `eventTypeId` — занятость владельца одна
(правило проекта 3). Линейный перебор достаточен: у in-memory нет индексов, объём MVP — десятки
записей, а точка, где появится индекс и exclusion constraint, уже выделена (`create`).

Почему этого достаточно без БД: Node исполняет JS в одном потоке, и внутри `create` нет `await`,
поэтому «проверить и вставить» неделимо для любого числа параллельных HTTP-запросов в этом процессе.
Чего это не покрывает — второго процесса API над тем же хранилищем; для in-memory такого сценария не
существует (состояние процессу принадлежит), а для PG его закроет constraint.

### Р8. Express 5: конкретика

- **Отказы async-обработчиков.** Обработчики async (репозитории асинхронны), Express 5 по документации
  сам передаёт отказ возвращённого промиса в error-middleware — обёртки вида `asyncHandler` или
  `express-async-errors` не заводим. Поведение подтверждается тестом на 5xx/4xx из брошенного
  `DomainError` (пункт проверки для `plan.md`, а не допущение).
- **Единый error-middleware** (4 аргумента, зарегистрирован последним): `DomainError` → таблица Р3;
  `SyntaxError` с `type: 'entity.parse.failed'` → `400 VALIDATION_ERROR`; всё остальное →
  `500 {code:'INTERNAL_ERROR'}` с логом на сервере и без деталей в теле.
- **Неизвестный маршрут и неподдерживаемый метод** — один fallback-обработчик перед error-middleware:
  `404 {code:'NOT_FOUND', message:'Route not found'}`, как в текущем smoke-сервере. 405 с `Allow` не
  делаем: у ответа нет потребителя, а код добавляет ветвление. **Вне контракта:** ни `NOT_FOUND`, ни
  `INTERNAL_ERROR` в контракте не описаны; они относятся к URL и ситуациям, которых контракт не
  описывает вовсе, и по форме остаются `ErrorResponse`. Зафиксировано как gap G3.
- **Что не делаем, потому что это `task-infra-003`:** CORS, security-заголовки (helmet), настройку
  лимита тела. `express.json()` берётся с дефолтами (в т.ч. дефолтный лимит 100kb) — это не решение
  о лимите, а отсутствие решения; тюнинг — за `infra-003`. Место вставки одно и задокументировано:
  начало `createApp`, до цикла монтирования.
- `res.json()` сам ставит `application/json`; `GET /health` отвечает ровно `{"status":"ok"}` (FR1,
  регрессия `task-006` не повторяется) — тело собирается из литерала, а не из объекта состояния сервера.

### Р9. Backend-тест покрытия контракта (FR7) и раннер

**Декларативный реестр вместо интроспекции router-стека.**

```ts
// http/routes.ts
export const ROUTES = [
  { operationId: 'getHealth', method: 'get', path: '/health' },
  { operationId: 'getAdminSetup', method: 'get', path: '/admin/setup' },
  { operationId: 'getPublicCalendar', method: 'get', path: '/calendar' },
  // … 12 строк
] as const;
export type OperationId = (typeof ROUTES)[number]['operationId'];
```

Механика даёт две разные гарантии, вместе покрывающие обе половины FR7:

1. `handlers: Record<OperationId, (deps: Deps) => RequestHandler>` — компилятор требует по обработчику
   на каждую строку реестра и не даёт лишних ключей;
2. `createApp` монтирует **только** циклом по `ROUTES` и является единственным местом, где вызываются
   `app.get/post/put`. Значит смонтированное множество равно реестру по построению, и тесту достаточно
   сверить реестр с `generated/openapi.yaml`: обход `paths` даёт `operationId`, метод и путь, сверка
   двусторонняя, с равенством количеств — как в секциях 1–2 `tests/contract-validation.test.ts`.

Почему не интроспекция `app.router.stack`: она опирается на внутреннее устройство Express и
`path-to-regexp` (в Express 5 `app._router` уже переименован в `app.router`), требует нетипизированного
доступа и проверяет ровно то же множество. Остаточный риск выбранного подхода — маршрут, добавленный
в обход `createApp`; он снижен тем, что монтирование в одном цикле, и тем, что любой незарегистрированный
URL отдаёт `404 NOT_FOUND` (Р8). Сознательно не добавляю страховочную сверку `app.router.stack.length`:
это вернуло бы зависимость от внутренностей, ради которой подход и выбран.

**Раннер — встроенный `node:test`**, без внешней зависимости: `"test": "node --test"` в
`apps/api/package.json`. Проверено, что дефолтный discovery Node 26 находит `**/*.test.ts` и что
относительный импорт `./lib.ts` работает. Флаг `--experimental-strip-types` не нужен (в Node 26
stripping включён по умолчанию), но и не мешает — корневой `tests/` его использует, и трогать корневой
`npm test` задача не будет: он остаётся `uispec:validate` + contract gate (НФТ brief).

HTTP-тесты без `supertest`: хелпер поднимает `createApp(deps)` на `listen(0)` и обращается глобальным
`fetch` — Node 26 умеет и то, и другое, зависимость не нужна.

Состав тестов (три файла в `src/`, поэтому покрыты `tsc --noEmit` через `include: ["src"]`):

| Файл | Что проверяет |
|---|---|
| `http/routes.contract.test.ts` | FR7: реестр ↔ `generated/openapi.yaml`, 12/12, без лишнего |
| `domain/slots.test.ts` | I3, I6, I7, I8, I9, `overlaps`, DST-случаи (`null` на несуществующем времени) |
| `api.test.ts` | AC2–AC7 и AC9 по HTTP, тела ответов сверяются generated response-схемами |

Кейсы, добавленные входным контрактом `0.2.0` (`task-contract-001`), — в `api.test.ts`:

- повтор `POST /bookings` с тем же `id` и эквивалентной нагрузкой → `200`, тело идентично первому
  ответу (то же `id`, тот же `createdAtUtc`), второй брони не появилось;
- повтор с тем же `id` и изменённой нагрузкой → `409 DUPLICATE_BOOKING_ID`;
- занятый слот от **другого** (или отсутствующего) ключа → `409 SLOT_UNAVAILABLE`;
- `GET /calendar` до onboarding → `400 CALENDAR_NOT_CONFIGURED`, после — `200` с `displayName`,
  тело по `zGetPublicCalendarResponse`;
- `Booking.eventTypeName` в ответах обеих booking-операций равен названию типа на момент создания
  и **не** меняется после переименования типа встречи (проверка snapshot-семантики, I15);
- пустой `eventTypeId` в теле `POST /bookings` и в query `GET /slots` → `400 VALIDATION_ERROR`.

Второй и третий файлы шире буквы FR7, но требуются Definition of Done роли («domain rules покрыты
тестами», «documented errors воспроизводимы») — это не расширение scope, а его обязательная часть.

### Р10. Конфигурация (FR8)

Один модуль `config.ts`, читающий `process.env` **только** внутри `loadConfig()`, вызываемой в
`server.ts`; результат передаётся в `createApp(deps)`. Обработчики env не читают — иначе тесты стали
бы зависеть от окружения процесса.

```ts
export interface AppConfig { port: number; publicWebUrl: string }
const DEFAULT_PORT = 3001;
const DEFAULT_PUBLIC_WEB_URL = 'http://localhost:8081';
```

- `PORT`: не задан → 3001 (как в текущем smoke-сервере); задан не числом или вне 1–65535 → падение
  на старте с внятным сообщением.
- `PUBLIC_WEB_URL`: не задан → `http://localhost:8081` (web-сборка Expo, дефолт из brief FR8); задан —
  проверяется конструктором `URL` и требованием протокола `http:`/`https:`.
- **Мусорное значение = отказ старта** (`process.exit(1)` с сообщением), а не тихий откат к дефолту.
  Причина: `publicUrl` — обязательное `format: uri` поле трёх ответов `CalendarSettingsResponse`;
  молчаливая подмена заставила бы API отдавать ссылку, о которой оператор не просил, и обнаружилась бы
  только у гостя. Ошибка конфигурации дешевле всего на старте.
- Валидация значения — `new URL(value)`, а не `z.url()` из generated-схем: схема описывает transport
  ответа, а не env; тянуть её в конфиг значило бы связать загрузку настроек с контрактом без нужды.
  Соответствие `format: uri` в ответе всё равно проверяется в тесте через `zGetAdminSettingsResponse`.

### Р11. Режим запуска TypeScript: без сборки

`apps/api` запускается напрямую из исходников; `dist` и шаг `tsc`-emit исчезают:

| Скрипт | Было | Стало |
|---|---|---|
| `start` | `node dist/server.js` | `node src/server.ts` |
| `dev` | `node --watch src/server.ts` | без изменений |
| `build` | `tsc` | удаляется (корневой `build --workspaces --if-present` просто пропустит `apps/api`) |
| `typecheck` | `tsc --noEmit` | без изменений — остаётся единственным типовым гейтом |
| `test` | нет | `node --test` |

Из `package.json` уходит `main: dist/server.js` (никто пакет не импортирует). В `tsconfig.json`
`rootDir`/`outDir` заменяются на `noEmit: true` и `allowImportingTsExtensions: true`.

Причина: относительные импорты в ESM обязаны иметь расширение, а `./config.js` на диске не существует
— Node не подменяет `.js` на `.ts`. Значит specifier'ы пишутся как `./config.ts`, что требует
`allowImportingTsExtensions`, а он требует `noEmit`. Альтернатива — `rewriteRelativeImportExtensions`
с сохранением сборки; отклонена как лишний артефакт (`lean-code`: удаление предпочтительнее
добавления), тем более что AC1 просит поднимать сервер одной командой — теперь без предварительного
`build`. Комбинация NodeNext + `allowImportingTsExtensions` + `noEmit` проверена: `tsc` завершается
с кодом 0, Node тот же файл исполняет.

Ограничения strip-only режима, обязательные к соблюдению в коде (проверено на этом Node):

- нет `enum` — только `as const`-объекты и union-типы;
- нет parameter properties — поля класса присваиваются явно (касается `DomainError`);
- нет `namespace` с рантайм-значением, нет декораторов;
- импорты только типов — через `import type`;
- у всех относительных импортов явное расширение `.ts`.

### Р12. Как `apps/api` получает `@minical/backend-contract`

Сейчас пакет не резолвится: в его `package.json` нет ни `exports`, ни `main` (проверено).
Альтернативы отклонены: глубокий относительный импорт
(`../../packages/backend-contract/src/generated/index.ts`) ломает границу пакета из
`AGENTS.md`; `paths` в tsconfig лечит только компилятор, но не рантайм.

**Исправлено 2026-08-07 по результатам `task-infra-005/adr.md` (Ф2, Ф3).** Первоначально здесь была
записана правка `"exports": { ".": "./src/generated/index.ts" }` — она **неверна для этой задачи**:
generated `index.ts` пакета состоит из единственной строки `export type { … }`, которая при
стирании типов исчезает целиком, поэтому такой вход резолвится успешно и даёт **ноль экспортов в
рантайме**. Прежняя проверка подтверждала резолв, а не наличие схем; FR3 этой правкой не
разблокировался бы. `zod.gen.ts` при этом самодостаточен — единственный импорт в файле — `zod`.

Итоговые специфаеры, которые задача обязана использовать (подтверждены пользователем 2026-08-07,
устанавливаются задачей `task-infra-005`):

```ts
import { zCreatePublicBookingBody, zGetPublicSlotsQuery } from '@minical/backend-contract/zod';
import type { CreateBookingRequest, ErrorResponse } from '@minical/backend-contract';
```

Схемы приходят подпутём `/zod`, типы — корневым входом. Ошибка использования ловится компилятором
(`has no exported member`), а не превращается в `undefined` в рантайме. Вариант «один вход через
регенерацию» отклонён пользователем: он требует `allowImportingTsExtensions` в
`apps/api/tsconfig.json` и навсегда закрывает возврат к `tsc`-сборке, который решение Р11 держит как
путь отступления для Docker.

**Граница ролей — решено вынесением наружу.** Файл `packages/backend-contract/package.json` не входит
в «разрешено менять» для Backend Agent (правило 10, роль владеет `src/**` вне `generated/`), поэтому
`task-back-001` его **не трогает**. Правка выполняется отдельной задачей `task-infra-005`, которая
добавляет `exports` сразу двум пакетам — `@minical/backend-contract` и `@minical/api-client`: у второго
та же болезнь, и она блокирует `task-front-guest-001` (её FR2 — доступ к `client.setConfig`). Один
владелец, одно изменение, ни один потребитель не лечит симптом у себя.

**Следствие для последовательности:** реализация `task-back-001` не может начаться раньше, чем
`task-infra-005` завершена — без точки входа пакета `import` из `apps/api` физически не резолвится
(`ERR_MODULE_NOT_FOUND`, проверено). Обходной путь `paths` в `apps/api/tsconfig.json` отклонён
окончательно: он лечит компилятор, но не рантайм, и создаёт второй источник правды о расположении
пакета.

### Р13. Внешние зависимости

Все объявляются явно в `apps/api/package.json` — НФТ brief прямо ссылается на историю скрытых
транзитивных `yaml`/`@typespec/openapi` из `task-006`.

| Пакет | Раздел | Версия | Зачем |
|---|---|---|---|
| `express` | dependencies | `^5.2.1` | маршрутизация, `express.json()`, error-middleware, проброс отказов промисов (решение brief) |
| `@types/express` | devDependencies | `^5.0.6` | Express не поставляет собственные типы; без них `strict` не собирается |
| `@minical/backend-contract` | dependencies | `*` (workspace) | generated Zod-схемы и transport-типы (FR3) |
| `zod` | dependencies | `^4.0.0` | тип `ZodType` в `parseOrThrow` и жёсткая привязка версии к той, на которой собраны схемы |
| `yaml` | devDependencies | `^2.9.0` | чтение `generated/openapi.yaml` в тесте покрытия (FR7); та же версия, что в корне |
| `@types/node` | devDependencies | `^26.1.2` | уже используется через hoisting (`types: ["node"]` в tsconfig); объявление делает зависимость явной |

Не добавляются: `luxon`/`date-fns-tz` (Р6), `supertest` (Р9), внешний тест-раннер (Р9), `dotenv`
(env читается из окружения процесса, `.env` в задаче не требуется), `helmet`/`cors`
(`task-infra-003`), `zod-validation-error` (сообщение собирается из `issues` в три строки).

## Затронутые компоненты

```text
apps/api/package.json                     скрипты (start/test, удаление build и main), зависимости Р13
apps/api/tsconfig.json                    noEmit, allowImportingTsExtensions вместо rootDir/outDir
apps/api/src/server.ts                    полностью заменяется: entry вместо smoke-сервера
apps/api/src/config.ts                    новый  (Р10)
apps/api/src/app.ts                       новый  (Р1, Р8, Р9)
apps/api/src/http/{routes,handlers,parse,present,errors}.ts        новые (Р1–Р3, Р9)
apps/api/src/usecases/{owner,booking}.ts  новые  (Р1, Р5)
apps/api/src/domain/{model,errors,slots,timezone}.ts              новые (Р3, Р5–Р7)
apps/api/src/store/{repositories,memory}.ts                       новые (Р4)
apps/api/src/api.test.ts                  новый  (Р9)
apps/api/src/domain/slots.test.ts         новый  (Р9)
apps/api/src/http/routes.contract.test.ts новый  (Р9)
apps/api/AGENTS.md                        описание «только smoke-сервер» устарело
packages/backend-contract/package.json    НЕ меняется здесь: exports добавляет task-infra-005 (Р12)
README.md                                 команды apps/api: появился test, исчез build
AGENTS.md                                 раздел «Структура репозитория»: состав apps/api/src
```

Не меняются: `packages/contracts/**` (API impact `NONE`), любые `generated/**`, корневой
`package.json` (корневые `test`/`typecheck` сохраняют смысл), `tests/contract-validation.test.ts`,
`docs/architecture.md` — решение остаётся внутри контура «модульный монолит + PostgreSQL позже» и не
меняет ни один источник правды из `docs/sources-of-truth.md`.

## Последствия и компромиссы

Положительные:

- контракт остаётся единственным источником transport-правды: схемы только читаются, ни одной
  самописной схемы и ни одного пути, порождающего OpenAPI из кода;
- полнота FR4 держится компилятором (`code` — ключ таблицы статусов), полнота FR2 — типом
  `Record<OperationId, …>`; забыть обработчик или добавить код без статуса нельзя молча;
- `domain/**` не зависит от Express и хранилища, поэтому вынос Slot Engine — перемещение файлов;
- одна точка монтирования маршрутов и одна точка вставки middleware упрощают `task-infra-003`;
- рантайм-зависимостей две (`express`, `zod`); сборочного шага нет вовсе.

Компромиссы и принятые ограничения:

1. `apps/api` больше не собирается в `dist`. Типы проверяет только `npm run typecheck`; запуск
   `node src/server.ts` типы не проверяет. Для учебного сервиса приемлемо, гейт в CI сохранён.
2. Пооперационные подмножества кодов ошибок из FR4 типами не выражены (Р3) — держатся тестами и ревью.
3. In-memory состояние живёт в процессе: после рестарта onboarding нужно проходить заново. Сидов и
   фикстур нет намеренно (YAGNI); сценарии AC начинаются с `PUT /admin/setup`.
4. Кандидаты слотов пересчитываются на каждый `POST /bookings` (≈224 интервала) и занятость
   проверяется линейно. Осознанно: индексы и диапазонные запросы приходят вместе с PostgreSQL.
5. В дни перехода на DST I7 (локальная вместимость) и I4 (абсолютная длительность) расходятся:
   встреча может закончиться позже по стенным часам, чем `endLocal`. I4 авторитетен; при
   необходимости это отдельная доменная задача, а не правка контракта.
6. Неоднозначное локальное время осеннего перехода отдаёт более раннее смещение — детерминированно,
   но второй проход того же часа слотами не покрывается.
7. `404 NOT_FOUND` и `500 INTERNAL_ERROR` — ответы вне контракта (G3). Форма `ErrorResponse`
   соблюдена, но generated SDK этих кодов не знает.
8. ~~Валидация тел `completeAdminSetup`/`updateAdminSettings` отдаёт недокументированный
   `400 VALIDATION_ERROR` (G1, Q1).~~ **Компромисс снят `task-contract-001` (FR5):** ответ
   документирован обеими операциями, backend отдаёт то, что описано в контракте. Сама валидация не
   обсуждалась и не обсуждается — FR3 и жёсткое исключение `lean-code` («никогда не срезать валидацию
   входных данных») требуют её независимо от контракта.
9. Запуск из исходников несовместим с раскладкой, где `@minical/backend-contract` физически лежит
   внутри `node_modules`: Node отказывается стриптить типы в `node_modules`
   (`ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING`, проверено). Симлинки npm workspaces этой проблемы
   не имеют — см. «Совместимость и миграция».

## Рассмотренные альтернативы

**Middleware-фабрика валидации вместо явного вызова (Р2).** Отклонена: чтобы обработчик увидел
уточнённый тип `req.body`, нужен generic-параметр `Request` или приведение — больше кода и потеря
точности вывода, чем один вызов `parseOrThrow` на операцию.

**Модельные схемы (`zSetupRequest`) вместо операционных (`zCompleteAdminSetupBody`) (Р2).** Отклонена:
операционные алиасы привязаны к `operationId`, поэтому расхождение тела операции с общей моделью
после будущей правки `.tsp` проявится само.

**Result-тип вместо исключений для доменных ошибок (Р3).** Отклонён: девять точек выхода в одном
use-case превращаются в цепочку разборов объединения; выигрыш в явности не оплачивается, поскольку
транспорт всё равно сводит результат к `{code, message}`.

**Статус HTTP в месте возникновения ошибки (Р3).** Отклонён: FR4 — таблица, её проверяемость важнее
локальности; `EVENT_TYPE_NOT_FOUND` на двух операциях обязан быть одним и тем же 404 по построению.

**Синхронные репозитории (Р4).** Отклонены: при переходе на PostgreSQL пришлось бы переписать все
use-case и обработчики, что прямо запрещает FR5.

**Наивный `create` плюс предварительная проверка в use-case (Р4).** Отклонён: между `await`-ами есть
микротаск-граница, а роль запрещает опираться только на предварительную выборку. Атомарная проверка
внутри `create` — это ещё и место, куда PG-репозиторий повесит exclusion constraint.

**Единая функция «свободные слоты» вместо пары «кандидаты» + «занятость» (Р5).** Отклонена: занятый
слот при `POST` получил бы `SLOT_NOT_ALIGNED` вместо `SLOT_UNAVAILABLE`.

**Обратная арифметика выравнивания (instant → локальная сетка) вместо проверки принадлежности
кандидатам (Р5).** Отклонена: второй путь вычислений, способный разойтись с `GET /slots`.

**`luxon` или `date-fns-tz` (Р6).** Отклонены: закрывают те же два случая тем же алгоритмом, добавляя
рантайм-зависимость; `null` на несуществующем локальном времени пришлось бы всё равно организовывать
самостоятельно. Пересмотр уместен при выносе `packages/slot-engine`.

**`Temporal` (Р6).** Отклонён по факту: в Node 26 API отсутствует даже под `--harmony-temporal`.

**Интроспекция `app.router.stack` для FR7 (Р9).** Отклонена: зависимость от внутренностей Express и
`path-to-regexp`, нетипизированный доступ, при том же покрытии, что даёт декларативный реестр,
из которого приложение и монтируется.

**Внешний тест-раннер (vitest/jest) и `supertest` (Р9).** Отклонены: `node:test` + `listen(0)` +
глобальный `fetch` закрывают потребность без зависимостей, а корневой `tests/` уже работает по этой
схеме.

**Сохранить сборку в `dist` (Р11).** Отклонена: `rewriteRelativeImportExtensions` или импорты `.js`
поверх `.ts` — лишний артефакт и второй режим запуска; Node 26 исполняет TypeScript напрямую.

**Глубокий относительный импорт или `paths` вместо `exports` у backend-contract (Р12).** Отклонены:
первый ломает границу пакета, второй лечит компилятор, но не рантайм.

**Полноценный hexagonal-контур (порты/адаптеры, DI-контейнер, классы-сервисы).** Отклонён: для 12
операций и одного хранилища три интерфейса репозиториев и функции use-case дают ту же изоляцию без
слоёв, которых требования не требуют.

**Реализовать Slot Engine сразу в `packages/slot-engine`.** Отклонено: прямой non-goal brief; Р5
делает вынос дешёвым перемещением файлов.

## Совместимость и миграция

**Контракт.** API impact `NONE` для самой `back-001`: `.tsp` не меняется, `npm run generate:check`
diff не даёт. Входной контракт — версии **`0.2.0`** (`task-contract-001`), а не `0.1.0`: реализация
ведётся против 12 операций, обязательного `Booking.eventTypeName` и двух успешных статусов у
`createPublicBooking`. Реализуются только документированные операции; единственное оставшееся
исключение — G3 ниже (G1 закрыт upstream).

**Переход на PostgreSQL (следующая задача).** Меняется: появляется `store/postgres.ts` с теми же
тремя интерфейсами; трансляция нарушений constraint в `DomainError('SLOT_UNAVAILABLE')` и
`DomainError('DUPLICATE_EVENT_TYPE_ID')` внутри `create`; `listBusyIntervals` и проверка пересечения
становятся диапазонным запросом и exclusion constraint; в `server.ts` меняется одна строка сборки
`deps`. Не меняется: `http/**`, `usecases/**`, `domain/**`, `ROUTES`, `config.ts` и все тесты, кроме
store-специфичных. Экземпляр `Date` для instant'ов сохраняется — драйвер PG отдаёт `timestamptz`
так же.

**Вынос Slot Engine.** `domain/slots.ts`, `domain/timezone.ts` и относящиеся к слотам типы из
`domain/model.ts` переносятся в `packages/slot-engine/src/` без изменений тела; в `usecases/booking.ts`
меняются specifier'ы импорта. `domain/errors.ts` остаётся в `apps/api`: коды — это транспортный
словарь задачи, а не часть движка.

**`task-infra-003`.** CORS, helmet и лимит тела вставляются в начало `createApp` до цикла монтирования;
других изменений не требуется. Дефолтный лимит `express.json()` (100kb) не является принятым решением
о лимите.

**Docker и упаковка.** Контейнер обязан ставить зависимости в корне репозитория, сохраняя симлинки
npm workspaces: при такой раскладке realpath `@minical/backend-contract` лежит вне `node_modules` и
type stripping работает (проверено). Если будущая infra-задача решит упаковывать workspace-пакеты
физически внутрь `node_modules` (`npm pack`), понадобится либо сборка `packages/backend-contract` в
`.js`, либо возврат `tsc`-сборки для `apps/api`. Это единственная известная точка, где решение Р11
влияет на инфраструктуру.

**Contract gaps.** G1, G2 и G4 **закрыты** задачей `task-contract-001` (её FR5, FR6, FR7) — не этой
задачей, но до её реализации. Открытым остаётся только G3, и он остаётся осознанным расхождением:

| # | Gap | Состояние |
|---|---|---|
| G1 | `completeAdminSetup` не документировал 400 вовсе; `updateAdminSettings` документировал 400 только как `CalendarNotConfigured` | **закрыт** `task-contract-001` (FR5): `ValidationError` добавлен в 400 обеих операций. Поведение backend (валидация V1–V4 → `400 VALIDATION_ERROR`) совпадает с контрактом |
| G2 | `AvailabilityRule.daysOfWeek` — массив без `@minItems(1)`, пустой список проходил транспорт и давал правило, которое никогда не срабатывает | **закрыт** `task-contract-001` (FR6): `@minItems(1)`, `zAvailabilityRule.daysOfWeek` — `.min(1)`. Следствие для `V3` — см. Р2 |
| G3 | Ответы `404 NOT_FOUND` (неизвестный URL/метод) и `500 INTERNAL_ERROR` контрактом не описаны | **остаётся open**, решение не обязательно: оба относятся к ситуациям вне описанных операций. Фиксируется как осознанное расхождение (`result.md`, P17) |
| G4 | `@minLength(1)` есть у `CreateEventTypeRequest.id`, но не у ссылающихся на него `getPublicSlots.eventTypeId` и `CreateBookingRequest.eventTypeId` | **закрыт** `task-contract-001` (FR7): `@minLength(1)` на оба поля. Делает первый пример AC5 достижимым, снимает Q2 и R3 плана |

**Обратная совместимость.** `GET /health` сохраняет тело `{"status":"ok"}` — единственный существующий
потребитель (smoke-проверки, Prism-мок из `infra-004`) не затронут. Команда запуска меняется с
`npm run build && npm start` на `npm start`.

## Вопросы к brief

Brief согласован и не правится; ниже расхождения, найденные при проектировании. Решения ADR указаны,
но Q1, Q3, Q4 и Q7 требуют явного подтверждения.

**Q1. FR3 против FR4 и контракта: недокументированный `400 VALIDATION_ERROR` на setup-операциях.**
FR3 требует валидировать все тела generated-схемами и отвечать `400 VALIDATION_ERROR`. Обход
`generated/openapi.yaml` показывает, что у `completeAdminSetup` документированы только 200 и 409, а у
`updateAdminSettings` 400 существует лишь как `CalendarNotConfigured`. Одновременно
`backend-agent.md` запрещает возвращать недокументированные статусы и коды. Решение ADR: валидировать
(FR3 и жёсткое исключение `lean-code` про валидацию входа сильнее) и зафиксировать G1. Не валидировать
эти тела — недопустимо: тогда мусорные `availabilityRules` попадут в хранилище и обрушат
`getPublicSlots`.

**Закрыт `task-contract-001` (FR5, 2026-08-08).** Контракт теперь документирует `400 ValidationError`
у обеих операций, поэтому противоречия между FR3 и `backend-agent.md` больше нет: валидация остаётся,
недокументированного ответа не остаётся. G1 закрыт вместе с вопросом.

**Q2. AC5: пример «пустое `eventTypeId`» недостижим.** И `zGetPublicSlotsQuery.eventTypeId`, и
`zCreateBookingRequest.eventTypeId` — это `z.string().max(100)` без `.min(1)`; проверено, что пустая
строка проходит `safeParse`. Такой запрос вернёт `404 EVENT_TYPE_NOT_FOUND`, а не
`400 VALIDATION_ERROR`. Второй пример AC5 (отсутствующий `guest`) работает, поэтому критерий
выполним; предлагаю при следующем касании brief заменить первый пример (например, на
`durationMinutes: 0` или невалидный `startAtUtc`).

**Закрыт `task-contract-001` (FR7, 2026-08-08).** Оба поля получили `@minLength(1)`, обе Zod-схемы —
`.min(1)`, пустая строка отвергается на транспортной границе. Первый пример AC5 достижим,
предложение заменить его снимается, специальная ветка в коде не нужна и не появляется. Риск R3
плана удаляется — основание исчезло.

**Q3. FR6 не включает инварианты `CalendarSettings` и `AvailabilityRule`.** FR6 ссылается на раздел 10
`domain-model.md` (I1–I14), в котором нет ни кратности `slotIntervalMinutes` числу 60 (§3 плюс
`task-006/adr.md` п.2, где проверка прямо делегирована backend), ни `startLocal < endLocal` и
непустого `daysOfWeek` (§4), ни семантической валидности зоны. ADR включает их как V1–V4 (Р2): без V4
документированная операция падает в 500, без V1–V3 в хранилище оказываются настройки, из которых
сетка слотов не строится. Формально это шире буквы FR6 — нужно подтверждение.

**Q4. Семантика «предстоящих» бронирований не задана.** Для `getAdminUpcomingBookings` brief не
определяет отсечку и не требует проверки настроенности. Решение ADR: `endAtUtc > now` (встреча,
которая ещё не закончилась), сортировка по `startAtUtc` по возрастанию, без
`CALENDAR_NOT_CONFIGURED` (не документирован — до onboarding отдаётся `[]`). Отсечка по `startAtUtc >= now`
равносильна по правдоподобию — это спорный выбор, а не выводимый.

**Решено (2026-08-07):** `endAtUtc > now` — идущая встреча остаётся в списке до своего конца, владелец
видит, чем занят прямо сейчас.

**Q5. Идемпотентность `CreateBookingRequest.id`.** `domain-model.md` §7.5 называет клиентский id
идемпотентностью, но контракт документировал `DUPLICATE_BOOKING_ID`. ADR трактовал повтор как
конфликт (409), а не как повторную выдачу ранее созданного Booking.

**Инвертирован `task-contract-001` (FR3, решения Р3–Р5, 2026-08-08).** Трактовка «повтор = конфликт»
больше не верна: повтор с тем же ключом `id` и эквивалентной нагрузкой даёт `200` с ранее созданной
бронью, конфликтом остаётся только несовпадение нагрузки при том же ключе. Контракт и доменная
модель сошлись; расхождение, из-за которого вопрос был задан, устранено в контракте, а не трактовкой.
Следствия для реализации — Р5 (шаг 5, различающий возврат use-case) и Р9 (кейсы идемпотентности).

**Q6. Создание EventType до onboarding разрешено.** У `createAdminEventType` и `getAdminEventTypes`
`CALENDAR_NOT_CONFIGURED` не документирован, поэтому проверки настроенности там нет. Асимметрия с
публичными операциями намеренная и следует контракту; отмечаю, чтобы она не выглядела упущением.

**Q7. Правка `packages/backend-contract/package.json` вне границ роли.** Пакет сейчас не резолвится
(нет `exports`/`main`, проверено), без одной строки `exports` backend физически не может
импортировать generated-схемы. Файл не входит в «разрешено менять» Backend Agent (правило 10) и
generated-артефактом не является. Прошу подтвердить правку; обходной путь (`paths` в
`apps/api/tsconfig.json`) хуже — создаёт второй источник правды о расположении пакета.

**Решено (2026-08-07):** правка выносится в отдельную задачу `task-infra-005` вместе с той же правкой
для `@minical/api-client`; `task-back-001` чужие пакеты не трогает и становится потребителем этой
задачи (Р12).

## Подтверждения пользователя (2026-08-07)

| Решение | Статус | Комментарий |
|---|---|---|
| Р11 — запуск без сборки (`node src/server.ts`, `noEmit`, specifier'ы `.ts`, удаление `build` и `dist`) | подтверждено | Принята и цена: будущий Docker обязан сохранять симлинки npm workspaces, иначе type stripping внутри `node_modules` падает |
| Q1 — валидировать тела `completeAdminSetup` / `updateAdminSettings`, отдавая недокументированный `400 VALIDATION_ERROR` (gap G1) | подтверждено; **пометка не действует с 2026-08-08** | Альтернатива пропускает мусорные `availabilityRules` в хранилище и обрушает `getPublicSlots`. Ответ больше не недокументирован: G1 закрыт `task-contract-001` (FR5) |
| Q3 — доменные проверки V1–V4 сверх списка I1–I14 | подтверждено | Без V4 (валидность зоны в ICU) документированная операция отдаёт 500 |
| Q4 — отсечка «предстоящих» | подтверждено | `endAtUtc > now` |
| Q7 — точки входа пакетов | вынесено | `task-infra-005`, оба пакета одним изменением |
| G1, G2 и `@minLength(1)` для ссылок на `eventTypeId` | **закрыто `task-contract-001` (2026-08-08)** | Прежняя пометка — «зафиксировать, не чинить здесь». Контрактная задача выполнена до реализации `back-001`: G1, G2 и G4 закрыты в `.tsp`, поведение backend совпадает с контрактом. `API impact NONE` у самой `back-001` сохраняется |

Дополнительный факт, найденный при ревью ADR: `@minLength(1)` у `CreateEventTypeRequest.id`
(`packages/contracts/src/models/event-type.tsp:26`) есть, а у ссылающихся полей
(`zGetPublicSlotsQuery.eventTypeId`, `CreateBookingRequest.eventTypeId`) — нет. Это внутренняя
несогласованность контракта, а не общий пропуск: создать тип события с пустым id нельзя, сослаться на
пустой — можно. Именно она делала первый пример AC5 brief недостижимым (Q2). Заведена как G4 и
**закрыта** `task-contract-001` (FR7): оба поля получили `@minLength(1)`, асимметрия устранена.
