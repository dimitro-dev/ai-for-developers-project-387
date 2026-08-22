# Результат TASK-INFRA-003

## Итог

Middleware-цепочка `apps/api` настроена: CORS с `Access-Control-Allow-Origin: *`, два
security-заголовка на всех ответах, лимит тела 64KB с ответом `413 PAYLOAD_TOO_LARGE`. Реализовано по
плану P01–P10 без отклонений от решений ADR; **новых npm-зависимостей нет** — `apps/api/package.json`
и `package-lock.json` не открывались (Р1).

Кода — четыре файла: новый модуль `http/security.ts`, три строки монтирования в `app.ts`, одна ветка
в `errorMiddleware`, новый тест-файл `http/security.test.ts`. Backend-тесты — 71 в пяти файлах
(было 64 в четырёх), exit 0. Корневые гейты (`contracts:format:check`, `generate:check`, `typecheck`,
`npm test`) зелены, generated-каталоги не тронуты: API impact `NONE`.

AC1–AC4 закрыты автотестами и curl'ом. AC5 закрыт 2026-08-12 браузерным smoke пользователя: `fetch` из
консоли браузера на `http://localhost:8081` вернул `{status: 'ok'}`, консоль без CORS-ошибок.

## Что изменено

| Файл | Изменение | Решение |
|---|---|---|
| `apps/api/src/http/security.ts` | новый: `BODY_LIMIT_BYTES = 64 * 1024`, `securityHeaders` (`nosniff`, `DENY`), `cors` (`ACAO: *` всегда; `OPTIONS` → `204` + `Allow-Methods` из `ROUTES` + `Allow-Headers: Content-Type`) | Р1–Р5 |
| `apps/api/src/app.ts` | `app.use(securityHeaders)` → `app.use(cors)` → `express.json({ limit: BODY_LIMIT_BYTES })` в начале `createApp`, до цикла монтирования; комментарий про «работу task-infra-003» заменён описанием фактической цепочки и причины порядка | Р2, Р5 |
| `apps/api/src/http/errors.ts` | ветка `isPayloadTooLargeError` → `413 {code:'PAYLOAD_TOO_LARGE'}` рядом с существующей `entity.parse.failed`; хелперы `isPayloadTooLargeError` и `payloadTooLargeMessage`. `ERROR_STATUS` и `DomainErrorCode` не расширялись | Р6 |
| `apps/api/src/http/security.test.ts` | новый: 7 тестов на AC1–AC4 плюс регрессия парсинга; свой харнесс (`createApp` + `listen(0)` + `fetch`), потому что клиент из `api.test.ts` отдаёт только статус и тело, а здесь проверяются заголовки | Р9.1 |
| `apps/api/AGENTS.md` | вступление; раздел «Middleware и место для `task-infra-003`» → «Middleware-цепочка» с фактическим порядком, лимитом и его областью действия; `413` добавлен к ответам вне контракта; состав и число тестов (71 / 5 файлов) | P09 |
| `AGENTS.md` | дерево `apps/api/src`: `http/` пополнен модулем `security` | P09 |
| `tasks/README.md` | строка `infra-003` в реестре инфраструктуры и в «Плане разработки»; строка в снимке «Где мы сейчас» со сноской ³; сводный абзац про три ответа вне контракта (G3 + G5) после раздела о contract-first | P09 |

Не изменялись: `apps/api/package.json` и `package-lock.json` (зависимостей не добавилось),
`packages/contracts/**`, все `generated/**`, `tests/contract-validation.test.ts`, `README.md` (ни новой
команды, ни новой зависимости, ни счётчика тестов там нет), `docs/**`, остальные файлы
`apps/api/src/**`.

## Контракт и generated-артефакты

**API impact `NONE`.** `.tsp` не открывался, `npm run generate:check` зелен, `git diff -- packages/`
пуст. Единственный новый ответ — `413 PAYLOAD_TOO_LARGE` — контрактом не описан и зафиксирован как
gap **G5** (см. «Известные ограничения»).

Форма ответа сверена с контрактом: базовая модель `ErrorResponse`
(`packages/contracts/src/models/errors.tsp`) объявляет `code` как `string` с `@maxLength(100)`, а
литеральные коды сужают только производные модели — значит `{code, message}` с новым кодом остаётся
валидным `ErrorResponse`, просто недокументированным.

## Выполненные проверки

### Обязательные гейты `AGENTS.md`

