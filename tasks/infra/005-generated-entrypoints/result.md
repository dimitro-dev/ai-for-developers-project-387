# Результат TASK-INFRA-005

## Итог

Оба generated-пакета импортируются по имени из своих потребителей. Реализовано по плану без отклонений
от ADR: `@minical/backend-contract` получил `exports` с подпутём и не потребовал регенерации,
`@minical/api-client` — правку конфигурации генерации (`module.extension: null`,
`includeInEntry: true`), `exports` и перевод собственного tsconfig в bundler-режим. Артефакт
`baseUrl: 'packages'` устранён исправлением `input` в обоих конфигах генерации (Р6, Q1). Все пять
acceptance criteria закрыты; AC2 подтверждён **настоящей сборкой** `expo export --platform web`, план Б
Р7 и замена по Q4/FR4 не потребовались. Контракт не менялся: API impact `NONE`.

Точные import-специфаеры — вход для `task-back-001` и `task-front-guest-001` — в разделе «Контракт и
generated-артефакты».

## Что изменено

Ручные правки — 5 файлов, все внутри двух generated-пакетов:

| Файл | Изменение | Решение |
|---|---|---|
| `packages/backend-contract/package.json` | `+ "exports": { ".": "./src/generated/index.ts", "./zod": "./src/generated/zod.gen.ts" }` | Р1 |
| `packages/backend-contract/openapi-ts.config.ts` | `input: 'packages/…'` → `'./packages/contracts/generated/openapi.yaml'` | Р6 |
| `packages/api-client/openapi-ts.config.ts` | тот же `input`; `+ output.module: { extension: null }`; строковый плагин → `{ name: '@hey-api/client-fetch', includeInEntry: true }` | Р2, Р6 |
| `packages/api-client/package.json` | `+ "exports": { ".": "./src/generated/index.ts" }` | Р2 |
| `packages/api-client/tsconfig.json` | `+ "module": "preserve"`, `+ "moduleResolution": "bundler"` (сохранены `extends ../../tsconfig.base.json`, `noEmit`, `include: ["src"]`) | Р2 |

Generated-вывод изменён единственным прогоном `npm run generate` (P04) — руками не редактировался ни
один файл в `src/generated/**` (правило 6, AC3).

Файлы вне двух пакетов не менялись. Временные пробники `apps/api/src/__probe.ts` и
`apps/client/__probe.ts` (плюс импорт пробника в `apps/client/App.tsx`) созданы для проверки AC1/AC2 и
удалены; `App.tsx` восстановлен через `git checkout --`, каталоги `apps/client/dist/` и
`apps/client/.expo/` удалены. Итоговое дерево не содержит ни изменённых, ни неотслеживаемых файлов в
`apps/**`, `packages/contracts/**`, `tests/**` и `docs/**`.

## Контракт и generated-артефакты

**API impact `NONE`.** `packages/contracts/src/**/*.tsp` не открывался; `packages/contracts/generated/openapi.yaml`
не изменился вовсе (отсутствует в diff) — правка `input` меняет путь к тому же файлу, а не его
содержимое. Набор маршрутов (8) и операций (11) не затронут, `tests/contract-validation.test.ts` не
правился.

### Точные import-специфаеры (AC5)

Дословно то, что прогонялось в пробниках P06 и P07.

`@minical/backend-contract` — вход для FR3 `task-back-001`:

```ts
import { zCreatePublicBookingBody, zGetPublicSlotsQuery } from '@minical/backend-contract/zod';
import type { CreateBookingRequest, ErrorResponse } from '@minical/backend-contract';
```

`@minical/api-client` — вход для FR2/FR3 `task-front-guest-001`:

```ts
import {
  client,
  getPublicEventTypes,
  getPublicSlots,
  createPublicBooking,
} from '@minical/api-client';
import type { EventType, Slot, ErrorResponse } from '@minical/api-client';

client.setConfig({ baseUrl: 'http://localhost:3001' }); // адрес — из конфигурации клиента
```

