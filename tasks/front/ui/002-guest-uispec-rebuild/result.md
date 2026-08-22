# Результат TASK-FRONT-UI-002

## Итог

Гостевая ветка UISpec Kit пересобрана по присланному макету и действующему канону. В ките ровно четыре
гостевых экрана (по одному на route) и восемь гостевых компонентов, все теги зарегистрированы, все
`api.*`-действия связаны через `api-bindings.xml`, все `{fn(...)}` объявлены, все токены резолвятся.
Расходящийся форк `specs/guest/` удалён. Owner-ветка не затронута: агрегат контрольных сумм 27 owner-файлов
до и после совпал посимвольно.

В состав задачи вошла аддитивная правка канона — 19-й атрибут `<Action>` `onErrorWhen` и корень выражений
`$error` — без которой состояния `slotUnavailable`, `networkError`, `serverValidationError` и `unavailable`
не имели бы пути входа через атрибут результата (AC7). Правка синхронна в четырёх местах: `MANUAL.md`,
allowlist валидатора, его собственный тест-набор, reference скилла.

Все 18 пунктов плана — `завершено`. Пять обязательных проверок `AGENTS.md` зелёные. Задача не коммитила и не
переводила файлы в `согласовано`/`approved`: все 12 гостевых файлов — `status: draft`.

## Что изменено

### Канон (P02–P04)

| Файл | Правка |
|---|---|
| `docs/ui-spec-kit/MANUAL.md` | §6.4: «Атрибуты (18)» → «(19)»; строка `onErrorWhen` в таблице сразу после `onSuccessWhen`; новый подраздел `#### onErrorWhen` (синтаксис ветвей, таблица полей `$error` — `code`/`message`/`transport`, правило дефолта `onErrorState`, явная оговорка про сознательную асимметрию с `onSuccessWhen`, пример); в описании `onSuccessWhen` — уточнение, что условие ветви может читать `$state`/`$validation`, а не только `$result`; в строке `before` — «используется с `local.submit`» → «чаще всего с `local.submit`, допустимо и с `api.command`» |
| `docs/ui-spec-kit/tools/uispec/validate_uispec.py` | `ACTION_ATTRS += 'onErrorWhen'`; `REF_PREFIXES += '$error'`; сбор route-целей ветвей обобщён на оба атрибута через новую константу `BRANCH_ATTRS = ('onSuccessWhen', 'onErrorWhen')` — иначе V5 объявил бы `GuestSlots` сиротой. Ветви как ERROR по-прежнему не проверяются (унаследованная неразличимость state/route, находка C3) |
| `docs/ui-spec-kit/tools/uispec/tests/run_tests.py` | Положительный кейс `onErrorWhen-allowed`: спека с `<Action kind="api.command" onErrorWhen="$error.transport == true:networkError" onErrorState="error">` и ссылкой `{$error.code}` в разметке проходит с `exit 0` **и без** строк «неизвестный атрибут» и «unknown token/reference». Для этого в харнесс добавлена функция `output_matches`: ожидание по выводу может быть tuple, подстрока с ведущим `!` обязана отсутствовать. Существующие 17 кейсов не переписаны и не ослаблены |
| `.opencode/skills/uispec-generator/references/uispec-language.md` | строка 11: `onErrorWhen` рядом с `onSuccessWhen` |

### Токены (P05, P06)

`sizes.tokens.xml` — 5 новых `<Size>` (только добавленные строки): `size.card.summary.height` 88,
`size.dateChip.width` 64, `size.dateChip.height` 72, `size.textarea.minHeight` 96, `size.icon.hero` 72.
`size.dateStrip.height` и `size.card.eventType` не заводились: высоту полоски задают чипы, вместо второго
переиспользован существующий `size.card.eventType.height`.

`colors.tokens.xml` — 10 новых `<Color>` (только добавленные строки): `color.status.warning`,
`color.status.warningSurface`, `color.status.errorSurface`, `color.guest.selectedSurface`,
`color.accent.1…6`. Строка `color.action.primary` осталась побайтово той же.

### Реестр (P07)

