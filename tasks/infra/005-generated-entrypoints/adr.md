# Architecture decision — TASK-INFRA-005

## Контекст

`brief.md` согласован и фиксирует вход: сделать оба generated-пакета импортируемыми по имени из
`apps/api` (Node 26) и `apps/client` (Metro / Expo 57), не редактируя generated-файлы вручную и не
меняя контракт (FR1–FR5). Механизм для `@minical/api-client` brief намеренно не выбирает и предлагает
три варианта; для `@minical/backend-contract` `task-back-001/adr.md` (Р12) уже предложил
`"exports": { ".": "./src/generated/index.ts" }` как «минимальную правку».

Решать нужно: точную форму точки входа каждого пакета, судьбу конфигураций генерации, совместимость
с Metro и способ проверки AC1/AC2 без выхода за границы роли.

### Что установлено фактически

Все проверки выполнены в этой рабочей копии; репозиторий не менялся (`git status --porcelain` пуст
до и после), эксперименты шли на копиях пакетов в scratchpad. Ключевые факты — по порядку
значимости.

| # | Факт | Команда / источник | Результат |
|---:|---|---|---|
| Ф1 | Node 26 **не** сопоставляет специфаер `./x.js` с файлом `x.ts` на диске | `node main.ts`, где `main.ts` содержит `import { value } from './dep.js'`, а на диске только `dep.ts` | `ERR_MODULE_NOT_FOUND: Cannot find module .../dep.js` |
| Ф2 | Generated `backend-contract/src/generated/index.ts` реэкспортирует **только типы**; Zod-схем в нём нет вовсе | чтение файла: единственная строка — `export type { … } from './types.gen.js'` | при импорте по `.` в рантайме **0 экспортов** (проверено: `import('@asis/backend-contract')` → `Object.keys(m).length === 0`) |
| Ф3 | `zod.gen.ts` не имеет ни одного относительного импорта | `grep "^import" packages/backend-contract/src/generated/zod.gen.ts` | ровно `import * as z from 'zod'` — файл исполняется как есть, Ф1 его не задевает |
| Ф4 | Generated `api-client` — рантайм-граф из 38 модулей, связанных специфаерами `.js` | `sdk.gen.ts:3` — `import { client } from './client.gen.js'` (значение, не тип) | без правки специфаеров пакет не исполним ни в Node, ни в Metro |
| Ф5 | Metro в Expo 57 читает `exports` по умолчанию | `metro-config/src/defaults/index.js:69` → `unstable_enablePackageExports: true`; реальный конфиг: `getDefaultConfig('apps/client').resolver.unstable_enablePackageExports` | `true`; версии — `metro` / `metro-resolver` 0.84.4, `@expo/metro-config` 57.0.7 |
| Ф6 | Metro ищет цель `exports` **точным путём**, без подстановки расширений | `metro-resolver/src/PackageExportsResolve.js:77` — `context.fileSystemLookup(filePath)`, иначе `«however this file does not exist»` | `.ts`-цель в `exports` резолвится, потому что файл существует |
| Ф7 | Metro **не** подставляет `.ts` вместо `.js` в относительных импортах | `metro-resolver/src/resolve.js:511–558`: кандидаты — точный путь, затем `путь + .ts/.tsx/…`, то есть `x.js.ts` | контроль: `./dep.js` при наличии только `dep.ts` → `FailedToResolvePathError` |
| Ф8 | В цепочке резолверов Expo CLI нет переписывания `.js → .ts` | `grep -E "replace\(/\\.js\\\$/" @expo/cli/build/src/start/server/metro/ @expo/metro-config/build/ metro-resolver/src/` | совпадений нет (только `.js → .hbc` в сериализаторе Hermes) |
| Ф9 | `exports` на `.ts`-вход + `.js`-специфаеры внутри = Metro входит в пакет и падает на первом же импорте | прогон настоящего `metro-resolver` на реплике с текущим generated-выводом | вход: `src/generated/index.ts` — OK; `./sdk.gen.js` из него — `FailedToResolvePathError` |
| Ф10 | При специфаерах **без расширения** или `.ts` Metro разрешает весь граф пакета | обход графа настоящим `metro-resolver` с контекстом, собранным как в `metro/src/node-haste/DependencyGraph/ModuleResolution.js:104–135`, и knob'ами реального конфига Expo (`mainFields` web `['browser','module','main']` из `withMetroMultiPlatform.js:279`, `preferNativePlatform = platform !== 'web'`) | `@minical/api-client` — 38/38 модулей, 0 ошибок, для `web` и для `android`; `@minical/backend-contract` — 4/4 |
| Ф11 | Контроли того же прогона ведут себя ожидаемо | `zod` (обычный `exports`), `./dep.ts`, `./dep.js` | OK / OK / FAIL — контекст собран верно |
| Ф12 | `watchFolders` реального конфига уже включают оба пакета | `getDefaultConfig('apps/client').watchFolders` | `…/packages/api-client`, `…/packages/backend-contract` — Metro видит их исходники |
| Ф13 | TS5097 **не** подавляется для файлов пакета, дошедших через симлинк workspace | `tsc --noEmit` из потребителя (NodeNext, `types: ["node"]`) на пакет с `.ts`-специфаерами | `error TS5097: An import path can only end with a '.ts' extension when 'allowImportingTsExtensions' is enabled` в `…/src/generated/index.ts` |
| Ф14 | С `allowImportingTsExtensions: true` тот же прогон чист | то же + флаг | exit 0 |
| Ф15 | То же верно для tsconfig клиента (`expo/tsconfig.base`, `moduleResolution: bundler`, TS 6.0.3) | `tsc -p` на реплике `api-client` с `.ts`-специфаерами | 6 × TS5097 без флага; exit 0 с флагом |
| Ф16 | Специфаеры **без расширения** проходят bundler-режим без каких-либо флагов | `tsc -p` (extends `expo/tsconfig.base`, `strict`) на реплике `api-client` без расширений; в файле — `client.setConfig({ baseUrl })` и три гостевые операции | exit 0 |
| Ф17 | …и не проходят NodeNext | тот же пакет, tsconfig `extends tsconfig.base.json` | `TS2834: Relative import paths need explicit file extensions…`, `TS2307` |
| Ф18 | Собственный `typecheck` пакета над extensionless-выводом чист, если пакет переведён в bundler-режим | `{ extends: tsconfig.base.json, module: "preserve", moduleResolution: "bundler", noEmit: true }` | exit 0 |
| Ф19 | Node 26 исполняет `zod.gen.ts` через подпуть `exports` без регенерации | `exports: { ".": "…/index.ts", "./zod": "…/zod.gen.ts" }`, затем `import('@asis/backend-contract/zod')` | **44 экспорта**, `zCreatePublicBookingBody` — объект, `safeParse` валидного тела → `success: true` |
| Ф20 | Тот же вариант чист для tsc NodeNext **без** каких-либо флагов | `tsc --noEmit`, потребитель импортирует схемы из `…/zod`, а типы — из `.` | exit 0 |
| Ф21 | `@hey-api/openapi-ts` 0.99.0 поддерживает `output.module.extension` | `@hey-api/shared/dist/index.d.mts:2327` (`module: { extension }`), устаревший алиас `output.importFileExtension`; проверено генерацией | `extension: '.ts'` → `from './client.gen.ts'`; `extension: null` → `from './client.gen'`, каталог как `from './client'` |
| Ф22 | Тот же пакет поддерживает пер-плагинный `includeInEntry` | `clientDefaultConfig = { baseUrl: true, bundle: true, includeInEntry: false }` (`index.d.mts:11635`); проверено генерацией | `{ name: '@hey-api/client-fetch', includeInEntry: true }` → в entry появляется `export { client, type CreateClientConfig } from './client.gen…'`; `{ name: 'zod', includeInEntry: true }` → строка с 44 схемами |
| Ф23 | `baseUrl: 'packages'` — следствие **относительного пути input** в конфиге генерации, а не отсутствия `@server` в контракте | три прогона генерации, различающиеся только `input` | `packages/contracts/…` → `createConfig({ baseUrl: 'packages' })`; `./packages/contracts/…` → `createConfig()`; абсолютный путь → `createConfig()`. Механика: `getBaseUrl` (`@hey-api/shared/dist/index.mjs:5374`) парсит значение как URL, и в bare-относительном пути первый сегмент становится host |
| Ф24 | Текущий generated-вывод воспроизводится байт-в-байт | генерация текущими конфигами в scratchpad + `diff -rq` против репозитория | оба пакета совпадают → `generate:check` на HEAD зелёный, база для FR5 есть |
| Ф25 | Потребителей у пакетов пока нет | `grep` по `apps`, `tests`, `packages` вне `src/generated` | единственное упоминание — комментарий в `apps/api/src/server.ts:6`; сломать нечего |
| Ф26 | `npm run typecheck` на HEAD проходит | `npm run typecheck` | exit 0 |

