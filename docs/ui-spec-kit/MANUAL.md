# UISpec 0.1 — руководство по чтению и генерации

## 1. Назначение

UISpec — полуабстрактный XML-подобный язык для описания интерфейса. Он не является runtime-фреймворком. Его задача — дать человеку и AI-агенту единый источник для описания экрана, из которого воспроизводимо генерируется код.

Фактические outputs `tools/uispec/generate_scaffold.py` (см. §6.2) — на один спек:

- TypeScript UI-state и action types (`*.types.generated.ts`);
- каркас React Native-компонента без layout-логики (`*.generated.tsx`);
- TypeSpec model fragment из `Data/Model`, `Data/Enum` без `source="api"` (`*.models.generated.tsp`, не компилируется standalone — см. §8);
- общий `uispec-runtime.ts` (branded-типы) — создаётся один раз на каталог `--out`.

**Roadmap (не реализовано генератором):** типизированные route params, Storybook fixtures, Jest/Maestro skeletons. Дописывать генератор до этих outputs без реальной потребности не нужно (YAGNI) — см. `AUDIT.md`, находки D5/C15.

## 2. Формат файла

Каждый `*.screen.md` и `*.component.md` содержит:

1. YAML frontmatter;
2. краткое человеческое описание;
3. ровно один fenced-блок `uispec`;
4. UX-правила;
5. acceptance criteria.

### 2.1. Sheet-компонент: спека без route

Bottom sheet, который открывает и закрывает родительский экран своим состоянием, а не навигация,
описывается обычным `*.screen.md`, но:

- `route` нет ни во frontmatter, ни в `Meta` — в `navigation/navigation.uispec.xml` записи для такой спеки
  тоже нет;
- `Meta` несёт `presentation="bottom-sheet"` и `parent=` — `Meta.id` родителя, несколько родителей через `|`;
- вход объявляется блоком `<Props>`, как в `*.component.md`, и читается в разметке через `$props.*`;
- открытие — `local.update` (что показать) с `onSuccessState` (состояние родителя, в котором sheet
  смонтирован), закрытие родителем — `local.transition`, закрытие изнутри — `local.submit` с
  `result="close"`; собственных `navigation.*` действий у sheet нет, системная «назад» на Android
  закрывает sheet, а не экран-родитель;
- каркас генератором по такой спеке не собирается: без `route=` имя артефактов берётся из имени файла
  (§6.2), а у нумерованных спек оно начинается с цифры. Sheet реализуется внутри родительского экрана.

Данные через границу sheet → родитель переносит `<Payload>`: поля payload действия `local.submit` с
`result="close"` становятся `$event.*` в действии родителя, которое обрабатывает закрытие. Поэтому все
пути закрытия с применением обязаны нести одинаковый payload, иначе часть из них отдаст родителю пустое
событие. Прецедент: `applyWorkingHours` и `confirmOverwriteApply` в 04 отдают одни и те же
`daysOfWeek`/`startLocal`/`endLocal`, а `applyWorkingInterval` в 03 и 07 читает их как
`$event.daysOfWeek`, `$event.startLocal`, `$event.endLocal`.

Так описаны `04-add-working-hours-sheet` (родители — 03 и 07) и `11-booking-details-sheet` (родитель — 05).

## 3. Приоритеты при конфликте

1. Явное правило в `UX rules` или `Acceptance criteria`.
2. XML-блок UISpec.
3. Design tokens и component registry.
4. Визуальный reference PNG.
5. Предположение агента.

При противоречии агент обязан остановить автоматическую генерацию спорного участка и создать `TODO-CONTRACT-GAP`.

## 4. Единицы

- layout: `dp`;
- font size и line height: `sp`;
- duration: `ms`;
- цвета: hex или token reference;
- размеры должны ссылаться на токены, если значение повторяется.

## 5. Layout-правила

Использовать flow-layout: `Stack`, `Row`, `Column`, `Center`, `ScrollView`, `Section`, `Spacer`, `Overlay`, `BottomSheet`.

Не использовать абсолютные координаты для основного layout. Атрибуты `x` и `y` допустимы только для декоративных элементов с `position="absolute"`.

