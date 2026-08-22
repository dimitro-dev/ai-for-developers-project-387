# Результат TASK-front-guest-001

## Итог

Клиентский фундамент гостевой ветки заложен целиком: `apps/client` из пустого Expo-scaffold стал приложением с дизайн-системой по registry, конфигурацией base URL, обвязкой generated SDK, маппером ошибок в канон `$error`, guest-flow состоянием с ключом идемпотентности, типизированной навигацией `GuestStack` и работающей тестовой инфраструктурой (jest-expo, 74 теста).

Все одиннадцать пунктов `plan.md` (P01–P11) — `завершено`. Пять acceptance criteria brief закрыты, причём AC1–AC4 подтверждены не только тестами, но и живым прогоном web-сборки против реального API `back-001` (`:3001`).

Главный технический риск задачи — транспиляция workspace-пакета `@minical/api-client`, отдающего сырой TS, — снят спайком P01 **без fallback**: достаточно было добавить `@minical` в whitelist `transformIgnorePatterns`; `moduleNameMapper` на `packages/api-client/src/generated/index.ts` не понадобился.

## Что изменено

### Конфигурация клиента

- `apps/client/package.json` — dependencies: `@minical/api-client "*"` (закрывает п. 4 «Известных ограничений» `task-infra-005/result.md`), `@react-navigation/native` ^7.3.16, `@react-navigation/native-stack` ^7.18.8, `react-native-screens` ~4.26.0, `react-native-safe-area-context` ~5.7.0, `expo-crypto` ~57.0.1; devDependencies: `jest-expo` ~57.0.4, `jest` ~29.7.0, `@types/jest` 29.5.14, `@testing-library/react-native` ^14.0.1. Версии Expo-пакетов поставлены `npx expo install` (совместимость с SDK 57). Скрипт `test: jest`. Секция `jest`: preset `jest-expo`, `transformIgnorePatterns` = whitelist пресета + `@minical`, `moduleNameMapper` `^@/(.*)$` → `<rootDir>/src/$1`.
- `apps/client/tsconfig.json` — `paths {"@/*": ["./src/*"]}`, `types: ["jest"]`.
- `apps/client/App.tsx` — bootstrap: `configureApiClient()` до первого рендера, затем `SafeAreaProvider` → `GuestFlowProvider` → `NavigationContainer` (без `linking`) → `GuestStack`.

### Новый код (`apps/client/src/`, 30 модулей + 10 тестовых файлов)

| Слой | Файлы | Назначение |
|---|---|---|
| `api/` | `config.ts`, `errors.ts` | base URL + `client.setConfig`; приведение ответа SDK к `$error` и словарь текстов |
| `design-system/` | `tokens.ts`, `theme.ts`, `layout/` (`Row`, `Column`, `Center`, `AppScrollView`, `Spacer`, `box.ts`), `components/` (`AppText`, `AppIcon`, `AppImage`, `AppButton`, `AppTextField`, `AppHeader`, `EmptyState`, `Skeleton`, `ValidationMessage`, `TimezoneLabel`) | 15 из 17 компонентов FR1 + токены |
| `shared/ui-state/` | `StateView`, `Repeat` | оставшиеся 2 компонента FR1 |
| `features/guest/model/` | `types.ts`, `mappers.ts` | view-model, отдельные от DTO (MANUAL §6.5) |
| `features/guest/usecases/` | `result.ts`, `guest.ts` | `UseCaseResult<T>`; четыре use-case поверх generated SDK |
| `features/guest/state/` | `reducer.ts`, `GuestFlowProvider.tsx` | черновик формы и ключ идемпотентности |
| `features/guest/lib/` | `newBookingKey.ts` | helper `newBookingKey` из registry (UUID через `expo-crypto`) |
| `features/guest/screens/` | четыре `*StubScreen.tsx` | стаб-экраны четырёх route |
| `navigation/` | `GuestStackParamList.ts`, `GuestStack.tsx` | типы параметров 1:1 по `navigation.uispec.xml`; native-stack |

### Документы

- Корневой `AGENTS.md` — `npm test -w @minical/client` добавлен в «Обязательные проверки»; абзац про раннеры переписан под два гейта приложений; поддерево `apps/client/` в карте репозитория актуализировано.
- `README.md` — строка `npm test -w @minical/client` в таблице команд.
- `tasks/README.md` — реестр и очередь обновлены.

## Контракт и generated-артефакты

Не затронуты. `npm run generate:check` — без diff. Ручных правок в `packages/*/generated/**` нет; весь HTTP-слой клиента импортируется из `@minical/api-client` (функции операций и DTO-типы), ручных копий контрактных типов нет.

## База данных и миграции

Не затронуты (`packages/database` остаётся пустым).

## Выполненные проверки

Корневые гейты и гейты приложений:

