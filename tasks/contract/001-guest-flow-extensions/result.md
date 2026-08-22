# Результат TASK-CONTRACT-001

## Итог

Контракт расширен под гостевой макет и приведён в согласие с самим собой: 9 маршрутов, 12 операций,
11 моделей ошибок (состав кодов не изменился), `info.version: 0.2.0`. Реализовано по плану P01–P16 без
отклонений от решений ADR: публичная операция `getPublicCalendar` отдаёт ровно `displayName`;
`Booking.eventTypeName` — обязательный snapshot названия типа встречи, одинаковый для гостевого и
owner-флоу; `POST /bookings` документирует второй успешный статус `200` для идемпотентного повтора, а
`DUPLICATE_BOOKING_ID` сужен до «тот же ключ, другая нагрузка»; закрыты гапы G1 (`400 ValidationError`
у обеих setup-операций), G2 (`@minItems(1)` у `daysOfWeek`) и G4 (`@minLength(1)` у двух ссылок на
`eventTypeId`). FR4 (иконка и цвет) выполнен путём (б) — в `.tsp` по нему нет ни одной правки.

Generated diff совпал с закрытым чеклистом P07 ровно: 7 файлов, `openapi: 3.0.0`, 44 → 46 Zod-схем,
`zCreatePublicBookingResponse` остался `zBooking` и не стал `z.union`. Контрактный гейт обновлён по двум
спискам и получил шесть новых проверок; **каждая из шести проверена на невакуумность** — при точечной
порче собранного документа она даёт `FAIL` (протокол ниже). Двенадцать AC из тринадцати закрыты, AC8
снят вместе с FR8.

Задача изменила входные условия `task-back-001`: её `brief.md` и `adr.md` возвращены из `согласовано` в
`черновик`, содержание всех трёх документов приведено в соответствие с контрактом `0.2.0`. **Статус
`согласовано` этим документам возвращает пользователь или назначенный reviewer** (правило 11) — до
этого шаг 3 «Плана разработки» заблокирован.

## Что изменено

### `.tsp` — единственный ручной источник контракта (правило 5)

| Файл | Изменение | Решение |
|---|---|---|
| `packages/contracts/src/main.tsp` | `@info(#{ version: "0.1.0" })` → `"0.2.0"` | Р7 (FR9) |
| `packages/contracts/src/models/owner.tsp` | `+ @minItems(1)` на `AvailabilityRule.daysOfWeek`; `+ model PublicCalendarResponse` с единственным `@maxLength(200) displayName: string` рядом с `CalendarSettingsResponse` | Р6 (FR6), Р1 (FR1) |
| `packages/contracts/src/models/booking.tsp` | `+ Booking.eventTypeName` (`@minLength(1)`, `@maxLength(200)`, обязательное, doc-комментарий про snapshot); `+ @minLength(1)` на `CreateBookingRequest.eventTypeId`; переписан doc-комментарий `CreateBookingRequest.id` | Р2 (FR2), Р6 (FR7), Р3 (FR3) |
| `packages/contracts/src/models/errors.tsp` | doc-комментарий `DuplicateBookingId`: «Booking с таким id уже существует» → «ключ принадлежит существующей брони, чья нагрузка отличается; эквивалентный повтор ошибкой не является» | Р5 (FR3) |
| `packages/contracts/src/operations/admin.tsp` | `+ 400 ValidationError` у `completeAdminSetup`; `+ 400 ValidationError` у `updateAdminSettings` рядом с существующим `400 CalendarNotConfigured` | Р6 (FR5) |
| `packages/contracts/src/operations/public.tsp` | `+ op getPublicCalendar` (`@route("/calendar") @get`, `200 PublicCalendarResponse` / `400 CalendarNotConfigured`) первой в файле; `+ @minLength(1)` на query `getPublicSlots.eventTypeId`; `+ 200 Booking` у `createPublicBooking` рядом с `201 Booking`; doc-комментарий операции описывает семантику идемпотентности | Р1, Р6, Р4, Р5 |

`git diff --stat` по источнику: 6 файлов, `+78 −5`. Новых файлов `.tsp` нет.

### Generated — только прогоном pipeline (правило 6)

`npm run generate` (`contracts:build` → `generate:client` → `generate:backend`), exit 0. Ни один
generated-файл руками не редактировался. `--stat`:

```text
packages/api-client/src/generated/index.ts         |  4 +-
packages/api-client/src/generated/sdk.gen.ts       | 25 +++++-
packages/api-client/src/generated/types.gen.ts     | 64 +++++++++++++--
packages/backend-contract/src/generated/index.ts   |  2 +-
packages/backend-contract/src/generated/types.gen.ts | 64 +++++++++++++--
packages/backend-contract/src/generated/zod.gen.ts | 26 ++++--
packages/contracts/generated/openapi.yaml          | 92 ++++++++++++++++++++--
7 files changed, 252 insertions(+), 25 deletions(-)
```

