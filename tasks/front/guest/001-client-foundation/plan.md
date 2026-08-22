# План TASK-front-guest-001

Декомпозиция по согласованным `brief.md` (FR1–FR8) и `adr.md` (§1–§8). Все новые файлы — в `apps/client/src/` по структуре ADR §3; пути компонентов — строго по `components.registry.xml`.

## Декомпозиция

| ID | Цель / проблема | Решение | Состояние |
|---|---|---|---|
| P01 | Спайк: снять главный риск FR8 — умеет ли jest транспилировать workspace-пакет `@minical/api-client`, отдающий сырой TS | `npx expo install jest-expo jest @types/jest --dev` + `npm i -D @testing-library/react-native -w @minical/client`; объявить `"@minical/api-client": "*"` в `dependencies` (нужно самому спайку, закрывает FR2-часть); jest-конфиг: preset `jest-expo`, `transformIgnorePatterns` с `@minical/*`, скрипт `"test": "jest"`. Смок-тест импортирует `client` и `getPublicCalendar` из `@minical/api-client`. Fallback при провале — `moduleNameMapper` на `packages/api-client/src/generated/index.ts`; итог спайка зафиксировать в `result.md` | завершено |
| P02 | Alias `@/*` из registry не объявлен — без него ни один import-путь компонентов не резолвится | В `apps/client/tsconfig.json` — `baseUrl` + `paths {"@/*": ["./src/*"]}`; в jest-конфиг — зеркальный `moduleNameMapper "^@/(.*)$" → <rootDir>/src/$1`; каркас каталогов `src/{api,design-system,features/guest,navigation,shared}`; проверить alias резолвом в `tsc` и jest (Metro проверится в P10 через `expo export`) | завершено |
| P03 | Токены существуют только как XML-спеки — коду не на что ссылаться (FR1, ADR §7) | Ручной одноразовый перенос шести файлов `specs/ui/tokens/*.xml` в типизированный `@/design-system/tokens.ts`: имена сохраняются (`color.action.primary` → `colors.action.primary`), light/dark — оба, единицы по `MANUAL.md` §4 | завершено |
| P04 | Базовые компоненты: layout и статические (часть 17 из FR1) | По props/именам/путям registry: `Row`, `Column`, `Center`, `ScrollView`, `Spacer`, `Header` (`@/design-system/layout/*`), `Text`, `Icon`, `Image`, `Skeleton` (`@/design-system/components/*`). Только токены, без хардкода значений | завершено |
| P05 | Базовые компоненты: интерактивные и state (остаток 17 из FR1) | `Button`, `TextField`, `ValidationMessage`, `EmptyState` (`@/design-system/components/*`), `StateView`, `Repeat` (`@/shared/ui-state/*`), `TimezoneLabel` (`@/shared/datetime/*`). Рендер-смоук jest для `Button` и `StateView` — проверка, что jest-окружение рендерит RN-компоненты | завершено |
| P06 | Init generated SDK: без `client.setConfig` запросы уйдут по относительному адресу (FR2, FR3, ADR §4) | `@/api/config.ts`: статическое `process.env.EXPO_PUBLIC_API_BASE_URL`, дефолт Prism `:4010`, Android-эмулятор `10.0.2.2` через `Platform.select`; `configureApiClient()` с `client.setConfig({ baseUrl })`; вызов в bootstrap `App.tsx` до рендера. Jest-тест: после вызова конфиг клиента содержит ожидаемый `baseUrl` | завершено |
| P07 | Маппер ошибок: канон `$error` (FR5, ADR §5) — без него состояния ошибок экранов недостижимы | `@/api/errors.ts`: приведение ответа/исключения SDK к `{code, message, transport}`; словарь текстов девяти кодов гостевого сценария + fallback (включая внеконтрактные `NOT_FOUND`, `INTERNAL_ERROR`, `PAYLOAD_TOO_LARGE`). Jest-тесты на фикстурах `ErrorResponse`: все девять кодов, fallback, `transport: true` при обрыве сети (AC3) | завершено |
| P08 | Use-cases и DTO→view-model мапперы четырёх операций (FR4) | `@/features/guest/`: use-cases `loadPublicEventTypes`+`loadPublicCalendar` (экран каталога — оба чтения), `loadPublicSlots`, `createBooking` поверх generated SDK; view-model типы отдельно от DTO; jest-тесты мапперов на фикстурах ответов | завершено |
| P09 | Guest-flow state: черновик формы и ключ идемпотентности (FR7, ADR §6) | `npx expo install expo-crypto`; `@/features/guest/state/`: Context + useReducer, черновик `{name, email, note}`, ключ `CreateBookingRequest.id` = `Crypto.randomUUID()` при первой попытке отправки, живёт до успеха. Jest-тесты reducer'а: черновик переживает возврат на слоты; повторная отправка — тот же ключ (AC4) | завершено |
| P10 | Навигация: типизированный `GuestStack` со стаб-экранами (FR6, AC1, ADR §1) | `npx expo install @react-navigation/native @react-navigation/native-stack react-native-screens react-native-safe-area-context`; `@/navigation/`: `GuestStackParamList` вручную по `navigation.uispec.xml`, `NavigationContainer` без linking; четыре стаба из компонентов дизайн-системы с отображением параметров; стаб каталога делает пробный вызов use-case (живое доказательство AC2 против Prism); сборка bootstrap в `App.tsx` (`configureApiClient` → провайдер state → навигация). Type-тест с `@ts-expect-error`: лишний/пропущенный параметр ловится компилятором | завершено |
| P11 | Гейты, документация, приёмка (AC1–AC5, НФТ) | Прогнать: `npm run typecheck -w @minical/client`, `npm test -w @minical/client`, `expo export --platform web`, корневые `contracts:format:check` / `generate:check` / `typecheck` / `npm test`; ручной смоук web против Prism (Android — при доступном окружении, brief этого не требует); добавить `npm test -w @minical/client` в «Обязательные проверки» корневого `AGENTS.md`; финализировать `result.md`, обновить реестр `tasks/README.md` | завершено |

Допустимые состояния:

```text
в плане
выполняется
завершено
```

## Порядок и зависимости

Строго первым — P01 (спайк, главный технический риск; провал меняет jest-конфиг, а не архитектуру). Затем P02 (alias — предпосылка всех import-путей). Дальше две независимые линии, порядок между ними свободный: UI-линия P03 → P04 → P05 (токены → компоненты) и API-линия P06 → P07 → P08 (init → маппер → use-cases). P09 требует P08 (тип `CreateBookingRequest`), P10 требует обе линии (стабы — из компонентов, пробный вызов — из use-case) и P09 (провайдер в bootstrap). P11 — последним.

Правки `AGENTS.md` («Обязательные проверки») и `tasks/README.md` — только в P11, чтобы гейт не требовал ещё не существующей команды.

## Блокеры и открытые вопросы

- Единственный технический риск — транспиляция workspace-TS в jest — вынесен в P01 с готовым fallback (ADR §2); блокером задачи не является.
- Prism отдаёт плейсхолдерные тела 4xx — покрытие кодов маппера проверяется только фикстурами (brief FR5); сквозной смоук в P10/P11 ограничивается HTTP-статусами и happy-path.
- Внешних блокеров нет: все зависимости задачи (`front-ui-002`, `infra-004`, `infra-005`) завершены.