| Команда | Exit code | Фактический вывод |
|---|---:|---|
| `npm run contracts:format:check` | 0 | `- Checking format` / `✔ 9 formatted` |
| `npm run generate:check` | 0 | `✓ ./packages/backend-contract/src/generated · 3 files · 79ms`; diff по `packages/` пуст |
| `npm run typecheck` | 0 | `tsc --noEmit` без диагностик во всех четырёх workspaces |
| `npm test` (корневой) | 0 | `✅ All contract validation checks passed`; `uispec:validate` в его составе — без ошибок |
| `npm test -w @minical/api` | 0 | `tests 71 / pass 71 / fail 0`, `suites 0`, `skipped 0`, `todo 0` |

`npm run uispec:validate` отдельно не запускался — входит в корневой `npm test`; по существу не
применим, `docs/ui-spec-kit/` и UI-код клиента не менялись.

### Новые тесты (`src/http/security.test.ts`)

| Тест | Что доказывает |
|---|---|
| `GET` с `Origin` → `ACAO: *` + `nosniff` + `DENY` | AC1, AC4 |
| заголовки на `404 NOT_FOUND` | цепочка выставляет заголовки до маршрутизации: ответ об ошибке читаем из браузера |
| `OPTIONS`-preflight → `204` | AC2: статус, `ACAO: *`, `Allow-Methods: GET, POST, PUT, OPTIONS`, `Allow-Headers: Content-Type`, пустое тело |
| `Allow-Methods` покрывает все методы `ROUTES` + `OPTIONS` | Р3: производность списка — новый метод контракта появится в preflight сам |
| тело `BODY_LIMIT_BYTES + 4096` → `413` | AC3: код `PAYLOAD_TOO_LARGE`, тело ровно `{code, message}`, сообщение называет фактический лимит, `ACAO` и security-заголовки на месте |
| тело `BODY_LIMIT_BYTES − 4096` → `400 VALIDATION_ERROR` | лимит не отсекает допустимые запросы: парсер тело принял, отверг его Zod |
| битый JSON → `400 VALIDATION_ERROR` | регрессия ветки `entity.parse.failed` из `back-001`: класс ошибки другой, поведение не изменилось |

Первый прогон дал одно расхождение и оно исправлено в коде, а не в ожидании теста: производный список
методов шёл в порядке строк реестра (`GET, PUT, POST`), а brief перечисляет `GET, POST, PUT`. Добавлена
сортировка — теперь значение заголовка не зависит от порядка строк `ROUTES` и совпадает с brief
побайтно.

### Acceptance criteria

| AC | Чем проверен | Результат |
|---|---|---|
| AC1 — `ACAO: *` на GET с `Origin` | автотест + curl | `HTTP/1.1 200 OK`, `Access-Control-Allow-Origin: *` |
| AC2 — preflight `204` с тремя CORS-заголовками | автотест + curl | `HTTP/1.1 204 No Content`, `Access-Control-Allow-Origin: *`, `Access-Control-Allow-Methods: GET, POST, PUT, OPTIONS`, `Access-Control-Allow-Headers: Content-Type` |
| AC3 — тело >64KB → `413` | автотест + curl (payload 70000 байт) | `HTTP/1.1 413 Payload Too Large`, тело `{"code":"PAYLOAD_TOO_LARGE","message":"Request body exceeds the limit of 65536 bytes"}` |
| AC4 — `nosniff` и `DENY` | автотест + curl | оба заголовка на всех проверенных ответах, включая `204`, `404`, `413` |
| AC5 — браузерный smoke без CORS error | браузерный smoke пользователя 2026-08-12 | `{status: 'ok'}`, консоль без CORS-ошибок |

### Ручные проверки P06 (сервер поднят `npm start -w @minical/api`, порт 3001)