### Контрактный гейт

`tests/contract-validation.test.ts`:

- `expectedRoutes` 8 → 9 (`'/calendar'` между `'/admin/bookings'` и `'/event-types'`);
- `expectedOperations` 11 → 12 (`'getPublicCalendar'` перед `'getPublicEventTypes'`);
- `expectedErrorCodes` — **без изменений**, 11 кодов: новых моделей ошибок нет, `DUPLICATE_BOOKING_ID`
  сохранён, `ValidationError` в 400 setup-операций — существующий код в новом месте;
- существующий рекурсивный обходчик `$ref` секции 5 обобщён: `checkOwnerId(schema, path, seen)` →
  `checkForbiddenProperties(schema, path, forbidden, seen)`. Секция 5 вызывает его с `['ownerId']`,
  новая секция 11 — с набором свойств настроек. Новой машинерии не появилось, контракт функции
  «собирать все несоответствия, а не падать на первом» сохранён;
- добавлена секция 11 — шесть проверок под AC1, AC2, AC3, AC5, AC6, AC7 (состав ниже).

### Документы и реестры

| Файл | Изменение |
|---|---|
| `docs/ui-spec-kit/specs/ui/bindings/contract-gaps.xml` | GAP-002 → `status="resolved" decided="2026-08-08"`; `screens=` дополнен `guest.booking-confirmation`; `<Missing>` описывает обе операции; `<Workaround>` по образцу GAP-001 («Не нужен: поле есть в контракте…») с пометкой, что join на 05/11 остаётся рабочим, а property состояния на 15 снимает `front-ui-002`; `<Task>` → `task-contract-001 (FR2)`. GAP-003 не тронут |
| `docs/domain-model.md` | Три правки — **санкционированное исключение**, см. отдельный раздел ниже |
| `tasks/task-infra-004/result.md` | Одна строка-примечание — решение Q2, см. ниже |
| `tasks/task-back-001/{brief,adr}.md` | `согласовано` → `черновик` + правки по Р10 |
| `tasks/task-back-001/plan.md` | Правки по Р10 (статус уже был `черновик`) |
| `tasks/README.md` | Статусы `contract-001` и `back-001` в каталоге задач; шаги 2 и 3 «Плана разработки»; снимок «Где мы сейчас» на 2026-08-08; сноска ¹ приведена к факту возврата |
| `README.md` | «все 11 операций» → 12; добавлен пункт про дефолтный `200` у `POST /bookings` и `Prefer: code=201` |

Не менялись: `apps/**`, `packages/contracts/tspconfig.yaml`, оба `openapi-ts.config.ts`,
`packages/{api-client,backend-contract}/package.json`, `docs/ui-spec-kit/specs/ui/bindings/api-bindings.xml`,
`*.screen.md`, `AGENTS.md`, `docs/{architecture,contract-pipeline,sources-of-truth}.md`.

## Контракт и generated-артефакты

**API impact `CHANGE`.** Приёмка generated diff (P07) по закрытому чеклисту — сошлась полностью:

| Проверка чеклиста | Факт |
|---|---|
| ровно 7 файлов, `client.gen.ts` / `client/` / `core/` не затронуты | 7 файлов, `client.gen.ts` в diff отсутствует |
| `openapi: 3.0.0`, секции `servers` нет | `openapi: 3.0.0`, `grep -c '^servers:'` → 0 |
| `info.version: 0.2.0` | да (AC9) |
| `paths./calendar.get` с `operationId: getPublicCalendar`, `200 → PublicCalendarResponse`, `400 → CalendarNotConfigured` | да |
| `PublicCalendarResponse` с единственным `displayName` (`maxLength: 200`) | да |
| `Booking.properties.eventTypeName` (`minLength: 1`, `maxLength: 200`) и `eventTypeName` в `Booking.required` | да |
| `paths./bookings.post.responses` содержит `'200'` и `'201'`, у каждого `$ref: Booking`, `description` различаются | да: `The request has succeeded.` / `…and a new resource has been created as a result.` |
| `CreateBookingRequest.properties.eventTypeId.minLength: 1` | да |
| `AvailabilityRule.properties.daysOfWeek.minItems: 1` | да |
| `paths./slots.get.parameters[eventTypeId].schema.minLength: 1` | да |
| `paths./admin/setup.put.responses.'400'` → `$ref: ValidationError` | да |
| `paths./admin/settings.put.responses.'400'` → `anyOf[ValidationError, CalendarNotConfigured]` | да, порядок именно такой |
| изменённые `description` только там, где правились doc-комментарии | `createPublicBooking`, `CreateBookingRequest.id`, `DuplicateBookingId`, `Booking.eventTypeName`, `PublicCalendarResponse`, `getPublicCalendar` |
| api-client: `PublicCalendarResponse`, `GetPublicCalendar*`, обязательное `eventTypeName`, `CreatePublicBookingResponses = { 200: Booking; 201: Booking }`, `CreatePublicBookingResponse` сворачивается в `Booking` | да; `UpdateAdminSettingsErrors[400]` стал `ValidationError \| CalendarNotConfigured`, `CompleteAdminSetupErrors` получил `400: ValidationError` |
| `sdk.gen.ts` — одна новая функция `getPublicCalendar` | да |
| Zod: `44 → 46`, ровно `zPublicCalendarResponse` и `zGetPublicCalendarResponse` | да, `diff` по списку экспортов даёт ровно эти два имени |
| `zBooking.eventTypeName = z.string().min(1).max(200)`; `.min(1)` в `zCreateBookingRequest.eventTypeId`, `zGetPublicSlotsQuery.eventTypeId`, `zAvailabilityRule.daysOfWeek` | да |
| `zCreatePublicBookingResponse` остаётся `zBooking`, не `z.union([…])` | да, проверено и по тексту, и в рантайме: `zCreatePublicBookingResponse === zBooking` → `true` |
| ни одна операция, схема или код ошибки не исчезли и не переименованы | 12 `op` в источнике, 11 моделей ошибок — состав кодов тот же |
| `icon`/`color` в `EventType`/`CreateEventTypeRequest` отсутствуют (AC4) | `grep -cE '^\s+(icon\|color):'` по generated OpenAPI → 0; в `.tsp` — 0 вхождений |
| конфиги генерации не тронуты | `git status --porcelain` по `tspconfig.yaml` и двум `openapi-ts.config.ts` — пусто |

Единственное отклонение от буквы чеклиста, не меняющее ни одного решения: doc-комментарий над
`zCreatePublicBookingResponse` в `zod.gen.ts` сменился с «The request has succeeded and a new resource
has been created as a result.» на «The request has succeeded.» — эмиттер берёт описание наименьшего
2xx. Прямое следствие Р4, схема при этом та же (`zBooking`).

**Специфаеры для потребителей** (установлены `task-infra-005`, задача их не меняла):
`import { zGetPublicCalendarResponse } from '@minical/backend-contract/zod'`,
`import type { PublicCalendarResponse } from '@minical/backend-contract'`,
`import { getPublicCalendar } from '@minical/api-client'`.

## Санкционированное исключение: правка `docs/domain-model.md`

Файл не входит в границы Contract Agent. Правка выполнена по **решению Q1 (harness, 2026-08-08)**,
зафиксированному в `adr.md`: оставлять источник правды по доменной модели расходящимся с контрактом
нельзя — по `docs/sources-of-truth.md` это дефект, а не отложенная работа. Внесено ровно три
минимальные правки, больше в файле не изменилось ничего:

1. **§7 «Поля»** — добавлена строка `- eventTypeName: string — snapshot названия EventType на момент
   бронирования`. Приводит документ в согласие с собственным §5 («Удаление EventType не отменяет
   существующие Booking — они сохраняют ссылку на id/имя для отображения»).
2. **§11 «Шаг 3»** — рядом с `→ Booking (201 Created)` добавлен второй успешный ответ
   `→ Booking (200 OK)` для идемпотентного повтора; в таблице доменных ошибок шага строка
   `DuplicateBookingId` уточнена до «тот же id, другая нагрузка; эквивалентный повтор даёт `200`».
3. **§12 каталог** — семантика `DuplicateBookingId` изменена на «тот же ключ `id`, другая полезная
   нагрузка; повтор с эквивалентной нагрузкой ошибкой не является».

Отдельная задача владельца документа не заводилась намеренно: разрыв между контрактом и доменной
моделью не должен жить неопределённое время.

## Примечание в завершённой `task-infra-004` (решение Q2)

В `tasks/task-infra-004/result.md` добавлена одна строка-примечание со ссылкой на эту задачу: операций
12, а не 11; дефолтный 2xx мока на `POST /bookings` — теперь `200` (Prism выбирает наименьший 2xx),
прежнее поведение — `Prefer: code=201`. **Статус задачи не отозван**, существующие формулировки не
переписаны: факты были верны на момент их проверки, примечание помечает запись как историческую.

## Возврат документов `task-back-001` (FR12, AC12)

`brief.md` и `adr.md` переведены из `согласовано` в `черновик`, в каждом — блок с причиной возврата,
датой, ссылкой на `task-contract-001` и перечнем затронутых мест. `plan.md` уже был `черновик`,
получил такой же блок. Содержание приведено в соответствие по чеклистам Р10.

