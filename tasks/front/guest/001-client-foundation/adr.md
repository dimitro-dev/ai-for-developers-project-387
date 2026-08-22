# Architecture decision — TASK-front-guest-001

## Контекст

`apps/client` — нетронутый Expo-scaffold: Expo 57.0.8, React Native 0.86.0, React 19.2.3, react-native-web 0.21.2, TypeScript 6.0.3; `tsconfig.json` наследует `expo/tsconfig.base` (`moduleResolution: bundler`, `customConditions: ["react-native"]`, `jsx: react-jsx`). Продуктового кода, навигационных библиотек, тестовой инфраструктуры и собственной конфигурации Metro/Babel/Jest нет.

Согласованный `brief.md` адресовал этому ADR три открытых решения: место вызова `client.setConfig` и способ объявления зависимости (FR2), выбор тест-раннера при bundler-only `@minical/api-client` (FR8), навигационная библиотека для типизированного `GuestStack` (FR6).

Жёсткие входные ограничения:

- `components.registry.xml` уже фиксирует import-пути компонентов (`@/design-system/**`, `@/features/<domain>/**`, `@/shared/**`, `@/navigation/**`) — при этом alias `@/*` в tsconfig клиента не объявлен;
- `@minical/api-client` экспортирует сырой TS (`"exports": {".": "./src/generated/index.ts"}`); из Node ESM и NodeNext-режима `tsc` не импортируется; экспортируемый `client` создаётся без `baseUrl` (`task-infra-005/result.md`);
- `EXPO_PUBLIC_*` инлайнится в build-time и только при статическом обращении `process.env.EXPO_PUBLIC_API_BASE_URL` (dot-нотация; динамический доступ не инлайнится) — [docs.expo.dev/guides/environment-variables](https://docs.expo.dev/guides/environment-variables/);
- параметр route `GuestBookingConfirmation` — объект `booking: Booking`; черновик формы гостя (PII) не должен попадать в URL и историю браузера (brief FR7);
- Metro в SDK 57 автоконфигурируется для npm workspaces через `expo/metro-config`, ручной `metro.config.js` не нужен ([docs.expo.dev/guides/monorepos](https://docs.expo.dev/guides/monorepos/)).

## Решение

### 1. Навигация — `@react-navigation/native` + native-stack

`@react-navigation/native` 7.x и `@react-navigation/native-stack` с обязательными `react-native-screens` и `react-native-safe-area-context`; версии — через `npx expo install` (совместимость с SDK 57). `GuestStack` описывается кодом в `@/navigation/` 1:1 по `navigation.uispec.xml`; `GuestStackParamList` типизируется вручную по `<Param>` четырёх route (генератор кита route-типы не даёт — roadmap). Linking на web не настраивается: state навигации не синхронизируется с URL/history, параметры (включая объект `booking`) живут в памяти JS.

Это **осознанное отклонение от рекомендации Expo** (expo-router для новых приложений): URL-first модель expo-router типизирует параметры как строки и рассчитана на их сериализацию в URL, что несовместимо с объектным параметром `booking` и требованием «PII не в URL».

### 2. Тесты — jest-expo

`jest-expo` (dist-tag `sdk-57`, линейка jest 29) + `@testing-library/react-native`; установка `npx expo install jest-expo jest @types/jest --dev`. Скрипт `"test": "jest"` в `apps/client/package.json`, запуск — `npm test -w @minical/client`; команда добавляется в «Обязательные проверки» корневого `AGENTS.md` (пункт plan). Единственный раннер из версионированных доков Expo v57 ([docs.expo.dev/develop/unit-testing](https://docs.expo.dev/develop/unit-testing/)); покрывает и чистые модули фундамента (маппер, state), и будущие компонентные тесты `front-guest-002`.

В `transformIgnorePatterns` к стандартному whitelist jest-expo явно добавляется `@minical/*` — workspace-пакет отдаёт сырой TS и обязан проходить babel-transform. Кейс «workspace-пакет с `exports` на `.ts`» в доках Expo не разобран, поэтому первым пунктом plan идёт спайк: jest-тест импортирует `client` из `@minical/api-client`. Fallback при провале спайка — `moduleNameMapper` на `packages/api-client/src/generated/index.ts`.

### 3. Alias `@/*` и структура `src/`

В `apps/client/tsconfig.json` добавляются `"baseUrl": "."` и `"paths": {"@/*": ["./src/*"]}`. Metro в SDK 57 понимает tsconfig paths из коробки; Jest получает зеркальный `moduleNameMapper` (`"^@/(.*)$": "<rootDir>/src/$1"`). Структура `src/` следует путям, зафиксированным registry, и дополняется транспортным слоем:

```text
src/
├── api/                 client init, config (base URL), маппер ошибок → $error
├── design-system/       tokens.ts + компоненты по registry (layout/, components/)
├── features/guest/      use-cases, DTO→view-model мапперы, state-контейнер, стаб-экраны
├── navigation/          GuestStack, GuestStackParamList
└── shared/              ui-state (StateView), datetime (TimezoneLabel) — по registry
```

Слой `@/api/` в registry не описан (registry фиксирует только UI-пути) — это дополнение структуры, а не параллельная альтернатива ей.

### 4. Init generated SDK и base URL

Модуль `@/api/config.ts` читает `process.env.EXPO_PUBLIC_API_BASE_URL` статической dot-нотацией; дефолт — Prism `http://localhost:4010`, для Android-эмулятора — `http://10.0.2.2:4010` через `Platform.select`. Явная функция `configureApiClient()` (внутри — `client.setConfig({ baseUrl })`) вызывается в bootstrap `App.tsx` до первого рендера. Side-effect-инициализация при импорте отвергнута: порядок импортов неявен, в тестах конфигурацию нужно вызывать управляемо.

Зависимость объявляется по конвенции репозитория: `"@minical/api-client": "*"` в `dependencies` (образец — `apps/api` → `"@minical/backend-contract": "*"`). Это закрывает пункт 4 «Известных ограничений» `task-infra-005/result.md`.

### 5. Маппер ошибок

`@/api/errors.ts` — единственная точка приведения ответа/исключения SDK к каноническому `$error = {code: string | null, message: string | null, transport: boolean}` (`MANUAL.md` §6.4) плюс словарь человекочитаемых текстов для девяти кодов гостевого сценария и fallback для неизвестных (включая внеконтрактные `NOT_FOUND`, `INTERNAL_ERROR`, `PAYLOAD_TOO_LARGE`). Покрывается jest-тестами на фикстурах `ErrorResponse`; Prism для проверки кодов непригоден (тела 4xx — плейсхолдеры, `task-infra-004/result.md`).

### 6. Guest-flow state — React Context + useReducer

Контейнер ветки в `@/features/guest/state/`: провайдер оборачивает `GuestStack`. Черновик формы `{name, email, note}` живёт только в памяти — brief требует пережить возврат на экран слотов, а не перезапуск приложения. Ключ идемпотентности `CreateBookingRequest.id` — `Crypto.randomUUID()` из `expo-crypto` (кроссплатформенная гарантия; глобальный `crypto.randomUUID` в Hermes не гарантирован), генерируется при первой попытке отправки и сохраняется в контейнере до успешного ответа. Внешние state-библиотеки не вводятся.

### 7. Токены — ручной перенос в типизированный модуль

Шесть XML-файлов `specs/ui/tokens/` переносятся одноразово вручную в `@/design-system/tokens.ts`: имена сохраняются (`color.action.primary` → `colors.action.primary`), light/dark переносятся оба, единицы — по `MANUAL.md` §4. Кодогенератор токенов не пишется; спек-сторону стережёт валидатор кита (`npm run uispec:validate`). Базовые компоненты (17 по FR1) реализуются вручную по props/именам/путям registry; скаффолд-генератор кита применяется позже, со спеками экранов в `front-guest-002`.

### 8. Граница «генерируемое / ручное»

Всё, что умеют генераторы проекта, берётся только из генераторов. HTTP-слой целиком — из TypeSpec: функции операций, DTO-типы и `ErrorResponse` приходят из `@minical/api-client`, ручных копий и обходов нет. Типы состояний экранов и каркасы view — из скаффолд-генератора кита; он включается в `front-guest-002` вместе со спеками экранов (фундамент делает стабы — генератору здесь нечего генерировать). Generated-файлы read-only.

Ручной код этой задачи — ровно две категории: **(а) документированные пробелы генератора кита** (roadmap `AUDIT.md`): типы route-параметров `GuestStackParamList`, перенос токенов в `tokens.ts`, тестовые каркасы; **(б) принципиально не генерируемое**: тела 17 базовых компонентов (registry задаёт их контракт — имена, props, import-пути, — но не реализацию), маппер ошибок, `configureApiClient()`, state-контейнер. Усиление генерации (кодоген токенов и route-типов в самом ките) — возможные будущие `front-ui`-задачи; фундамент на них не блокируется.

## Затронутые компоненты

- `apps/client/**` — весь новый код (`src/`), `tsconfig.json` (paths), `package.json`: dependencies `@minical/api-client "*"`, `@react-navigation/native`, `@react-navigation/native-stack`, `react-native-screens`, `react-native-safe-area-context`, `expo-crypto`; devDependencies `jest-expo`, `jest`, `@types/jest`, `@testing-library/react-native`; scripts `test`.
- Корневой `AGENTS.md` — добавление `npm test -w @minical/client` в «Обязательные проверки» (пункт plan).
- Не затрагиваются: TypeSpec-контракт и generated-пакеты, `apps/api`, UISpec-файлы, БД. API impact — `NONE`.

## Последствия и компромиссы

- **Нет URL-адресации гостевого флоу на web в MVP** (следствие отказа от expo-router и linking): шарить ссылку на конкретный экран нельзя. Приемлемо для MVP; если понадобятся deep links / шаримые URL — отдельная задача с пересмотром типа параметра `booking` (передавать `bookingId`).
- **Линейка jest 29** — фиксируется peer-требованиями `jest-expo@57`; переход на jest 30 возможен только вместе с обновлением SDK.
- **Риск транспиляции workspace-TS в jest** — закрыт спайком в начале plan; fallback — `moduleNameMapper` (см. Решение §2).
- **Base URL фиксируется при сборке** (build-time env): переключение мок ↔ реальный API требует перезапуска с другим `EXPO_PUBLIC_API_BASE_URL`, runtime-переключателя нет — осознанно, среда учебная.
- **Черновик не переживает перезагрузку** страницы/приложения — соответствует brief; персистентность не вводится.
- Появляется слой `@/api/`, не описанный в registry, — зафиксирован здесь как расширение структуры.

## Рассмотренные альтернативы

- **expo-router** — рекомендация Expo, file-based routing, deep links «бесплатно». Отклонён: параметры — URL-строки (объект `booking` пришлось бы сериализовать или менять контракт route в обход UISpec), PII-требование FR7 потребовало бы обходного хранилища, типизация route слабее ручного ParamList.
- **node --test** (конвенция `apps/api`) — отклонён: `@minical/api-client` bundler-only и из Node ESM не импортируется; RN-компонентам нужно jsdom/RN-окружение. Унификация раннера между api и client невозможна буквально.
- **vitest / гибрид vitest+jest** — отклонён: в версионированных доках Expo v57 не упомянут (а `apps/client/AGENTS.md` требует опираться именно на них); RN-пресета нет — компонентные тесты позже потребовали бы второго раннера, две конфигурации моков.
- **Side-effect `setConfig` при импорте модуля** — отклонён: неявный порядок инициализации, неуправляемость в тестах.
- **zustand / redux / xstate** для guest-flow — отклонены: для одной ветки с черновиком формы достаточно Context+useReducer, ноль новых зависимостей.
- **AsyncStorage для черновика** — отклонён: brief требует пережить возврат по стеку, не перезапуск; YAGNI.
- **Кодогенератор токенов из XML** — отклонён: шесть небольших файлов переносятся одноразово; генератор — отдельная инфраструктура без второго потребителя.

## Совместимость и миграция

Существующего продуктового кода в клиенте нет — миграция не требуется. `front-guest-002` строится поверх без пересборки каркаса: заменяет содержимое стаб-экранов и переиспользует use-cases, маппер, state-контейнер и навигацию. Версии новых зависимостей ставятся `npx expo install` (гарантия совместимости с SDK 57) и фиксируются в корневом `package-lock.json`. Архитектурный контур `docs/architecture.md` не меняется: модульный монолит сохраняется, клиент остаётся не-источником истины по слотам и занятости; обновление `docs/architecture.md` не требуется.