```text
$ curl -si -H "Origin: http://example.com" http://localhost:3001/health
HTTP/1.1 200 OK
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Access-Control-Allow-Origin: *                                            <- AC1, AC4

$ curl -si -X OPTIONS -H "Origin: http://example.com" \
       -H "Access-Control-Request-Method: POST" http://localhost:3001/bookings
HTTP/1.1 204 No Content
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, PUT, OPTIONS
Access-Control-Allow-Headers: Content-Type                                 <- AC2

$ curl -si -X POST -H "Content-Type: application/json" \
       --data-binary @payload-70kb.json http://localhost:3001/bookings
HTTP/1.1 413 Payload Too Large
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Access-Control-Allow-Origin: *
{"code":"PAYLOAD_TOO_LARGE","message":"Request body exceeds the limit of 65536 bytes"}   <- AC3

# то же тело без Content-Type: application/json — документированное ограничение Р5
$ curl -s -X POST --data-binary @payload-70kb.json http://localhost:3001/bookings
{"code":"VALIDATION_ERROR","message":"Invalid request: (root): Invalid input: expected object, received undefined"}
status=400

# следствия Р4
$ curl -o /dev/null -w '%{http_code}' -X OPTIONS http://localhost:3001/nope   204
$ curl -o /dev/null -w '%{http_code}'             http://localhost:3001/nope   404
```

### AC5: что сделано вместо браузерной проверки

Web-сборка клиента поднята (`npm run web -w @minical/client`, Metro на `http://localhost:8081` —
ровно тот origin, который `apps/api` держит в `PUBLIC_WEB_URL`). Дальше требовалась консоль браузера,
а браузерных инструментов в сессии исполнителя нет; выполнять `fetch` руками исполнитель не может.
Критерий **не подгонялся**: вместо него проиграны те же запросы, которые браузер отправляет из этого
origin, — так проверяется серверная половина CORS-алгоритма (клиентскую половину исполняет сам
браузер):

```text
$ curl -si -H "Origin: http://localhost:8081" /health
HTTP/1.1 200 OK · Access-Control-Allow-Origin: *

$ curl -si -X OPTIONS -H "Origin: http://localhost:8081" \
       -H "Access-Control-Request-Method: POST" -H "Access-Control-Request-Headers: content-type" /bookings
HTTP/1.1 204 No Content · Access-Control-Allow-Origin: * ·
Access-Control-Allow-Methods: GET, POST, PUT, OPTIONS · Access-Control-Allow-Headers: Content-Type

$ curl -si -X POST -H "Origin: http://localhost:8081" -H "Content-Type: application/json" -d '{}' /bookings
HTTP/1.1 400 Bad Request · Access-Control-Allow-Origin: *

$ curl -si -H "Origin: http://localhost:8081" '/slots?eventTypeId=intro'
HTTP/1.1 400 Bad Request · Access-Control-Allow-Origin: *
```

Статусы `400` здесь доменные (onboarding в свежем процессе не пройден) и к CORS отношения не имеют —
существенно, что заголовок присутствует и на них.

Закрыто 2026-08-12: пользователь выполнил этот шаг — `fetch` из консоли devtools на
`http://localhost:8081` вернул `{status: 'ok'}`, консоль без записей о CORS.

## Отклонения от brief / ADR / plan

Отклонений от решений ADR нет. Три уточнения, каждое внутри свободы, оставленной ADR:

1. **Сортировка производного списка методов** (см. «Новые тесты»): Р3 фиксировал и вывод из `ROUTES`,
   и значение `GET, POST, PUT, OPTIONS`; сортировка — то, что делает второе следствием первого
   независимо от порядка строк реестра.
2. **Сообщение `413` называет лимит числом**, взятым из поля `limit` самой ошибки
   (`Request body exceeds the limit of 65536 bytes`), поэтому `errors.ts` не импортирует
   `BODY_LIMIT_BYTES` и текст не может разойтись с фактом — как и предусматривал Р6.
3. **Улучшение против ожиданий brief.** Brief предупреждал: список методов CORS — не константа, при
   добавлении нового HTTP-метода в TypeSpec конфигурацию нужно пересматривать вручную, иначе
   preflight нового метода будет молча отклоняться. Список выводится из реестра `ROUTES`, равенство
   которого контракту доказывает `routes.contract.test.ts`, поэтому ручной шаг исчез: предупреждение
   стало неактуальным. Это улучшение против ожиданий brief, а не отклонение от него — требование
   «методы должны соответствовать фактическому набору generated OpenAPI» выполняется по построению.

Пункт **P07 переведён в `завершено`** 2026-08-12 после браузерного smoke пользователя.

## Известные ограничения и риски

**Contract gap.**

| # | Gap | Состояние |
|---|---|---|
| G5 | `413 PAYLOAD_TOO_LARGE` при превышении лимита тела контрактом не описан | open, осознанно. Класс G3 (`404 NOT_FOUND`, `500 INTERNAL_ERROR`): ситуация вне описанных операций. Форма `ErrorResponse` соблюдена, generated SDK кода не знает и разберёт ответ как неизвестную ошибку. Сводная запись — в `tasks/README.md` после раздела о contract-first; документы `back-001` (согласованы) не правились |