`brief.md`: «Контекст» (9 маршрутов, 12 операций, 46 схем), «Зависимости» (+`contract-001`, входной
контракт `0.2.0`), «Цель» (12 операций), сценарий гостя п. 3 (обе ветви повтора) и новый п. 4
(`GET /calendar`), FR2 (12-я строка таблицы операций), FR3 (три случая закрываются транспортом),
FR4 (`VALIDATION_ERROR` на 5 операциях, `CALENDAR_NOT_CONFIGURED` на 6, `DUPLICATE_BOOKING_ID` —
«другая нагрузка», два 2xx у `createPublicBooking`), FR6 (новый инвариант `I15` про snapshot
`eventTypeName`), AC3 (три ветви повтора), AC5 (первый пример достижим), AC8 (12/12).

`adr.md`: frontmatter и блок возврата, «Контекст» (12 операций / 9 маршрутов, `I1–I15`, 46 схем, две
устаревшие строки таблицы фактов зачёркнуты с объяснением), Р1 (`getPublicCalendar` как use-case +
`present.publicCalendar`; `present.booking` отдаёт `eventTypeName` из snapshot'а), Р2 (`V3` теряет
обоснование через G2 и становится недостижимым через HTTP; вывод про недокументированный 400 снят),
Р3 (проверка настроенности на 6 операциях), Р5 (шаг 5 — различающий возврат use-case и правило
эквивалентности нагрузки; шаг 9 — запись snapshot'а), Р9 (`ROUTES` 12 строк, покрытие 12/12, шесть
новых тестовых кейсов), «Последствия» п. 8 (компромисс снят), «Совместимость и миграция» (входной
контракт `0.2.0`, из исключений остался только G3), таблица «Contract gaps» (G1, G2, G4 — закрыты;
G3 — open), Q1 и Q2 (закрыты), Q5 (инвертирован), «Подтверждения пользователя» (две строки).

`plan.md`: P01 (44 → 46), P02 (`eventTypeName` в доменной модели), P05 (запись брони хранит
`eventTypeName`, `findById` — ещё и для сравнения нагрузки), P07 (`ROUTES` 12 строк, 12/12,
двенадцатый обработчик), P08 и P09 (ссылки на G1 и недокументированный 400 снят, `V3`
переквалифицирован), P10 (`getPublicCalendar`: use-case, презентер, проверка настроенности, тест до и
после onboarding), P11 (пустой `eventTypeId` → `400 VALIDATION_ERROR` вместо 404), P12 (шаг 5,
различающий возврат, `200` у повтора, snapshot при создании, кейсы идемпотентности), P13
(`eventTypeName` из snapshot'а, не из join'а), P17 (G1/G2/G4 закрыты upstream, в реестре остаётся
G3), таблица AC (AC3, AC5, AC8), блокер **R3 удалён** — основание исчезло. Число пунктов и их ID
сохранены.

**Согласование за пользователем или reviewer'ом (правило 11).** До него реализация `back-001`
начаться не может — это зафиксировано и в самих документах, и в шаге 3 «Плана разработки».

## База данных и миграции

Не затронуты. `packages/database` остаётся пустым placeholder'ом; схема, миграции и exclusion
constraint — задача Database Agent. Единственное следствие этого изменения для будущей схемы:
`Booking` получает колонку под `eventTypeName` (`not null`), потому что поле обязательное и
snapshot'ное — досчитывать его join'ом с `EventType` нельзя.

## Выполненные проверки

### Обязательные команды

| Команда | Exit | Факт |
|---|---|---|
| `npm run contracts:format:check` | 0 | `✔ 9 formatted` — formatter правок не потребовал, ручного выравнивания не было |
| `npm run contracts:build` | 0 | `✔ @typespec/openapi3 34ms packages/contracts/generated/`, `Compilation completed successfully.` |
| `npm run generate` | 0 | три шага: `contracts:build`, `openapi-ts` api-client (4 файла), `openapi-ts` backend-contract (3 файла) |
| `npm run generate:check` | 0 | зелёный **после `git add`** изменения: скрипт сравнивает рабочее дерево с индексом (`git diff --exit-code`), поэтому до индексации generated-правок он показывал ровно тот diff, который входит в коммит. Незакоммиченного дрейфа нет |
| `npm run typecheck` | 0 | оба потребителя generated-типов компилируются |
| `npm test` | 0 | `✅ All contract validation checks passed` |
| `npm run uispec:validate` | 0 | `Validated 31 files; errors=0`; `--- Contract gaps (V9, не resolved): GAP-003 (open)` — GAP-002 ушёл из сводки (AC11) |

### Поведение `npm test` по фазам — совпало с таблицей плана

| Состояние | Exit | Что показал |
|---|---|---|
| после P06 (регенерация), до P08 | **1** | ровно три ожидаемых `FAIL`: `Route count: 9 === 8`, `Operation count: 12 === 11`, `Route /calendar is within MVP scope` |
| после P08 (два списка) | 0 | `✅ All contract validation checks passed` |
| после P09 (шесть проверок) | 0 | то же, плюс 20 новых `PASS` в секции 11 |

