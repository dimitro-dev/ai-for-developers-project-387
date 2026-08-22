# План TASK-INFRA-005

Объём работ ограничен разделом «Затронутые компоненты» `adr.md`. Каждый пункт ссылается на решение
ADR (`Р1`…`Р8`), на проверенный факт (`Ф1`…`Ф26`) и на требование brief (`FR*`, `AC*`). Решения не
переизобретаются: Q1 (правка `input`) и Q2 (два специфаера у `backend-contract`) подтверждены
пользователем 2026-08-07, альтернативы А1–А10 отклонены в ADR.

## Декомпозиция

| ID | Цель / проблема | Решение | Состояние |
|---|---|---|---|
| P01 | `@minical/backend-contract` не резолвится по имени: в `package.json` нет ни `exports`, ни `main`. При этом одного входа `"."` недостаточно — generated entry состоит из единственного `export type` и в рантайме пуст (Ф2), то есть FR3 `task-back-001` им не разблокировался бы | Р1: в `packages/backend-contract/package.json` добавить `"exports": { ".": "./src/generated/index.ts", "./zod": "./src/generated/zod.gen.ts" }`. Больше в пакете на этом шаге ничего не меняется, конфигурация генерации не открывается, generated-diff нулевой. Проверка (из корня репозитория): `node -e "import('@minical/backend-contract/zod').then(m => console.log(Object.keys(m).length))"` печатает `44`, а `safeParse` валидного тела через `zCreatePublicBookingBody` даёт `success: true` (Ф19); `node -e "import('@minical/backend-contract').then(m => console.log(Object.keys(m).length))"` печатает `0` — это ожидаемое поведение по Ф2, а не дефект (компромисс 1 ADR, обязателен к фиксации в `result.md`); `git status --porcelain` показывает ровно один изменённый файл | завершено |
| P02 | `@minical/api-client` непригоден к импорту по трём независимым причинам: нет `exports`; generated-граф склеен значимыми `.js`-специфаерами файлов, которых на диске нет (Ф4), поэтому ни Node, ни Metro его не собирают (Ф1, Ф7, Ф9); entry не реэкспортирует экземпляр `client`, без которого недоступен `setConfig({ baseUrl })`. Плюс сам `baseUrl` сгенерирован как нерабочее `'packages'` (Ф23) | Р2 + Р6: три файла пакета. `openapi-ts.config.ts` — `input: './packages/contracts/generated/openapi.yaml'` (Р6, Q1 подтверждён), `output.module.extension: null` (Ф21) и `plugins: [{ name: '@hey-api/client-fetch', includeInEntry: true }]` (Ф22) вместо строкового элемента; `output.path` не меняется. `package.json` — `"exports": { ".": "./src/generated/index.ts" }`: один вход, подпуть `./client` не нужен, так как `client` попадёт в entry. `tsconfig.json` — `module: "preserve"`, `moduleResolution: "bundler"`, `noEmit: true` при сохранении `extends ../../tsconfig.base.json` и `include: ["src"]` (Ф18); extensionless-вывод в NodeNext недопустим (Ф17), поэтому пакет честно становится bundler-only (компромиссы 2 и 3 ADR). Проверка этого пункта — только содержимое трёх файлов: фактический вывод генератора появится в P04, а `typecheck` пакета зелен и до регенерации (tsc сопоставляет `.js`-специфаер с `.ts`-файлом в любом режиме резолва) и потому здесь ничего не доказывает | завершено |
| P03 | Р6 требует убрать причину `baseUrl: 'packages'` в **обоих** конфигах генерации: bare-относительный путь `input` парсится `getBaseUrl` как URL, и первый сегмент становится host (Ф23). У `backend-contract` тот же путь протёк в тип `ClientOptions.baseUrl` в `types.gen.ts` | Р6: в `packages/backend-contract/openapi-ts.config.ts` заменить `input` на `./packages/contracts/generated/openapi.yaml`; `plugins` и `output.path` не трогать. Это единственная правка данного пакета, дающая generated-diff, — ровно 2 строки в `types.gen.ts` (`` `${string}://packages` `` → `` `${string}://${string}` ``, Р4). Пункт отделён от P01 именно потому, что P01 обязан оставаться правкой с нулевым generated-diff. Проверка: содержимое файла; фактический diff — P04 и P05 | завершено |
| P04 | Конфиги изменены, а generated-вывод в git ещё прежний: `generate:check` красный, а FR5/AC4 требуют, чтобы результат регенерации входил в тот же коммит, что и правка конфигурации | Один прогон `npm run generate` (`contracts:build` → `generate:client` → `generate:backend`), затем `git add` изменённых generated-каталогов и `npm run generate:check`. Важно: `generate:check` — это повторная генерация плюс `git diff --exit-code`, то есть сравнение рабочего дерева с **индексом**; зелёным он станет только после индексации или коммита регенерированных файлов. Ожидаемый объём (измерен в ADR, Р4): `packages/api-client/src/generated` — 12 файлов, 81 строка (`<` + `>`); `packages/backend-contract/src/generated/types.gen.ts` — 2 строки; `packages/contracts/generated/openapi.yaml` — без изменений вовсе (API impact `NONE`, Ф24). Расхождение с этими числами не «поправляется на месте» руками (правило 6), а разбирается в P05 | завершено |
| P05 | Правка конфигурации генерации в принципе способна изменить не упаковку, а контрактную часть вывода — имена операций, формы запросов и ответов, Zod-схемы. Definition of Done роли Contract Agent требует просмотра generated diff, и это единственная защита от такого исхода | Ручной просмотр `git diff --cached -- packages/contracts/generated packages/api-client/src/generated packages/backend-contract/src/generated` по закрытому чеклисту. Допустимы ровно четыре вида изменённых строк: (а) module specifier потерял `.js` — включая каталожный `'./client/index.js'` → `'./client'` и `'../core/*.gen.js'` → `'../core/*.gen'`; (б) единственная новая строка `export { client, type CreateClientConfig } from './client.gen'` в `api-client/src/generated/index.ts`; (в) `createConfig({ baseUrl: 'packages' })` → `createConfig()` в `client.gen.ts`; (г) тип `baseUrl` в двух `types.gen.ts`. Дополнительно сверяется: список 11 имён операций в `sdk.gen.ts` и в обоих `index.ts` совпадает с прежним; `--stat` не содержит `zod.gen.ts` и `openapi.yaml`; ни одна строка не находится внутри тела функции или определения типа запроса/ответа. Любое отклонение останавливает пункт, фиксируется в `result.md` и при материальности возвращает `adr.md` в `черновик` (правило 8) | завершено |
| P06 | AC1 сформулирован «из `apps/api`», но задача этот каталог не меняет; резолв, проверенный из корня в P01, не равен резолву из потребителя (у него свой `tsconfig.json` с NodeNext и `types: ["node"]`) | Р8, временный пробник: создать `apps/api/src/__probe.ts` с `import { zCreatePublicBookingBody } from '@minical/backend-contract/zod'` и `import type { CreateBookingRequest } from '@minical/backend-contract'`, с `safeParse` валидного и невалидного тела. Прогнать рантайм — `node apps/api/src/__probe.ts` (type stripping разрешён, потому что путь идёт через симлинк npm workspaces, а не через физический `node_modules`), и компилятор — `npm run typecheck -w @minical/api`; флагов в `apps/api/tsconfig.json` для этого не требуется (Ф20), файл чужой роли не открывается. Затем пробник удалить. Команды и их вывод — в `result.md` (AC1 требует именно вывод) | завершено |
| P07 | AC2 сформулирован «из `apps/client`». Резолв Metro подтверждён настоящим `metro-resolver` 0.84.4 с knob'ами реального конфига Expo 57 (Ф10, Ф11), но не сборкой; до этой проверки AC2 считается непроверенным (компромисс 5 ADR) | Р8, временный пробник: `apps/client/__probe.ts` с `import { client, getPublicEventTypes, getPublicSlots, createPublicBooking } from '@minical/api-client'`, вызовом `client.setConfig({ baseUrl: 'http://localhost:3001' })` и ссылками на все три функции; импорт пробника из `App.tsx`, чтобы он попал в граф. Прогнать `npm run build -w @minical/client` (это и есть `expo export --platform web`) и `npm run typecheck -w @minical/client` (Ф16 — extensionless-вывод проходит bundler-режим без флагов). Затем удалить пробник, вернуть `App.tsx` через `git checkout -- apps/client/App.tsx`, убрать `apps/client/dist/` и `apps/client/.expo/` (оба в `.gitignore`). Если `expo export` неработоспособен по причинам вне пакета — замена по Q4/FR4, см. блокер R2 | завершено |
| P08 | Пункты проверялись поодиночке и во временно загрязнённом дереве; AC3 и AC4 требуют одного прогона всех гейтов на чистом дереве | Полный чеклист раздела «Обязательные проверки» этого файла: `npm run contracts:format:check`, `npm run generate:check`, `npm run typecheck`, `npm test` — четыре команды по `AGENTS.md` (пятая, `uispec:validate`, входит в `npm test` и по существу не применима). Плюс AC3: `git status --porcelain` пуст, а `git diff --cached --name-only` содержит ровно ожидаемый набор — два `package.json`, два `openapi-ts.config.ts`, `packages/api-client/tsconfig.json` и generated-каталоги двух пакетов; ни одного файла в `apps/**`, `packages/contracts/**` и `docs/**`. Результаты команд и их вывод фиксируются в `result.md` | завершено |
| P09 | AC5: без записанных специфаеров `task-back-001` (FR3) и `task-front-guest-001` (FR2/FR3) начнут выяснять их заново, а `task-back-001/adr.md` (Р12) содержал специфаер, дающий ноль экспортов в рантайме (Ф2) | Заполнить `tasks/task-infra-005/result.md`: **точные import-специфаеры** — `import { zCreatePublicBookingBody, zGetPublicSlotsQuery } from '@minical/backend-contract/zod'` для схем и `import type { CreateBookingRequest, ErrorResponse } from '@minical/backend-contract'` для типов; `import { client, getPublicEventTypes, getPublicSlots, createPublicBooking } from '@minical/api-client'` — единственный вход клиента, там же типы, там же `client.setConfig({ baseUrl })`. Плюс: почему `.` у `backend-contract` пуст в рантайме (компромисс 1); что `api-client` стал bundler-only (компромисс 2); что расхождение с Р12 `task-back-001` устранено; contract impact `NONE`; какой из путей Р7/Q4 применялся, если применялся. Обновить строку `infra-005` в реестре задач `tasks/README.md` по факту результата. Проверка: каждый специфаер в `result.md` дословно совпадает с тем, что реально прогонялось в P06 и P07 | завершено |