`width="fill"` → `alignSelf: 'stretch'`.
`height="fill"` или `flex="1"` → flex layout.
`gap` генерируется через `gap`, если поддерживается целевой RN, иначе через wrapper spacing.

## 6. Генерация React Native

### 6.1. Компоненты

Каждый UISpec-тег разрешается через `specs/ui/registry/components.registry.xml`.

Пример:

```xml
<Button variant="primary" label="Продолжить" />
```

генерируется как:

```tsx
<AppButton variant="primary" label="Продолжить" />
```

Не заменять зарегистрированные компоненты случайными `View`, `Text` или `Pressable`.

### 6.2. Файлы

Имя файлов = route id (`Meta/@route` спека; если route не указан — pascal-case имени файла спека), а не человекочитаемый screen id из `Meta/@id`/frontmatter. Для экрана `owner.upcoming-meetings` (route: `OwnerMeetings`) `tools/uispec/generate_scaffold.py --out <directory>` создаёт:

```text
OwnerMeetings.types.generated.ts     — TS-типы State/Action/Model (§7)
OwnerMeetings.generated.tsx          — каркас GeneratedView (заглушка, без layout-логики)
OwnerMeetings.models.generated.tsp   — TSP-фрагмент Data/Model,Enum без source="api" (§8)
uispec-runtime.ts                    — branded-типы; общий на весь каталог --out, создаётся один раз
```

`*.generated.*` и `uispec-runtime.ts` перезаписываются при каждом запуске — правки в них не сохраняются. Ручной файл-обёртка (например, `OwnerMeetings.tsx`, импортирует `OwnerMeetingsGeneratedView`) генератором не создаётся и никогда не перезаписывается — это отдельный файл, который пишет реализующий агент.

### 6.3. StateMachine

Каждый `<State>` превращается в discriminated union по полю `kind`.

`extends="content"` наследует свойства базового состояния.

### 6.4. Actions

Каждый `<Action>` превращается в член discriminated union действий экрана (`<Screen>Action`, см. §7): `{ type: <id>; ...параметры Param }`. `id` действия обязан быть уникален в пределах файла; для `kind="api.*"` — глобально уникален между экранами (валидатор, проверка V1).

Исполняемая грамматика (allowlist `kind` и атрибутов) закреплена в валидаторе — `ACTION_KINDS`/`ACTION_ATTRS`, `tools/uispec/validate_uispec.py`, проверка V7. Таблицы ниже обязаны совпадать с ним 1:1; неизвестный атрибут `<Action>` — WARN, неизвестный `kind` — ERROR.

#### Kind (12)

| `kind` | Семантика |
|---|---|
| `navigation.push` | Переход на новый route текущего стека |
| `navigation.sheet` | Открыть route как modal/bottom-sheet поверх текущего экрана |
| `navigation.back` | Вернуться на предыдущий route стека; `target` не используется |
| `navigation.reset` | Сбросить историю стека и перейти на `target` без возможности вернуться назад |
| `navigation.tab` | Переключить bottom-tab и перейти на `target` внутри другой вкладки |
| `native.share` | Вызвать системный Share sheet (React Native Share API) с параметрами из `<Param>` |
| `api.query` | Читающий вызов backend через use-case/repository; операция резолвится только через `specs/ui/bindings/api-bindings.xml` (см. §8), прямой fetch из view запрещён |
| `api.command` | Пишущий вызов backend (create/update) через use-case/repository; переносит `<Payload>` |
| `local.update` | Точечное обновление одного поля client-side состояния по `path`/`value`, без запроса к backend |
| `local.dispatch` | Программно вызвать другое действие этого экрана (`target` — id действия), минуя прямое взаимодействие пользователя |
| `local.submit` | Локальная валидация и применение `<Payload>` без сетевого вызова (например, применение формы bottom sheet к состоянию экрана-родителя) |
| `local.transition` | Чистый переход StateMachine без payload и без сетевого вызова (`target` — id state этого экрана) |

#### Атрибуты (19)

