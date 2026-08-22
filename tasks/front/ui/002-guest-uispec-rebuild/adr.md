# Architecture decision — TASK-FRONT-UI-002

## Контекст

Вход задачи — согласованный [`brief.md`](brief.md) (FR1–FR16, AC1–AC13) и присланный дизайн-отделом набор `docs/ui-spec-kit/specs/guest/**`: 4 экрана, 8 компонентов, собственные `MANUAL.md`, `navigation`, `GUEST_CONTRACT_GAPS.md`, макет `assets/guest-mobile-flow.png`. Набор сгенерирован по старой грамматике и не является спеками этого кита; действующий канон — `docs/ui-spec-kit/MANUAL.md` (12 `kind`, 18 атрибутов, `operationId` как единственный словарь) плюс исполняемый allowlist `ACTION_KINDS`/`ACTION_ATTRS` в `tools/uispec/validate_uispec.py`.

**Кадры макета — по факту открытого изображения** (доска 3×3, 1448×1086, слева-вправо, сверху-вниз):

| Кадр | Что нарисовано |
|---:|---|
| 1 | «Каталог встреч»: вордмарк «Calendar», H1 «Запланировать встречу с Дмитрием», подпись «Выберите тип встречи», две карточки — цветная плитка с иконкой (синяя и фиолетовая), название, описание, длительность, шеврон |
| 2 | «Выбор Event Type»: back + заголовок «Консультация»; плитка-иконка + «30 минут»; описание; глобус «Europe/Prague · GMT+2»; разделитель; «Выберите дату»; горизонтальная полоска чипов «Пт 31» (выбран, синяя заливка), «Сб 1», «Пн 3», «Вт 4» — **пропуск 2-го числа: недоступные дни не нарисованы вовсе**; подпись «Пятница, 31 июля». Сетки слотов и CTA в кадре нет |
| 3 | «Календарь и слоты»: та же шапка и сводка; полоски дат в кадре нет; «Пятница, 31 июля»; сетка 2×3 «09:00 / 09:30 / 10:00 (выбран, синяя заливка) / 10:30 / 14:00 / 14:30»; сноска с info-иконкой «Слоты доступны на ближайшие 14 дней». CTA в кадре нет |
| 4 | «Данные гостя»: back + «Ваши данные»; карточка сводки (плитка-иконка, «Консультация», «31 июля · 10:00–10:30», ссылка «Изменить», ниже глобус «Europe/Prague · GMT+2»); поля «Имя», «Email», «Комментарий» (многострочное) с плейсхолдерами; CTA «Подтвердить встречу» — синяя, **активная при пустых полях** |
| 5 | «Ошибки формы»: те же поля, у «Имя» и «Email» красная рамка, под ними «Введите имя» / «Введите корректный email» (email заполнен как `anna@`); CTA по-прежнему активная |
| 6 | «Создание бронирования»: поля заполнены (`Anna Novak`, `anna@example.com`, «Буду рад обсудить детали.»); CTA «Создаём встречу...» со спиннером |
| 7 | «Подтверждение»: без шапки и back; зелёный check-circle; H «Встреча запланирована»; карточка строк с иконками: «Консультация», «31 июля 2026», «10:00–10:30», «Europe/Prague · GMT+2», «Anna Novak», «anna@example.com»; текст «Можно закрыть эту страницу.»; аутлайн-кнопка «К другим встречам» |
| 8 | «Слот уже занят»: back + «Консультация»; алерт с треугольником на светло-красной подложке «Этот слот только что заняли / Выберите другое доступное время.»; глобус; «Пятница, 31 июля»; сетка из трёх слотов (10:00 исчез); та же сноска про 14 дней. Строки длительности/описания в кадре нет |
| 9 | «Ошибка сети»: без шапки; иллюстрация облака с Wi-Fi и красным крестом; H «Не удалось создать встречу»; «Проверьте подключение. / Ваши данные сохранены.»; кнопки «Повторить» (заполненная) и «Выбрать другое время» (аутлайн) |

Кадры 2, 3, 8 — один пользовательский экран (одинаковая шапка «Консультация», одна и та же сводка) в разных стадиях; кадры 4, 5, 6, 9 — один экран формы; кадры 1 и 7 — по экрану.

**Контракт на момент решения — `0.2.0`** (сверено по `packages/contracts/generated/openapi.yaml`, `task-contract-001` завершена):

| Нужно кадру | Источник в контракте |
|---|---|
| имя владельца (кадр 1) | `getPublicCalendar` (`GET /calendar`) → `PublicCalendarResponse.displayName`; 400 `CALENDAR_NOT_CONFIGURED` |
| типы встреч (кадр 1) | `getPublicEventTypes` → `EventType[]` (`id`, `name`, `description?`, `durationMinutes`) |
| слоты (кадры 2, 3, 8) | `getPublicSlots(eventTypeId)` → `Slot[]` (`startAtUtc`, `endAtUtc`, `eventTypeId`); 404 `EVENT_TYPE_NOT_FOUND`, 400 `CALENDAR_NOT_CONFIGURED`/`VALIDATION_ERROR` |
| создание брони (кадр 6) | `createPublicBooking` → `CreateBookingRequest {eventTypeId, startAtUtc, id?, guest: GuestDetails{name, email, note?}}`; **201 создано / 200 идемпотентный повтор**; 409 `SLOT_UNAVAILABLE`/`DUPLICATE_BOOKING_ID`; 400 `VALIDATION_ERROR`/`GUEST_NAME_REQUIRED`/`GUEST_EMAIL_REQUIRED`/`SLOT_OUTSIDE_WINDOW`/`SLOT_NOT_ALIGNED`/`CALENDAR_NOT_CONFIGURED`; 404 `EVENT_TYPE_NOT_FOUND` |
| подтверждение (кадр 7) | `Booking` с обязательным `eventTypeName` (snapshot), `startAtUtc`, `endAtUtc`, `guestName`, `guestEmail` |
| безопасный повтор (кадр 9) | `CreateBookingRequest.id` — необязательный ключ идемпотентности (UUID); контракт прямо требует сгенерировать ключ **до первой попытки**, иначе повтор нераспознаваем |

Обязательных полей, которых кадрам не хватает, ровно одно — по-полевая привязка серверной ошибки валидации (`ErrorResponse {code, message}`), см. Р14.

**Проверенные факты о валидаторе** (прогон копии кита в scratch, реальные токены/реестр/openapi, baseline `Validated 31 files; errors=0`):

- `onErrorWhen=` сегодня даёт `WARN V7: неизвестный атрибут`; `$error.code`/`$error.transport` — `WARN unknown token/reference` (`$error` нет в `REF_PREFIXES`);
- `local.update` с `onSuccessState=` проходит без замечаний и проверяется V6 (значение обязано быть state этого экрана);
- `<Route>` с вложенными `<Param name= type= required=>` в `navigation.uispec.xml` не ломает `collect_navigation` (он читает только id);
- `when="$state.…"` на layout-элементах замечаний не даёт;
- `<Repeat item="eventType">` → `$eventType.*` даёт `WARN unknown token/reference`: допустимы только корни из `REF_PREFIXES` (`$item`, `$group`, `$booking`, `$interval`). Это объясняет часть предупреждений присланного набора и связывает руки в разметке;
- `Model source="api" schema="PublicCalendarResponse"` с полем `displayName` V11 проходит;
- `<Prop type=…>` в компонентах не типизируется ничем — слепая зона, о которой обязано помнить любое решение про типы.

## Решение

