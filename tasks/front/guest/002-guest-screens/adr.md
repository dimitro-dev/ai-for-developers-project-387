# Architecture decision — TASK-front-guest-002

## Контекст

Brief согласован 2026-08-13. Реализуются четыре экрана гостевого сценария по спекам `front-ui-002` (12–15) на фундаменте `front-guest-001`: дизайн-система по registry, `configureApiClient()`, четыре use-case поверх generated SDK, маппер `$error` со словарём текстов, `GuestFlowProvider` (Context+useReducer) с черновиком формы и ключом идемпотентности, типизированный `GuestStack` со стаб-экранами.

Входные условия, которые этот ADR обязан разрешить:

- **Три конвенции контейнера — проза UX rules, а не атрибуты грамматики** (`task-front-ui-002/result.md`, ограничение 2): начальные `api.query` при монтировании; `initBookingKey` при монтировании формы; `refreshPublicSlots` при возврате на экран слотов. Нужен конкретный механизм в терминах React Navigation.
- **Семантика ключа идемпотентности фундамента расходится со спекой 14.** Редьюсер `guest/state/reducer.ts` выдаёт ключ set-once при первой отправке (`booking/attempt`), живой прогон фундамента подтвердил «тот же ключ» после возврата по стеку. Спека 14 требует `initBookingKey` при монтировании — до первой попытки — и «ключ живёт ровно монтирование»: иначе смена слота после возврата отправит старый ключ с другой нагрузкой и получит `DUPLICATE_BOOKING_ID`. Brief FR3.4 фиксирует семантику спеки.
- **`AppIcon` — плейсхолдер** без icon-библиотеки; brief FR0.1 согласовал `@expo/vector-icons` как расширение фундамента. Гостевые спеки и компоненты используют 14 имён: `arrow-left`, `globe` (фундамент), `cloud-off`, `calendar-x`, `event-type`, `info`, `check-circle`, `chevron-right`, `alert-triangle`, `alert-circle`, `calendar`, `clock`, `user`, `mail`.
- **Скаффолд-генератор кита ещё ни разу не применялся к клиенту.** ADR фундамента (§8) отложил его включение до этой задачи. `generate_scaffold.py` даёт на экран три файла, из которых кодом клиента полезен один: `*.types.generated.ts` (discriminated unions State/Action); `*.generated.tsx` — заглушка без layout-логики, `*.models.generated.tsp` — фрагмент для контрактной работы, которой здесь нет (API impact NONE). MANUAL §12 требует `generation-report.md` при первой реальной генерации в клиент.
- **Возврат по конфликту слота — решение реализующего агента** (`task-front-ui-002/result.md`, ограничение 5): route-цель ветви `onErrorWhen` обязана резолвиться как pop на существующий экран стека, не второй push.
- Этапы Э1–Э4 разрабатываются против Prism-мока `:4010` (состояние не хранит, тела 4xx — плейсхолдеры), Э5 — против реального API `:3001`; переключение — `EXPO_PUBLIC_API_BASE_URL` + обязательный `--clear` (известное ограничение 2 фундамента).
- Тестовая инфраструктура — jest-expo + `@testing-library/react-native` 14 (полностью асинхронный API).

## Решение

### 1. Экран = ручной контейнер + ручной view + сгенерированные типы состояний

Для четырёх экранов запускается `generate_scaffold.py` (по процессу скилла `uispec-generator`: валидация спек до генерации). Генерация идёт в scratch-каталог; в клиент переносятся **только** `Guest*.types.generated.ts` (4 файла) и общий `uispec-runtime.ts` — в `src/features/guest/screens/generated/`. Заглушки `*.generated.tsx` (layout-логики не содержат) и `*.models.generated.tsp` (контрактная работа отсутствует; локальные модели `AvailableDate`, `FieldError` остаются view-model клиента) в код не переносятся. `generation-report.md` по MANUAL §12 ведётся в `tasks/task-front-guest-002/`.

Каждый экран — два ручных файла в `src/features/guest/screens/`: контейнер `<Route>Screen.tsx` (диспатч use-cases, редьюсер состояния экрана, навигация) и чистый view `<Route>View.tsx` (props: состояние + колбэки действий; DTO внутрь не попадают — MANUAL §6.5). Стабы `*StubScreen.tsx` удаляются, `GuestStack` переключается на контейнеры.

### 2. Состояние экранов — локальный useReducer; поля формы — в GuestFlowProvider

StateMachine каждого экрана — discriminated union по `kind` из сгенерированных типов; переходы — чистый редьюсер рядом с контейнером, ветви `onSuccessWhen`/`onErrorWhen` реализуются в порядке спеки (сверху вниз, `onErrorState` — дефолт). Глобального store для состояний экранов нет.