### Шесть проверок гейта — и негативный контроль

Все шесть проходят против собранного документа:

```text
PASS: createPublicBooking 200 response discloses none of: availabilityRules, slotIntervalMinutes, publicUrl
PASS: createPublicBooking 201 response discloses none of: …
PASS: getPublicCalendar 200 response discloses none of: …
PASS: getPublicEventTypes 200 response discloses none of: …
PASS: getPublicSlots 200 response discloses none of: …
PASS: AC1 check reached public operation getPublicCalendar / getPublicEventTypes / getPublicSlots / createPublicBooking
PASS: Booking.eventTypeName exists
PASS: Booking.eventTypeName is required
PASS: POST /bookings documents '200' with $ref Booking (got #/components/schemas/Booking)
PASS: POST /bookings documents '201' with $ref Booking (got #/components/schemas/Booking)
PASS: updateAdminSettings (/admin/settings) documents 400 ValidationError (400 references: ValidationError, CalendarNotConfigured)
PASS: completeAdminSetup (/admin/setup) documents 400 ValidationError (400 references: ValidationError)
PASS: AC5 check reached operation completeAdminSetup / updateAdminSettings
PASS: AvailabilityRule.daysOfWeek minItems === 1
PASS: getPublicSlots query param eventTypeId has schema.minLength === 1
PASS: CreateBookingRequest.eventTypeId minLength === 1
```

**Негативный контроль обязателен и выполнен** — иначе это был бы вакуумный PASS. Копия гейта и копия
собранного документа вынесены в scratchpad; каждая из семи проверок (шестая — два ассерта, проверены
по отдельности) прогнана против точечно испорченного документа. Контрольный прогон на неиспорченной
копии — exit 0; каждый прогон с порчей — exit 1 с ожидаемым `FAIL` и **без** посторонних отказов:

| Порча документа | Ожидаемый `FAIL` | Результат |
|---|---|---|
| в `EventType.properties` подсажен `slotIntervalMinutes` (достижим только рекурсивно: `getPublicEventTypes` 200 → `items` → `$ref EventType`) | проверка 1 | `FAIL: slotIntervalMinutes found in schema at /event-types getPublicEventTypes 200.items -> EventType` + `FAIL: getPublicEventTypes 200 response discloses none of: …` |
| `eventTypeName` удалён из `Booking.required` (свойство оставлено) | проверка 2 | `FAIL: Booking.eventTypeName is required` |
| удалён `paths['/bookings'].post.responses['200']` | проверка 3 | `FAIL: POST /bookings documents '200' … (got no such response)` |
| 400 у `completeAdminSetup` заменён на `$ref: CalendarNotConfigured` | проверка 4 | `FAIL: completeAdminSetup (/admin/setup) documents 400 ValidationError (400 references: CalendarNotConfigured)` |
| удалён `AvailabilityRule.daysOfWeek.minItems` | проверка 5 | `FAIL: AvailabilityRule.daysOfWeek minItems === 1` |
| удалён `minLength` у query-параметра `getPublicSlots.eventTypeId` | проверка 6a | `FAIL: getPublicSlots query param eventTypeId has schema.minLength === 1` |
| удалён `minLength` у `CreateBookingRequest.eventTypeId` | проверка 6b | `FAIL: CreateBookingRequest.eventTypeId minLength === 1` |

Проверка 1 дополнительно защищена ассертами «check reached public operation …»: без них переименование
или удаление публичной операции сделало бы её вакуумной.

### Runtime-проверки generated Zod (AC6, AC7, AC2)

`grep -c '^export const z' packages/backend-contract/src/generated/zod.gen.ts` → **46** (было 44);
рантайм-подсчёт экспортов `@minical/backend-contract/zod` тоже даёт 46. Прямые `safeParse` (в каждом
случае рядом положительный контроль, чтобы `false` нельзя было списать на другое поле):

```text
exported Zod schemas: 46
zPublicCalendarResponse present: true
zGetPublicCalendarResponse present: true
zGetPublicSlotsQuery      | eventTypeId: ''         | success=false | eventTypeId: Too small: expected string to have >=1 characters
zGetPublicSlotsQuery      | eventTypeId: 'consult'  | success=true
zCreatePublicBookingBody  | eventTypeId: ''         | success=false | eventTypeId: Too small: expected string to have >=1 characters
zCreatePublicBookingBody  | eventTypeId: 'consult'  | success=true
zCreateBookingRequest     | eventTypeId: ''         | success=false | eventTypeId: Too small: expected string to have >=1 characters
zAvailabilityRule         | daysOfWeek: []          | success=false | daysOfWeek: Too small: expected array to have >=1 items
zAvailabilityRule         | daysOfWeek: ['Monday']  | success=true
zCreatePublicBookingResponse без eventTypeName: success=false
zCreatePublicBookingResponse с eventTypeName:   success=true
zCreatePublicBookingResponse === zBooking:      true
```