7 новых `<Component>`: `SlotGrid`, `DateStrip`, `DateChip` (`@/features/slots/components/*`), `InlineAlert`
(`@/design-system/components/InlineAlert`), `PublicEventTypeCard`, `BookingSummaryCard`,
`ConfirmationDetails` (`@/features/guest/components/*`). `SlotButton` не заведён — роль кнопки слота исполняет
существующий `SlotItem`, его запись не менялась.

6 новых `<Helper>`: `fullDateLabel`, `availableDates`, `slotsOnDate`, `selectedSlotMissing`,
`eventTypeAccentIndex`, `newBookingKey`. Одна изменённая существующая строка (задекларированное заранее
исключение): сигнатура `formattedSlot` расширена до `(startAtUtc, endAtUtc) => string` — helper гостевой,
owner-экранов не касается. Пять функций оформления присланного набора (`dateChipTextColor`, `alertBackground`,
`alertBorder`, `alertIcon`, `alertIconColor`) не переносились: оформление возвращает компонент, а не helper.

### Компоненты (P08, P09) — 8 файлов, все `status: draft`, `platforms: [android, web]`

| Файл | Состояние |
|---|---|
| `date-chip.component.md` | новый — чип даты, `disabled`-варианта нет вовсе |
| `date-strip.component.md` | новый — `<Repeat item="item">` + `DateChip`, локальная копия view-model `AvailableDate` |
| `slot-grid.component.md` | новый — сетка ≥2 колонок, внутри `SlotItem`, локальная копия `Slot` |
| `slot-item.component.md` | **переписан** — корень `<SlotItem>`, props `startAtUtc`/`endAtUtc`/`selected`/`onPress` |
| `public-event-type-card.component.md` | новый — плитка по `accentIndex`, глиф `$color.text.onPrimary` |
| `inline-alert.component.md` | новый — `variant="warning\|error"`, соответствие «вариант → токен/иконка» в `Rules` |
| `booking-summary-card.component.md` | новый — `{formattedSlot(...)}`, `TimezoneLabel`, ссылка «Изменить» |
| `confirmation-details.component.md` | новый — шесть строк кадра 7 с иконками |

### Экраны (P11–P14) — 4 файла, все `status: draft`

| Файл | Кадры | Состояния |
|---|---|---|
| `12-public-event-types.screen.md` | 1 | `loading`, `content`, `empty`, `error` |
| `13-public-slots.screen.md` | 2, 3, 8 | `loading`, `dateSelection`, `slotSelection`, `slotUnavailable`, `empty`, `unavailable`, `error` |
| `14-guest-booking-form.screen.md` | 4, 5, 6, 9 | `editing`, `validationError`, `submitting`, `serverValidationError`, `networkError` |
| `15-booking-confirmation.screen.md` | 7 | `content`, `error` |

Имена файлов, `Meta.id` и route сохранены каноническими (`guest.event-types`/`GuestEventTypes` и далее):
присланные `guest.catalog`/`GuestCatalog` не заводились, поэтому ни одна ссылка в завершённых задачах
`front-ui-001` и `contract-001` не стала висячей. У каждого экрана в UX rules — таблица путей входа в
состояния (действие + атрибут результата): это и есть машиночитаемое доказательство AC7 там, где ветви
валидатором не проверяются.

### Остальное

- `navigation.uispec.xml` — вложенные `<Param name type required>` у трёх guest-route; owner-часть (`Root`,
  `OnboardingStack`, `OwnerTabs`) не тронута, третий bottom-tab не появился.
- `api-bindings.xml` — 2 новых `<Binding>`: `loadPublicCalendar` → `getPublicCalendar`,
  `refreshPublicSlots` → `getPublicSlots`. Три существующие guest-записи не правились.
- `contract-gaps.xml` — новая запись `GAP-004` (`open`, severity low, blocking false,
  screens `guest.booking-form`). GAP-001, GAP-002 (`resolved`) и GAP-003 не тронуты.
- `assets/guest-mobile-flow.png` — перенесён из `specs/guest/assets/` (sha256 до и после
  `28b20ced0263377ec5193729b4ff679809f06fb7c522490a392317becbb216ef` — файл побайтово тот же).
- `assets/ASSETS.md` — ровно 2 добавленных строки: макет гостевого флоу и `$asset.network-error` с
  `TODO-ASSET`. Четыре существующие строки, включая owner-овскую, не редактировались.