Поля формы гостя (`name`, `email`, `note`) живут **только** в `GuestFlowProvider.draft` (действие `draft/change` уже существует) — так черновик автоматически переживает и возврат к слотам, и обрыв сети (FR3.5), а форма при монтировании берёт значения из контекста без синхронизации двух источников. Локальный state формы — только машина (`editing | validationError | submitting | serverValidationError | networkError`), `fieldErrors` и `message`. `selectedDate`/`selectedSlot` экрана слотов — локальный state: пока экран в стеке под формой, выбор сохраняется естественно, а исходы возврата полностью закрывает `refreshPublicSlots` (FR2.4).

### 3. Конвенции жизненного цикла — useEffect на монтирование, useFocusEffect на возврат

- Каталог: `useEffect` при монтировании диспатчит пару `loadPublicCalendar` + `loadPublicEventTypes`; «Повторить» перезапускает пару целиком (FR1.2), переходами владеет результат `loadPublicEventTypes`.
- Слоты: первый фокус (монтирование) → `loadPublicSlots`; каждый последующий фокус → `refreshPublicSlots`. Механизм — `useFocusEffect` из `@react-navigation/native` c ref-флагом «первый фокус». Неудачный refresh состояние не меняет (`preserveContent`).
- Форма: `useEffect` при монтировании диспатчит `initBookingKey` (решение 5).
- Подтверждение: контейнер-guard при монтировании — нет параметра `booking` → состояние `error` (FR4.3).

### 4. Возврат к слотам — pop, не push

Ветви `createBooking` с целью-route `GuestSlots` (`SLOT_UNAVAILABLE`, `SLOT_OUTSIDE_WINDOW`, `SLOT_NOT_ALIGNED`) выполняются как `navigation.popTo('GuestSlots')` (native-stack, React Navigation 7) — возврат на существующий экран стека; сам конфликт распознаёт экран слотов через focus-refresh (решение 3). `chooseAnotherTime` — `navigation.goBack()` (kind `navigation.back`). `openCatalog` и `backToCatalog` — `navigation.reset` по спекам.

### 5. Ключ идемпотентности — новый на каждое монтирование формы

Семантика редьюсера guest-flow приводится к спеке 14: действие `booking/attempt` (set-once) заменяется на `booking/init`, которое **безусловно** записывает новый ключ; контейнер формы диспатчит его при монтировании с `newBookingKey()`. `booking/succeeded` по-прежнему очищает ключ; черновик при успехе не трогается (спека очистку не требует). Повтор после обрыва сети (`retryBooking`) переиспользует ключ и нагрузку текущего монтирования — форма в состоянии `networkError` не размонтируется, менять нагрузку нечем (кадр 9). Возврат к слотам размонтирует форму, и новое монтирование выдаёт новый ключ — старый ключ с другой нагрузкой не может уйти на сервер. Это санкционированное brief FR3.4 изменение фундамента; тесты редьюсера и провайдера обновляются вместе с ним.

### 6. Иконки — @expo/vector-icons, семейство Feather, типизированный словарь

`npx expo install @expo/vector-icons` (входит в Expo SDK, новой внешней зависимости нет — FR0.1). `AppIcon` переписывается: `name` сужается со `string` до union `IconName` (14 имён контекста), внутри — словарь `IconName → глиф`. Основное семейство — **Feather**: 12 из 14 имён спек совпадают с его глифами буквально (`cloud-off`, `info`, `check-circle`, `alert-triangle`, …). Для двух имён без прямого глифа — точечный override другим семейством пакета: `calendar-x` → MaterialCommunityIcons `calendar-remove`, `event-type` → глиф выбирается при реализации по мокапу (кандидаты: Feather `grid`/`tag`, MCI `shape-outline`). Props-API и a11y-поведение (`accessibilityLabel`, декоративность без label) сохраняются — вызывающий код фундамента не правится, меняется только тип `name`. Плейсхолдер удаляется (AC9 brief).

### 7. Новые модули — строго по путям registry

| Модуль | Содержимое |
|---|---|
| `@/features/guest/components/` | `PublicEventTypeCard`, `BookingSummaryCard`, `ConfirmationDetails` |
| `@/features/slots/components/` | `SlotGrid`, `SlotItem`, `DateStrip`, `DateChip` |
| `@/features/slots/lib` | `availableDates`, `slotsOnDate`, `selectedSlotMissing` |
| `@/features/event-types/lib` | `durationLabel`, `eventTypeAccentIndex` (FNV-1a 32-bit mod 6 — алгоритм фиксирован registry) |
| `@/shared/datetime` | `dateLabel`, `timeLabel`, `fullDateLabel`, `formattedSlot`, `formatUtcOffset`, определение timezone гостя |
| `@/shared/forms` | `fieldError` |
| `@/design-system/components/InlineAlert` | вариант → токен/иконка по таблице компонент-спеки |