```text
npm run contracts:format:check   ✔ 9 formatted
npm run generate:check           OK — diff в generated отсутствует
npm run typecheck                OK (api, client, api-client, backend-contract)
npm test                         ✅ All contract validation checks passed (uispec:validate + контрактный gate)
npm test -w @minical/api         tests 71 / pass 71 / fail 0
npm test -w @minical/client      Test Suites 10 passed, Tests 74 passed
npx expo export --platform web   Exported: dist (508 modules, 798KB)
```

Статический анализ — это `tsc --noEmit` в strict-режиме по всем workspaces: отдельного линтера (ESLint/Biome) в репозитории нет ни в одном пакете, задача его не вводила. `any` и `@ts-ignore` в новом коде отсутствуют.

### Живой e2e-прогон (web, Playwright, реальный API `back-001`)

Сборка `EXPO_PUBLIC_API_BASE_URL=http://localhost:3001 npx expo export --platform web --clear`, раздача `dist` статикой, backend — `npm start -w @minical/api` с завершённым онбордингом и двумя типами встреч.

| Проверка | Результат |
|---|---|
| AC2 — запросы через generated SDK на base URL из env | `GET http://localhost:3001/calendar` → 200 и `GET http://localhost:3001/event-types` → 200 в network log; на экране «Дмитрий Масленников», «Типов встреч получено: 2» |
| AC1 — четыре route живьём | `GuestEventTypes` → `GuestSlots` → `GuestBookingForm` → `GuestBookingConfirmation`; на экране слотов видны все четыре параметра, включая опциональный `eventTypeDescription`; на подтверждении — поля объекта `booking` |
| ADR §1 — навигация не в URL | адрес остаётся `http://localhost:8090/` на всех четырёх экранах; объектный параметр `booking` и черновик формы в URL и историю не попадают |
| AC4 — черновик и ключ | введены «Анна Петрова» / `anna@example.com`, выдан ключ `90cde501-…`; возврат на слоты и повторный переход в форму — те же значения и **тот же** ключ (`expo-crypto` `randomUUID()` работает на web) |
| AC3 — транспортная ошибка | backend остановлен → «Нет связи с сервером…» (ветка `$error.transport == true`) |
| AC3 — код ошибки сервера | backend перезапущен без онбординга → «Календарь пока не настроен — записаться не на что.» (ветка `$error.code == 'CALENDAR_NOT_CONFIGURED'`) |
| Консоль браузера | ошибок нет (кроме ожидаемых `Failed to load resource` в сценарии с выключенным backend) |

Android не проверялся — brief этого не требует, окружение эмулятора в сессии не поднималось.

## Отклонения от brief / ADR / plan

1. **`baseUrl` в tsconfig не добавлен** (ADR §3 предполагал `baseUrl` + `paths`). TypeScript 6.0.3 отвечает на него ошибкой `TS5101: Option 'baseUrl' is deprecated and will stop functioning in TypeScript 7.0`. `paths` работает и без него — относительно каталога tsconfig. Alias проверен резолвом и в `tsc`, и в jest, и в Metro (web-экспорт собирается).
2. **`TimezoneLabel` лежит в `@/design-system/components/`**, а не в `@/shared/datetime/` как написано в P05. Путь взят из `components.registry.xml` — plan сам объявляет реестр источником правды по путям компонентов; в `@/shared/datetime` реестр помещает helper-функции (`formatTime`, `dateLabel`, …), а не компонент.
3. **Добавлен `@/design-system/theme.ts`** — хук `useColors()` поверх `useColorScheme()`. ADR §7 говорит только про `tokens.ts`; чтобы `tokens.ts` остался чистыми данными без импорта react-native (и был пригоден для будущего кодогенератора), выбор светлой/тёмной палитры вынесен в соседний модуль.
4. **Добавлен `@/features/guest/lib/newBookingKey.ts`** — это не новая сущность, а реализация helper'а `newBookingKey`, уже объявленного в `<Helpers>` реестра с точно этим модулем-владельцем.
5. **`AppIcon` — временный плейсхолдер без библиотеки иконок.** `@expo/vector-icons` в зависимостях клиента нет, а их состав зафиксирован ADR; ставить пакет вне задачи не стали. Компонент рендерит токен-размерный прямоугольник, сохраняя `name` в props и `testID`. Подробности — в «Известных ограничениях».
6. **Стаб-экраны богаче минимума.** Plan требовал «отображение параметров» и один пробный вызов use-case на каталоге. Стабы дополнительно показывают черновик формы, ключ идемпотентности и ветки ошибок — это то, чем AC1–AC4 проверяются вживую, а не только тестами; `front-guest-002` заменяет их содержимое целиком.
7. **Поле `$error.message` не показывается гостю.** MANUAL §6.4 требует хранить в `$error.message` серверный `ErrorResponse.message`; он на английском и адресован разработчику. Канон соблюдён буквально, а текст для гостя отдаёт отдельная функция `errorMessage($error)` по словарю кодов.