Допустимые состояния:

```text
в плане
выполняется
завершено
```

## Порядок и зависимости

```text
P02 ─┬─→ P04 ─→ P05 ─┬─→ P07 (AC2) ─┐
P03 ─┘               │              ├─→ P08 ─→ P09
P01 ─────────────────┴─→ P06 (AC1) ─┘
```

- **P01 идёт первым** и стоит особняком: это единственная правка задачи с нулевым generated-diff, её результат проверяем сразу и не зависит от генерации. Так же он служит входным контролем Ф19 в реальном дереве, а не на реплике.
- **P02 и P03 — только правка конфигураций, без прогона генератора.** Порядок между ними произволен; оба обязаны быть сделаны до P04, иначе регенерация пройдёт частично и diff придётся смотреть дважды.
- **P04 — единственная точка, где меняется `src/generated/**`,** и делается одним прогоном на оба пакета: `npm run generate` перегенерирует всё, разделять его по пакетам нельзя.
- **P05 строго после P04 и строго до проверок потребителями.** Смысл порядка: если конфиг задел контрактную часть вывода, это выяснится до того, как пробники «подтвердят» неверный артефакт.
- **P06 и P07 независимы друг от друга** (разные пакеты, разные потребители, разные тулчейны) и могут идти в любом порядке. P06 технически исполним уже после P01, но записываемый в `result.md` прогон должен быть на пост-P04 состоянии — иначе он проверит вывод, которого в коммите не будет.
- **P08 после обоих пробников:** его часть про чистоту дерева (AC3) имеет смысл только когда временные файлы удалены.
- **P09 последний:** он фиксирует то, что фактически прогонялось, а не то, что планировалось.