Маппинг `accentIndex → colors.accent[N]` и `variant → оформление` живёт в RN-реализации компонентов (как `Button variant`), не в helpers, — так решено спеками. Иллюстрация `$asset.network-error` — placeholder-компонент с `TODO-ASSET` (FR3.7).

### 8. Даты и время — Intl, явная timezone, локаль ru-RU

Никаких date-библиотек: форматирование — `Intl.DateTimeFormat` (Hermes на Android и браузер её дают). Все функции `@/shared/datetime` и `@/features/slots/lib` принимают IANA-timezone **явным параметром** — тестируемость не зависит от TZ окружения. Timezone гостя — `Intl.DateTimeFormat().resolvedOptions().timeZone`, единая функция в `@/shared/datetime` (источник `$system.timeZone`). Локаль подписей — константа `ru-RU` (язык продукта). Календарная дата — строка `YYYY-MM-DD`, полученная форматированием UTC-момента в timezone гостя; клиент не делает арифметики поясов и не вычисляет `endAtUtc` (FR2.3).

### 9. Валидация формы — чистые функции, на submit

`validateGuestForm(draft): FieldError[]` в `@/features/guest/lib` реализует три правила спеки (`trim(name)`, `trim(email)`, `isEmail`); вызывается только из `createBooking` (`before`-хук): непустой результат → `validationError`, запрос не уходит. `isEmail` — консервативная структурная проверка (непустые локальная часть и домен вокруг `@`); авторитет — серверная валидация (MANUAL §9), 400 брони не создаёт. Тексты серверных ошибок — только через `errorMessage($error)` фундамента; сырой `message` гостю не показывается (FR3.7).

### 10. Адаптив — правило раскладки в коде экранов

`useWindowDimensions` + два константных значения в `@/design-system/layout` (не в `tokens.ts` — таких токенов в ките нет, это правило UX rules): максимум ширины контента 760 dp с центрированием и порог двух колонок 768 dp — для каталога и слотов. Число колонок `SlotGrid` экран вычисляет от доступной ширины при min ширине элемента 112 dp, минимум 2. У формы и подтверждения собственных правил раскладки нет — только ограничение ширины контента не применяется (спеки его не задают). Отдельных platform-файлов и отдельных экранов под web нет.

### 11. Проверка этапов: Э1–Э4 — Prism, Э5 — реальный API

Покомпонентная разработка и состояния экранов — против мока `:4010` (доступны только happy-path и HTTP-статусы) и против jest-фикстур `UseCaseResult`/`$error` (все ветви ошибок). Э5 — против `back-001` на `:3001`: web — экспорт с `EXPO_PUBLIC_API_BASE_URL=http://localhost:3001 … --clear` и прогон в браузере (образец — живой прогон фундамента), Android — эмулятор с `10.0.2.2:3001`. Сидирование — setup/admin-операциями контракта; контроль числа броней — `GET /admin/bookings`. Эмуляция обрыва сети обязана сохранять состояние API-процесса (блокировка запросов на стороне клиента/браузера или приостановка процесса — не рестарт); конкретный протокол шагов по платформам фиксируется в `plan.md` (FR5.3).

### 12. Тесты

- unit: все новые helpers (`@/shared/datetime`, `@/features/slots/lib`, `@/features/event-types/lib`, `validateGuestForm`) и редьюсеры экранов — включая порядок ветвей `refreshPublicSlots` и все три исхода `createBooking`;
- компонентные (RNTL 14, всё через `await`): восемь гостевых компонентов + переписанный `AppIcon`;
- контейнерные (RNTL): переходы состояний экранов через мок use-cases (jest.mock модуля `usecases/guest`) — семь состояний слотов, пять состояний формы, guard подтверждения, пара чтений каталога;
- редьюсер guest-flow: новый ключ на каждое `booking/init`, повтор с тем же ключом внутри одного монтирования.

Всё — в гейте `npm test -w @minical/client`. Переходы, проверяемые только против живого сервера (кадры 8, 9 end-to-end), — ручной протокол Э5 в `plan.md`/`result.md`, E2E-автотестов нет (non-goal).

## Затронутые компоненты

- `apps/client/package.json` — `@expo/vector-icons` в dependencies (через `npx expo install`).
- `apps/client/src/design-system/` — `components/AppIcon.tsx` (переписан), `components/InlineAlert.tsx` (новый), `layout/` (константы адаптива).
- `apps/client/src/features/guest/` — `screens/` (4 контейнера + 4 view + `generated/`, стабы удалены), `components/` (3 новых), `lib/` (`validateGuestForm`), `state/reducer.ts` (+ тесты) — семантика ключа.
- `apps/client/src/features/slots/` и `src/features/event-types/` — новые каталоги по registry.
- `apps/client/src/shared/datetime/`, `src/shared/forms/` — новые модули.
- `apps/client/src/navigation/GuestStack.tsx` — подключение контейнеров вместо стабов.
- `tasks/task-front-guest-002/generation-report.md` — отчёт первой генерации в клиент.
- Не затрагиваются: `packages/**` (контракт и generated), `apps/api`, `docs/ui-spec-kit/**` (non-goal), БД, `docs/architecture.md` (контур не меняется). API impact — `NONE`.