Результат действия описывается раздельными атрибутами: `onSuccessState`/`onErrorState` — переход StateMachine (значение — state id экрана), `onSuccessRoute` — навигация после успеха (значение — route id из `navigation.uispec.xml`). Перегруженный `onSuccess` не используется (см. решение по находке C3, `AUDIT.md`).

| Атрибут | Семантика | Словарь значений |
|---|---|---|
| `id` | Идентификатор действия, литерал `type` в сгенерированном union | строка, уникальна в файле (глобально — для `kind="api.*"`) |
| `kind` | Тип действия | один из 12 kind выше |
| `target` | Цель действия; словарь зависит от `kind` | `navigation.push/sheet/reset/tab` → route id из `navigation.uispec.xml`; `local.dispatch` → id другого действия этого файла; `local.transition` → id state этого экрана; у `navigation.back` не используется |
| `path` | Путь к полю client-side состояния, которое обновляет `local.update` | expression вида `$state.form.<поле>` / `$state.<поле>` |
| `value` | Значение, записываемое по `path` (`local.update`) | expression (обычно `$event.value`) или литерал |
| `disabledWhen` | Условие недоступности управляющего элемента, вызывающего действие | boolean-expression над `$validation`/`$state` |
| `onSuccessState` | Переход StateMachine этого экрана после успеха | id state этого экрана |
| `onErrorState` | Переход StateMachine этого экрана после ошибки | id state этого экрана |
| `onSuccessRoute` | Навигация после успеха | id route из `navigation.uispec.xml` |
| `onSuccessWhen` | Многоветочный результат вместо одиночного `onSuccessState`/`onSuccessRoute` — синтаксис и словарь ниже | см. ниже |
| `onErrorWhen` | Многоветочный разбор ошибки по её машиночитаемому коду или транспортной природе; `onErrorState` при этом остаётся дефолтом — синтаксис и словарь ниже | см. ниже |
| `preserveContent` | Повторный `api.query` (например, pull-to-refresh) не переключает экран в loading-state, текущий контент остаётся видимым | `"true"` |
| `markDirty` | Помечает экран как имеющий несохранённые изменения — читается другими действиями в `disabledWhen` (например, `!$state.dirty`) | `"true"` |
| `before` | Имя проверки/хука, выполняемого до основного эффекта действия (чаще всего с `local.submit`, допустимо и с `api.command` — например клиентская валидация формы перед запросом) | свободная метка; реализующий агент определяет хук сам — валидатор её не резолвит ни в один реестр |
| `onConflict` | Куда перейти, если `before`-проверка сообщила о конфликте | id state этого экрана |
| `after` | Имя хука, выполняемого после основного эффекта `local.update` | свободная метка, как `before` — не резолвится валидатором |
| `afterWhen` | Условный запуск хука после `local.update` — синтаксис `"условие:имяХука"` | условие — boolean-expression; хук — свободная метка, как `after` |
| `result` | Итог `local.submit` | наблюдаемое значение `"close"` — закрыть host bottom-sheet/route и вернуть фокус родителю; словарь литералов, не id-ссылка |
| `gap` | Действие заблокировано/деградирует до решения по contract gap | id из `specs/ui/bindings/contract-gaps.xml` (проверка V9) |

`before`/`after`/`afterWhen` называют произвольные локальные хуки, которые реализующий агент определяет сам при переносе спека в код (например, «сгенерировать `publicId` из названия», «выставить флаг touched»). В отличие от `onConflict`, их значения не резолвятся ни в Actions, ни в StateMachine — валидатор их не проверяет.

#### `onSuccessWhen`

Синтаксис: `"условие1:цель1;условие2:цель2;..."` — ветки разделены `;`, каждая ветка — `условие:цель`. Условие — boolean-expression, как правило над `$result` (данные ответа действия); допустимо читать и текущее состояние экрана — `$state.*`, `$validation.*` — когда исход зависит не только от ответа (например «пришёл список без ранее выбранного элемента»). Цель — id state этого экрана **или** id route из `navigation.uispec.xml`; синтаксически они не различаются (наследие смешанной семантики бывшего `onSuccess`, см. находку C3 `AUDIT.md`) — агент резолвит цель вручную, проверяя оба словаря; валидатор не проверяет ветки как ERROR, только учитывает route-цели при поиске route-сирот (V5).

