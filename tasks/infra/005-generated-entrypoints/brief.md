# TASK-INFRA-005 — Публичные точки входа generated-пакетов

## Контекст и проблема

Ни один из двух generated-пакетов сейчас нельзя импортировать по имени: у обоих в `package.json` нет
ни `exports`, ни `main`.

- `@minical/backend-contract` — проверено фактически: `import('@minical/backend-contract')` из корня
  репозитория падает с `ERR_MODULE_NOT_FOUND` (зафиксировано в `task-back-001/adr.md`, таблица
  проверок «Контекст»). Пакет содержит 44 Zod-схемы и transport-типы, на которых по FR3
  `task-back-001` обязан валидировать вход. Без точки входа backend физически не может их
  импортировать.
- `@minical/api-client` — та же болезнь плюс вторая: generated `src/generated/index.ts`
  реэкспортирует только функции операций и типы, но **не** экземпляр `client`, а он живёт в
  отдельном `src/generated/client.gen.ts`. При этом сконфигурирован он с `baseUrl: 'packages'` —
  артефакт генерации, нерабочее значение, поэтому без явной установки base URL ни один запрос
  клиента не уйдёт по назначению. `task-infra-004/result.md` («Известные ограничения и риски» →
  «Import-плюмбинг клиента») фиксирует именно это: точный import-спецификатор для `setConfig` не
  задокументирован, а подключение SDK названо non-goal той задачи.

Итог: одна и та же недоделка упаковки блокирует две задачи с двух сторон — реализацию
`task-back-001` и FR2 `task-front-guest-001`. Каждая из них могла бы вылечить симптом у себя
(глубокий относительный импорт, `paths` в своём `tsconfig.json`), но оба обходных пути создают
второй источник правды о расположении пакета, а `paths` к тому же лечит компилятор и не лечит
рантайм.

Владелец обоих файлов один — Contract Agent (`AGENTS.md`, таблица «Пакеты и границы»: generated-пакеты
меняются только через `npm run generate`). Ни Backend, ни Frontend Agent не вправе править их
`package.json` по правилу 10, поэтому правка выносится в отдельную задачу. Идентификатор `infra-005`
выбран потому, что реестр типов задач в `tasks/README.md` допускает только `infra`, `back`,
`front-ui`, `front-guest`, `front-owner`, а по существу это упаковка и toolchain; исполнитель —
Contract Agent.

## Цель

Сделать оба generated-пакета импортируемыми по имени из их потребителей — `apps/api` (Node 26) и
`apps/client` (Metro / Expo 57) — не редактируя generated-файлы вручную и не меняя контракт.

## Зависимости

- `002`, `003`, `006` — контракт и generated-пакеты существуют в текущем виде.

Задача **блокирует** реализацию `task-back-001` (импорт Zod-схем) и `task-front-guest-001` (FR2/FR3 —
инициализация SDK и base URL).

## Пользовательские сценарии

Сценариев конечного пользователя нет — потребители задачи технические:

1. Backend Agent пишет `import { zCreatePublicBookingBody } from '@minical/backend-contract'` в
   `apps/api/src/http/handlers.ts`, и это работает и при `tsc --noEmit`, и при `node src/server.ts`.
2. Frontend Agent получает функции гостевых операций и возможность задать `baseUrl` SDK по
   задокументированному спецификатору, без глубоких импортов в `src/generated/**`.

## Функциональные требования

**FR1.** `@minical/backend-contract` резолвится по имени пакета из `apps/api`: доступны Zod-схемы и
transport-типы. Работает в двух режимах — рантайм Node 26 (проект запускается из исходников, решение
Р11 `task-back-001/adr.md`) и `tsc --noEmit` с `moduleResolution: NodeNext`.

**FR2.** `@minical/api-client` предоставляет задокументированный публичный доступ к двум вещам:
функциям операций с их типами и экземпляру `client` (для `client.setConfig({ baseUrl })`). Механизм
выбирает `adr.md`; варианты, из которых нужно выбрать явно:

- `exports` с подпутём (например, `.` и `./client`);
- рукописный `src/index.ts` вне `src/generated/**`, реэкспортирующий и то, и другое;
- изменение конфигурации генерации (`packages/api-client/openapi-ts.config.ts`) так, чтобы generated
  `index.ts` сам реэкспортировал `client`, с последующей регенерацией.

**FR3.** Правило 6 не нарушается: generated-файлы вручную не редактируются. Допустимы правки
`package.json`, файлов вне `src/generated/**` и конфигураций генерации с последующей регенерацией
командой `npm run generate`.

**FR4.** Совместимость обоих потребителей проверена фактически, а не по документации:

- Node 26 — с учётом того, что type stripping внутри физического `node_modules` запрещён
  (`ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING`), а через симлинк npm workspaces работает;
- Metro / Expo 57 — поддержка `exports` и резолв `.ts`-исходника из пакета workspace. Это главный
  риск задачи: если Metro не резолвит выбранный механизм, для `api-client` понадобится другой
  (например, `main` вместо `exports`), и решение должно это учитывать.

**FR5.** `npm run generate:check` остаётся зелёным. Если менялась конфигурация генерации, результат
регенерации входит в тот же коммит, чтобы diff отсутствовал.

## Нефункциональные требования

- Минимальная правка: никаких новых зависимостей, никакой сборки пакетов в `.js`/`dist`.
- `npm run typecheck` и `npm test` проходят без изменения своего смысла.
- Оба пакета остаются `private: true` — публикация в реестр не предполагается.

## API impact

`NONE` — `packages/contracts/src/**/*.tsp` не меняется, форма HTTP-контракта не затрагивается.

## Acceptance criteria

1. Из `apps/api` импорт по имени `@minical/backend-contract` работает в рантайме Node 26 и при
   `tsc --noEmit`; проверка зафиксирована командой и её выводом.
2. Из `apps/client` доступны функции трёх гостевых операций и установка `baseUrl` SDK по
   задокументированному спецификатору; подтверждено фактическим резолвом Metro либо
   `expo export --platform web`.
3. Ни один файл в `packages/*/src/generated/**` не отредактирован вручную: `git diff` содержит
   только `package.json`, файлы вне `generated/`, конфигурацию генерации и её регенерированный вывод.
4. `npm run typecheck`, `npm test`, `npm run generate:check` проходят.
5. В `result.md` записан точный import-спецификатор для обоих пакетов — он становится входом для
   `task-back-001` и `task-front-guest-001`, чтобы им не пришлось это выяснять заново.

## Non-goals

- Исправление `baseUrl: 'packages'` на уровне контракта (добавление `@server` в `.tsp`) — изменение
  контракта, отдельная контрактная задача.
- Закрытие contract gaps, найденных в `task-back-001/adr.md` (G1, G2, `@minLength(1)` у ссылок на
  `eventTypeId`) — та же отдельная контрактная задача.
- Сборка generated-пакетов в JavaScript, `dist`, публикация в npm.
- Реализация backend или клиента — задачи `task-back-001` и `task-front-guest-001`.
- CORS, security-заголовки, Docker — другие infra-задачи.

## Связанные документы

- [`../../back/001-api-skeleton/adr.md`](../../back/001-api-skeleton/adr.md) — Р12 и таблица проверок окружения
- [`../004-contract-mock-prism/result.md`](../004-contract-mock-prism/result.md) — «Import-плюмбинг клиента»
- [`../../front/guest/001-client-foundation/brief.md`](../../front/guest/001-client-foundation/brief.md) — FR2/FR3
- [`../../../docs/contract-pipeline.md`](../../../docs/contract-pipeline.md)
- [`../../../.opencode/agents/contract-agent.md`](../../../.opencode/agents/contract-agent.md)
