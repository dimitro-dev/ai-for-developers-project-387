# Результат front/owner/001

## Итог

Все 22 пункта плана завершены, фаза «Проверка» пройдена полным набором обязательных гейтов.

Owner-флоу реализован в `apps/client` по UISpec-киту: все 11 экранов, навигация
`SetupCheck → OnboardingStack → OwnerTabs`, owner-модель и 7 admin-операций через generated SDK.
Backend, контракт и generated-пакеты не менялись (API impact `NONE`). Сквозные прогоны против
реального `back/001` выполнены на web (P20) и Android (P21); оба нашли по одному дефекту, оба
исправлены и покрыты тестами.

Итог по diff `main..task/front-owner-001-owner-screens`: 118 файлов в `apps/client`
(+10 470 / −47), из них 37 файлов тестов; вне клиента изменены только `package-lock.json`,
корневой `README.md` (режимы запуска) и документы самой задачи.

Работа велась в worktree `../minical-front-owner-001` на ветке
`task/front-owner-001-owner-screens`. Пока ветка не влита в `main`, `npm run task -- status`
из основного дерева показывает прогресс `0 из 22` — актуальное состояние видно из worktree.

## Что изменено

Сводка по фактическому diff ветки `task/front-owner-001-owner-screens`.

- **P01** — `@react-navigation/bottom-tabs` в `apps/client` (`npx expo install`, версия подобрана
  под Expo SDK 57); правка `transformIgnorePatterns` не потребовалась.
- **P02** — режим приложения: `apps/client/src/appMode.ts` (`EXPO_PUBLIC_APP_MODE`, статическое
  обращение, дефолт `guest`), ветвление корня в `App.tsx`.
- **P03** — `tokens.ts` синхронизирован с китом: dark `action.primary` `#4D86FF` → `#246BFD`,
  dark `action.primaryPressed` `#6A99FF` → `#1554D6`. Остальные группы токенов совпадали.
- **P04** — `rightActions` в `AppHeader` (тип `HeaderAction`, максимум две action, accessibility
  labels, touch target 48 dp).
- **P05** — хелперы: `features/availability/lib` (`formatAvailabilitySummary`, `formatWeekdays`),
  `features/owner/lib` (`generatePublicId`), `groupBookingsByOwnerDate` в `shared/datetime`.
- **P06** — каркасы девяти owner-экранов (01–03, 05–10) из UISpec в
  `features/owner/screens/generated/`; sheets 04 и 11 генератором не собираются (MANUAL §2.1).
- **P07** — `AppBottomSheet` (RN `Modal`, scrim, drag handle, backdrop/swipe/`onRequestClose`) и
  `ConfirmationDialog`.
- **P08** — `AppSelectField`: обычный список и `pickerMode="bottom-sheet"` с поиском (timezone).
- **P09** — `TimeField`, `WeekdaySelector`, `DurationSelector`.
- **P10** — кастомный таб-бар `OwnerBottomNavigation` + `BottomNavigationItem`; недостающие глифы
  в `AppIcon`.
- **P11** — `ProgressHeader`, `AnimatedSetupIllustration` (placeholder, `TODO-ASSET`).
- **P12** — `SettingsRow`, `MeetingCard`, `EventTypeCard`, `ScheduleCard`.
- **P13** — `features/owner/model` (types, mappers, словарь ошибок в каноне `$error`) и
  `features/owner/usecases` (все 7 admin-операций через `runOperation`).
- **P14** — owner-навигация: `OwnerRoot` (`SetupCheck → OnboardingStack → OwnerTabs`),
  `OwnerTabs` с кастомным `tabBar`, стеки `OnboardingStack`, `OwnerMeetingsStack`,
  `OwnerSettingsStack`, ручные param lists и их тест типов; ветвление корня по режиму в `App.tsx`.
- **P15** — экран 01 `SetupCheck`: контейнер + редьюсер + view, роутинг по `onboardingCompleted`,
  состояния `checking` / `error`.