- `screens/FRAME_MAP.md` — гостевой раздел переписан: доска 3×3, 9 кадров, таблица «кадр → экран →
  состояние» и явный список 10 состояний без кадра. Owner-разделы не тронуты.
- `specs/guest/` — удалён целиком (17 файлов); `.DS_Store` в ките больше нет ни одного.

## Контракт и generated-артефакты

`API impact NONE` — подтверждено фактически. `packages/contracts/**` и generated-пакеты не менялись;
`npm run generate:check` зелёный **без diff**, `git status` после всех прогонов чистый.
`tests/contract-validation.test.ts` не трогался.

Спеки написаны против контракта `0.2.0`: `PublicCalendarResponse.displayName` (имя владельца, кадр 1),
`EventType {id, name, description?, durationMinutes}`, `Slot {startAtUtc, endAtUtc, eventTypeId}`,
`CreateBookingRequest {eventTypeId, startAtUtc, id?, guest}`, `GuestDetails {name, email, note?}`,
`Booking.eventTypeName` (кадр 7). Выдуманных полей нет: V11 чист. Обёрток `GuestCatalogData`/`GuestSlotWindow`,
полей `publicId`, `title`, `bookingId`, `windowStart`/`windowEnd`, `startAt`/`endAt`, `comment` в ките не
осталось.

Поручение записи GAP-002 (`contract-gaps.xml:25`) исполнено: property состояния `eventTypeName` на экране 15
снята, значение берётся из `Booking.eventTypeName` ответа `createPublicBooking`.

## База данных и миграции

Не затронуты — задача правит только UISpec Kit.

## Выполненные проверки

### Нулевая отметка (P01, до любой правки)

```text
Validated 31 files; errors=0
--- Статусы (V10): approved=26, draft=5
--- Contract gaps (V9, не resolved): GAP-003 (open)
--lint — ни одной строки LINT
run_tests.py — 17/17 passed
npm test — ✅ All contract validation checks passed
```

### Итоговая отметка (P17)

```text
npm run uispec:validate            EXIT=0
  Validated 38 files; errors=0
  --- Статусы (V10): approved=26, draft=12
  --- Contract gaps (V9, не resolved): GAP-003 (open), GAP-004 (open)

--lint                             EXIT=0, ни одной строки LINT (обязан молчать — молчит)
--strict                           EXIT=1 (ожидаемо), strict-draft=12 — ровно 12 гостевых файлов
run_tests.py                       18/18 passed, EXIT=0
generate_scaffold.py (smoke)       4 экрана → 13 файлов в scratch, exit 0 каждый; в apps/client не записано ничего
конфиги внутри docs/               ровно один: docs/ui-spec-kit/uispec.config.json (суррогатов нет)
```

Валидатор проходил зелёным после **каждого** пункта плана. Единственное расхождение с таблицей плана —
арифметическое: после P08 план ожидал 35 файлов, фактически 34, потому что `slot-item.component.md` уже
существовал и переписывается, а не создаётся (P08 добавляет 3 файла, не 4). Целевые 38 файлов после P09
совпали с планом.

### Grep-контроль того, что прогон не проверяет

```text
inline operation= в specs/ui/screens|components        0
status: approved в 12 гостевых файлах                  0
platforms без android среди гостевых файлов            0 (везде [android, web])
web-mobile / web-desktop в ките                        0
localDate в ките                                       0
onErrorCode / onSuccessAction в ките                   0
<Param value=> в гостевых экранах                      0
<Param> без type= в гостевых экранах                   0
local.update с target= вместо path/value               0
Viewport гостевых экранов                              360×800 у всех четырёх
```

Встречная сверка AC2 (только внутри `uispec`-блоков): `SlotItem` 2× (`slot-grid`, `slot-item`), `SlotGrid` 2×,
`DateStrip` 2×, `DateChip` 2× (`date-chip`, **внутри `date-strip`**), `InlineAlert` 3×, `PublicEventTypeCard`
2×, `BookingSummaryCard` 2×, `ConfirmationDetails` 2×. Записей реестра без пользователя всего две — `Stack` и
`Overlay`, обе унаследованные owner-записи со `status="reserved"`, к гостевой ветке не относятся. Все шесть
новых helpers имеют вызовы в спеках.