### Р1. Набор имён — канонический, присланный не переносится

Остаются существующие id, route и имена файлов: `guest.event-types`/`GuestEventTypes`/`12-public-event-types.screen.md`, `guest.slots`/`GuestSlots`/`13-public-slots.screen.md`, `guest.booking-form`/`GuestBookingForm`/`14-guest-booking-form.screen.md`, `guest.booking-confirmation`/`GuestBookingConfirmation`/`15-booking-confirmation.screen.md`. Присланные `guest.catalog`/`GuestCatalog`, `guest.event-booking`, `guest.details`, `guest.confirmation` не заводятся.

Цена измерена grep'ом по репозиторию. При переходе на присланные имена пришлось бы править:

| Файл | Что ломается |
|---|---|
| `api-bindings.xml:34–36` | три `screen=` (и переименование трёх `action=`) |
| `navigation.uispec.xml:25–28` | четыре `Route id=` + `screen=` |
| `contract-gaps.xml:23` | `screens="…,guest.booking-confirmation"` в **resolved**-записи GAP-002, закрытой завершённой `task-contract-001` |
| `tasks/task-front-guest-001…005/brief.md` | 15 строк ссылок (`:17` зависимости, `:9` контекст, FR3/FR5/FR6/FR7) |
| `tasks/task-front-ui-001/{brief,adr,plan,result}.md` | ≈15 строк в **завершённой** задаче (`status: согласовано`), которую править нельзя → ссылки станут висячими навсегда |
| `tasks/task-contract-001/{brief,adr,plan,result}.md` | 5 строк в завершённой задаче — то же |

При каноническом наборе `api-bindings.xml` не требует ни одной правки существующих строк (только два новых `<Binding>`, Р11), `navigation` меняется только вложенными `<Param>`, GAP-002 остаётся точным, а brief `front-guest-*` требуют правки **содержания** (состав состояний и компонентов), но не идентичности — их строки «спека `13-public-slots.screen.md`, route `GuestSlots`» остаются верными.

### Р2. Четыре экрана, по одному на route; переписывается внутренняя структура экрана слотов

Количество экранов не меняется: и канон, и присланный набор дают четыре. Слияние из присланного набора относится не к числу route, а к устройству экрана слотов: вместо одного длинного сгруппированного списка (`SlotGroup[]`, `SlotItem` в `Row wrap`) — полоска доступных дат плюс сетка слотов выбранной даты, как на кадрах 2/3/8. Состав состояний по AC7:

| Экран | Состояния (initial первым) | Кадры |
|---|---|---|
| `guest.event-types` | `loading`, `content`, `empty`, `error` | 1 → `content` |
| `guest.slots` | `loading`, `dateSelection`, `slotSelection` (`extends="dateSelection"`), `slotUnavailable` (`extends="dateSelection"`), `empty`, `unavailable`, `error` | 2 → `dateSelection`, 3 → `slotSelection`, 8 → `slotUnavailable` |
| `guest.booking-form` | `editing`, `validationError` (`extends="editing"`), `submitting` (`extends="editing"`), `serverValidationError` (`extends="editing"`), `networkError` (`extends="editing"`) | 4 → `editing`, 5 → `validationError`, 6 → `submitting`, 9 → `networkError` |
| `guest.booking-confirmation` | `content`, `error` | 7 → `content` |

Имена состояний берутся канонические там, где они уже есть в ките: «нет свободного времени» — `empty` (как на экранах 12/13 и owner-экранах), а не `noSlots`.

Полоска дат присутствует во всех трёх стадиях экрана слотов (кадры 3 и 8 её не рисуют из-за размера кадра доски — макет не является источником состава элементов, MANUAL §3 приоритет 4). Недоступные даты в полоску **не попадают** (кадр 2: пропущено 2-е число), поэтому `disabled`-чипа не существует — это снимает целый класс недостижимой разметки и функцию `dateChipTextColor`.

### Р3. Календарная дата — `string` формата `YYYY-MM-DD`; `PRIMITIVES` не расширяются

Тип `localDate` не вводится. Выбранная дата и даты полоски — `type="string"` с зафиксированным в UX rules и в реестре helpers форматом ISO-календарной даты (`YYYY-MM-DD`) в timezone гостя.

Основания: (1) значение никогда не покидает клиент — это ключ группировки, выведенный из `Slot.startAtUtc`, в контракте такого поля нет; (2) `utcDateTime` начала дня был бы ложью — календарная дата не момент, и такой тип приглашает клиентскую арифметику по часовым поясам, запрещённую правилом 4 `AGENTS.md`; (3) расширение `PRIMITIVES` без поддержки в `generate_scaffold.py` (branded-тип `LocalDate`, как `UtcDateTime`) не даёт ни одной проверки — а с поддержкой это отдельная работа по трём файлам плюс фикстура, при нулевом выигрыше для генерации; (4) `<Prop type=>` компонентов валидатор не типизирует вовсе, поэтому `localDate` в `date-chip.component.md` был бы декоративной подписью. Non-goal brief про доработку валидатора сверх необходимого закрывает вопрос.

### Р4. Ветвление по коду ошибки — новый атрибут `onErrorWhen`; канон правится в составе задачи

Вводится 19-й атрибут `<Action>` — `onErrorWhen`, симметричный `onSuccessWhen`:

```text
onErrorWhen="условие1:цель1;условие2:цель2"
```

- условие — boolean-expression над `$error` (и, при необходимости, `$state`/`$validation`);
- `$error` — результат маппера ошибок клиента: `{code: string | null, message: string | null, transport: boolean}`, где `transport = true` означает «ответа от сервера не было»;
- цель — id state этого экрана **или** id route (та же неразличимость, что у `onSuccessWhen`, находка C3 `AUDIT.md`);
- ветки проверяются по порядку; если ни одна не совпала, действует `onErrorState` — он остаётся значением по умолчанию и, в отличие от `onSuccessState`, не вытесняется наличием ветвления. Асимметрия сознательная: у ошибки всегда обязан быть дефолт, у успеха — нет.

Правки канона, входящие в задачу:

| Файл | Правка |
|---|---|
| `MANUAL.md` §6.4 | строка `onErrorWhen` в таблице атрибутов (18 → 19) + подраздел с синтаксисом, формой `$error` и правилом дефолта; в описании `onSuccessWhen` — уточнение, что условие может читать `$state`/`$validation`, а не только `$result`; в строке `before` формулировка «используется с `local.submit`» смягчается до «чаще всего с `local.submit`» (Р9 применяет `before` к `api.command`) |
| `tools/uispec/validate_uispec.py` | `ACTION_ATTRS += 'onErrorWhen'`; `REF_PREFIXES += '$error'`; сбор route-целей из ветвей `onErrorWhen` наравне с `onSuccessWhen` (иначе V5 сочтёт route сиротой) |
| `tools/uispec/tests/run_tests.py` | положительный кейс: спека с `onErrorWhen` и `$error.*` проходит с `errors=0` и без предупреждений (негативный кейс на опечатку в имени атрибута уже покрыт кейсом `V7-unknown-kind`/неизвестного атрибута) |
| `.opencode/skills/uispec-generator/references/uispec-language.md:11` | в строке навигации по §6.4 к `onSuccessWhen` добавляется `onErrorWhen` (файл сознательно не дублирует грамматику, строка 17) |