- **P16** — экраны 02–04: `OnboardingProfile`, `OnboardingWorkingHours` и общий
  `AddWorkingHoursSheet` (создание и правка с префиллом, замена интервала, `ConfirmationDialog`
  перезаписи); submit — `completeAdminSetup`.
- **P17** — экраны 05 и 11: `OwnerMeetings` (две операции, группировка по датам владельца,
  refresh с `preserveContent`, empty со share `publicUrl`) и `BookingDetailsSheet` на пропсах.
- **P18** — экраны 06 и 10: `EventTypes` и `CreateEventType` (`DurationSelector`, автогенерация
  публичного id, `InlineAlert`, `DUPLICATE_EVENT_TYPE_ID → fieldErrors['public-id']`); поддержка
  `prefix` в `AppTextField`.
- **P19** — экраны 07–09: `OwnerSettings`, `OwnerProfileSettings`, `OwnerWorkingHoursSettings` —
  read-modify-write полным `SetupRequest`, dirty-гейт кнопок, sheet 04 из настроек.
- **P20** — исправление по итогам web-прогона: таб-бар искал вкладки по именам экранов вместо
  имён вкладок навигатора (`tabRoute` / `screenRoute` в дескрипторе), переход —
  `navigate(tabRoute, { screen: screenRoute })`; мок теста приведён к именам реального навигатора.
- **P21** — исправление по итогам Android-прогона: таб-бар больше не рендерится на экране 10
  (смотрит на сфокусированный route вложенного стека, список исключений `CreateEventType`).
- **P22** — фаза «Проверка»: полный набор гейтов, этот документ, режимы запуска клиента
  (`EXPO_PUBLIC_APP_MODE`, `EXPO_PUBLIC_API_BASE_URL`) в разделе «Запуск» корневого `README.md`,
  перегенерация `tasks/REGISTRY.md`.

## Контракт и generated-артефакты

Контракт (`packages/contracts/**`), `@minical/api-client` и `@minical/backend-contract` не
менялись — API impact `NONE`, `npm run generate` не запускался.

UISpec-каркасы экранов (`features/owner/screens/generated/**`) — производные `generate_scaffold.py`
по спекам кита.

Изменение спеки кита (по решению владельца 2026-08-17): в
`docs/ui-spec-kit/specs/ui/screens/09-owner-profile-settings.screen.md` добавлена модель
`<Model name="AvailabilityRule" source="api" schema="AvailabilityRule" />`. Причина: поле
`CalendarSettingsSnapshot.availabilityRules` имеет контрактный тип, но генератор эмитит импорт из
`@minical/api-client` только для моделей с `source="api"`, поэтому каркас экрана 09 не
компилировался. Правка минимальна и смысла модели не меняет. Сама спека в git не попадает —
`docs/` в `.gitignore`.

## База данных и миграции

Не затронуты.

## Выполненные проверки

Полный набор обязательных гейтов корневого `AGENTS.md`, прогон 2026-08-18 в worktree
`../minical-front-owner-001` на `task/front-owner-001-owner-screens`:

```text
npm run contracts:format:check  — ✔ 9 formatted
npm run generate:check          — перегенерация без diff в generated
npm run typecheck               — 0 ошибок (4 workspace)
npm test                        — контрактный gate: all contract validation checks passed
npm run uispec:validate         — Validated 40 files; errors=0
                                  (V10: approved=29, draft=11; V9 open: GAP-003, GAP-004)
npm run task:check              — 20 задач, 0 ошибок, 0 предупреждений
npm test -w @minical/api        — 71 / 71 pass, 0 fail
npm test -w @minical/client     — 59 suites / 453 tests passed
```

`GAP-003` и `GAP-004` остаются `open` штатно: это известные расхождения кита с контрактом,
зафиксированные в `contract-gaps.xml` и учтённые ADR (read-modify-write настроек), — валидатор
их не считает ошибкой. По ходу реализации после каждого пункта прогонялись гейты затронутой
области.