### Prism-мок (AC13)

`npm run mock:prism` → `Prism is listening on http://127.0.0.1:4010`. Все 12 операций отвечают по тем
же базовым путям:

```text
getHealth                GET  /health                -> 200
getAdminSetup            GET  /admin/setup           -> 200
completeAdminSetup       PUT  /admin/setup           -> 200
getAdminSettings         GET  /admin/settings        -> 200
updateAdminSettings      PUT  /admin/settings        -> 200
getAdminEventTypes       GET  /admin/event-types     -> 200
createAdminEventType     POST /admin/event-types     -> 201
getAdminUpcomingBookings GET  /admin/bookings        -> 200
getPublicCalendar        GET  /calendar              -> 200
getPublicEventTypes      GET  /event-types           -> 200
getPublicSlots           GET  /slots?eventTypeId=…   -> 200
createPublicBooking      POST /bookings              -> 200
```

- `GET /calendar` → `{"displayName":"string"}` — новый маршрут смонтирован автоматически;
- **дефолтный 2xx у `POST /bookings` — `200`**, как и предсказывал ADR: мок выбирает наименьший 2xx.
  Тело содержит `eventTypeName`;
- `Prefer: code=201` на `POST /bookings` → **201** — прежнее поведение доступно штатным механизмом;
- новые ограничения доехали и до мока: `POST /bookings` с `eventTypeId: ""` → `400`,
  `GET /slots?eventTypeId=` → `400` (до этой задачи оба запроса проходили транспортную валидацию).

Мок остановлен после проверки; порт `4010` свободен.

### Acceptance criteria

| AC | Статус | Чем подтверждён |
|---|---|---|
| AC1 — `displayName` публично, ни один публичный ответ не раскрывает настроек | закрыт | `GET /calendar` + проверка гейта 1 (рекурсивный обход `$ref` по всем 2xx четырёх публичных операций) с негативным контролем |
| AC2 — название типа встречи в ответе брони, одна форма для обоих флоу, snapshot зафиксирован | закрыт | `Booking.eventTypeName` в `required` (проверка 2), doc-комментарий про snapshot, `zBooking` отвергает тело без поля |
| AC3 — три ситуации FR3 документированы, doc-комментарий описывает семантику | закрыт | `200` и `201` на одну схему `Booking` (проверка 3), `409 DUPLICATE_BOOKING_ID` и `409 SLOT_UNAVAILABLE` сохранены; правило эквивалентности нагрузки — в doc-комментарии операции, схемой не проверяется (backend-тесты `back-001`) |
| AC4 — путь (б) FR4: ни одной правки по иконке и цвету | закрыт | 0 вхождений `icon`/`color` в `.tsp` и в generated OpenAPI; `10-create-event-type.screen.md` не тронут, остаётся `approved` |
| AC5 — `400 ValidationError` у обеих setup-операций | закрыт | проверка 4 + generated: `$ref: ValidationError` и `anyOf[ValidationError, CalendarNotConfigured]` |
| AC6 — `minItems: 1` у `daysOfWeek` | закрыт | проверка 5 + `safeParse([])` → `false` |
| AC7 — `minLength: 1` у двух ссылок на `eventTypeId`, пустая строка отвергается Zod | закрыт | проверка 6 (два ассерта) + три `safeParse('')` → `false` |
| AC8 | **снят** вместе с FR8 (2026-08-07): `servers` и `baseUrl` — предмет `task-infra-005`. Номер сохранён | — |
| AC9 — `info.version` ≠ `0.1.0` | закрыт | `info.version: 0.2.0` в generated OpenAPI |
| AC10 — гейт соответствует факту, `npm test` зелёный | закрыт | `npm test` exit 0 после P08 и P09; негативный контроль шести проверок |
| AC11 — GAP-002 `resolved` с `<Workaround>` и `<Task>`, GAP-003 не тронут, обход зарегистрирован | закрыт | `uispec:validate` exit 0, `errors=0`, в сводке open-gaps только `GAP-003 (open)` |
| AC12 — документы `back-001` в `черновик` со ссылкой и перечнем затронутого | закрыт по содержанию | `brief`/`adr` → `черновик` с блоком причины; `plan` приведён в соответствие. Пересогласование — за пользователем/reviewer'ом |
| AC13 — пять команд без ошибок; `mock:prism` отвечает на `4010` | закрыт | таблица команд выше + smoke 12 операций |

## Отклонения от brief / ADR / plan