## Обязательные проверки

Полный список — в [`AGENTS.md`](../../../AGENTS.md), результаты фиксируются в `result.md`.

- [x] `npm run contracts:format:check` — применима формально: `packages/contracts/src/**/*.tsp` не открывается (API impact `NONE`), команда обязана проходить без изменений
- [x] `npm run generate:check` — **ключевая проверка задачи** (FR5, AC4): меняются обе конфигурации генерации, поэтому регенерированный вывод обязан лежать в том же коммите; при незакоммиченной (и непроиндексированной) регенерации команда красная по построению — `git diff --exit-code` сравнивает дерево с индексом
- [x] `npm run typecheck` — проверяет все workspaces; критична для `packages/api-client`, который переводится в bundler-режим над extensionless-выводом (Ф18), и для временных пробников, пока они лежат в `apps/api` и `apps/client`
- [x] `npm test` — корневой гейт; набор маршрутов и операций не меняется, поэтому обязан проходить **без** правок `tests/contract-validation.test.ts` (11 операций как есть)
- [x] `npm run uispec:validate` — по существу не применима: `docs/ui-spec-kit/` и UI-код `apps/client/` не меняются (временный пробник P07 удаляется до коммита); выполняется только внутри `npm test`
- [x] Проверка потребителем AC1 (Р8): `node apps/api/src/__probe.ts` + `npm run typecheck -w @minical/api`, затем удаление пробника — P06
- [x] Проверка потребителем AC2 (Р8): `npm run build -w @minical/client` (`expo export --platform web`) + `npm run typecheck -w @minical/client`, затем удаление пробника и восстановление `App.tsx` — P07
- [x] `git status --porcelain` пуст и `git diff --cached --name-only` содержит ровно ожидаемый набор файлов — машинный критерий AC3 и незаметности пробников — P08
- [x] `npm run mock:prism` — **не нужна**: контракт не меняется, `packages/contracts/generated/openapi.yaml` остаётся байт-в-байт тем же (Ф24), мок `task-infra-004` работает поверх него и не затронут