### P20 — сквозной прогон в браузере против реального `back/001`

Backend `apps/api` (`npm start`, порт 3001, in-memory), клиент — `expo start --web --clear` с
`EXPO_PUBLIC_APP_MODE=owner` и `EXPO_PUBLIC_API_BASE_URL=http://localhost:3001`. Состояние
backend на старте — чистое (`onboardingCompleted: false`).

| Сценарий brief | Проверено | Итог |
|---|---|---|
| **A.** Первый запуск и онбординг | SetupCheck → шаг 1 (имя, timezone-пикер с поиском) → шаг 2 (интервал, шаг слота) → `completeAdminSetup` → список встреч | пройден |
| **B.** Просмотр встреч | группировка по дате владельца, время в timezone владельца (08:00 UTC → 10:00 CEST), empty со share, sheet деталей | пройден |
| **C.** Типы событий | создание с автогенерацией id из кириллицы, чипы длительности, список с акцентом и полной подписью длительности | пройден |
| **D.** Настройки | сводка, правка профиля, правка рабочего времени и шага слота | пройден |

Acceptance criteria, проверенные вживую:

- **AC1** — без `EXPO_PUBLIC_APP_MODE` открывается гостевой корень (`GuestEventTypes`), гостевой
  каталог видит владельца и созданный тип: регрессии нет.
- **AC2** — повторный запуск настроенного приложения ведёт сразу на список встреч, онбординг не
  предлагается.
- **AC4** — дубль публичного id (409 `DUPLICATE_EVENT_TYPE_ID`) показан двумя каналами: баннер над
  формой и ошибка у поля id; введённые значения сохранены, серверный `message` не показан.
- **AC5** — на экране встреч запроса `/admin/event-types` нет (проверено по сетевому журналу
  вкладки); название типа берётся из `Booking.eventTypeName`. Sheet деталей не делает запросов.
- **AC6** — read-modify-write в обе стороны: сохранение профиля не потеряло `availabilityRules` и
  `slotIntervalMinutes`; сохранение рабочего времени не потеряло `displayName` и `timeZone`
  (сверено по `GET /admin/settings`).
- **AC7** — редактирование интервала открывает sheet с префиллом и заменяет исходный интервал
  (карточка одна, время обновилось).

Сборка: `npx expo export --platform web` — успешно (`web bundles (1)`, `Exported: dist`); каталог
`dist` после проверки удалён.

**Дефект, найденный прогоном и исправленный здесь же:** кастомный таб-бар в режиме `tabBar` искал
вкладки в `state.routes` по именам экранов (`OwnerMeetings`/`OwnerSettings`), тогда как табовый
навигатор регистрирует их под именами `<Tab id=...>` спеки (`MeetingsTab`/`SettingsTab`). Из-за
этого `route` всегда был `undefined`: вкладки не переключались и активный пункт не подсвечивался.
Юнит-тест пункта P10 дефект не ловил, потому что мок состояния повторял то же неверное допущение.
Исправлено разделением полей дескриптора (`tabRoute` — вкладка навигатора, `screenRoute` — корневой
экран вкладки), переход выполняется как `navigate(tabRoute, { screen: screenRoute })`; мок теста
приведён к именам реального навигатора.

### P21 — сквозной прогон на Android-эмуляторе

Pixel_Android_15 (Android 15, 1080×2400, жестовая навигация), Expo Go, тёмная тема системы.
Backend — тот же `apps/api` на 3001, клиент — `EXPO_PUBLIC_APP_MODE=owner` и
`EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:3001` (эмулятор видит хост как `10.0.2.2`).
Состояние backend на старте — чистое.