Почему без этого нельзя: AC7 требует, чтобы `slotUnavailable`, `networkError`, `serverValidationError`, `unavailable` существовали как отдельные состояния и имели путь входа «действие + атрибут результата». У действия в каноне один `onErrorState`, а `createPublicBooking` обязан различать четыре исхода (транспорт, устаревший слот, отказ сервера, всё остальное), `getPublicSlots` — три. Единственное состояние ошибки с полем `code` и разметкой по `when=` (вариант без правки канона) стирает требуемые AC7 состояния и заменяет проверяемые атрибуты прозой. Присланного `onErrorCode=` не вводим: его синтаксис (`КОД:цель`) умеет только сравнение кода и не выражает транспортную ошибку.

Ветки по экранам:

| Действие | `onErrorWhen` | `onErrorState` |
|---|---|---|
| `loadPublicCalendar`, `loadPublicEventTypes` | `$error.code == 'CALENDAR_NOT_CONFIGURED':empty` | `error` |
| `loadPublicSlots` | `$error.code == 'EVENT_TYPE_NOT_FOUND':unavailable;$error.code == 'CALENDAR_NOT_CONFIGURED':unavailable` | `error` |
| `refreshPublicSlots` | — | нет (неудачный фоновый refresh оставляет текущий контент, `preserveContent="true"`) |
| `createBooking` | `$error.transport == true:networkError;$error.code == 'SLOT_UNAVAILABLE':GuestSlots;$error.code == 'SLOT_OUTSIDE_WINDOW':GuestSlots;$error.code == 'SLOT_NOT_ALIGNED':GuestSlots` | `serverValidationError` |

`CALENDAR_NOT_CONFIGURED` на каталоге ведёт в `empty`, а не в отдельное состояние: контракт делает этот код публичным выражением незавершённого онбординга, и гостю незачем знать разницу между «владелец не настроил календарь» и «типов встреч нет».

### Р5. Оформление — варианты компонента и токены, не helpers

Пять функций присланного набора, возвращающих оформление (`dateChipTextColor`, `alertBackground`, `alertBorder`, `alertIcon`, `alertIconColor`), не переносятся:

| Присланное | Замена |
|---|---|
| `alertBackground/alertBorder/alertIcon/alertIconColor(variant)` | `<InlineAlert variant="warning|error">`; соответствие «вариант → токен/иконка» описано в `Rules` компонента и живёт в его RN-реализации — так же, как у `Button variant="primary"` (MANUAL §6.1) |
| `dateChipTextColor(selected, disabled)` | `<DateChip selected="…">`; `disabled` исчезает вместе с недоступными чипами (Р2) |

Правило: helper возвращает **данные** (подпись, набор, индекс, признак), оформление возвращает компонент. Единственный «на грани» случай — цвет акцента (Р7), и он решён индексом-данными, а не токеном-строкой.

### Р6. `slot-item` переиспользуется как кнопка слота; `SlotButton` не заводится

`docs/ui-spec-kit/specs/ui/components/slot-item.component.md` переписывается: корень — собственный тег `<SlotItem>` (как у остальных карточек кита), props `startAtUtc`, `endAtUtc`, `selected`, `onPress`, подпись считается внутри через существующий `timeLabel($props.startAtUtc)`, `accessibilityLabel` — «Выбрать время …», высота `$size.slot.height`. Запись реестра `<Component tag="SlotItem" …>` не меняется. Присланный `slot-button.component.md` не переносится.

Выигрыш: минус один тег в реестре, ссылка `tasks/task-front-guest-003/brief.md:17,24,52` на `SlotItem` остаётся валидной, зарегистрированного тега без пользователя не возникает (AC2). Потеря: имя `SlotItem` менее выразительно, чем `SlotButton` — цена косметическая.

Итоговый состав компонентов гостевой ветки — 8 файлов, 7 новых тегов в реестре:

| Компонент | Статус | Где используется |
|---|---|---|
| `PublicEventTypeCard` | новый тег | `guest.event-types` (кадр 1) |
| `DateStrip` | новый тег | `guest.slots` (кадры 2/3/8) |
| `DateChip` | новый тег | внутри `DateStrip` |
| `SlotGrid` | новый тег | `guest.slots` |
| `SlotItem` | тег существует | внутри `SlotGrid` |
| `InlineAlert` | новый тег | `guest.slots` (кадр 8), `guest.booking-form` (`serverValidationError`) |
| `BookingSummaryCard` | новый тег | `guest.booking-form` (кадры 4–6) |
| `ConfirmationDetails` | новый тег | `guest.booking-confirmation` (кадр 7) |

`PublicEventTypeCard` заводится отдельно от owner-компонента `EventTypeCard`: тот показывает `/publicId`, требует его обязательным prop и принадлежит owner-экрану 06, а правка owner-компонентов — прямой non-goal brief. Переиспользуются без изменений `EmptyState` (пустые состояния), `Skeleton` (loading), `TimezoneLabel`, `TextField`, `ValidationMessage`, `Button`, `Icon`, `Image`, `Repeat`, `StateView`.

### Р7. Палитра акцентов: 6 токенов и детерминированный индекс

Иконка у всех типов встреч одна — существующая `event-type`; различается только цвет плитки под ней (кадр 1: синяя и фиолетовая).

- в `colors.tokens.xml` аддитивно добавляются `color.accent.1 … color.accent.6` (light/dark, как у всех цветовых токенов);
- helper `eventTypeAccentIndex(id: string) => int32` — «стабильный 32-битный FNV-1a от `EventType.id`, взятый по модулю 6»; одинаковый `id` всегда даёт один индекс, результат не зависит ни от порядка элементов в списке, ни от появления новых типов (свойство хеша, а не перечисления);
- компонент получает `accentIndex` (данные) и сам сопоставляет индекс с токеном — правило Р5;
- глиф внутри плитки — `$color.text.onPrimary`.

Палитра проверена на контраст с белым глифом (WCAG 1.4.11 для графических объектов, порог 3:1) — все шесть проходят в обеих темах:

| Токен | light | контраст | dark | контраст |
|---|---|---:|---|---:|
| `color.accent.1` синий | `#246BFD` | 4.57 | `#4D86FF` | 3.40 |
| `color.accent.2` фиолетовый | `#6C3CE0` | 6.25 | `#8F6BF0` | 3.80 |
| `color.accent.3` бирюзовый | `#0E7C86` | 4.95 | `#28A0AC` | 3.13 |
| `color.accent.4` янтарный | `#B25E00` | 4.67 | `#D07E1F` | 3.14 |
| `color.accent.5` розовый | `#C2306B` | 5.34 | `#DB5B8B` | 3.57 |
| `color.accent.6` зелёный | `#1F7A45` | 5.35 | `#2E9B5C` | 3.52 |

Размер палитры 6 — компромисс: достаточно, чтобы два-три типа встреч у одного владельца почти всегда получили разные цвета, и мало, чтобы каждый оттенок был проверен на контраст вручную в обеих темах. Цвет носит декоративный характер и не кодирует смысла, поэтому требование «не кодировать только цветом» к нему не применяется; `color.accent.1` совпадает с `color.action.primary` намеренно — кадр 1 показывает первую карточку в основном синем.

### Р8. Источники данных: timezone, имя владельца, название типа встречи