Соответствие acceptance criteria и проверок:

| AC | Чем проверяется | Пункт |
|---|---|---|
| AC1 — импорт `@minical/backend-contract` из `apps/api` в рантайме Node 26 и при `tsc --noEmit`, с выводом команд | временный пробник: `node apps/api/src/__probe.ts` (44 схемы, `safeParse`) + `npm run typecheck -w @minical/api`; предварительно — резолв из корня в P01 | P01, P06 |
| AC2 — из `apps/client` доступны три гостевые операции и установка `baseUrl` | `npm run build -w @minical/client` (`expo export --platform web`) + `npm run typecheck -w @minical/client`; при неработоспособности сборки — фиксация фактического резолва `metro-resolver` (Q4, FR4) | P07 |
| AC3 — ни один файл в `packages/*/src/generated/**` не отредактирован вручную | `src/generated/**` меняется единственным прогоном `npm run generate` (P04); просмотр diff по чеклисту (P05); `git status --porcelain` и `git diff --cached --name-only` (P08) | P04, P05, P08 |
| AC4 — `npm run typecheck`, `npm test`, `npm run generate:check` проходят | четыре корневые команды чеклиста одним прогоном на чистом дереве | P08 |
| AC5 — точные import-специфаеры записаны в `result.md` как вход для `task-back-001` и `task-front-guest-001` | текст `result.md` сверяется с тем, что дословно прогонялось в P06 и P07 | P09 |

## Блокеры и открытые вопросы

Блокеров, останавливающих старт, нет: зависимости `002`, `003`, `006` завершены, `npm run typecheck`
на HEAD зелёный (Ф26), потребителей у пакетов пока нет и сломать нечего (Ф25).