### Корневые гейты (P18)

```text
npm run contracts:format:check     EXIT=0
npm run generate:check             EXIT=0, без diff
npm run typecheck                  EXIT=0
npm test                           EXIT=0
git status                         чисто (кит вне git; packages/** и apps/** не затронуты)
```

### Owner-снимок (AC9)

27 файлов: owner-экраны `01-setup-check` … `11-booking-details-sheet` (11), owner-компоненты
`specs/ui/components/*.component.md` кроме `slot-item` (15), `assets/owner-mobile-flow.png` (1).

```text
агрегат P01 (до):    b789c7d4511d057aed42756ed9b2a2d2ff1e4ec2cd608e0172c80ffb7ebe2266
агрегат P18 (после): b789c7d4511d057aed42756ed9b2a2d2ff1e4ec2cd608e0172c80ffb7ebe2266
построчный diff 27 контрольных сумм — пусто
```

Построчный `diff` восьми общих файлов с копиями P01:

| Файл | + | − | Что за изменённые строки |
|---|---:|---:|---|
| `components.registry.xml` | 14 | 1 | сигнатура `formattedSlot` — задекларированное исключение (P07) |
| `sizes.tokens.xml` | 5 | 0 | — |
| `colors.tokens.xml` | 20 | 0 | — |
| `navigation.uispec.xml` | 15 | 3 | три **гостевых** `<Route>`: `/>` → `>` … `</Route>`, чтобы вложить `<Param>`; owner-строки не тронуты |
| `api-bindings.xml` | 2 | 0 | — |
| `contract-gaps.xml` | 6 | 0 | — |
| `FRAME_MAP.md` | 32 | 2 | обе — внутри гостевого раздела: заменённый абзац «reference-фреймов нет вообще» и финальная строка («на общей доске» → «на общих досках», доски теперь две) |
| `ASSETS.md` | 2 | 0 | — |

Owner-строк среди изменённых нет ни в одном файле.

### Контраст guest-токена выбранного состояния (P06, Реш.7)

Формула WCAG 2.1: `ratio = (L_светлее + 0.05) / (L_темнее + 0.05)`, где `L` — относительная яркость
(`0.2126R + 0.7152G + 0.0722B` по линеаризованным каналам). Текст на выбранном элементе —
`$color.text.onPrimary` = `#FFFFFF` в обеих темах, `L = 1.0`.

| Токен | Тема | Значение | Контраст к `#FFFFFF` | Порог | Контраст к фону экрана |
|---|---|---|---:|---|---:|
| `color.guest.selectedSurface` | light | `#1F5FE0` | **5.57** | 4.5 (текст 14sp) | 5.57 к `#FFFFFF` |
| `color.guest.selectedSurface` | dark | `#2F63E0` | **5.27** | 4.5 | 3.52 к `#111318`, 3.20 к `#191D24` |

Синий замысел кадров 2/3 сохранён — fallback Реш.7 не потребовался. Для сравнения, owner-токен
`color.action.primary`, которым красил выбранное состояние черновик: light `#246BFD` → 4.57 (проходит),
dark `#4D86FF` → **3.40** (не проходит AA для текста 14sp). Строка `color.action.primary` не изменена.

Заявленные ADR значения девяти токенов Р7/Р12 пересчитаны и подтверждены, а не приняты на слово:
акценты к белому глифу 4.57 / 6.25 / 4.95 / 4.67 / 5.34 / 5.35 (light) и 3.40 / 3.80 / 3.13 / 3.14 / 3.57 /
3.52 (dark) — все выше порога 3:1 (WCAG 1.4.11); `warningSurface` к `text.primary` 16.47 / 13.00 и к
`text.secondary` 4.56 / 6.71; `errorSurface` — 16.59 / 14.39 и 4.60 / 7.42; `status.warning` к своей подложке
4.30 / 8.08; `status.error` к `errorSurface` 4.80 / 5.79.

### Acceptance criteria