| Элемент | Источник | Обоснование |
|---|---|---|
| «Europe/Prague · GMT+2» (кадры 2, 3, 4, 7, 8) | timezone устройства гостя — `$system.timeZone`, offset — существующий `formatUtcOffset` | Контракт публично timezone владельца не отдаёт и отдавать не должен: `PublicCalendarResponse` несёт только `displayName`, настройки календаря гостю не раскрываются. Корень `$system` уже используется в ките (`$system.ianaTimezones`, экраны 02 и 09) и входит в `REF_PREFIXES` — новых сущностей не появляется. Гапом не является: показывается своя timezone гостя, а не чужая |
| «Запланировать встречу с Дмитрием» (кадр 1) | `getPublicCalendar` → `PublicCalendarResponse.displayName` | Второе чтение на экране каталога; композиция двух операций — прецедент owner-экрана 05 |
| «Консультация» на кадре 7 | `Booking.eventTypeName` из ответа `createPublicBooking` | GAP-002 закрыт `task-contract-001`; property состояния `eventTypeName`, приходившая из навигации, снимается — ровно то, что запись GAP-002 поручает этой задаче (`contract-gaps.xml:25`) |
| «30 минут», описание, заголовок экрана слотов | route params от каталога (`eventTypeName`, `durationMinutes`, `eventTypeDescription`), подпись — существующий `durationLabel` | Операции «получить один тип встречи» в контракте нет; повторный `getPublicEventTypes` ради подписи — лишний запрос |
| «Слоты доступны на ближайшие 14 дней» (кадры 3, 8) | статический текст | 14 дней — документированная семантика `getPublicSlots` («Server computes a 14-day booking window»), а не поле ответа. Гап-записи не заводим: отсутствует не данное, а константа; при изменении окна правится текст. Спорно — см. «Вопросы к brief» |

### Р9. Черновик гостя, ключ идемпотентности и возврат по конфликту

Три сцепленных решения, вытекающих из текста контракта про идемпотентность и из кадров 8/9.

1. **Ключ идемпотентности.** `CreateBookingRequest.id` заполняется всегда: `<Property name="bookingKey" type="string" />` в состоянии `editing`, действие `initBookingKey` (`local.update`, `value="{newBookingKey()}"`) диспатчится контейнером при монтировании экрана формы — той же конвенцией, по которой контейнер диспатчит начальный `api.query`. Повтор после ошибки сети (кадр 9) отправляет **тот же** ключ и ту же нагрузку — это и делает повтор безопасным (200 вместо второй брони). Ключ **не** живёт дольше монтирования: смена слота меняет `startAtUtc`, а тот же ключ с другой нагрузкой по контракту даёт `DUPLICATE_BOOKING_ID`. Редактирование полей после 400 безопасно: 400 брони не создаёт, ключ ничему не принадлежит; редактировать после ошибки сети UI не даёт — в `networkError` формы на экране нет (кадр 9).
2. **Черновик гостя.** Введённые имя, email и комментарий хранит guest-flow state контейнера, а не route params: `navigation.back` параметров не несёт в принципе, а протаскивать имя и email через параметры навигации нельзя — на web они попадают в URL и в историю браузера (PII). Форма при монтировании берёт значения из черновика, если он есть. Это единственная сущность решения, которой нет в словаре UISpec; она объявляется в UX rules обоих экранов и попадает в перечень требований к `front-guest-001` (Р16 «Совместимость»).
3. **Возврат по конфликту.** Ветка `createBooking.onErrorWhen` для `SLOT_UNAVAILABLE`/`SLOT_OUTSIDE_WINDOW`/`SLOT_NOT_ALIGNED` — route-цель `GuestSlots`, разрешаемая как возврат на существующий экран стека (pop), а не второй push; неразличимость state/route в ветвях уже документирована каноном, способ навигации агент резолвит по месту. Сам конфликт распознаёт **экран слотов**: на возврате контейнер диспатчит `refreshPublicSlots` (`preserveContent="true"`), и ветка `selectedSlotMissing($result, $state.selectedSlot) == true:slotUnavailable` включает кадр 8 — «Этот слот только что заняли», слоты перезагружены, прежний выбор сброшен. Побочная выгода: тот же путь срабатывает, если слот заняли, пока гость просто смотрел на список, — без всякого участия формы.

`refreshPublicSlots` покрывает исходы полностью и детерминированно: `$result.length == 0:empty; selectedSlotMissing(…) == true:slotUnavailable; $state.selectedSlot == null:dateSelection; true:slotSelection`.

### Р10. Route-параметры типизированы в навигации

`GuestStack` в `navigation.uispec.xml` получает вложенные `<Param name= type= required=>` (FR12). Owner-часть файла не меняется; третий bottom-tab не появляется.

| Route | Параметры |
|---|---|
| `GuestEventTypes` | — |
| `GuestSlots` | `eventTypeId: string`, `eventTypeName: string`, `durationMinutes: int32`, `eventTypeDescription: string` (необязательный) |
| `GuestBookingForm` | `eventTypeId: string`, `eventTypeName: string`, `startAtUtc: utcDateTime`, `endAtUtc: utcDateTime` |
| `GuestBookingConfirmation` | `booking: Booking` |

Имя, email и комментарий гостя в параметрах отсутствуют осознанно (Р9.2). Валидатор навигационные `<Param>` не проверяет (проверено), поэтому они остаются документацией для реализующего агента — но документацией в машиночитаемой форме и в единственном месте.

### Р11. Действия, биндинги и модели

Пять `api.*`-действий, пять `<Binding>`; **три существующие записи `api-bindings.xml` не правятся вовсе**, добавляются две:

| Действие | `operationId` | Экран | Статус записи |
|---|---|---|---|
| `loadPublicCalendar` | `getPublicCalendar` | `guest.event-types` | новая |
| `loadPublicEventTypes` | `getPublicEventTypes` | `guest.event-types` | без изменений |
| `loadPublicSlots` | `getPublicSlots` | `guest.slots` | без изменений |
| `refreshPublicSlots` | `getPublicSlots` | `guest.slots` | новая (прецедент — пара `load`/`refresh` owner-экрана 05) |
| `createBooking` | `createPublicBooking` | `guest.booking-form` | без изменений |

Инлайновых `operation=` нет; мёртвых записей не остаётся.

Локальные действия: `selectEventType` (`navigation.push` → `GuestSlots`), `selectDate` (`local.update` + `onSuccessState="dateSelection"` + `after="clearSelectedSlot"`), `selectSlot` (`local.update` пишет `$state.selectedSlot`, `onSuccessState="slotSelection"`), `continueToForm` (`navigation.push` → `GuestBookingForm`, `startAtUtc`/`endAtUtc` из `$state.selectedSlot`), `openCatalog` (`navigation.reset` → `GuestEventTypes` — безопасно при web-deep-link прямо на слоты), `goBack` (`navigation.back`), `changeName`/`changeEmail`/`changeNote` (`local.update` по `path`/`value`), `initBookingKey`, `retryBooking` (`local.dispatch` → `createBooking`), `chooseAnotherTime` (`navigation.back`; одно действие на «Изменить» кадра 4, «Выбрать другое время» кадра 9 и back в шапке), `backToCatalog` (`navigation.reset` → `GuestEventTypes`, FR10).

Клиентская валидация формы — на submit, как на кадрах 4/5 (CTA активна при пустых полях, ошибки появляются после нажатия): `createBooking` получает `before="validateGuestForm"` и `onConflict="validationError"`, `disabledWhen="$state == submitting"`. `$validation.invalid` в `disabledWhen` не используется — иначе нажать и увидеть подсказки было бы невозможно, а запрос с пустым именем всё равно не уйдёт (`before`).

Модели (V11: `source="api"` — точное подмножество properties схемы, всё остальное — view-model):