**R1. План Б, если Metro всё-таки не соберёт `api-client` (Р7).** Порядок отступления зафиксирован в
ADR, чтобы его не переоткрывать; отдельными пунктами работ он не оформляется, потому что срабатывает
только по симптому в P07.

1. *«Пакет не найден»* — Metro не применил `exports`: добавить в `packages/api-client/package.json`
   поле `"main": "./src/generated/index.ts"` рядом с `exports`. Одна строка, специфаер потребителя не
   меняется. Сразу не добавляется: `exports` работает (Ф5, Ф10), а два поля с одним путём — два места
   для расхождения (А8).
2. *«Модуль внутри пакета не найден»* — вернуть `module: { extension: '.ts' }`, перегенерировать и
   добавить `allowImportingTsExtensions: true` в `packages/api-client/tsconfig.json` **и** в
   `apps/client/tsconfig.json`. Вторая правка выходит за границы роли (правило 10), поэтому требует
   согласования с Frontend Agent и обязательной записи в `result.md`. Объём diff при этом меняется —
   чеклист P05 прогоняется заново.
3. *«Metro не трансформирует `.ts` из workspace-пакета»* (Ф12 делает это маловероятным) —
   единственный оставшийся путь (сборка в `.js`/`dist`) прямо запрещён НФТ brief, поэтому пункт не
   решается молча: `brief.md` возвращается в `черновик`.

**R2. `expo export` может оказаться неработоспособен по причинам вне пакета.** Клиент сейчас — один
`App.tsx` без `metro.config.js`, полная сборка в проекте не прогонялась ни разу. Если она падает по
причине, не связанной с резолвом `@minical/api-client` (конфигурация Expo, web-энтрипоинт, ассеты),
Q4 и FR4 допускают замену: фиксация фактического резолва настоящим `metro-resolver` скриптом вне
репозитория с выводом в `result.md`, плюс `npm run typecheck -w @minical/client` как проверка
компилятора. Замена обязана быть помечена в `result.md` явно — AC2 в этом случае подтверждён
резолвером, а не сборкой (компромисс 5 ADR остаётся в силе).

**R3. `apps/client` не объявляет `@minical/api-client` зависимостью — и это не нужно исправлять
здесь.** Для резолва объявление не требуется: npm workspaces уже создали симлинки в корневом
`node_modules`, Metro ищет по `nodeModulesPaths`, включающему корень репозитория (Р5), а `tsc`
поднимается по каталогам `node_modules` вверх. Объявление зависимости — работа `task-front-guest-001`
(её FR2); правка `apps/client/package.json` здесь нарушила бы правило 10. Практическое следствие для
P07: пробник обязан импортировать пакет по имени, а не относительным путём, иначе проверка потеряет
смысл.

То же верно для `apps/api`, у которого в `package.json` сейчас нет секции `dependencies` вовсе:
пробник P06 резолвится через тот же симлинк, объявление `@minical/backend-contract` — работа
`task-back-001` (его P01).

**R4. Объём generated-diff измерен на реплике при `@hey-api/openapi-ts` 0.99.0 из текущего
`package-lock.json`.** Числа Р4 (12 файлов / 81 строка у `api-client`, 2 строки у
`backend-contract`) верны для этой версии; любое обновление генератора между ADR и реализацией меняет
их и делает чеклист P05 неполным. Если фактический diff отличается по составу, а не только по
количеству, пункт P05 не «подгоняется» — расхождение идёт в `result.md`.

**O1. Фиксировать специфаеры только в `result.md` или ещё и в `AGENTS.md`.** ADR («Затронутые
компоненты», последний абзац) отмечает, что `AGENTS.md` описывает оба generated-пакета без упоминания
точек входа. По умолчанию AC5 закрывается `result.md`, и план так и построен (P09). Если reviewer
хочет, чтобы специфаеры попали в глобальную документацию, это добавляется отдельным пунктом; молча
править `AGENTS.md` план не будет.