| AC | Статус | Чем подтверждён |
|---|---|---|
| AC1 — `errors=0` реальным конфигом, суррогатов нет | выполнен | `Validated 38 files; errors=0`; `find docs -name '*.config.json'` → ровно один |
| AC2 — ноль незарегистрированных тегов, ни одной записи без пользователя | выполнен | `errors=0` (ERROR `unregistered tag` отсутствует) + встречная сверка 8 тегов выше |
| AC3 — ровно один `<Binding>` на api-действие, инлайна нет | выполнен | V1/V2/V3 чисты; `grep 'operation='` по спекам → 0 |
| AC4 — ноль `unknown token/reference`, `--lint` молчит | выполнен | ни одной строки WARN в прогоне; `--lint` без вывода |
| AC5 — ноль V8 | выполнен | ни одной строки `V8:` в прогоне |
| AC6 — V11 чист по гостевым моделям | выполнен | ни одной строки `V11:`; все `source="api"` модели с `schema=`, поля ⊆ схемы `0.2.0` |
| AC7 — состояния присутствуют и достижимы, у каждого путь входа | выполнен | 18 состояний на четырёх экранах, у каждого строка в таблице путей входа в UX rules; ветви `onErrorWhen`/`onSuccessWhen` + `onErrorState`/`onConflict` в спеках |
| AC8 — 9 кадров соотнесены, состояния без кадра перечислены, frontmatter корректен | выполнен | `FRAME_MAP.md`: таблица 9 кадров + 10 состояний без кадра; `referenceFrame: 1`, `referenceFrames: [2, 3, 8]`, `referenceFrames: [4, 5, 6, 9]`, `referenceFrame: 7` |
| AC9 — owner-часть не затронута | выполнен | агрегаты `shasum` совпали посимвольно; построчный diff 8 общих файлов — только добавления и два задекларированных исключения |
| AC10 — нет `specs/guest/`, второго `MANUAL.md`, второго navigation, `.DS_Store` | выполнен | `find`: `specs/guest` отсутствует, `MANUAL.md` — 1, `*navigation*.xml` — 1, `.DS_Store` — 0 |
| AC11 — `<Gap>` + маркер, выдуманных полей нет | выполнен | `GAP-004` в реестре, `gap="GAP-004"` на `createBooking` (единственное действие с `gap=`), `TODO-CONTRACT-GAP(GAP-004)` в UX rules формы; сводка open-gaps пополнилась |
| AC12 — все гостевые файлы `draft`, `--strict` даёт exit 1 | выполнен | `approved=26, draft=12`; `--strict` → exit 1, `strict-draft=12` |
| AC13 — пять обязательных команд зелёные | выполнен | `contracts:format:check`, `generate:check`, `typecheck`, `npm test`, `uispec:validate` — все EXIT=0 |

## Отклонения от brief / ADR / plan

1. **`.DS_Store`: удалено пять файлов, а не три.** План (P16, блокер B6) исходил из трёх (`specs/guest/`,
   `specs/`, `specs/ui/`); фактически в ките их было пять — ещё `docs/ui-spec-kit/.DS_Store` и
   `docs/ui-spec-kit/tools/.DS_Store`. AC10 требует, чтобы `.DS_Store` в ките не осталось **вовсе**, поэтому
   удалены все пять. Файлы — мусор macOS, к owner-спекам и снимку P01 не относятся, на валидацию не влияют.
   Если reviewer считает два дополнительных удаления выходом за scope, они восстанавливаются без последствий
   для остальной задачи.
2. **Промежуточный счётчик файлов после P08 — 34, а не 35** (см. «Выполненные проверки»). Арифметическая
   поправка к плану, не дефект: `slot-item.component.md` переписывается, а не создаётся. Целевые 38 совпали.
3. **Три изменённые строки в `navigation.uispec.xml`** — не «только вставленные строки», как формулировал
   план: чтобы вложить `<Param>`, самозакрывающиеся теги трёх **гостевых** `<Route>` пришлось превратить в
   пары открывающий/закрывающий. Механически неизбежно при вложении; owner-строки побайтово те же.
4. **Финальная строка `FRAME_MAP.md`** («на общей доске» → «на общих досках») изменена дополнительно к
   заменённому абзацу. Строка находится внутри гостевого раздела и после появления второй доски была бы
   неверной. Owner-разделы не тронуты.
5. **`clearSelectedSlot` оставлен свободной меткой хука** (развилка B5), как `before="validateGuestForm"`:
   полноценным действием не объявлялся, чтобы не заводить действие без триггера.