**Два входа у `backend-contract`, и корневой вход в рантайме пуст.** `src/generated/index.ts`
состоит из единственного `export type { … } from './types.gen.js'`, то есть целиком стирается при
компиляции: `import('@minical/backend-contract')` даёт **0 экспортов** (проверено на реальном дереве,
Ф2). Это не дефект упаковки, а свойство generated-вывода, и именно поэтому Zod-схемы отдаются
подпутём `./zod`: `zod.gen.ts` не имеет ни одного относительного импорта (Ф3) и исполняется как есть —
44 экспорта. Практическое следствие для Backend Agent: типы берутся из `.`, схемы — из `/zod`; ошибка
адресации ловится компилятором (`has no exported member`), а не превращается в `undefined` в рантайме.

**`@minical/api-client` стал bundler-only.** После `module.extension: null` весь его generated-граф
(38 модулей) связан специфаерами без расширения. Metro и `tsc` в bundler-режиме такое собирают без
единого флага (подтверждено сборкой, см. AC2), но **из чистого Node ESM и из NodeNext-режима `tsc`
пакет импортировать нельзя** — относительные импорты без расширения там недопустимы (Ф17). Поэтому
`packages/api-client/tsconfig.json` переведён в `moduleResolution: bundler`: собственный `typecheck`
пакета проверяет его в том режиме, в котором он реально потребляется. Потребителей в Node у пакета
нет и не планируется; если появятся, путь перехода на `.ts`-специфаеры описан в Р7 п. 2.

**Расхождение с Р12 `task-back-001` устранено.** Р12 предлагал `"exports": { ".": "./src/generated/index.ts" }`
как достаточную правку — она резолвится, но по Ф2 даёт ноль экспортов в рантайме и FR3
`task-back-001` не разблокировала бы. Итоговые специфаеры — два (см. выше); запись в
`task-back-001/adr.md` (Р12) уже исправлена на них при согласовании ADR этой задачи, а его P01 получил
проверку наличия экспортов вместо проверки успешного резолва. Backend Agent должен идти по
специфаерам из этого файла.

### Состав generated-diff

`npm run generate` → 12 файлов в `packages/api-client/src/generated` (81 изменённая строка) и 2 строки
в `packages/backend-contract/src/generated/types.gen.ts` — совпадает с измеренным в ADR (Р4).
`openapi.yaml` и `zod.gen.ts` в diff отсутствуют.

Просмотр по закрытому чеклисту P05 (`git diff --cached` по трём generated-каталогам): каждая
изменённая строка попадает ровно в одну из четырёх допустимых категорий, ни одна не лежит внутри тела
функции или определения типа запроса/ответа.

| Категория | Факт |
|---|---|
| (а) module specifier потерял `.js` | большинство строк, включая каталожный `'./client/index.js'` → `'./client'` и `'../core/*.gen.js'` → `'../core/*.gen'` |
| (б) новая строка реэкспорта `client` | ровно одна: `export { client, type CreateClientConfig } from './client.gen';` в `api-client/src/generated/index.ts` |
| (в) `createConfig({ baseUrl: 'packages' })` → `createConfig()` | одна строка в `api-client/src/generated/client.gen.ts` |
| (г) тип `baseUrl` в `types.gen.ts` | `` `${string}://packages` `` → `` `${string}://${string}` `` в обоих пакетах, по 1 строке |

Машинная сверка состава:

- список 11 функций операций в `sdk.gen.ts` — идентичен HEAD (`diff` по `^export const ` → пусто);
- `api-client/src/generated/index.ts` после снятия `.js` идентичен HEAD с точностью до одной новой
  строки категории (б) — включая полный список 76 экспортируемых типов;