Документация Expo v57 (`https://docs.expo.dev/versions/v57.0.0/config/metro/`) согласуется с Ф5:
«Metro will look at the `package.json:exports` conditions map», поведение введено с SDK 53 на всех
платформах и **выключается** явным `config.resolver.unstable_enablePackageExports = false`. О
резолве `.ts`-исходников из workspace-пакетов документация не говорит — этот вопрос закрыт только
эмпирикой (Ф6, Ф9, Ф10).

### Три следствия, меняющие постановку

1. **Р12 `task-back-001` недостаточен.** `"exports": { ".": "./src/generated/index.ts" }` для
   `backend-contract` резолвится и в Node, и в `tsc` — но даёт **ноль** Zod-схем в рантайме (Ф2):
   entry generated-пакета состоит из одного `export type`, который стирается целиком. Проверка Р12
   («exports на `.ts`-исходник работает») верна, но проверяла резолв, а не наличие схем. FR3
   `task-back-001` этой правкой не разблокируется.
2. **Для `api-client` правки `package.json` принципиально недостаточно.** Его generated-вывод — не
   один файл, а граф из 38 модулей, склеенный **значимыми** импортами с расширением `.js`, которых
   на диске нет (Ф4). Ни Node, ни Metro такой граф не собирают (Ф1, Ф7, Ф9). Значит из трёх
   вариантов brief FR2 первые два (`exports` с подпутём; рукописный `src/index.ts`) не решают задачу
   в принципе: любой из них лишь доводит резолвер до `index.ts`, который падает на следующем шаге.
   Работает только третий — правка конфигурации генерации с последующей регенерацией.