**Прочие ограничения, принятые ADR и подтверждённые реализацией:**

1. `Access-Control-Allow-Origin: *` открывает API для любого origin — допустимо только для локальной
   учебной среды (риск зафиксирован в security review `task-002`). Смена origin-политики — потенциальный
   breaking change для web-клиентов и потребует `Vary: Origin`.
2. Лимит 64KB действует только на тела с `Content-Type: application/json` (проверено: 70KB с другим
   типом даёт `400`, а не `413`). Тело другого типа парсер не читает, поэтому память приложения не
   занимает. Guard по `Content-Length` отклонён как строго слабый: `raw-body` ловит и чанкованное тело
   без этого заголовка.
3. `OPTIONS` на неизвестный URL отвечает `204` (проверено), `Allow` на `OPTIONS` не отдаётся;
   `Access-Control-Allow-Methods` общий для приложения, а не пооперационный.
4. Корректность preflight принадлежит проекту, а не пакету `cors`; держится семью автотестами.
5. `X-Powered-By: Express` продолжает отдаваться — brief его не упоминает, а `app.disable('x-powered-by')`
   был бы расширением согласованного объёма. Отмечено как наблюдение для возможной отдельной задачи, не
   сделано молча.
6. Rate limiting, TLS и полный preset helmet — Non-goals brief, не делались.

## Описание для MR

### Summary

`apps/api` получает middleware-цепочку: CORS (`Access-Control-Allow-Origin: *`, preflight `204`),
security-заголовки `X-Content-Type-Options: nosniff` и `X-Frame-Options: DENY`, лимит тела запроса
64KB с ответом `413 PAYLOAD_TOO_LARGE` вместо прежнего `500`. Всё — в начале `createApp`, в точке,
которую зарезервировала `back-001`. Без CORS web-клиент не может обратиться к API из браузера, поэтому
задача — условие соединения guest-клиента с реальным backend. Зависимостей не добавилось: пакеты
`cors` и `helmet` не нужны, когда из них используются три константных заголовка. Контракт не менялся:
API impact `NONE`.

### Changes

- `apps/api/src/http/security.ts` (новый): `securityHeaders`, `cors`, `BODY_LIMIT_BYTES`. Список
  методов preflight выводится из реестра `ROUTES`, поэтому не может отстать от контракта.
- `apps/api/src/app.ts`: цепочка `securityHeaders` → `cors` → `express.json({ limit })` до цикла
  монтирования. Порядок значим — иначе `413` уходит без CORS-заголовков и браузер скрывает от клиента
  код ошибки.
- `apps/api/src/http/errors.ts`: ветка `entity.too.large` → `413 PAYLOAD_TOO_LARGE` рядом с
  существующей ветвью `entity.parse.failed`. `ERROR_STATUS` и `DomainErrorCode` не расширены: домен об
  ограничениях транспорта не знает.
- `apps/api/src/http/security.test.ts` (новый): 7 тестов — AC1–AC4, производность списка методов,
  граница лимита, регрессия парсинга.
- Документы: `apps/api/AGENTS.md` (фактическая цепочка вместо «место для `task-infra-003`»), корневой
  `AGENTS.md` (состав `http/`), `tasks/README.md` (реестр, план, снимок, сводка ответов вне контракта).

### Verification

`npm run contracts:format:check`, `npm run generate:check`, `npm run typecheck`, корневой `npm test` —
exit 0; `npm test -w @minical/api` — 71 тест (было 64), exit 0. AC1–AC4 дополнительно проверены curl'ом
на поднятом сервере, вывод — в `result.md`. AC5 подтверждён браузерным smoke 2026-08-12 (fetch из
консоли `http://localhost:8081` → `{status:'ok'}`, без CORS-ошибок). Generated-файлы не тронуты,
`package.json` не менялся.

### Known limitations

`413 PAYLOAD_TOO_LARGE` — ответ вне контракта (G5, класс G3).
Лимит действует на `application/json`; тело другого типа парсер не читает и получает `400`, а не `413`.
`OPTIONS` на неизвестный URL отвечает `204`, `Allow` на `OPTIONS` не отдаётся. `X-Powered-By` не
снимался — вне согласованного объёма brief.