## Известные ограничения и риски

1. **Иконок нет.** `AppIcon` — плейсхолдер (см. отклонение 5). До реализации гостевых экранов нужно решение: `npx expo install @expo/vector-icons` и маппинг имён из спеков (`cloud-off`, `calendar-x`, `event-type`, `info`, …) на глифы — работа для `front-guest-002` или отдельной UI-задачи.
2. **Смена `EXPO_PUBLIC_*` требует `--clear`.** Metro кэширует результат трансформации, и повторный `expo export` с другим значением переменной отдаёт бандл со **старым** инлайненным base URL. Проверено: без `--clear` в бандле остался `localhost:4010` вместо заданного `localhost:3001`. Правило: меняешь env — экспортируй с `--clear`.
3. **Раскладки экранов нет.** Реализованы контракты компонентов (имена, props, токены), а не композиция кадров макета: адаптив (760 dp контент, две колонки от 768 dp), состояния `Skeleton`-вариантов и восемь гостевых компонентов — за `front-guest-002`.
4. **Коды ошибок проверены только фикстурами и точечно вживую.** Полный словарь из двенадцати кодов покрыт jest-тестами на фикстурах `ErrorResponse`; в браузере подтверждены две ветки (`transport` и `CALENDAR_NOT_CONFIGURED`). Prism для проверки кодов по-прежнему непригоден (тела 4xx — плейсхолдеры, `task-infra-004/result.md`).
5. **Черновик не переживает перезагрузку** страницы или приложения — так требует brief FR7 (пережить возврат по стеку, а не рестарт); персистентности нет.
6. **Web без URL-адресации** (следствие отказа от expo-router и `linking`, ADR §1): ссылку на конкретный экран гостевого флоу шарить нельзя. Подтверждено прогоном — адрес не меняется. Если понадобятся deep links, это отдельная задача с пересмотром типа параметра `booking`.
7. **Линейка jest 29** зафиксирована peer-требованиями `jest-expo@57`; переход на jest 30 — только вместе с обновлением SDK.
8. **`@testing-library/react-native` 14 полностью асинхронный**: `render`, `renderHook`, `act`, `rerender`, `unmount` возвращают промисы и требуют `await`. Синхронный вызов даёт `TypeError: Cannot read properties of undefined (reading 'current')` — ловушка при переносе примеров из доков более старых версий.

## Описание для MR

### Summary

Клиентский фундамент гостевой ветки MiniCal: `apps/client` получил дизайн-систему по UISpec-реестру, конфигурацию base URL с явным `client.setConfig`, обвязку generated SDK, единый маппер ошибок в канон `$error`, guest-flow состояние с ключом идемпотентности, типизированную навигацию `GuestStack` со стаб-экранами и тестовую инфраструктуру на jest-expo. Экраны реализует следующая задача — `front-guest-002`.

### Changes

- `apps/client/src/design-system/` — токены (перенос шести XML-файлов, обе цветовые схемы) и 15 базовых компонентов по `components.registry.xml`; ещё два (`StateView`, `Repeat`) — в `src/shared/ui-state/`.
- `apps/client/src/api/` — `resolveApiBaseUrl()`/`configureApiClient()` (`EXPO_PUBLIC_API_BASE_URL`, дефолт Prism `:4010`, Android `10.0.2.2`) и маппер ошибок в `{code, message, transport}` со словарём текстов двенадцати кодов.
- `apps/client/src/features/guest/` — view-model и мапперы, четыре use-case поверх generated SDK, Context+useReducer для черновика формы и ключа идемпотентности, четыре стаб-экрана.
- `apps/client/src/navigation/` — `GuestStackParamList` 1:1 по `navigation.uispec.xml` и native-stack навигатор; `App.tsx` собран как bootstrap.
- Тестовая инфраструктура: `jest-expo`, `@testing-library/react-native`, команда `npm test -w @minical/client`, 74 теста; команда добавлена в «Обязательные проверки» `AGENTS.md` и в `README.md`.

### Verification

`npm run contracts:format:check`, `npm run generate:check`, `npm run typecheck`, `npm test`, `npm test -w @minical/api` (71), `npm test -w @minical/client` (74), `npx expo export --platform web` — всё зелёное. Плюс живой прогон web-сборки в браузере против реального API `back-001`: четыре route открываются с типизированными параметрами, запросы уходят на base URL из переменной окружения, черновик и ключ идемпотентности переживают возврат по стеку, обе ветки ошибок (`transport` и код сервера) показывают правильные тексты.

### Known limitations

Иконки — временный плейсхолдер без icon-библиотеки; смена `EXPO_PUBLIC_*` требует `expo export --clear`; раскладок экранов и восьми гостевых компонентов ещё нет (`front-guest-002`); web-флоу без URL-адресации (осознанно, ADR §1); черновик не переживает перезагрузку.