Отклонений от решений ADR нет: ни одно решение Р1–Р11 не пересматривалось, ни один блокер B1–B4 не
сработал. Зафиксированные мелочи:

1. **`generate:check` требует индексации.** Скрипт — `npm run generate && git diff --exit-code -- …`,
   то есть сравнивает рабочее дерево с индексом. Пока generated-правки не были в индексе, он
   ожидаемо давал exit 1 на том же diff, который входит в коммит. После `git add` — exit 0. Это
   свойство скрипта, а не дрейф; коммит выполняет reviewer.
2. **Doc-комментарий `zCreatePublicBookingResponse`** в `zod.gen.ts` изменился как побочный эффект
   второго 2xx (эмиттер берёт описание наименьшего статуса). Схема — та же `zBooking`.
3. **Три правки за пределами буквы чеклиста Р10, в тех же разделах тех же файлов** — сделаны потому,
   что новый контракт делает прежний текст ложным, а Р10 задаёт чеклист, а не перепись:
   в `back-001/brief.md` — строка `VALIDATION_ERROR` таблицы FR4 (3 операции → 5, следствие FR5),
   утверждение «`createPublicBooking` — единственная операция, у которой несколько моделей ошибок
   делят один статус» (после FR5 такова же `updateAdminSettings`) и новый п. 4 сценария гостя
   (`GET /calendar` — иначе двенадцатая операция не имеет сценария); в `brief.md` также добавлена
   строка `contract-001` в «Зависимости». В `adr.md` — «Последствия» п. 8 (компромисс про
   недокументированный 400 снят) и два счётчика «11 операций» → 12 в Р1 и в «Рассмотренных
   альтернативах».
4. **Статус `contract-001` в реестре задач — `черновик`, а не `завершена`.** По определению самого
   реестра `завершена` = все четыре документа `согласовано`, а `result.md` ждёт ревью. В строке
   каталога и в шаге 2 «Плана разработки» зафиксировано «реализация выполнена, `result.md` на ревью».

## Известные ограничения и риски

1. **Семантика идемпотентности схемой OpenAPI 3.0 не выражается.** Правило эквивалентности нагрузки
   (`eventTypeId`, `startAtUtc` и каждое поле `guest` равны как разобранные значения; `id` в
   сравнении не участвует) живёт в doc-комментарии `createPublicBooking` и проверяется
   backend-тестами `back-001`. На уровне схемы `200` и `201` неотличимы по телу — это и есть условие,
   при котором Zod-схема ответа остаётся одной.
2. **`id` остаётся опциональным**, поэтому безопасность повтора — обязанность клиента: без ключа
   повтор по-прежнему даёт `409 SLOT_UNAVAILABLE`. Сделать поле обязательным значило бы отменить «`id`
   генерируется сервером» из `docs/domain-model.md` §7.5.
3. **Snapshot-чтение `eventTypeName` на `getAdminUpcomingBookings`** контракт задаёт doc-комментарием,
   но проверить не может: если backend посчитает значение join'ом с текущими типами, поведение при
   переименовании разойдётся между двумя операциями. Проверяется тестом `back-001` (Р9).
4. **Prism по умолчанию отвечает на `POST /bookings` статусом `200`.** Клиент, разрабатываемый против
   мока, обязан трактовать любой 2xx как успех; `201` доступен через `Prefer: code=201`. Запись в
   `task-infra-004/result.md` стала исторической — помечена примечанием, статус не отозван.
5. **Экраны 05, 11 и 15 продолжают жить с обходами**, которые контракт уже сделал ненужными: правка
   `approved`-экранов вернула бы `front-ui-001` в `черновик` (правило 8), а экран 15 целиком заменяет
   `front-ui-002`. Маркеры `TODO-CONTRACT-GAP(GAP-002)` и атрибуты `gap="GAP-002"` (в том числе в
   `api-bindings.xml`) оставлены на месте — V9 проверяет только регистрацию гапа, не его статус.
6. **Binding для `getPublicCalendar` в `api-bindings.xml` не добавлен**: ни один существующий гостевой
   экран имени владельца не показывает. Появится вместе с экранами `front-ui-002`.
7. **GAP-003 (`PATCH /admin/settings`) и G3 (`404 NOT_FOUND` / `500 INTERNAL_ERROR` вне контракта)**
   остаются открытыми — прямые non-goals brief.
8. **Реализация `back-001` заблокирована** до повторного согласования её `brief.md` и `adr.md`
   (правило 11, блокер B3 плана). Риск, если этого не сделать: backend начнут писать по документам,
   часть которых описывает прежний контракт.
9. **Обязательное `eventTypeName` — breaking для любого производителя ответа**, и `Booking` больше не
   заполняется из одного `CreateBookingRequest` без чтения типа встречи (впрочем, `endAtUtc` этого
   требовал и раньше). Цена сейчас нулевая: реализации нет.