3. **Расширение специфаеров — это выбор режима резолва, и он у двух пакетов разный.** `.ts` работает
   везде, но требует `allowImportingTsExtensions` у **каждого** потребителя, включая
   `apps/client/tsconfig.json` (Ф13–Ф15) — файл чужой роли. Отсутствие расширения работает в Metro
   и в bundler-режиме tsc без единого флага (Ф10, Ф16), но несовместимо с Node и NodeNext (Ф17).

## Решение

Рамка — скилл `lean-code`: для каждого пакета выбирается **самая низкая ступень лестницы**, которая
закрывает требование его собственного потребителя. Единый механизм «для симметрии» не вводится:
потребители у пакетов разные (Node ESM против Metro), и подгонка одного под другого стоит правок в
чужих каталогах.

### Р1. `@minical/backend-contract` — `exports` с подпутём, без регенерации

Меняется **только** `packages/backend-contract/package.json`:

```json
"exports": {
  ".": "./src/generated/index.ts",
  "./zod": "./src/generated/zod.gen.ts"
}
```

Точные import-специфаеры для `task-back-001` (вход для его FR3 и для AC5 этой задачи):

```ts
import { zCreatePublicBookingBody, zGetPublicSlotsQuery } from '@minical/backend-contract/zod';
import type { CreateBookingRequest, ErrorResponse } from '@minical/backend-contract';
```

Почему именно так:

- **Работает без единой дополнительной правки.** Ф19: Node 26 отдаёт все 44 схемы и исполняет
  `safeParse`; Ф20: `tsc --noEmit` с NodeNext чист **без** `allowImportingTsExtensions`. Причина —
  Ф3: `zod.gen.ts` не содержит относительных импортов вовсе, поэтому проблема Ф1 его не касается, а
  `index.ts` со `export type` до рантайма не доживает и в резолве `./types.gen.js` не нуждается.
- **Ноль generated-diff.** FR5 и AC3 для этого пакета выполняются тривиально: `npm run generate`
  выдаёт тот же вывод, что лежит в git (Ф24), потому что конфигурация генерации не меняется.
- **Не связывает задачу с решением Р11 `task-back-001`.** Вариант «один вход через регенерацию»
  (см. «Альтернативы», А1) потребовал бы `allowImportingTsExtensions` в `apps/api/tsconfig.json`.
  Флаг там и так планируется (Р11, подтверждён 2026-08-07), но он несовместим с emit: пакет с
  `.ts`-специфаерами навсегда запретил бы `apps/api` вернуться к сборке через `tsc`, а именно этот
  откат `task-back-001` держит как путь на случай упаковки workspace внутрь `node_modules`
  («Совместимость и миграция», п. Docker). Р1 такого ограничения не создаёт.
- **Подпуть — механизм, прямо разрешённый brief.** FR2 перечисляет «`exports` с подпутём (например,
  `.` и `./client`)» как допустимый вариант; FR1 требует резолва «по имени пакета», а не единственной
  точки входа. Глубоких импортов в `src/generated/**` нет — наоборот, `exports` их теперь физически
  запрещает (Node не пускает мимо карты).

Цена — два специфаера вместо одного и то, что `.` в рантайме пуст. Обе издержки под контролем
компилятора: `import { zX } from '@minical/backend-contract'` даёт «has no exported member», а не
`undefined` в рантайме. Расхождение с прозой сценария 1 brief вынесено в Q2.

### Р2. `@minical/api-client` — правка конфигурации генерации, один вход, специфаеры без расширения

Три файла, все в границах Contract Agent.

1. `packages/api-client/openapi-ts.config.ts`:

```ts
export default defineConfig({
  input: './packages/contracts/generated/openapi.yaml',
  output: {
    path: 'packages/api-client/src/generated',
    module: { extension: null },
  },
  plugins: [{ name: '@hey-api/client-fetch', includeInEntry: true }],
});
```

2. `packages/api-client/package.json`:

```json
"exports": { ".": "./src/generated/index.ts" }
```

3. `packages/api-client/tsconfig.json` — перевод пакета в bundler-режим (Ф18):

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "module": "preserve", "moduleResolution": "bundler", "noEmit": true },
  "include": ["src"]
}
```

Точный import-специфаер для `task-front-guest-001` (вход для его FR2/FR3 и для AC5):

```ts
import { client, getPublicEventTypes, getPublicSlots, createPublicBooking } from '@minical/api-client';
import type { EventType, Slot, ErrorResponse } from '@minical/api-client';