- `sdk.gen.ts` после снятия `.js` идентичен HEAD с точностью до **порядка** строк: `import { client }
  from './client.gen'` встал после `from './client'`, потому что генератор сортирует специфаеры и
  снятие `.js` изменило их лексикографический порядок. Содержательно набор импортов тот же;
- в diff нет ни одной строки, не являющейся `import`/`export`, продолжением `} from '…'`,
  строкой `baseUrl:` или строкой `export const client: Client = createClient(…)`.

## База данных и миграции

Не применимо.

## Выполненные проверки

Все команды — на итоговом состоянии дерева, после удаления пробников. Регенерированные файлы
проиндексированы (`git add`), поэтому `generate:check` сравнивает дерево с индексом и зелен (FR5, AC4);
коммит делает reviewer.

### Обязательные гейты `AGENTS.md`

| Команда | Exit code | Фактический вывод |
|---|---:|---|
| `npm run contracts:format:check` | 0 | `- Checking format` / `✔ 9 formatted` |
| `npm run generate:check` | 0 | `Compilation completed successfully.`; `✓ ./packages/api-client/src/generated · 4 files · 116ms`; `✓ ./packages/backend-contract/src/generated · 3 files · 78ms`; `git diff --exit-code` без вывода |
| `npm run typecheck` | 0 | `tsc --noEmit` без диагностик во всех четырёх workspaces: `@minical/api`, `@minical/client`, `@minical/api-client`, `@minical/backend-contract` |
| `npm test` | 0 | `uispec:validate`: `Validated 31 files; errors=0`, `approved=26, draft=5`, gaps `GAP-002 (open)`, `GAP-003 (open)`; contract gate: `Route count: 8 === 8`, `Operation count: 11 === 11`, `✅ All contract validation checks passed` |

`npm run uispec:validate` отдельно не запускался — входит в `npm test` (вывод выше); по существу не
применим, `docs/ui-spec-kit/` и UI-код клиента не менялись. `npm run mock:prism` не нужен: `openapi.yaml`
не изменился.

### AC1 — `@minical/backend-contract` из `apps/api`

Временный `apps/api/src/__probe.ts` со специфаерами из раздела выше, `safeParse` валидного и
невалидного тела.

```text
$ node apps/api/src/__probe.ts
valid body success: true
invalid body success: false
invalid body issues: 3
slots query success: true
error type usable: VALIDATION_ERROR
exit=0

$ npm run typecheck -w @minical/api
> tsc --noEmit
exit=0
```

Дополнительно, входной контроль из корня репозитория (P01, до регенерации):
`import('@minical/backend-contract/zod')` → **44 экспорта**, `zCreatePublicBookingBody.safeParse`
валидного тела → `success: true`; `import('@minical/backend-contract')` → **0 экспортов** (ожидаемо,
см. выше). Флагов в `apps/api/tsconfig.json` не потребовалось (Ф20) — файл не открывался.

### AC2 — `@minical/api-client` из `apps/client`

**Подтверждён настоящей сборкой, а не резолвером.** Временный `apps/client/__probe.ts` со
специфаерами из раздела выше, `client.setConfig({ baseUrl: 'http://localhost:3001' })` и ссылками на
три гостевые операции; пробник импортирован в `App.tsx`, чтобы попасть в граф.

```text
$ npm run build -w @minical/client        # expo export --platform web
Expo Autolinking module resolution enabled
Starting Metro Bundler
Web Bundled 1500ms apps/client/index.ts (197 modules)
› web bundles (1):
_expo/static/js/web/index-678ccb10ef61a76b4a151fb607c81cb8.js (353KB)
› Files (3): favicon.ico (15KB), index.html (1.2KB), metadata.json (49B)
Exported: dist
exit=0

$ npm run typecheck -w @minical/client
> tsc --noEmit
exit=0
```

Пакет действительно попал в бандл, а не был вырезан: в выходном `.js` присутствуют `localhost:3001`
(1×) и url-литералы всех трёх гостевых операций — `/event-types`, `/slots`, `/bookings` (по 1×), плюс
внутренние символы клиентского графа `createSseClient` (2×) и `serializeArrayParam` (3×).