Примеры из спеков:

- `$result.length == 0:empty;$result.length &gt; 0:content` — цели `empty`/`content` — state id этого экрана.
- `$result.onboardingCompleted == true:OwnerMeetings;$result.onboardingCompleted == false:OnboardingProfile` — цели — route id.

#### `onErrorWhen`

Синтаксис тот же, что у `onSuccessWhen`: `"условие1:цель1;условие2:цель2;..."` — ветки разделены `;`, каждая ветка — `условие:цель`, ветки проверяются по порядку сверху вниз.

Условие — boolean-expression над `$error` — результатом маппера ошибок клиента:

| Поле `$error` | Тип | Значение |
|---|---|---|
| `code` | `string \| null` | машиночитаемый `ErrorResponse.code` ответа сервера; `null`, если кода нет |
| `message` | `string \| null` | человекочитаемый `ErrorResponse.message` |
| `transport` | `boolean` | `true` — ответа от сервера не было вовсе (обрыв сети, таймаут, DNS); `false` — сервер ответил ошибкой |

При необходимости условие может читать и `$state`/`$validation`, как у `onSuccessWhen`.

Цель — id state этого экрана **или** id route из `navigation.uispec.xml`, с той же неразличимостью и тем же способом резолва, что у `onSuccessWhen`; валидатор ветки как ERROR не проверяет и учитывает только route-цели при поиске route-сирот (V5).

Если ни одна ветка не совпала, действует `onErrorState`. Здесь **сознательная асимметрия** с `onSuccessWhen`: у успеха ветвление вытесняет одиночный `onSuccessState`, у ошибки `onErrorState` остаётся обязательным значением по умолчанию — необработанного исхода у ошибки быть не должно.

Пример:

- `$error.transport == true:networkError;$error.code == 'SLOT_UNAVAILABLE':GuestSlots` при `onErrorState="serverValidationError"` — обрыв сети ведёт в state `networkError`, занятый слот возвращает на route `GuestSlots`, любая другая ошибка сервера — в state `serverValidationError`.

#### Вложенные элементы

`<Param name= type= bind= />` — параметр действия: у `navigation.push/sheet` — route params, у `native.share` и `api.query` — передаваемые значения запроса.

- `name` — имя параметра;
- `type` — тип из системы типов §7 (тот же словарь, что у `Field`); без атрибута параметр типизируется как `unknown` в сгенерированном union (подтверждено `generate_scaffold.py`);
- `bind` — expression-источник значения на момент диспатча (`$state.*`, `$event.*`, `$route.params.*`).

`<Payload><Field name= bind= /></Payload>` — данные, переносимые `api.command`/`local.submit`: один `<Payload>` на действие, произвольное число `<Field>`.

- `Field.name` — имя поля в исходящем запросе/наборе изменений; для `api.command` — точно совпадает с полем контрактной схемы (§8);
- `Field.bind` — expression-источник значения;
- `type=` внутри `Payload/Field` не объявляется: для `api.command` тип берёт целевая контрактная схема, для `local.submit` значение уходит напрямую в состояние экрана-родителя без отдельной типизации на этом уровне.

### 6.5. View и container

Сгенерированный view-компонент должен быть чистым:

```text
ScreenContainer → use-case/repository → DTO mapper → ScreenState → GeneratedView
```

API DTO не передавать прямо в UI-компоненты.

## 7. Генерация TypeScript

`Data/Model` генерируется в интерфейсы или type aliases.

Типы UISpec:

| UISpec | TypeScript |
|---|---|
| string | string |
| boolean | boolean |
| int32 | number |
| decimal | number |
| utcDateTime | string brand/ISO string |
| localTime | string brand `HH:mm` |
| url | string brand/URL |
| `T[]` | `T[]` |
| enum | string union |

Для runtime validation рекомендуется генерировать Zod-схемы, но TypeScript-типы остаются отдельным output.