client.setConfig({ baseUrl: /* из конфигурации клиента */ });
```

Обоснование по частям:

- **`includeInEntry: true` вместо рукописного `src/index.ts`.** Ф22: опция существует в
  установленной версии 0.99.0 и добавляет в generated entry ровно строку
  `export { client, type CreateClientConfig } from './client.gen'`. Рукописный реэкспорт дал бы тот
  же результат новым файлом, который придётся держать согласованным с generated-выводом руками;
  генератор делает это сам (`lean-code`: нативная возможность инструмента вместо своего кода).
- **`module: { extension: null }` — необходимое условие, а не украшение.** Без него Metro не собирает
  пакет (Ф4, Ф7, Ф9): дело не в `client`, а в том, что весь граф склеен несуществующими `.js`.
  Выбор «без расширения» против `.ts`: оба варианта Metro устраивают (Ф10), но `.ts` требует
  `allowImportingTsExtensions` в `apps/client/tsconfig.json` (Ф15) — файле Frontend Agent, а
  extensionless не требует у потребителя ничего (Ф16). По правилу 10 это решает выбор.
- **`moduleResolution: bundler` в tsconfig пакета — следствие, а не отдельное желание.** Специфаеры
  без расширения недопустимы в NodeNext (Ф17), поэтому собственный `npm run typecheck` пакета должен
  проверять его в том режиме, в котором пакет реально потребляется. Пакет становится честно
  bundler-only; это уже существующий в репозитории паттерн (`apps/client/tsconfig.json` тоже не
  наследует корневую базу).
- **Один вход, без подпути `./client`.** `client` попадает в entry вместе с функциями операций,
  поэтому второй подпуть не нужен: меньше специфаеров для потребителя.

### Р3. Почему у двух пакетов разные механизмы

Не косметическая асимметрия, а разные ограничения потребителей:

| | `@minical/backend-contract` | `@minical/api-client` |
|---|---|---|
| Потребитель | Node 26 ESM + `tsc` NodeNext (`apps/api`) | Metro / Expo 57 + `tsc` bundler (`apps/client`) |
| Требование к расширениям | обязательны и должны существовать (Ф1) | не нужны; каталог и extensionless резолвятся (Ф10) |
| Нужен ли рантайм-граф | нет: схемы лежат в одном самодостаточном файле (Ф3) | да: 38 модулей, включая bundled fetch-клиент (Ф4) |
| Минимально достаточное | `exports` с подпутём, регенерация не нужна | конфигурация генерации + регенерация |

Уравнивание в любую сторону дороже: под Node пришлось бы переводить `api-client` на `.ts` и править
tsconfig клиента, под bundler — лишать `backend-contract` возможности исполняться в Node.

### Р4. Что происходит при регенерации и почему `generate:check` останется зелёным

`npm run generate` перегенерирует оба пакета. Вывод `backend-contract` не меняется вовсе (его конфиг
не тронут, Ф24 — вывод воспроизводим байт-в-байт), кроме случая, если будет принят Р6.

Diff `api-client` измерен заранее (генерация в scratchpad + `diff -r` против репозитория):

| Вариант | Файлов изменено | Строк (`<` + `>`) | Состав |
|---|---:|---:|---|
| `extension: null` + `includeInEntry`, input без правки | 11 | 77 | 38 строк со специфаерами теряют `.js`; `index.ts` получает строку с `client` |
| то же + input `./packages/…` (Р6) | 12 | 81 | плюс `client.gen.ts`: `createConfig({ baseUrl: 'packages' })` → `createConfig()`, и `types.gen.ts`: `\`${string}://packages\`` → `\`${string}://${string}\`` |

Ни одна строка не касается тел функций, имён операций, типов запросов и ответов: меняются только
module specifiers, одна строка реэкспорта и (при Р6) значение baseUrl. `generate:check`
(`npm run generate` + `git diff --exit-code` по трём generated-каталогам) остаётся зелёным, потому
что регенерированный вывод входит в тот же коммит, что и правка конфига (FR5), а генерация
детерминирована (Ф24).

### Р5. Границы правила 6 и правила 10

- **Правило 6 (generated-файлы не редактируются вручную) соблюдено.** Руками правятся три вида
  файлов: `package.json` двух пакетов, `tsconfig.json` пакета и `openapi-ts.config.ts` — ни один не
  находится в read-only-списке `AGENTS.md` (`packages/api-client/src/generated/**`,
  `packages/backend-contract/src/generated/**`, `packages/contracts/generated/**`). Содержимое
  `src/generated/**` изменится только как результат `npm run generate` — это ровно тот путь, который
  `AGENTS.md` называет единственно допустимым («никто вручную — только `npm run generate`»). FR3
  brief разрешает это дословно.
- **Правило 10 (границы роли) соблюдено.** Владелец generated-пакетов — Contract Agent (таблица
  «Пакеты и границы»), а `contract-agent.md` в «Разрешено менять» включает «TypeSpec project
  config/scripts — только если это предусмотрено task ADR/plan»: конфигурация генерации и упаковка
  generated-пакетов — это и есть project config, и она предусмотрена этим ADR. Backend и Frontend
  Agent такой правки сделать не вправе: `packages/*/package.json` не входит в их «разрешено менять»
  (Q7 `task-back-001` уже зафиксировал это и вынес правку сюда).
- **Ни один файл вне `packages/api-client/**` и `packages/backend-contract/**` не меняется.** В
  частности не меняются `apps/api/tsconfig.json`, `apps/client/tsconfig.json` и
  `apps/client/package.json`: объявление зависимости `@minical/api-client` в клиенте — работа
  `task-front-guest-001` (её FR2), и для резолва она не требуется (npm workspaces уже создали
  симлинки в корневом `node_modules`, Metro ищет по `nodeModulesPaths`, включающему корень).