| Экран | Модели |
|---|---|
| `guest.event-types` | `Calendar` (`source="api" schema="PublicCalendarResponse"`: `displayName`), `EventType` (`schema="EventType"`: `id`, `name`, `description?`, `durationMinutes`) |
| `guest.slots` | `Slot` (`schema="Slot"`: `startAtUtc`, `endAtUtc`, `eventTypeId`), `AvailableDate` (view-model: `date` `YYYY-MM-DD`, `weekdayLabel`, `dayLabel` — все `derived="true"`) |
| `guest.booking-form` | `GuestDetails` (`schema="GuestDetails"`: `name`, `email`, `note?`), `FieldError` (view-model `{field, message}` — та же форма, что на owner-экранах 02/10, решение 13 R1) |
| `guest.booking-confirmation` | `Booking` (`schema="Booking"`: `eventTypeName`, `startAtUtc`, `endAtUtc`, `guestName`, `guestEmail`) |

Обёрток `GuestCatalogData`/`GuestSlotWindow`, полей `publicId`, `title`, `bookingId`, `windowStart`, `windowEnd`, `startAt`/`endAt`, вложенного `guest` в моделях нет; поле комментария — `note`. `AvailableDate` дублируется в файл-потребитель `date-strip.component.md` — конвенция самодостаточности спеков для генератора (заметка исполнения R1).

Helpers: шесть переиспользуются, шесть заводятся, четырнадцать необъявленных из присланного набора исчезают.

| Helper | Судьба |
|---|---|
| `durationLabel`, `timeLabel`, `dateLabel`, `formatUtcOffset`, `fieldError` | переиспользуются как есть (вместо `formatDuration`, `formatGuestTimeRange`, `formatGuestDate`) |
| `formattedSlot` | переиспользуется с расширенной сигнатурой `(startAtUtc, endAtUtc) => string` («31 июля · 10:00–10:30») — вместо `formatGuestDateTimeRange`; helper гостевой, owner-экранов не касается |
| `availableDates(slots: Slot[], timeZone) => AvailableDate[]` | новый — календарные даты, у которых есть хотя бы один слот, по возрастанию, с подписями дня недели и числа (вместо `deriveAvailableDates`) |
| `slotsOnDate(slots: Slot[], date: string, timeZone) => Slot[]` | новый — слоты выбранной календарной даты, хронологически (вместо `filterSlotsByDate`) |
| `selectedSlotMissing(slots: Slot[], selected: Slot \| null) => boolean` | новый — распознавание конфликта (Р9.3); при `selected == null` возвращает `false` |
| `fullDateLabel(date: string) => string` | новый — «Пятница, 31 июля» для календарной даты; служит и `accessibilityLabel` чипа (отдельный `formatAccessibleDate` не нужен) |
| `newBookingKey() => string` | новый — UUID-ключ идемпотентности (Р9.1) |
| `eventTypeAccentIndex(id: string) => int32` | новый — Р7 |
| `coalesce`, `if`, `isBasicEmail` | не вводятся: `if(...)` как выражение в каноне отсутствует (подпись CTA различается по состоянию), `coalesce` не нужен при обязательных route params, вместо `isBasicEmail` — builtin `isEmail` |

### Р12. Токены: пять размеров и девять цветов, аддитивно

| Токен | Значение | Вместо чего |
|---|---|---|
| `size.dateChip.width` | 64 | новый (чип полоски дат) |
| `size.dateChip.height` | 72 | новый; высота самой полоски отдельным токеном не описывается — её задают чипы, `size.dateStrip.height` не заводится |
| `size.card.summary.height` | 88 | `size.card.summary` присланного набора, имя выровнено по конвенции `…​.height` |
| `size.textarea.minHeight` | 96 | новый (многострочный комментарий, 2× `size.input.height`) |
| `size.icon.hero` | 72 | литерал `size="72"` у check-circle кадра 7 |
| `color.accent.1…6` | Р7 | иконка/цвет типа встречи |
| `color.status.warning` | light `#B25E00`, dark `#FFB861` | иконка и рамка алерта кадра 8 (контраст к подложке 4.30 / 8.08) |
| `color.status.warningSurface` | light `#FFF4E5`, dark `#3A2A12` | подложка алерта (к `text.primary` 16.47 / 13.00, к `text.secondary` 4.56 / 6.71) |
| `color.status.errorSurface` | light `#FEF4F4`, dark `#3A1D1D` | подложка `error`-варианта алерта (к `text.secondary` 4.60 / 7.42; `#FDECEC` присланного набора давал 4.34 и порог 4.5 не проходил) |

Переиспользуются вместо новых: `size.card.eventType.height` (вместо `size.card.eventType`), `size.slot.height` (кнопка слота), `size.input.height`, `size.button.height`, `size.icon.small/medium/large`, `size.touch.android`, все `$space.*`, `$radius.*`, `$type.*`. `minHeight="64"` у `InlineAlert` не переносится — алерт растёт по контенту, токен не нужен. Значения размеров выбраны по существующей шкале кита (64/72/88/96 в ней уже есть) и **не измерены с PNG** (MANUAL §13). Литеральных размеров с тремя и более вхождениями не остаётся — проверяется прогоном `--lint`, который обязан молчать, как после R1.

### Р13. Состояния без кадров, карта кадров и frontmatter

`FRAME_MAP.md`: раздел «Guest-экраны 12–15» переписывается — доска 3×3, 9 кадров, таблица «кадр → экран → состояние» (Р2) и **явный список состояний без кадра**: `loading`/`empty`/`error` каталога, `loading`/`empty`/`unavailable`/`error` слотов, `serverValidationError` формы, `error` подтверждения. Owner-разделы файла не трогаются.

Frontmatter гостевых экранов: `platforms: [android, web]` (FR14; `web-mobile`/`web-desktop` не вводятся, правила адаптива — «каталог max-width 760 dp и центрирование, две колонки от 768 dp», «сетка слотов ≥2 колонок при min width элемента» — живут в UX rules), `reference: ../assets/guest-mobile-flow.png`, `referenceFrame: 1` и `referenceFrame: 7` у каталога и подтверждения, `referenceFrames: [2, 3, 8]` и `referenceFrames: [4, 5, 6, 9]` у слотов и формы, `status: draft`.

Каждый экран получает в UX rules таблицу путей входа в состояния (действие + атрибут результата) — она и есть машиночитаемое доказательство AC7 там, где ветви `onSuccessWhen`/`onErrorWhen` валидатором не проверяются (см. «Последствия»).

`Viewport` — 360×800, как у остальных 15 экранов кита, а не 390×844 присланного набора: макет нарисован в iOS-ширине, но целевые платформы задачи — android и web, а PNG не источник размеров.

### Р14. Contract gaps: одна новая запись

Проход по всем девяти кадрам (Р«Контекст» + Р8) даёт единственный элемент без источника в контракте `0.2.0`:

| Gap | Содержание |
|---|---|
| `GAP-004` (`open`, severity low, blocking false, screens `guest.booking-form`) | **Missing:** по-полевая привязка серверной ошибки валидации — `ErrorResponse {code, message}` не сообщает, какое поле отвергнуто; `GUEST_NAME_REQUIRED`/`GUEST_EMAIL_REQUIRED` через HTTP недостижимы, потому что generated Zod-схема отклоняет пустые значения раньше как `VALIDATION_ERROR`, а кода для `note` нет вовсе. **Workaround:** состояние `serverValidationError` показывает общий текст сервера в `InlineAlert variant="error"` над формой, без подсветки поля; введённые данные сохраняются. **Proposal:** массив `details: [{field, code}]` в `ValidationError`. **Task:** не назначена — non-goal `task-contract-001` |