## Последствия и компромиссы

- **Поведение ключа идемпотентности меняется относительно живого прогона фундамента**: возврат к слотам и новое открытие формы теперь дают новый ключ (раньше — тот же). Это устраняет ловушку `DUPLICATE_BOOKING_ID` при смене слота; гарантия кадра 9 сохраняется, потому что при обрыве сети форма не размонтируется. Тесты фундамента на set-once переписываются — санкция brief FR3.4.
- **Сгенерированные типы — одноразовый перенос**: при будущем изменении спек экранов перенос `*.types.generated.ts` придётся повторить вручную. Приемлемо: изменение UISpec — отдельная `front-ui`-задача по определению.
- **Шрифты icon-семейств попадают в web-бандл** (Feather + MaterialCommunityIcons ≈ два font-файла). Приемлемо для учебного сервиса; сокращение до одного семейства возможно, если для `calendar-x`/`event-type` найдутся Feather-глифы.
- **Локаль `ru-RU` захардкожена** — i18n вне MVP; тексты спек русские.
- **`useFocusEffect`-конвенция неявна для читателя спек**: связь «возврат на экран → refresh» живёт в контейнере слотов. Компенсация — контейнерный тест на «второй фокус диспатчит refresh» и комментарий с ссылкой на UX rule.
- **Выбор слота живёт в локальном state экрана**: восстановление стека после выгрузки процесса выбор не сохранит — гость выберет заново; спеки этого и не требуют.
- Мок Prism не покрывает ветви ошибок и состояние — все негативные переходы до Э5 проверяются только фикстурами; риск расхождения с реальным сервером закрывается сквозной проверкой Э5.

## Рассмотренные альтернативы

- **Глобальный store состояний экранов (Redux/zustand/xstate)** — отклонён: состояния строго экранные, между экранами ходят route-параметры и guest-flow контекст; внешняя зависимость не окупается (решение ADR фундамента §6 продолжено).
- **TanStack Query для загрузки/refresh** — отклонён: refresh-семантика спек (`preserveContent`, ветвь `slotUnavailable`) ручная и точечная, кэш между экранами не нужен, use-cases уже есть; библиотека добавила бы второй слой состояний поверх StateMachine спек.
- **Поля формы в локальном state с копированием в контекст при уходе** — отклонён: два источника истины, риск потерять ввод при обрыве сети или системном «назад»; контекст уже спроектирован под черновик.
- **Ключ идемпотентности set-once до успеха (текущий фундамент)** — отклонён: противоречит спеке 14 и brief FR3.4; смена слота после возврата дала бы `DUPLICATE_BOOKING_ID`.
- **`navigation.goBack()` для конфликтных ветвей `createBooking`** — эквивалентен popTo при нынешней форме стека, отклонён в пользу явного `popTo('GuestSlots')`: выражает цель ветви буквально и не сломается, если между формой и слотами появится промежуточный route.
- **Polling слотов на экране** — отклонён: спека определяет обновление только на возврат (focus); конфликт при простое ловится тем же focus-refresh, а необнаруженный — сервером на submit.
- **MaterialCommunityIcons как единственное семейство** — отклонён: потребовал бы переименовать 12 из 14 имён (словарь `cloud-off → cloud-off-outline`, …); Feather совпадает со спеками почти 1:1, override нужен двум именам.
- **Перенос `*.generated.tsx` как основы view** — отклонён: заглушка без layout-логики, переписывалась бы целиком; ценность генератора — типы State/Action, они и переносятся.
- **date-fns/day.js/luxon** — отклонены: `Intl` покрывает всё форматирование задачи; зависимость и вес бандла без выгоды.

## Совместимость и миграция

Стаб-экраны фундамента заменяются целиком (так и задумано `front-guest-001`); route, их параметры и `GuestStackParamList` не меняются. Use-cases, маппер `$error`, дизайн-система и токены переиспользуются без правок; единственные изменения фундамента — `AppIcon` (санкция FR0.1, прежний props-API сохранён) и семантика `bookingKey` в редьюсере (санкция FR3.4, обновляются его тесты). `App.tsx` уже не содержит шаблонного текста и открывает гостевой каталог — FR5.4 выполняется фактом фундамента. Контракт, generated-пакеты, backend и UISpec Kit не меняются; `npm run uispec:validate` остаётся зелёным без правок кита. Обязательные проверки `AGENTS.md` применимы в полном составе, включая оба гейта приложений.