Замена по Q4/FR4 не применялась: `expo export` заработал с первого прогона в текущем состоянии
клиента (один `App.tsx`, без `metro.config.js`). Блокер R2 не сработал, план Б Р7 не понадобился —
`exports` на `.ts`-вход Metro применил, граф из extensionless-специфаеров собрал, `"main"` добавлять не
пришлось. Компромисс 5 ADR («резолв подтверждён резолвером, а не сборкой») тем самым снят.

### AC3 — чистота дерева

```text
$ git status --porcelain --untracked-files=all | grep -vE '^[MADRC] '
(пусто: нет ни одного unstaged-изменения и ни одного неотслеживаемого файла)

$ git diff --cached --name-only
packages/api-client/openapi-ts.config.ts
packages/api-client/package.json
packages/api-client/src/generated/client.gen.ts
packages/api-client/src/generated/client/client.gen.ts
packages/api-client/src/generated/client/index.ts
packages/api-client/src/generated/client/types.gen.ts
packages/api-client/src/generated/client/utils.gen.ts
packages/api-client/src/generated/core/bodySerializer.gen.ts
packages/api-client/src/generated/core/serverSentEvents.gen.ts
packages/api-client/src/generated/core/types.gen.ts
packages/api-client/src/generated/core/utils.gen.ts
packages/api-client/src/generated/index.ts
packages/api-client/src/generated/sdk.gen.ts
packages/api-client/src/generated/types.gen.ts
packages/api-client/tsconfig.json
packages/backend-contract/openapi-ts.config.ts
packages/backend-contract/package.json
packages/backend-contract/src/generated/types.gen.ts
```

18 файлов, `55 insertions(+), 44 deletions(-)`: ровно ожидаемый набор — два `package.json`, два
`openapi-ts.config.ts`, `packages/api-client/tsconfig.json` и generated-каталоги двух пакетов. Ни
одного файла в `apps/**`, `packages/contracts/**`, `tests/**`, `docs/**`.

## Отклонения от brief / ADR / plan

Отклонений нет. Все пункты P01–P09 выполнены в порядке плана, чеклист P05 сошёлся полностью,
фактический объём generated-diff совпал с измеренным в ADR (12 файлов / 81 строка у `api-client`,
2 строки у `backend-contract`), поэтому блокер R4 не сработал.

Q1 и Q2 реализованы в подтверждённом пользователем виде (2026-08-07): `input` исправлен здесь,
специфаеров у `backend-contract` два. Q3 (временные пробники) применён. Q4 (замена сборки резолвером)
**не** применён — сборка прошла. Открытый вопрос O1 закрыт по умолчанию: специфаеры зафиксированы
только в этом файле, `AGENTS.md` не правился.

## Известные ограничения и риски

1. **Корневой вход `@minical/backend-contract` в рантайме пуст** (0 экспортов) — следствие того, что
   generated entry состоит из одного `export type`. Схемы доступны только через `/zod`. Ошибка
   адресации ловится компилятором. Цена отказа от регенерации этого пакета (компромисс 1 ADR).
2. **`@minical/api-client` bundler-only:** из Node ESM и из NodeNext-режима `tsc` не импортируется.
   Актуально, если появится node-потребитель (например, QA-скрипт против мока) — тогда Р7 п. 2
   (переход на `.ts`-специфаеры плюс `allowImportingTsExtensions` у потребителей).
3. **В репозитории теперь три режима резолва модулей:** корневая база (NodeNext),
   `apps/client` (`expo/tsconfig.base`) и `packages/api-client` (bundler). Осознанно — отражает
   реальный способ потребления пакета (компромисс 3 ADR).