Маркер: `gap="GAP-004"` на действии `createBooking` и `TODO-CONTRACT-GAP(GAP-004)` в UX rules формы. GAP-001/GAP-002 (`resolved`) и GAP-003 (`open`, owner) не трогаются; сводка open-gaps валидатора пополняется одной строкой. Иконка и цвет типа встречи гапом не являются (путь (б), Р7); имя владельца, `eventTypeName` и идемпотентность закрыты контрактом.

### Р15. Порядок работ: кит валиден на каждом шаге

`npm test` гоняет валидатор по всему набору, поэтому порядок обязателен — кросс-файловые проверки V1/V4/V5/V6 не переживают половинчатого состояния.

| # | Шаг | Почему здесь |
|---:|---|---|
| 1 | Снимок контрольных сумм owner-артефактов: экраны 01–11, owner-компоненты, `owner-mobile-flow.png`, а также строки owner в общих файлах | AC9 требует сверку «до и после»; кит вне git, другого способа доказать неизменность нет |
| 2 | Канон: `MANUAL.md` §6.4 → валидатор → фикстура `run_tests.py` → строка skill-reference (Р4) | Грамматика обязана существовать до первой спеки, которая её использует; правка аддитивна, набор остаётся `errors=0` |
| 3 | Токены (Р12), реестр — 7 компонентов и 6 helpers плюс сигнатура `formattedSlot` (Р6, Р11), `ASSETS.md` + перенос `guest-mobile-flow.png` в `specs/ui/assets/` | Аддитивно; неиспользованная запись реестра ошибкой не является (проверено) |
| 4 | **Атомарно:** 4 экрана + 8 компонентов + `GuestStack` с параметрами + два новых `<Binding>` + `GAP-004` | Ссылки перекрёстные: экраны без биндингов ломают V1, биндинги без экранов — «Binding-сирота», route без `Meta.id` — V5 |
| 5 | Удаление `specs/guest/` целиком: 4 экрана, 8 компонентов, форк `MANUAL.md`, `GUEST_CONTRACT_GAPS.md`, `guest-navigation.uispec.xml`, `GUEST_FRAME_MAP.md`, `.DS_Store` | Содержание уже перенесено; каталог вне `sourceRoot`, поэтому на валидацию не влиял и до, и после |
| 6 | Guest-раздел `FRAME_MAP.md` (Р13) | Ссылается на конечные имена состояний |
| 7 | Проверки: `uispec:validate` (+`--lint`, +`--strict` — ожидаемый exit 1), `run_tests.py`, `contracts:format:check`, `generate:check`, `typecheck`, `npm test`; повторный снимок контрольных сумм owner-артефактов; smoke-прогон `generate_scaffold.py` по четырём экранам в scratch (в клиент не генерируем — non-goal) | AC1, AC4, AC5, AC9, AC12, AC13 |

Все правки общих файлов — только добавление строк; owner-строки реестра, токенов, навигации, биндингов, `FRAME_MAP.md` и `ASSETS.md` не редактируются.

### Р16. Статусы и границы валидации

Все новые и переписанные гостевые файлы — `status: draft`; присланный `approved` не наследуется (правило 11 `AGENTS.md`). `--strict` продолжает давать exit 1 (в `npm test` вызывается без него) — после задачи draft-файлов станет 12 вместо 5. Валидация — только реальным `docs/ui-spec-kit/uispec.config.json`; разведочный конфиг остаётся в scratch и в репозиторий не попадает.

Ограничение разметки, найденное прогоном и обязательное к соблюдению: в `<Repeat item="…">` допустимы только корни из `REF_PREFIXES` — `item`, `group`, `booking`, `interval`. Присланные `item="eventType"`/`item="date"` дают предупреждения `unknown token/reference` и нарушили бы AC4; в гостевых спеках используется `item="item"`.

## Затронутые компоненты

```text
docs/ui-spec-kit/MANUAL.md                                       правка §6.4 (Р4): +onErrorWhen, $error, дефолт onErrorState,
                                                                 условие ветвей может читать $state, смягчение формулировки before
docs/ui-spec-kit/tools/uispec/validate_uispec.py                 ACTION_ATTRS += onErrorWhen; REF_PREFIXES += $error;
                                                                 сбор route-целей из onErrorWhen
docs/ui-spec-kit/tools/uispec/tests/run_tests.py                 +1 положительный кейс (onErrorWhen/$error)
.opencode/skills/uispec-generator/references/uispec-language.md   строка 11: +onErrorWhen рядом с onSuccessWhen

docs/ui-spec-kit/specs/ui/screens/12-public-event-types.screen.md      переписан по кадру 1
docs/ui-spec-kit/specs/ui/screens/13-public-slots.screen.md            переписан по кадрам 2, 3, 8
docs/ui-spec-kit/specs/ui/screens/14-guest-booking-form.screen.md      переписан по кадрам 4, 5, 6, 9
docs/ui-spec-kit/specs/ui/screens/15-booking-confirmation.screen.md    переписан по кадру 7
docs/ui-spec-kit/specs/ui/screens/FRAME_MAP.md                         переписан guest-раздел

docs/ui-spec-kit/specs/ui/components/public-event-type-card.component.md   новый
docs/ui-spec-kit/specs/ui/components/date-strip.component.md              новый
docs/ui-spec-kit/specs/ui/components/date-chip.component.md               новый
docs/ui-spec-kit/specs/ui/components/slot-grid.component.md               новый
docs/ui-spec-kit/specs/ui/components/inline-alert.component.md            новый
docs/ui-spec-kit/specs/ui/components/booking-summary-card.component.md    новый
docs/ui-spec-kit/specs/ui/components/confirmation-details.component.md    новый
docs/ui-spec-kit/specs/ui/components/slot-item.component.md               переписан (Р6)

docs/ui-spec-kit/specs/ui/registry/components.registry.xml    +7 <Component>, +6 <Helper>, сигнатура formattedSlot
docs/ui-spec-kit/specs/ui/tokens/sizes.tokens.xml             +5 <Size>
docs/ui-spec-kit/specs/ui/tokens/colors.tokens.xml            +9 <Color>
docs/ui-spec-kit/specs/ui/navigation/navigation.uispec.xml    GuestStack: <Param> у трёх route
docs/ui-spec-kit/specs/ui/bindings/api-bindings.xml           +2 <Binding>
docs/ui-spec-kit/specs/ui/bindings/contract-gaps.xml          +GAP-004
docs/ui-spec-kit/specs/ui/assets/guest-mobile-flow.png        перенесён из specs/guest/assets/
docs/ui-spec-kit/specs/ui/assets/ASSETS.md                    +2 строки (макет, $asset.network-error с TODO-ASSET)

docs/ui-spec-kit/specs/guest/**                               удалён целиком: 16 файлов (4 экрана, 8 компонентов, форк MANUAL.md,
                                                              GUEST_CONTRACT_GAPS.md, guest-navigation.uispec.xml, GUEST_FRAME_MAP.md)
                                                              + .DS_Store; макет перенесён шагом 3, а не удалён
```

Не затрагиваются: `packages/**` и generated-артефакты (API impact `NONE`), owner-экраны 01–11, owner-компоненты, `owner-mobile-flow.png`, owner-строки общих файлов, `apps/client/**`, `uispec.config.json`, `README.md` кита, `AUDIT.md`, `ROADMAP.md`.

## Последствия и компромиссы