Правила генератора `tools/uispec/generate_scaffold.py`:

- branded-типы `UtcDateTime`, `LocalTime`, `Url` объявлены один раз в общем `uispec-runtime.ts` рядом с каркасами и импортируются через `import type`; в отдельных файлах экранов они не переобъявляются;
- модели с `source="api"` не дублируются локальным интерфейсом: по атрибуту `schema=` генерируется `import type { Схема } from '@minical/api-client'` плюс алиас под именем модели. `source="api"` без `schema=` — предупреждение в stderr и старое поведение (локальный интерфейс);
- тип параметра действия берётся из атрибута `type=` элемента `<Param>` (та же система типов, что у `Field`); без атрибута параметр остаётся `unknown`;
- `default=` у `<Property>` порождает константу `<Screen><State>Defaults` со значениями по умолчанию этого состояния (свойства без `default=` в неё не входят).

## 8. Генерация TypeSpec

TypeSpec генерировать только из `Data/Model` и `Data/Enum`, если модель не помечена `source="api"`.

Правила:

- `required="false"` → optional property;
- `format="email"` → `@format("email")`;
- `format="uri"` или `type="url"` → `url` либо проектный scalar;
- `utcDateTime` → `utcDateTime`;
- UISpec не придумывает HTTP route;
- `<Action kind="api.*">` биндится к операции только через `specs/ui/bindings/api-bindings.xml`; значение `operation` в биндинге — точный `operationId` из `packages/contracts/generated/openapi.yaml`; inline `operation=` в экранах запрещён;
- модели с `source="api"` указывают контрактную схему атрибутом `schema=`, и их поля — точное подмножество её properties; view-model фиксирует происхождение полей атрибутами `from="Схема.поле"` (derived-поля — `derived="true"`).

Если операции или данных нет в контракте, зарегистрировать gap в `specs/ui/bindings/contract-gaps.xml` и пометить затронутое место маркером `TODO-CONTRACT-GAP(GAP-XXX)`, а не создавать новый endpoint без решения архитектора.

## 9. Validation

`Validation/Rule` преобразуется в:

1. runtime form validation;
2. inline error mapping;
3. Jest test case;
4. при применимости — ограничение TypeSpec модели.

Client-side validation не заменяет server validation.

## 10. Accessibility

Обязательные правила:

- `IconButton` всегда имеет `accessibilityLabel`;
- touch target не меньше 48 dp для Android;
- поля имеют отдельный label;
- ошибка связана с полем;
- disabled/selected не кодируются только цветом;
- bottom sheet имеет доступное название и корректный focus restore;
- loading animation имеет текстовый статус.

## 11. Анимации

UISpec описывает намерение, а не пиксельную реализацию:

```xml
<Motion preset="$motion.setupCheck" />
```

Генератор создаёт placeholder. Агент реализует Reanimated/Lottie только при наличии согласованного asset. Не генерировать тяжёлую анимацию из предположений.

## 12. Визуальная сверка

После генерации:

1. открыть reference frame;
2. сравнить hierarchy, spacing, typography, CTA placement;
3. проверить small Android и large Android viewport;
4. проверить font scale 1.0 и 1.3;
5. проверить loading/empty/content/error;
6. зафиксировать расхождения в `generation-report.md`.

`generation-report.md` создаётся при первой реальной генерации экрана в клиент (`apps/client/`) — рядом со сгенерированными файлами экрана либо в директории активной задачи (`tasks/<тип>/<номер>-<слаг>/`), решает реализующий агент по месту. Задним числом для прошлых прогонов генератора, сделанных не для реальной генерации в клиент (например, каркасы 05/10/14 из `AUDIT.md`, созданные для проверки генератора), файл не создаётся.

## 13. Запрещённые действия

- не вставлять значения цветов напрямую, если есть token;
- не смешивать DTO и view model;
- не создавать третий bottom-tab `Типы событий`;
- не превращать bottom sheet в отдельный route без решения в UISpec;
- не считать PNG точным источником текста или размеров;
- не перезаписывать ручные файлы;
- не скрывать contract gaps обходными предположениями.