| Проверено | Итог |
|---|---|
| Сценарий A: онбординг целиком, `completeAdminSetup` | пройден, backend получил имя, timezone, интервал Пн–Пт 09:00–18:00, шаг 30 |
| Сценарий B: список встреч, группировка, sheet деталей | пройден, 06:00 UTC → 09:00 MSK в timezone владельца |
| Сценарий C: список типов и создание типа | пройден, тип `android-demo` создан с устройства |
| Сценарий D: сводка настроек, переключение вкладок | пройден |
| **Системная «назад» у sheets** | **оба sheet (04 «Добавить рабочее время» и 11 «Детали встречи») закрываются «назад», экран-родитель остаётся на месте** |
| Безопасные зоны | статус-бар не перекрывает шапку, жестовая полоса не перекрывает CTA и таб-бар; длинный контент доступен прокруткой |
| Тёмная тема | акцент `#246BFD` из синхронизированных токенов (P03) применён |

**Второе расхождение со спекой, найденное прогоном и исправленное здесь же:** таб-бар
показывался на экране 10 «Новый тип события». Из шести owner-экранов вкладок только спека 10 не
содержит `<BottomNavigation>`, но бар рисует табовый навигатор — сразу для всех экранов вкладки.
Теперь бар сам смотрит на сфокусированный route вложенного стека и не рендерится на route из
списка исключений (`CreateEventType`); поведение закреплено тестом и проверено на устройстве.

## Отклонения от brief / ADR / plan

1. **Расположение хелперов (ADR §7 vs реестр кита).** ADR §7 и формулировка P05 предполагали
   `features/owner/lib`, но `components.registry.xml` закрепляет за этими хелперами модули
   `@/features/availability/lib` (`formatAvailabilitySummary`, `formatWeekdays`,
   `toAvailabilityRules`, `formatDaysOff`, `overwriteMessage`, `applyDaysLabel`) и
   `@/shared/datetime` (`groupBookingsByOwnerDate`). Реализовано по реестру: он — источник правды
   для UI-артефактов, и на него же смотрят сгенерированные каркасы. В `features/owner/lib` остался
   `generatePublicId`, которого в реестре нет (вызывается действием экрана, а не bind-выражением).
   Решение владельца 2026-08-17: оставить по реестру, ADR не откатывать.

2. **Транслитерация кириллицы в `generatePublicId`.** Спека экрана 10 требует
   `^[a-z0-9]+(?:-[a-z0-9]+)*$`, но поведение для кириллических названий не описывает. Без
   транслитерации русское название давало бы пустой id и ломало UX-правило «id генерируется из
   названия», поэтому добавлена посимвольная транслитерация («Консультация» → `konsultaciya`).
   Подтверждено владельцем 2026-08-17.

3. **Формат сводки графика при нескольких правилах.** Реестр описывает формат для одного правила
   («Пн–Пт · 09:00–18:00»); для нескольких выбран разделитель «; ». Решение реализующего агента,
   задокументировано в коде и покрыто тестами.

4. **`Spacer flex=` в спеке `progress-header`.** Зарегистрированный `Spacer` поддерживает только
   вертикальный `size`; тот же результат достигнут `flex` + выравниванием подписи — приём, уже
   применённый в `AppHeader`. Внешний вид спеке соответствует.

5. **Time picker.** Спека `time-field` допускает native picker «или согласованный cross-platform»;
   выбран второй вариант (RN `Modal` со степперами часов и минут), чтобы не вводить новую
   зависимость. Работает одинаково на web и Android.

6. **`EventTypesFromSettings` и создание типа.** `navigation.uispec.xml` объявляет во вкладке
   «Настройки» route `EventTypesFromSettings`, но парного `CreateEventType` в ней нет, тогда как
   спека экрана 06 требует header action «Создать тип события» (`navigation.push` →
   `CreateEventType`). Единственный объявленный route создания живёт во вкладке «Встречи», поэтому
   действие переключает таб (`navigation/EventTypesFromSettingsScreen.tsx` — тонкая обёртка над тем
   же экраном), а `goBack` остаётся внутри вкладки «Настройки». Альтернатива — завести
   `CreateEventTypeFromSettings` в спеке навигации; это правка UISpec, то есть отдельная задача
   `front/ui`.