- **API impact `NONE`.** `packages/contracts/src/**/*.tsp` не открывается; `openapi.yaml` не меняется
  (правка input меняет **путь** к тому же файлу, а не его содержимое).

### Р6. `baseUrl: 'packages'` — причина найдена, и она не в контракте

Brief относит исправление `baseUrl` к non-goals, называя исправлением «добавление `@server` в
`.tsp`». Ф23 показывает, что диагноз был неверен: `servers` в `openapi.yaml` отсутствует, а `packages`
берётся из **относительного пути input** в `openapi-ts.config.ts` — `getBaseUrl` парсит
`packages/contracts/generated/openapi.yaml` как URL и получает host `packages`. Префикс `./`
устраняет артефакт полностью, `@server` для этого не нужен.

**Решение:** заменить `input` на `./packages/contracts/generated/openapi.yaml` в обоих конфигах
генерации — правка в тех же двух файлах, которые задача и так открывает (для `backend-contract`
это добавляет 2 строки generated-diff в `types.gen.ts`; см. Р4). Причина устраняется там, где
находится, а не документируется как «известное ограничение» (`lean-code`: «чини причину, а не
симптом»).

**Требует подтверждения (Q1):** формально это правка того самого `baseUrl`, который brief перечислил
в non-goals. Если решение не принимается, задача выполняется без него, и тогда:
`client.gen.ts` сохраняет `baseUrl: 'packages'`, `ClientOptions.baseUrl` сохраняет тип
`` `${string}://packages` | (string & {}) `` (второй член союза оставляет `setConfig` типобезопасным,
проверено Ф16), а обязательность явного `client.setConfig({ baseUrl })` не меняется ни в одном из
вариантов — без неё запросы уходят по бессмысленному относительному адресу. Для будущей контрактной
задачи в любом случае фиксируется: пункт «`@server` в `.tsp` вместо артефакта `baseUrl: 'packages'`»
из `tasks/README.md` («План разработки», абзац об отдельной контрактной задаче) **беспредметен** —
артефакт порождается конфигом генерации. Если `@server` понадобится, то как описание реального
окружения, а не как лечение этого симптома.

### Р7. План Б, если Metro всё-таки не резолвит

Резолв подтверждён на настоящем `metro-resolver` 0.84.4 с knob'ами реального конфига Expo 57 (Ф10,
Ф11), но не полной сборкой; сборка проверяется пунктом плана (Р8). Если она выявит отказ, порядок
отступления фиксируется здесь, чтобы не переоткрывать ADR:

1. **Симптом «пакет не найден» (Metro не применил `exports`)** — добавить в
   `packages/api-client/package.json` поле `"main": "./src/generated/index.ts"` рядом с `exports`.
   Metro при неудаче `exports` откатывается на file-based-резолв, а без `main` подставляет `index` в
   корне пакета и падает с `InvalidPackageError` (воспроизведено в ходе проверок). Одна строка,
   специфаер и всё остальное не меняются. Сразу не добавляется: `exports` работает (Ф5, Ф10), а два
   поля с одним и тем же путём — два места для расхождения (`lean-code`, YAGNI).
2. **Симптом «модуль внутри пакета не найден»** — вернуть `module: { extension: '.ts' }` и добавить
   `allowImportingTsExtensions: true` в `packages/api-client/tsconfig.json` **и** в
   `apps/client/tsconfig.json`; вторая правка выходит за границы роли, поэтому оформляется как
   согласованное с Frontend Agent исключение и отражается в `result.md`.
3. **Симптом «Metro не трансформирует `.ts` из workspace-пакета»** (Ф12 делает это маловероятным) —
   единственный оставшийся путь противоречит НФТ brief («никакой сборки пакетов в `.js`/`dist`») и
   поэтому возвращает `brief.md` в `черновик`, а не решается молча.

### Р8. Как проверяются AC1 и AC2, не нарушая границ роли

Ни `apps/api`, ни `apps/client` в этой задаче не изменяются, а AC1/AC2 требуют проверки «из»
соответствующего приложения. Обе проверки выполняются **временными** файлами, которые удаляются до
коммита; критерий их незаметности — AC3 (`git status --porcelain` пуст, `dist/` и `.expo/` в
`.gitignore`).

- **AC1:** временный `apps/api/src/__probe.ts` с импортом схемы из `@minical/backend-contract/zod` и
  типа из `@minical/backend-contract`; запуск `node apps/api/src/__probe.ts` (рантайм) и
  `npm run typecheck --workspace @minical/api` (компилятор); затем файл удаляется. Флагов в
  `apps/api/tsconfig.json` не требуется (Ф20).
- **AC2:** временный модуль в `apps/client`, импортируемый из `App.tsx`, с вызовом
  `client.setConfig({ baseUrl })` и тремя гостевыми операциями; `npx expo export --platform web`;
  затем модуль удаляется, `App.tsx` восстанавливается (`git checkout --`). Если `expo export` в
  текущем состоянии клиента недоступен по причинам, не связанным с пакетом, допустимая замена по
  brief FR4 — фиксация резолва настоящим `metro-resolver` (скрипт-пробник вне репозитория, вывод в
  `result.md`), плюс `npm run typecheck --workspace @minical/client` как проверка компилятора (Ф16).