Breaking changes B1–B7 из ADR («Совместимость и миграция») в силе и подтверждены фактом: B1
(`Booking.eventTypeName`), B2 (второй 2xx и дефолт Prism), B3 (семантика `DUPLICATE_BOOKING_ID`),
B4 (`@minItems(1)`), B5 (`@minLength(1)`), B6 (12-я операция и 9-й маршрут — жёсткие списки гейта
обновлены в том же изменении), B7 (`info.version` `0.2.0`).

## Описание для MR

**Title:** `feat: task-contract-001 — расширение контракта под гостевой флоу и закрытие гапов G1/G2/G4`

### Summary

Контракт MiniCal расширен до 12 операций / 9 маршрутов, версия `0.2.0`. Гость теперь может узнать имя
владельца календаря и название типа встречи из ответа сервера, а повтор создания брони после
потерянного ответа безопасен и отличим от настоящего конфликта. Заодно закрыты три расхождения
контракта, найденные при проектировании `task-back-001`: недокументированный `400` у setup-операций,
пустой `daysOfWeek` и пустая ссылка на `eventTypeId`.

### Changes

- **`GET /calendar` (`getPublicCalendar`)** — публичная проекция профиля владельца, ровно
  `displayName`. До завершения onboarding — `400 CALENDAR_NOT_CONFIGURED`. `timeZone`,
  `availabilityRules`, `slotIntervalMinutes`, `publicUrl` гостю не раскрываются.
- **`Booking.eventTypeName`** — обязательное поле, snapshot названия типа встречи на момент
  бронирования: переименование типа существующие брони не меняет, значение переживает удаление типа.
  Одна модель `Booking` закрывает и `createPublicBooking`, и `getAdminUpcomingBookings`.
- **Идемпотентный `POST /bookings`** — ключ остаётся существующим опциональным `id` тела. `201` —
  создано; `200` — повтор с эквивалентной нагрузкой, в теле ранее созданная бронь. `409
  DUPLICATE_BOOKING_ID` теперь означает только «тот же ключ, другая нагрузка»; занятость слота от
  другого ключа по-прежнему `409 SLOT_UNAVAILABLE`. Правило эквивалентности — в doc-комментарии
  операции.
- **`400 ValidationError`** добавлен у `completeAdminSetup` и `updateAdminSettings` (G1).
- **`@minItems(1)`** у `AvailabilityRule.daysOfWeek` (G2); **`@minLength(1)`** у query-параметра
  `getPublicSlots.eventTypeId` и у `CreateBookingRequest.eventTypeId` (G4).
- **`info.version` `0.1.0` → `0.2.0`** (пока мажор нулевой, breaking → минор).
- Регенерация: `openapi.yaml`, `@minical/api-client`, `@minical/backend-contract` (44 → 46 Zod-схем) —
  в том же изменении.
- Контрактный гейт: два списка обновлены, добавлены шесть проверок под AC1, AC2, AC3, AC5, AC6, AC7;
  существующий рекурсивный обходчик `$ref` обобщён до набора запрещённых свойств.
- Иконка и цвет типа встречи (FR4) реализуются путём (б) — контракта не касаются.

### Verification

`contracts:format:check`, `generate:check`, `typecheck`, `test`, `uispec:validate` — exit 0.
`npm run mock:prism` на `4010`: `/health`, новый `/calendar` и все 12 операций отвечают по тем же
базовым путям; дефолтный 2xx у `POST /bookings` — `200`, `201` через `Prefer: code=201`. Generated diff
принят по закрытому чеклисту (7 файлов, `openapi: 3.0.0`, `zCreatePublicBookingResponse` остался
`zBooking`). Каждая из шести новых проверок гейта прогнана против точечно испорченного документа и
даёт `FAIL` — вакуумных PASS нет. Прямые `safeParse`: пустая строка отвергается
`zGetPublicSlotsQuery` и `zCreatePublicBookingBody`, пустой массив — `zAvailabilityRule`, тело без
`eventTypeName` — `zBooking`.

### Known limitations

Семантика идемпотентности схемой OpenAPI 3.0 не выражается и живёт в doc-комментарии плюс
backend-тестах `back-001`; `id` остаётся опциональным, поэтому безопасность повтора — обязанность
клиента. Prism по умолчанию отвечает на `POST /bookings` статусом `200` (запись в
`task-infra-004/result.md` помечена как историческая). Экраны 05, 11 и 15 продолжают жить с обходами,
которые контракт уже сделал ненужными: 05 и 11 принадлежат завершённой `front-ui-001`, 15 заменяет
`front-ui-002`. GAP-003 и G3 остаются открытыми. Документы `task-back-001` возвращены в `черновик` и
приведены в соответствие — реализация backend не может начаться до их повторного согласования.