7. **Размер иконки ошибки на экране 01.** Спека 01 задаёт `size="48"` литералом, тогда как соседние
   error-состояния (05, 12, 13, 15) используют токен `$size.icon.large` (32) для того же глифа
   `cloud-off`. Хардкод размеров запрещён правилами зоны, поэтому взят токен — визуально иконка на
   16 dp меньше буквального значения спеки. Кандидат на мелкую правку спеки.

8. **Сообщение об ошибке на экране 03.** Спека объявляет состояние `error` со свойством `message`,
   но ни один элемент `<Layout>` его не выводит — сообщение было бы недостижимо. Добавлен
   `InlineAlert` по образцу серверной ошибки гостевой формы (экран 14). Кандидат на правку спеки.

9. **Кнопка «Назад» на экране 07.** Спека 07 не задаёт `backAction` у `<Header>`, в отличие от
   соседнего экрана 09, хотя оба открываются push’ем из сводки настроек. Реализовано строго по
   спеке: возврат — системной навигацией (жест или аппаратная кнопка). Похоже на несогласованность
   спек; решается отдельно.

10. **`activeTab="none"` экрана 06 недостижим.** Спека 06 объявляет бар с `activeTab="none"`
    (ни один пункт не подсвечен), но по ADR §2 бар — кастомный `tabBar` навигатора, а не элемент
    разметки экрана: для экрана внутри вкладки «Встречи» навигатор всегда подсвечивает свою
    вкладку. Это следствие принятого архитектурного решения; расхождение косметическое и не влияет
    на переходы.

11. **Дефолты, не заданные спеками.** Шаг слота в онбординге — 30 минут (спека 03 значения не
    задаёт; выбрано по аналогии с дефолтом длительности встречи из спеки 10). Client-only `id`
    рабочего интервала — счётчик поверх метки времени, а не UUID: значение служит только React-ключом,
    а `expo-crypto` в jest-окружении настоящий UUID не выдаёт.

## Известные ограничения и риски

- `AnimatedSetupIllustration` — placeholder с маркером `TODO-ASSET`: ассета `$asset.setup-check` в
  ките нет. То же относится к `$asset.network-error` экрана 08.
- Список timezone берётся из `Intl.supportedValuesOf('timeZone')`; при усечённом ICU используется
  зашитый фолбэк примерно из 32 основных зон.
- **Пробелы дизайн-системы, помеченные `TODO-COMPONENT`** (ни один не блокирует сценарии, все
  видны в коде по маркеру):
  - `IconButton` и `ProgressBar` реестра не заведены отдельными shared-компонентами — примитивы
    инлайнятся в местах употребления (паттерн `AppHeader`);
  - `ProgressIndicator` числится в реестре, но компонента нет: экран 01 использует RN
    `ActivityIndicator` с доступной подписью, чем и закрывает своё acceptance criteria;
  - `AppButton` не поддерживает `icon`, поэтому кнопка «Добавить рабочее время» (экраны 03 и 07)
    рисуется без глифа `plus`;
  - `AppTextField` не поддерживает `disabled`: на экране 09 в состоянии `saving` поле имени
    остаётся редактируемым (пикер timezone рядом дизейблится штатно), повторный submit при этом
    заблокирован.
- `$accessibility.reduceMotion` подключён локальным хуком внутри view экрана 01
  (`AccessibilityInfo`), общего провайдера для него в клиенте нет. Второму потребителю
  reduce motion хук придётся вынести в общее место.
- Экран 09 при неудачной первичной загрузке показывает форму с пустыми значениями (состояние
  `error` наследует `editing` по спеке). Save заблокирован, пока нет изменений, но снапшот
  настроек в этом сценарии пуст — задокументировано в коде как осознанный trade-off, отдельного
  acceptance criteria у этого edge case нет.
- Read-modify-write настроек (GAP-003) оставляет теоретическую гонку «последняя запись побеждает» —
  принято ADR: владелец один, среда учебная.
- Список встреч без пагинации — non-goal задачи.

## Описание для MR