## Затронутые компоненты

```text
packages/backend-contract/package.json      + exports (".", "./zod")                        Р1
packages/backend-contract/openapi-ts.config.ts  input → './packages/…'                      Р6 (при подтверждении Q1)
packages/backend-contract/src/generated/**  без изменений; при Р6 — 2 строки types.gen.ts, результат npm run generate
packages/api-client/openapi-ts.config.ts    + output.module.extension: null,
                                            + plugin includeInEntry: true, input → './packages/…'   Р2, Р6
packages/api-client/package.json            + exports (".")                                  Р2
packages/api-client/tsconfig.json           module: preserve, moduleResolution: bundler      Р2
packages/api-client/src/generated/**        11–12 файлов, 77–81 строка, результат npm run generate  Р4
tasks/task-infra-005/result.md              точные import-специфаеры обоих пакетов (AC5)
tasks/README.md                             статус infra-005 в реестре (по правилам result.md)
```

Не меняются: `packages/contracts/**` (API impact `NONE`), корневой `package.json` (скрипты генерации
и проверок сохраняют смысл), `tests/contract-validation.test.ts` (набор операций и маршрутов не
затронут), `apps/api/**`, `apps/client/**`, `docs/**`. Ни один источник правды из
`docs/sources-of-truth.md` не сдвигается: решение целиком про упаковку generated-артефактов.

Отдельно отмечается: `docs/architecture.md` и `AGENTS.md` не требуют правки, но `AGENTS.md`
описывает `@minical/api-client` и `@minical/backend-contract` без упоминания точек входа; если
пользователь захочет, чтобы специфаеры были зафиксированы в глобальной документации, а не только в
`result.md`, это добавляется пунктом плана — по умолчанию (AC5) достаточно `result.md`.

## Последствия и компромиссы

Положительные:

- обе блокирующие задачи разблокированы без обходных путей: ни глубоких импортов в
  `src/generated/**`, ни `paths` в чужих `tsconfig.json` (оба варианта brief называет созданием
  второго источника правды);
- `exports` не только открывает вход, но и **закрывает** остальное: Node запрещает импорт мимо карты,
  то есть граница пакета из `AGENTS.md` становится машинно-проверяемой, а не декларативной;
- у `backend-contract` generated-вывод не меняется вовсе — риск drift'а нулевой, FR5 выполняется без
  коммита регенерации;
- ни один файл вне двух пакетов не тронут: правило 10 соблюдено без исключений и согласований;
- специфаеры `api-client` перестают быть фикцией: сейчас generated-код ссылается на файлы, которых на
  диске нет, и это молча ждало первого потребителя.

Компромиссы и принятые ограничения:

1. **Два специфаера у `backend-contract`** (`.` для типов, `/zod` для схем) и пустой в рантайме `.`.
   Ошибка использования отлавливается компилятором, но факт неинтуитивен и обязан попасть в
   `result.md` (AC5) — это и есть цена отказа от регенерации.
2. **`@minical/api-client` становится bundler-only:** из чистого Node его импортировать нельзя
   (специфаеры без расширения, Ф17). Потребителей в Node у него нет и не планируется; если появятся
   (например, node-скрипт QA против мока), переход на `.ts` описан в Р7, п. 2.
3. **`packages/api-client/tsconfig.json` расходится с корневой базой по резолву модулей.** Это
   осознанно отражает реальный способ потребления пакета, но добавляет второй режим резолва в
   репозиторий (третий, если считать `apps/client`).
4. **Регенерация `api-client` даёт 77–81 изменённую строку.** Все они — module specifiers и одна
   строка реэкспорта; ревью diff'а обязано это подтвердить (Definition of Done роли: «просмотреть
   generated diff»).
5. **Резолв Metro подтверждён на уровне резолвера, а не полной сборки.** Контекст собран по коду
   `ModuleResolution.js` с knob'ами реального конфига и проверен контролями (Ф11), но окончательная
   проверка — пункт плана (Р8), и до её прохождения AC2 считается непроверенным.
6. **Проверки AC1/AC2 требуют временных файлов в чужих каталогах.** Файлы удаляются до коммита,
   отсутствие следов подтверждается AC3; альтернатива — ждать `task-back-001` и
   `task-front-guest-001`, то есть проверять задачу после её потребителей.
7. **Обязательность `client.setConfig({ baseUrl })` не снимается ни одним вариантом Р6.** Пакет не
   знает адреса backend; адрес приходит из конфигурации клиента (`task-front-guest-001`, FR3).

## Рассмотренные альтернативы