6. **Id guest-токена — `color.guest.selectedSurface`** (развилка B4 оставляла имя исполнителю); значения
   подобраны измерением, а не на глаз, расчёт приведён выше.
7. **Кнопка «Повторить» на экране каталога ссылается на `loadPublicEventTypes`**, хотя перезапустить нужно
   оба начальных чтения: `local.dispatch` умеет одну цель, а переходом состояний владеет именно
   `loadPublicEventTypes`. Конвенция «контейнер перезапускает пару» зафиксирована в UX rules экрана.

Расхождений с решениями ADR (Р1–Р16, Реш.1–Реш.7) нет; порядок пунктов плана соблюдён буквально, ни одна из
двух разрешённых перестановок не потребовалась (перенос PNG выполнен в составе P15, сразу после P14).

## Известные ограничения и риски

1. **Ветви `onSuccessWhen`/`onErrorWhen` валидатор не проверяет** — унаследованная неразличимость state/route
   (находка C3 `AUDIT.md`). Опечатка в имени состояния внутри ветви не будет поймана инструментом.
   Компенсация: таблицы путей входа в UX rules каждого экрана и проход по AC7 глазами reviewer'а. Усиление V6
   в scope не входило: проверка задела бы owner-ветви.
2. **Три конвенции контейнера остаются прозой UX rules**, а не атрибутами: начальные `api.query` при
   монтировании, `initBookingKey` при монтировании формы, `refreshPublicSlots` при возврате на экран слотов.
   Грамматика UISpec триггеров жизненного цикла не описывает, и вводить их ради трёх мест — переусложнение.
3. **Guest-flow черновик (имя/email/комментарий) — сущность вне UISpec.** Плата за отказ протаскивать PII
   через route params (на web они уезжают в URL и историю браузера). Валидатор этого не проверяет; требование
   переходит в `front-guest-001`.
4. **При 7+ типах встреч у одного владельца акцентные цвета повторяются** — осознанный предел палитры из
   шести. Цвет декоративен и смысла не кодирует, поэтому повтор ничего не ломает.
5. **Возврат по конфликту слота опирается на решение реализующего агента**: route-цель ветви `onErrorWhen`
   обязана резолвиться как возврат на существующий экран стека (pop), а не второй `push`. Ошибка реализации
   даст растущий стек и «назад» в устаревшую форму; сервер повторную попытку по занятому слоту всё равно
   отклонит.
6. **`<Prop type=>` компонентов валидатор не типизирует вовсе** — типы в восьми гостевых компонентах остаются
   документацией. Это существующая слепая зона инструмента, а не следствие задачи.
7. **`$asset.network-error` — placeholder с `TODO-ASSET`:** иллюстрации кадра 9 в пакете нет, вырезать её из
   PNG запрещено.
8. **Шесть brief `front-guest-001…006` остаются с устаревшим содержанием** до отдельного прохода (см. ниже).
   Начинать `front-guest-002…005` по их текущим brief нельзя — получатся экраны, не соответствующие ките.
9. **Решения R1–R6 дополнены, а не откачены:** `operationId` остаётся единственным словарём операций,
   `api-bindings.xml` — единственной точкой связи, `onSuccessState`/`onSuccessRoute` не схлопнуты обратно в
   перегруженный `onSuccess`, реестры helpers и gaps на месте, `<Param type=>` обязателен,
   `uispec:validate` остаётся в `npm test`. Добавлен один симметричный атрибут и один корень выражений.
   `AUDIT.md` и `ROADMAP.md` — исторические документы исполненных R1–R6 — не переписывались.

## Downstream: ссылки, требующие обновления отдельным проходом

Переписывание brief в scope не входит (non-goal). Перечень адресный:

| Задача | Что расходится после этой задачи |
|---|---|
| `front-guest-001` | FR1 — состав дизайн-системы: +7 тегов (`PublicEventTypeCard`, `DateStrip`, `DateChip`, `SlotGrid`, `InlineAlert`, `BookingSummaryCard`, `ConfirmationDetails`) и переписанный `SlotItem` (props `startAtUtc`/`endAtUtc`/`selected`/`onPress`); FR5 — маппер ошибок обязан отдавать форму `$error` с полем **`transport`**; новое — guest-flow черновик и генерация UUID-ключа идемпотентности до первой попытки; FR6 — route те же, но с типизированными `<Param>` |
| `front-guest-002` | Экран каталога делает **два** чтения (`getPublicEventTypes` + `getPublicCalendar`); карточка — `PublicEventTypeCard` с `accentIndex`, а не owner-овский `EventTypeCard`; переход к слотам несёт четыре параметра |
| `front-guest-003` | FR3 «группировка по датам; reuse `SlotItem`» больше не описывает экран: полоска дат + сетка слотов выбранной даты, **семь** состояний вместо четырёх, второе действие `refreshPublicSlots` с распознаванием конфликта, четыре новых компонента к реализации, `SlotItem` получает `selected` |
| `front-guest-004` | Состояния `validationError`/`serverValidationError`/`networkError` вместо одного `error`; CTA активна при невалидной форме (валидация на submit через `before`); `BookingSummaryCard`; ключ идемпотентности в payload; «Выбрать другое время» и «Изменить» — одно действие возврата; поле комментария — `note` |
| `front-guest-005` | Название типа встречи из `Booking.eventTypeName`, а не из навигации; `ConfirmationDetails`; состояние `error`; возврат — `navigation.reset` |
| `front-guest-006` | Сквозной сценарий получает пути кадров 8 и 9: конфликт слота с сохранением данных и ошибка сети с повтором по тому же ключу |
| `tasks/README.md` | Строка `front-ui-002` в реестре задач и раздел «Где мы сейчас» |

## Описание для MR

### Summary

Гостевая ветка UISpec Kit пересобрана по макету дизайн-отдела и действующему канону кита: 4 экрана,
8 компонентов, зарегистрированные теги, реальные `operationId` через `api-bindings.xml`, объявленные helpers и
токены, полные наборы состояний, один новый contract gap. Расходящийся форк `specs/guest/` удалён.
Owner-ветка не затронута (сверено контрольными суммами). Контракт и generated не менялись.

### Changes

- Канон: 19-й атрибут `<Action>` `onErrorWhen` и корень выражений `$error` — `MANUAL.md` §6.4, allowlist
  валидатора, положительная фикстура в его тест-наборе, reference скилла.
- Токены: +5 размеров, +10 цветов (палитра акцентов из шести, три статусных, guest-токен выбранного
  состояния) — только добавленные строки.
- Реестр: +7 компонентов, +6 helpers, расширенная сигнатура `formattedSlot`.
- Компоненты: 7 новых, `slot-item` переписан как кнопка слота.
- Экраны 12–15 переписаны по кадрам 1–9; у каждого — таблица путей входа в состояния.
- Навигация: типизированные `<Param>` у трёх guest-route. Биндинги: +`loadPublicCalendar`,
  +`refreshPublicSlots`. Гапы: +`GAP-004` (по-полевая серверная ошибка валидации).
- Макет перенесён в `specs/ui/assets/`, `ASSETS.md` и гостевой раздел `FRAME_MAP.md` приведены к факту.
- Удалены `specs/guest/` (17 файлов) и все `.DS_Store` кита.

### Verification

```text
npm run uispec:validate          Validated 38 files; errors=0; approved=26, draft=12; gaps GAP-003, GAP-004
--lint                           молчит
--strict                         exit 1, strict-draft=12 (ожидаемо: все гостевые файлы draft)
run_tests.py                     18/18 passed (было 17/17)
generate_scaffold.py smoke       4 экрана, exit 0, в apps/client не записано ничего
npm run contracts:format:check   EXIT=0
npm run generate:check           EXIT=0, без diff
npm run typecheck                EXIT=0
npm test                         EXIT=0
owner-снимок 27 файлов           агрегат sha256 до и после совпал посимвольно
```

### Known limitations

Ветви `onSuccessWhen`/`onErrorWhen` валидатор не проверяет; три конвенции контейнера остаются прозой;
guest-flow черновик — сущность вне UISpec; при 7+ типах встреч акцентные цвета повторяются; возврат по
конфликту слота опирается на решение реализующего агента (pop, а не push); `<Prop type=>` не типизируется
инструментом; `$asset.network-error` — `TODO-ASSET`; шесть brief `front-guest-*` требуют отдельного прохода
по перечню выше.