4. **`apps/client` и `apps/api` по-прежнему не объявляют пакеты в своих `dependencies`.** Резолв
   работает через симлинки npm workspaces в корневом `node_modules` (проверено обоими пробниками), но
   объявление зависимости — работа `task-front-guest-001` (FR2) и `task-back-001` (P01); правка
   `apps/*/package.json` здесь нарушила бы правило 10.
5. **Требование `client.setConfig({ baseUrl })` не снято.** Артефакт `baseUrl: 'packages'` устранён, и
   теперь клиент создаётся вовсе без `baseUrl`; адрес backend обязан задать потребитель
   (`task-front-guest-001`, FR3). Без него запросы уйдут по относительному адресу.
6. **Для Docker сохраняется требование `task-back-001`:** зависимости ставятся в корне репозитория с
   сохранением симлинков workspace. `exports` этого не меняет — он указывает на `.ts`-файл, который
   Node исполняет только вне физического `node_modules` (иначе
   `ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING`).
7. **Числа generated-diff привязаны к `@hey-api/openapi-ts` 0.99.0** из текущего `package-lock.json`.
   Обновление генератора изменит объём вывода и потребует повторного просмотра diff.

## Описание для MR

### Summary

Оба generated-пакета стали импортируемыми по имени: `@minical/backend-contract` — из `apps/api`
(Node 26 + `tsc` NodeNext), `@minical/api-client` — из `apps/client` (Metro / Expo 57 + `tsc`
bundler). Это разблокирует `task-back-001` (валидация generated Zod-схемами) и FR2/FR3
`task-front-guest-001` (инициализация SDK и base URL). Заодно устранён артефакт генерации
`baseUrl: 'packages'` — его причиной был bare-относительный путь `input` в конфигах, а не отсутствие
`@server` в контракте. Контракт не менялся: API impact `NONE`.

### Changes

- `packages/backend-contract/package.json`: `exports` с двумя входами — `.` (transport-типы) и
  `./zod` (44 Zod-схемы). Регенерация этому пакету не потребовалась.
- `packages/api-client/`: `openapi-ts.config.ts` — `output.module.extension: null` и плагин
  `@hey-api/client-fetch` с `includeInEntry: true` (generated entry сам реэкспортирует `client`);
  `package.json` — `exports` с единственным входом; `tsconfig.json` — bundler-режим под
  extensionless-вывод.
- Оба `openapi-ts.config.ts`: `input` → `./packages/contracts/generated/openapi.yaml`.
- `packages/*/src/generated/**`: результат одного прогона `npm run generate` — 12 файлов / 81 строка у
  `api-client`, 2 строки у `backend-contract`. Только module specifiers, одна строка реэкспорта
  `client` и значение/тип `baseUrl`; имена и формы операций не изменились. `openapi.yaml` не тронут.

Импорт-специфаеры для потребителей — в `tasks/task-infra-005/result.md`, раздел «Контракт и
generated-артефакты».

### Verification

`npm run contracts:format:check`, `npm run generate:check`, `npm run typecheck`, `npm test` — все exit
0 на итоговом дереве. AC1: `node apps/api/src/__probe.ts` (валидное тело `true`, невалидное `false` с
3 issues) + `npm run typecheck -w @minical/api`. AC2: `npm run build -w @minical/client`
(`expo export --platform web`, 197 модулей, бандл содержит `localhost:3001` и url-литералы трёх
гостевых операций) + `npm run typecheck -w @minical/client`. Пробники удалены, `App.tsx` восстановлен;
`git diff --cached` содержит ровно 18 файлов двух пакетов и ничего в `apps/**`.

### Known limitations

Корневой вход `@minical/backend-contract` в рантайме пуст — схемы только через `/zod` (свойство
generated entry, ошибка ловится компилятором). `@minical/api-client` стал bundler-only: из Node ESM не
импортируется. Явный `client.setConfig({ baseUrl })` по-прежнему обязателен. Ни `apps/api`, ни
`apps/client` пока не объявляют пакеты в `dependencies` — это работа их собственных задач.