**А1. `backend-contract` одним входом через регенерацию** (`zod` плагин с `includeInEntry: true` +
`module: { extension: '.ts' }`, `exports: { ".": "./src/generated/index.ts" }`). Работает: проверено —
Node отдаёт 44 экспорта, `safeParse` валидного тела `true`, собственный `typecheck` пакета с
`allowImportingTsExtensions` чист, generated-diff всего 3–5 строк. Отклонена, потому что даёт один
специфаер ценой (а) `allowImportingTsExtensions` в `apps/api/tsconfig.json` — чужом файле, пусть флаг
там и планируется решением Р11, и (б) жёсткой связки: пакет с `.ts`-специфаерами запрещает `apps/api`
любой возврат к `tsc`-сборке, который `task-back-001` держит как путь отступления для Docker. Р1
достигает того же результата правкой одного файла и без связок. Если пользователь предпочтёт единый
специфаер (Q2), А1 — готовая замена: план в этом случае получает два дополнительных пункта
(регенерация `backend-contract` и флаг в tsconfig пакета), а флаг в `apps/api` остаётся за
`task-back-001`.

**А2. `exports` только с `"."` для `backend-contract`** — предложение Р12 `task-back-001` в чистом
виде. Отклонено по факту: Ф2 — в рантайме ноль экспортов, FR3 `task-back-001` не разблокирован. Это
не «менее удобный», а неработающий вариант.

**А3. `exports` с подпутём `./client` для `api-client`** (первый вариант brief FR2). Отклонён по
факту: Ф9 — Metro входит в `index.ts` и падает на `./sdk.gen.js`. Подпуть решает вопрос доступа к
`client`, но не вопрос сборки пакета.

**А4. Рукописный `src/index.ts` вне `src/generated/**` для `api-client`** (второй вариант brief FR2).
Отклонён по той же причине (Ф9: падение произойдёт на первом же реэкспорте из `./generated/…`), плюс
он вводит файл, который нужно синхронизировать с generated-выводом руками, тогда как
`includeInEntry` делает это генератором (Ф22).

**А5. `module: { extension: '.ts' }` для `api-client`.** Работает в Metro (Ф10) и в tsc (Ф15 с
флагом). Отклонён: требует `allowImportingTsExtensions` в `apps/client/tsconfig.json` — правки в
каталоге Frontend Agent (правило 10), тогда как extensionless не требует у потребителя ничего (Ф16).
Остаётся планом Б (Р7, п. 2).

**А6. Сборка пакетов в `.js`/`dist`.** Прямо запрещена НФТ brief; кроме того, вернула бы сборочный
шаг, который `task-back-001` (Р11) из проекта убрал.

**А7. `paths` в `tsconfig.json` потребителей или глубокие относительные импорты.** Отклонены brief и
Р12 `task-back-001`: `paths` лечит компилятор и не лечит рантайм, глубокий импорт ломает границу
пакета. Ф1 добавляет к этому, что и глубокий импорт `…/src/generated/index.ts` для `api-client` не
помог бы — граф всё равно рвётся на `.js`.

**А8. `"main"` вместе с `exports` сразу.** Отклонено: `exports` подтверждённо работает у обоих
потребителей (Ф5, Ф10, Ф19), а дубль пути в двух полях — лишнее место для расхождения. Оставлено
планом Б (Р7, п. 1) с явным условием срабатывания.

**А9. Единый механизм для двух пакетов «ради симметрии».** Отклонён: см. Р3 — уравнивание в любую
сторону оплачивается либо правкой в чужом каталоге, либо потерей исполнимости в Node.

**А10. Отключить `unstable_enablePackageExports` и жить на `main`.** Отклонено: это правка
`metro.config.js` клиента (которого сейчас нет вовсе), уход от штатного поведения Expo 57 (Ф5,
документация v57) и отказ от машинной защиты границы пакета.

## Совместимость и миграция

**Контракт.** API impact `NONE`: `packages/contracts/src/**/*.tsp` не открывается, `openapi.yaml`
байт-в-байт тот же. `npm run contracts:format:check` и `tests/contract-validation.test.ts` не
затронуты — набор операций и маршрутов не меняется.

**`task-back-001`.** Получает готовые специфаеры (Р1) и снимает свою блокировку. Решение Р11
(запуск из исходников, `allowImportingTsExtensions` для собственных относительных импортов) остаётся
в силе и от этой задачи не зависит: для импорта `@minical/backend-contract/zod` флаг не нужен (Ф20).
Р12 `task-back-001` требует уточнения — предложенная там правка недостаточна (Ф2); формально Р12
описывает не сделанное этой задачей, а её постановку, поэтому `task-back-001/adr.md` в `черновик` не
возвращается, но `result.md` этой задачи обязан зафиксировать расхождение, чтобы Backend Agent не
пошёл по специфаеру из Р12.

**`task-front-guest-001`.** Получает единственный специфаер `@minical/api-client` (Р2) для функций,
типов и `client`. Её FR2/FR3 добавляют зависимость в `apps/client/package.json` и вызывают
`client.setConfig({ baseUrl })` из конфигурации клиента; ни одна правка в generated-пакетах ей не
потребуется. Специфаеры глубоких импортов в `src/generated/**` ей теперь недоступны физически —
это желаемое поведение.

**`task-infra-004` (Prism-мок).** Не затронут: мок работает поверх `openapi.yaml`, который не
меняется. Ограничение «Import-плюмбинг клиента» из его `result.md` закрывается этой задачей.