1. **Канон перестаёт быть неизменным.** Задача правит `MANUAL.md` и валидатор — то, что R1–R3 приводили в согласованное состояние. Компенсация: правка аддитивна (новый атрибут, новый корень выражений), таблицы MANUAL и allowlist валидатора остаются 1:1, фикстура закрепляет поведение. Риск расхождения канона и инструмента не растёт — он проверяется тем же `npm test`.
2. **Ветви `onSuccessWhen`/`onErrorWhen` валидатор не проверяет** (унаследованная неразличимость state/route, находка C3): опечатка в имени состояния внутри ветви не будет поймана. Усиливать V6 в этой задаче не стали — проверка задела бы owner-ветви и вышла бы за non-goal. Компенсация: таблица путей входа в UX rules каждого экрана и обязательный проход по AC7 глазами reviewer'а.
3. **Три конвенции контейнера остаются прозой, а не атрибутами:** начальный `api.query` при монтировании (уже действует в ките), `initBookingKey` при монтировании формы, `refreshPublicSlots` при возврате на экран слотов. Грамматика UISpec не описывает триггеры жизненного цикла, и вводить их ради трёх мест — переусложнение. Все три названы в UX rules и в acceptance criteria экранов.
4. **Guest-flow черновик — сущность вне UISpec** (Р9.2). Плата за отказ протаскивать PII через route params; требование переходит в `front-guest-001`, где контейнер и так создаётся.
5. **Контраст выбранного чипа и слота в тёмной теме — 3.40** (`color.action.primary` dark + `text.onPrimary`), ниже порога 4.5 для текста 14sp. Это существующее свойство owner-токенов, а не следствие этой задачи; правка owner-строк `colors.tokens.xml` — non-goal. Компенсация: выбор кодируется не только цветом (semantic `selected`), как требует MANUAL §10.
6. **Возврат по конфликту через route-цель ветви** опирается на решение реализующего агента (pop, а не push). Ошибка реализации даст растущий стек и «назад» в устаревшую форму — единственный сценарий, где это заметно; сервер повторную попытку по занятому слоту всё равно отклонит.
7. **`empty` каталога склеивает два случая** («типов встреч нет» и «календарь не настроен»). Гость разницы не увидит — намеренно; диагностика этого случая живёт в owner-флоу.
8. **Downstream-задачи получают правку brief** (см. «Совместимость»): экономия от Р1 не отменяет того, что содержание пяти brief `front-guest-*` описано под заменяемые черновики.
9. **Реализация экранов усложняется** относительно черновиков `front-ui-001`: два чтения на каталоге, полоска дат и refresh с распознаванием конфликта на слотах, ключ идемпотентности и три пути ошибки на форме. Это цена соответствия макету и контракту, зафиксированная brief.

## Рассмотренные альтернативы

| Развилка | Отвергнуто | Цена отвергнутого |
|---|---|---|
| Набор имён (Р1) | Присланные `guest.catalog`/`GuestCatalog`… | Правка 3 `screen=` и 3 `action=` в биндингах, 4 route в навигации, `screens=` в **resolved** GAP-002, 15 строк в 5 brief `front-guest-*` — и, главное, ≈20 строк в двух **завершённых** задачах (`front-ui-001`, `contract-001`), которые править нельзя: ссылки остались бы висячими навсегда. Выигрыш — только выразительность слова «catalog» |
| Экран слотов (Р2) | Сохранить канонический сгруппированный список `SlotGroup[]` | Прямое расхождение с кадрами 2/3, отказ от полоски дат — содержательного улучшения, ради которого макет и принят |
| Экран слотов (Р2) | Разбить кадры 2 и 3 на два route | Пятый экран, лишний переход, противоречие AC7 («по одному экрану на route», четыре гостевых экрана) и кадру 8, где алерт живёт на том же экране |
| Тип даты (Р3) | Расширить `PRIMITIVES` типом `localDate` | Правка `MANUAL.md` §7, `PRIMITIVES`, generated branded-тип в `generate_scaffold.py`, фикстура — ради типа, который валидатор всё равно не проверит в `<Prop>` и который не пересекает границу API |
| Тип даты (Р3) | `utcDateTime` начала дня | Календарная дата перестаёт быть датой: значение зависит от timezone, приглашает клиентскую арифметику, запрещённую правилом 4 `AGENTS.md` |
| Ошибки (Р4) | Одно состояние ошибки с полем `code` и разметкой по `when=` | Стирает состояния, перечисленные AC7 (`networkError`, `serverValidationError`, `slotUnavailable`), и делает кадр 8 недостижимым: алерт по макету живёт на экране слотов, а не на форме |
| Ошибки (Р4) | Присланный `onErrorCode="КОД:цель"` | Умеет только сравнение кода: транспортную ошибку (кадр 9) выразить нечем; синтаксис не симметричен `onSuccessWhen`, то есть в каноне появилась бы вторая форма ветвления |
| Конфликт (Р9.3) | `navigation.push GuestSlots` с параметрами `conflict` + prefill | Дубль route в стеке, «назад» ведёт в устаревшую форму, имя и email гостя уезжают в параметры навигации (на web — в URL) |
| Конфликт (Р9.3) | `navigation.reset GuestSlots` | Убивает back-стрелку, нарисованную на кадрах 2/3/8, и путь к каталогу |
| Конфликт (Р9.3) | Транзитное состояние `slotTaken` на форме с кнопкой «Выбрать другое время» | Лишний, не нарисованный макетом шаг взаимодействия против сценария 5 brief («гость возвращается к выбору времени») |
| Оформление (Р5) | Оставить `alertBackground`/`alertIcon`/… helpers | Реестр helpers превратился бы в теневую тему оформления, дублирующую токены; канон уже решает это вариантами компонента |
| Слот (Р6) | Завести `SlotButton`, удалить `SlotItem` и его запись реестра | Плюс один тег в реестре, минус валидность ссылок `front-guest-003` — без функциональной разницы |
| Карточка типа (Р6) | Переиспользовать owner-компонент `EventTypeCard` с новым `variant` | Правка owner-компонента, используемого экраном 06 — прямой non-goal; у него обязательный `publicId`, который гостю не показывают |
| Палитра (Р7) | Хранить готовый токен-строку в helper (`eventTypeAccentColor(id) => token`) | Helper начинает возвращать оформление (нарушение Р5), а подстановку токена нельзя проверить ни валидатором, ни линтом |
| Timezone (Р8) | Показывать timezone владельца | Контракт её публично не отдаёт (осознанное решение `contract-001`); понадобился бы новый gap и, по сути, разглашение настроек календаря |
| Валидация формы (Р11) | `disabledWhen="$validation.invalid"` (как в черновике `front-ui-001`) | Кадры 4/5 рисуют активную CTA при пустых и невалидных полях; при заблокированной кнопке гость не получает подсказок вообще |
| Порядок (Р15) | Сначала спеки, потом канон и реестр | Промежуточный прогон валидатора красный: `WARN`→`AC4`/`FR8` по `onErrorWhen`, `unregistered tag` по семи тегам, «Binding-сирота» по двум действиям |

## Совместимость и миграция

**API и generated.** Не затрагиваются: `API impact NONE`, `contracts:format:check` и `generate:check` в списке проверок Р15 присутствуют как регресс-контроль, а не как ожидание diff.

**Реестр gaps.** GAP-002 остаётся `resolved` и точным: его `screens=` содержит `guest.booking-confirmation` (id сохранён по Р1), а поручение «property состояния на экране 15 снимает task-front-ui-002» (`contract-gaps.xml:25`) исполняется в шаге 4 — экран берёт `Booking.eventTypeName` из ответа. GAP-001 и GAP-003 не трогаются.