### Summary

Owner-флоу клиента: все 11 экранов владельца по UISpec-киту, навигация
`SetupCheck → OnboardingStack → OwnerTabs`, owner-модель и 7 admin-операций через generated SDK
(`@minical/api-client`). Backend, TypeSpec-контракт и generated-пакеты не менялись — API impact
`NONE`, `npm run generate` не запускался.

Флоу выбирается переменной `EXPO_PUBLIC_APP_MODE` (`guest` по умолчанию, `owner` — новый корень).
Без переменной поведение гостевого клиента прежнее; auth в MVP нет, owner-режим — локальный
способ открыть экраны владельца, а не защищённая роль.

### Changes

- **Навигация** — `OwnerRoot`, `OwnerTabs` с кастомным таб-баром, стеки онбординга, встреч и
  настроек, ручные param lists; ветвление корня по режиму в `App.tsx`.
- **Экраны (11)** — 01 SetupCheck; 02–04 онбординг (профиль, рабочее время, sheet интервала);
  05 и 11 встречи и детали; 06 и 10 типы событий и создание; 07–09 настройки. Каждый экран —
  контейнер + чистый редьюсер + view + тесты состояний и действий с моком usecases.
- **Дизайн-система** — `AppBottomSheet`, `ConfirmationDialog`, `AppSelectField` с поиском,
  `TimeField`, `WeekdaySelector`, `DurationSelector`, `ProgressHeader`,
  `AnimatedSetupIllustration`, `SettingsRow`, `MeetingCard`, `EventTypeCard`, `ScheduleCard`,
  `OwnerBottomNavigation`; `rightActions` в `AppHeader`, `prefix` в `AppTextField`, новые глифы
  в `AppIcon`. Токены синхронизированы с китом (dark `action.primary` `#246BFD`).
- **Инфраструктура** — `@react-navigation/bottom-tabs`; режимы запуска клиента в корневом
  `README.md`.
- Объём: 118 файлов в `apps/client` (+10 470 / −47), из них 37 файлов тестов.

### Verification

Полный набор обязательных гейтов зелёный: `contracts:format:check`, `generate:check`,
`typecheck`, `npm test` (контрактный gate), `uispec:validate` (40 файлов, 0 ошибок),
`task:check`, `npm test -w @minical/api` (71/71), `npm test -w @minical/client`
(59 suites / 453 tests).

Сквозные прогоны против реального backend `back/001` — сценарии A–D из brief:

- **web** (`expo start --web`, `EXPO_PUBLIC_API_BASE_URL=http://localhost:3001`) — все четыре
  сценария пройдены, гостевой режим без регрессий, `expo export --platform web` успешен;
- **Android** (Pixel_Android_15, Expo Go, `http://10.0.2.2:3001`) — все четыре сценария,
  безопасные зоны, системная «назад» у обоих sheets, тёмная тема.

Каждый прогон нашёл по одному дефекту таб-бара (переключение вкладок; бар на экране 10) — оба
исправлены и закреплены тестами.

### Known limitations

- `AnimatedSetupIllustration` — placeholder `TODO-ASSET`: ассетов `$asset.setup-check` и
  `$asset.network-error` в ките нет.
- Пробелы дизайн-системы под маркером `TODO-COMPONENT`: `IconButton` / `ProgressBar` инлайнятся,
  `ProgressIndicator` заменён `ActivityIndicator`, `AppButton` без `icon`, `AppTextField` без
  `disabled`. Сценарии не блокируют.
- Список timezone — `Intl.supportedValuesOf('timeZone')` с зашитым фолбэком (~32 зоны) при
  усечённом ICU.
- Read-modify-write настроек (GAP-003) оставляет гонку «последняя запись побеждает» — принято
  ADR: владелец один, среда учебная.
- Список встреч без пагинации — non-goal задачи.
- Расхождения со спеками кита (11 пунктов раздела «Отклонения») задокументированы; кандидаты на
  правку спек решаются отдельно.