**Будущая контрактная задача.** Из её списка выпадает пункт про `@server` как средство лечения
`baseUrl: 'packages'` (Р6, Ф23). Гапы G1, G2, G4 из `task-back-001/adr.md` этой задачей не
затрагиваются и остаются за ней.

**Docker и упаковка.** Решение сохраняет требование `task-back-001`: контейнер обязан ставить
зависимости в корне репозитория, сохраняя симлинки npm workspaces. Для `backend-contract` это
критично по той же причине, что и раньше (type stripping внутри физического `node_modules` падает с
`ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING`), и `exports` этого не меняет: он указывает на
`.ts`-файл, который Node исполняет только вне `node_modules` по realpath. `api-client` в контейнер не
попадает — он собирается Metro на стороне клиента.

**Обратная совместимость.** Ломать нечего: у обоих пакетов пока нет ни одного потребителя (Ф25), а
`npm run typecheck` на HEAD зелёный (Ф26). Единственное поведенческое изменение вне пакетов — то, что
станет **возможным** импортировать их по имени.

## Вопросы к brief

Brief согласован и не правится; ниже расхождения и решения, найденные при проектировании. Q1 и Q2
требуют явного подтверждения.

**Q1. Правка `input` в конфигах генерации формально затрагивает non-goal.** Brief относит
исправление `baseUrl: 'packages'` к non-goals, но описывает его как контрактную правку (`@server` в
`.tsp`). Ф23 показывает, что причина — bare-относительный путь `input` в
`openapi-ts.config.ts`, то есть в файле, который задача открывает по FR2. Решение ADR (Р6) —
исправить причину здесь: +4 строки к generated-diff `api-client` и +2 строки в `types.gen.ts`
`backend-contract`. Прошу подтвердить. При отказе задача выполняется без Р6, `baseUrl: 'packages'`
остаётся, ни одно другое решение не меняется.

**Q2. Специфаер `@minical/backend-contract/zod` против прозы сценария 1.** Сценарий 1 brief
записан как `import { zCreatePublicBookingBody } from '@minical/backend-contract'`. Решение ADR
(Р1) даёт схемы по подпути `/zod`, а по `.` — только типы; FR1 («резолвится по имени пакета») и FR2
(«`exports` с подпутём» как допустимый механизм) этому не противоречат, а AC5 требует записать
специфаер как результат задачи. Единый специфаер возможен (альтернатива А1) ценой
`allowImportingTsExtensions` в `apps/api/tsconfig.json` и связки, описанной в Р1. Прошу подтвердить
выбор.

**Q3. Проверки AC1/AC2 требуют временных файлов в `apps/api` и `apps/client`.** Задача эти каталоги
не меняет, но критерии сформулированы «из `apps/api`» и «из `apps/client`». Решение ADR (Р8) —
временные пробники, удаляемые до коммита, с подтверждением через AC3. Противоречия с brief нет;
фиксирую, чтобы способ проверки не выглядел выходом за scope.

**Q4. AC2 упоминает `expo export --platform web` как способ подтверждения.** Резолв уже подтверждён
настоящим `metro-resolver` с конфигом Expo 57 (Ф10), но полная сборка в текущем состоянии клиента
(один `App.tsx`, без `metro.config.js`) не проверялась. Если `expo export` окажется неработоспособен
по причинам, не связанным с пакетом, brief FR4 допускает «фактический резолв Metro» как
самостоятельное подтверждение — этот путь и будет использован, с явной пометкой в `result.md`.

## Подтверждения пользователя (2026-08-07)

| Вопрос | Решение | Следствие |
|---|---|---|
| Q1 — правка `input` в конфигах генерации (Р6) | **подтверждено: чинить здесь** | `input` → `./packages/contracts/generated/openapi.yaml` в обоих конфигах; `baseUrl: 'packages'` исчезает; generated-diff растёт на 4 строки у `api-client` и 2 строки в `types.gen.ts` у `backend-contract`. Из будущей контрактной задачи пункт про `@server` снят как беспредметный — в `task-contract-001/brief.md` FR8 помечен снятым и перенесён в non-goals |
| Q2 — специфаер Zod-схем (Р1) | **подтверждено: два входа** | Схемы — `@minical/backend-contract/zod`, типы — `@minical/backend-contract`. Альтернатива А1 (единый вход через регенерацию) отклонена: требует `allowImportingTsExtensions` в чужом `apps/api/tsconfig.json` и закрывает `apps/api` возврат к `tsc`-сборке, который Р11 `task-back-001` держит как путь отступления для Docker |
| Q3 — временные пробники для AC1/AC2 | принято как способ проверки | Файлы удаляются до коммита, отсутствие следов подтверждается AC3 |
| Q4 — способ подтверждения AC2 | принято | При неработоспособности `expo export` допускается фиксация фактического резолва `metro-resolver` с выводом в `result.md` (brief FR4) |

Дополнительно исправлено в зависимых документах: `task-back-001/adr.md` (Р12) содержал специфаер
`exports: { ".": "./src/generated/index.ts" }`, который по Ф2 даёт ноль экспортов в рантайме — запись
исправлена на итоговые два специфаера; `task-back-001/plan.md` (P01) получил проверку наличия
экспортов вместо проверки успешного резолва.