**Downstream — brief требуют правки** (переписывание не входит в scope; перечень обязателен к переносу в `result.md`):

| Задача | Что расходится после этой задачи |
|---|---|
| `front-guest-001` | FR1 — состав компонентов дизайн-системы: добавляются 7 тегов (`PublicEventTypeCard`, `DateStrip`, `DateChip`, `SlotGrid`, `InlineAlert`, `BookingSummaryCard`, `ConfirmationDetails`) и переписанный `SlotItem`; FR5 — маппер ошибок обязан отдавать форму `$error` (`code`, `message`, **`transport`**), которой в перечне кодов нет; новое: guest-flow черновик (имя/email/комментарий) и генерация UUID-ключа идемпотентности; FR6 — route'ы те же, но получают типизированные параметры |
| `front-guest-002` | Экран каталога делает **два** чтения (`getPublicEventTypes` + `getPublicCalendar`); карточка — `PublicEventTypeCard` с `accentIndex`, а не owner-овский `EventTypeCard`; в параметрах перехода к слотам теперь четыре значения |
| `front-guest-003` | FR3 «группировка по датам; reuse `SlotItem`» больше не описывает экран: полоска дат + сетка слотов выбранной даты, семь состояний вместо четырёх, второе действие `refreshPublicSlots` с распознаванием конфликта, четыре новых компонента к реализации; `SlotItem` получает `selected` |
| `front-guest-004` | Состояния `validationError`/`serverValidationError`/`networkError` вместо одного `error`; CTA активна при невалидной форме (валидация на submit); `BookingSummaryCard`; ключ идемпотентности в payload; «Выбрать другое время» и «Изменить» — одно действие возврата; поле комментария — `note` |
| `front-guest-005` | Название типа встречи берётся из `Booking.eventTypeName`, а не из навигации; `ConfirmationDetails`; состояние `error`; возврат — `navigation.reset` на каталог |
| `front-guest-006` | Сквозной сценарий получает пути кадров 8 и 9 (конфликт слота с сохранением данных, ошибка сети с повтором по тому же ключу) |
| `tasks/README.md` | Строка `front-ui-002` в реестре и «Где мы сейчас» — по факту согласования этапов |

**Завершённые задачи** (`front-ui-001`, `contract-001`) не правятся: их тексты описывают состояние на момент своего выполнения, а благодаря Р1 ни одна их ссылка не становится висячей.

**Возврат согласованных документов.** Правка `MANUAL.md` и валидатора — изменение согласованной спецификации кита (правило 8 `AGENTS.md`), но кит вне git и своих task-документов не имеет: фиксация идёт в `plan.md`/`result.md` этой задачи. `AUDIT.md` и `ROADMAP.md` — исторические документы исполненных R1–R6, их эта задача не переписывает; отношение решений R1–R6 к новому атрибуту — «дополнены, не откачены» — фиксируется в `result.md`.

## Решения по вопросам (harness, 2026-08-08)

Пользователь делегировал ревью и фиксацию решений на ночной прогон. Все семь закрыты; шесть — подтверждением выбора ADR, седьмое — с поправкой по существу.

1. **Правка канона ради `onErrorWhen` — принята.** AC7 требует, чтобы `slotUnavailable`, `networkError`, `serverValidationError` и `unavailable` существовали как отдельные состояния **и** имели путь входа через атрибут результата. Альтернатива склеивает состояния и заменяет проверяемые атрибуты прозой, то есть деградирует согласованный критерий приёмки — это дороже, чем 19-й атрибут, симметричный уже существующему `onSuccessWhen`. Опасение «вторая грамматическая сущность за два дня» снимается тем, что правка не создаёт диалекта: она перечислена поимённо в `MANUAL.md`, валидаторе, его тестах и reference скилла, то есть канон и инструмент остаются единственным источником.
2. **Смягчение формулировки `before` — принято как уточнение документации, не как правка канона.** Валидатор применение к `api.command` уже допускает; узкой была только проза MANUAL. Фиксируется как приведение текста к поведению инструмента.
3. **Статический текст про 14 дней без gap-записи — принят.** Окно — документированная константа операции (`docs/domain-rules.md`), а не поле ответа. Gap-запись означала бы, что контракт обязан отдавать границы окна, чего от него не требуется: клиент показывает правило, а не данные.
4. **Палитра из 6 акцентов — принята с фиксацией предела.** Цвет здесь — украшение, а не идентичность: повтор при седьмом типе встреч ничего не ломает. В «Известные ограничения» `result.md` внести прямо: при 7+ типах у одного владельца цвета повторяются, и это осознанно.
5. **Черновик формы как сущность вне UISpec — принят.** Хранение состояния формы — клиентская механика, UISpec её не моделирует; в спеке экрана обязано присутствовать само состояние, а не способ его сохранения. То, что валидатор этого не проверяет, фиксируется в `result.md`.
6. **`empty` каталога как приёмник `CALENDAR_NOT_CONFIGURED` — принят.** Контракт делает этот код публичным выражением незавершённого онбординга; для гостя исход один — записаться не на что. Различать «владелец не настроил календарь» и «типов встреч нет» гостю не нужно, и не сообщать ему внутреннее состояние владельца скорее правильно.
7. **Контраст 3.40 в тёмной теме — не оставляем ограничением, чиним аддитивно.** 3.40 не проходит WCAG AA для обычного текста (нужно 4.5:1), а состояние «слот выбран» — не декоративная деталь, а несущая информация. Правка owner-строки `action.primary` действительно non-goal, но brief разрешает **аддитивные** правки общих файлов: значит в `colors.tokens.xml` добавляется отдельный guest-токен для выбранного состояния (пара «светлая/тёмная») с контрастом ≥ 4.5:1 к тексту, который на нём лежит, а owner-строки остаются побайтово теми же. Если сохранить визуальный замысел макета (синий выбранный чип) с достаточным контрастом невозможно, тогда — и только тогда — фиксируется ограничение с измеренным значением и указанием, какой именно токен его вызывает.

## Вопросы к brief

Спорные места, зафиксированные при проектировании; решения по ним — в разделе выше.

1. **Правка канона ради `onErrorWhen`** (Р4). Brief её разрешает, но это уже вторая грамматическая сущность за два дня (`$error` — новый корень выражений). Альтернатива — принять деградацию AC7 и склеить `networkError`/`serverValidationError`.
2. **Смягчение формулировки `before`** в MANUAL (Р11): применение к `api.command` вместо только `local.submit`. Технически валидатор это уже допускает; вопрос в том, считать ли это правкой канона или чтением.
3. **Статический текст «Слоты доступны на ближайшие 14 дней»** без gap-записи (Р8): окно — документированная константа операции, а не поле ответа.
4. **Размер палитры акцентов — 6** (Р7): число выбрано, а не выведено; при 10+ типах встреч у одного владельца цвета начнут повторяться.
5. **Guest-flow черновик как сущность вне UISpec** (Р9.2) — единственное место решения, которое нельзя проверить валидатором.
6. **`empty` каталога как приёмник `CALENDAR_NOT_CONFIGURED`** (Р4): гость не различает «нет типов встреч» и «календарь не настроен».
7. **Тёмная тема: контраст 3.40** у подписи выбранного слота и чипа (Р12, следствие owner-токена `action.primary`). Исправление требует правки owner-строки `colors.tokens.xml` — сейчас это non-goal.
