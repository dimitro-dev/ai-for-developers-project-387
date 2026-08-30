# Реестр задач

Генерируется `scripts/task registry`; руками не правится.

## Реестр по типам

### contract

| id | Задача | Зависимости | Стадия |
|---|---|---|---|
| [contract/001](contract/001-guest-flow-extensions/) | Расширение контракта под гостевой макет и закрытие расхождений, найденных в `task-back-001` | [infra/005](infra/005-generated-entrypoints/), [front/ui/001](front/ui/001-guest-uispec/), [infra/004](infra/004-contract-mock-prism/) | завершена (16/16) |

### infra

| id | Задача | Зависимости | Стадия |
|---|---|---|---|
| [infra/001](infra/001-postgres-compose/) | PostgreSQL runtime-контур на Docker Compose | — | завершена (10/10) |
| [infra/002](infra/002-android-builder/) | Android builder: Docker-образ для сборки APK | — | постановка |
| [infra/003](infra/003-http-security/) | Backend HTTP Security Middleware | [back/001](back/001-api-skeleton/) | завершена (10/10) |
| [infra/004](infra/004-contract-mock-prism/) | Contract mock server (Prism) | — | завершена (8/8) |
| [infra/005](infra/005-generated-entrypoints/) | Публичные точки входа generated-пакетов | — | завершена (9/9) |
| [infra/006](infra/006-ci-release-please/) | CI: обязательные проверки и release-please на GitHub Actions | — | завершена (10/10) |
| [infra/007](infra/007-e2e-native-framework/) | Выбор native e2e-фреймворка: Detox, Maestro или Appium | [infra/002](infra/002-android-builder/), [front/guest/002](front/guest/002-guest-screens/) | заявлена |
| [infra/008](infra/008-e2e-web-playwright/) | Web e2e на Playwright: сквозной прогон гостевого сценария | [front/guest/002](front/guest/002-guest-screens/), [back/001](back/001-api-skeleton/), [infra/006](infra/006-ci-release-please/) | заявлена |
| [infra/009](infra/009-docker-deploy/) | Публикация приложения: Docker-образ и деплой | — | завершена (10/10) |
| [infra/010](infra/010-opencode-github/) | OpenCode GitHub App: вызов агента из комментария и авто-ревью PR | — | завершена (6/6) |
| [infra/011](infra/011-action-sha-pinning/) | Крепление стороннего action по SHA: воспроизводимая версия агента в CI | — | заявлена |
| [infra/012](infra/012-command-trigger-precision/) | Точность триггера агента: команда только с начала строки | — | заявлена |

### back

| id | Задача | Зависимости | Стадия |
|---|---|---|---|
| [back/001](back/001-api-skeleton/) | Каркас backend и реализация контракта на in-memory хранилище | [infra/005](infra/005-generated-entrypoints/), [contract/001](contract/001-guest-flow-extensions/) | завершена (17/17) |
| [back/002](back/002-database-persistence/) | Персистентность: схема БД, миграции и exclusion constraint | [infra/001](infra/001-postgres-compose/) | завершена (10/10) |
| [back/003](back/003-slot-engine-package/) | Вынесение Slot Engine в packages/slot-engine | [back/001](back/001-api-skeleton/) | заявлена |

### front/ui

| id | Задача | Зависимости | Стадия |
|---|---|---|---|
| [front/ui/001](front/ui/001-guest-uispec/) | Гостевой UISpec: экраны публичного сценария гостя | — | завершена (7/7) |
| [front/ui/002](front/ui/002-guest-uispec-rebuild/) | Гостевой UISpec по макету дизайн-отдела | [front/ui/001](front/ui/001-guest-uispec/), [contract/001](contract/001-guest-flow-extensions/) | завершена (18/18) |
| [front/ui/003](front/ui/003-owner-uispec-sync/) | Синхронизация owner-спек с контрактом 0.2.0 и новыми макетами | — | завершена (7/7) |

### front/guest

| id | Задача | Зависимости | Стадия |
|---|---|---|---|
| [front/guest/001](front/guest/001-client-foundation/) | Клиентский фундамент гостевой ветки | [front/ui/002](front/ui/002-guest-uispec-rebuild/), [infra/004](infra/004-contract-mock-prism/), [infra/005](infra/005-generated-entrypoints/) | завершена (11/11) |
| [front/guest/002](front/guest/002-guest-screens/) | Гостевой сценарий: четыре экрана и сквозная проверка | [front/ui/002](front/ui/002-guest-uispec-rebuild/), [front/guest/001](front/guest/001-client-foundation/), [infra/004](infra/004-contract-mock-prism/), [back/001](back/001-api-skeleton/), [infra/003](infra/003-http-security/) | завершена (15/15) |
| [front/guest/003](front/guest/003-adaptive-slots-column/) | Адаптивная ширина контента гостевых экранов каталога и слотов | — | завершена (4/4) |

### front/owner

| id | Задача | Зависимости | Стадия |
|---|---|---|---|
| [front/owner/001](front/owner/001-owner-screens/) | Экраны владельца | [back/001](back/001-api-skeleton/), [front/guest/001](front/guest/001-client-foundation/), [front/ui/003](front/ui/003-owner-uispec-sync/) | завершена (22/22) |

### process

| id | Задача | Зависимости | Стадия |
|---|---|---|---|
| [process/001](process/001-tasks-rework/) | Переработка процесса задач: структура, стадии, CLI | — | завершена (23/23) |
| [process/002](process/002-registry-queue-history/) | REGISTRY: очередь без завершённых, история отдельно | — | завершена (3/3) |
| [process/003](process/003-docs-commands-rework/) | Единый вход команд и контракт размещения документации | — | завершена (15/15) |

## Очередь работ

Порядок — по `queue.after`; завершённые — в «Истории выполнения».

| id | Стадия | Обоснование | Параллельно с |
|---|---|---|---|
| [infra/002](infra/002-android-builder/) | постановка | Сборка APK в Docker; приоритет низкий — Android проверяется expo run:android на хосте; начинать со спайка QEMU | — |
| [back/003](back/003-slot-engine-package/) | заявлена | Вынесение Slot Engine в packages/slot-engine с полным набором доменных тестов | — |
| [infra/008](infra/008-e2e-web-playwright/) | заявлена | Web e2e дешевле native: testID уже проставлены, react-native-web мапит их в data-testid; эмулятор и APK не нужны. Защищает гостевой сценарий от регрессий во время работы над owner-flow и снимает часть объёма с infra/007 | — |
| [infra/007](infra/007-e2e-native-framework/) | заявлена | Выбор native e2e-инструмента (Detox / Maestro / Appium) и способа его запуска; нужен работающий APK-контур из infra/002 и эмулятор с аппаратной виртуализацией — на macOS-хосте только вне Docker | — |
| [infra/011](infra/011-action-sha-pinning/) | заявлена | Issue #9. В opencode.yml оба job'а используют anomalyco/opencode/github@latest — подвижный тег рядом с секретом OPENCODE_API_KEY и правом id-token: write. Проверено 2026-08-30: latest указывает на github-v1.2.19, актуален github-v1.2.25 (SHA a3b97d9090ccf4aa9ac32268486283e3131e36b4), тег отстаёт хронически (anomalyco/opencode#19865). Важная оговорка: action — composite и сам ставит бинарь CLI через curl opencode.ai/install \| bash последнего релиза, входа version в action.yml нет, поэтому SHA закрепляет только обвязку. Решать: пин + Dependabot, и что делать с незакреплённым бинарём | — |
| [infra/012](infra/012-command-trigger-precision/) | заявлена | Issue #10. Условие job'а comment использует contains, то есть подстроку: агента запускает любое упоминание команды в тексте — цитата, обсуждение, путь .github/workflows/opencode.yml внутри которого есть /opencode. За 2026-08-30 сработало дважды: агент ответил сам себе и завёл лишний PR. Фильтр user.type != 'Bot' закрыл только ботов. Регулярок в выражениях Actions нет, поэтому проверка начала строки делается отдельным job'ом detect с grep -qE по телу через env и блоком outputs: для передачи в needs. Это патч точности, а не безопасности: намеренная команда в начале строки всё равно даёт промпт-инъекцию, настоящее закрытие — фильтр по author_association | — |

### История выполнения

| id | Стадия | Обоснование | Параллельно с |
|---|---|---|---|
| [front/ui/003](front/ui/003-owner-uispec-sync/) | завершена (7/7) | Разблокирует front/owner/001: owner-спеки приводятся к контракту 0.2.0, решениям сессии 2026-08-17 и новым макетам | — |
| [front/owner/001](front/owner/001-owner-screens/) | завершена (22/22) | Экраны владельца по синхронизированным спекам; приоритет перед back/002–003 — решение владельца 2026-08-17 | — |
| [infra/005](infra/005-generated-entrypoints/) | завершена (9/9) | Точки входа generated-пакетов: без exports пакеты не импортируются по имени; блокировала контракт и backend | — |
| [contract/001](contract/001-guest-flow-extensions/) | завершена (16/16) | Контракт вперёд кода: расширения по макету гостевого флоу и гапы G1, G2, G4 — дешевле до реализации backend | [front/ui/002](front/ui/002-guest-uispec-rebuild/) |
| [back/001](back/001-api-skeleton/) | завершена (17/17) | Каркас API по итоговому контракту 0.2.0; разблокировал infra/003 и сквозную проверку | [front/ui/002](front/ui/002-guest-uispec-rebuild/), [front/guest/001](front/guest/001-client-foundation/), [front/guest/002](front/guest/002-guest-screens/) |
| [infra/003](infra/003-http-security/) | завершена (10/10) | CORS, security-заголовки, лимит тела — условие соединения web-клиента с реальным API | — |
| [front/ui/002](front/ui/002-guest-uispec-rebuild/) | завершена (18/18) | Пересборка гостевого UISpec по канону от макета; спеки — документы, backend не ждут | [contract/001](contract/001-guest-flow-extensions/), [back/001](back/001-api-skeleton/) |
| [front/guest/001](front/guest/001-client-foundation/) | завершена (11/11) | Клиентский фундамент: дизайн-система по registry, SDK, guest-flow state, тестовая инфраструктура | — |
| [front/guest/002](front/guest/002-guest-screens/) | завершена (15/15) | Вертикальная задача: четыре гостевых экрана и сквозная проверка против реального API | [front/owner/001](front/owner/001-owner-screens/), [infra/001](infra/001-postgres-compose/) |
| [infra/001](infra/001-postgres-compose/) | завершена (10/10) | Контейнер PostgreSQL — шаг к персистентности (back/002); Docker Engine — внешняя предпосылка | — |
| [back/002](back/002-database-persistence/) | завершена (10/10) | Схема БД, миграции и exclusion constraint — последняя линия защиты от пересечения Booking, недостижимая на in-memory | — |
| [infra/006](infra/006-ci-release-please/) | завершена (10/10) | CI + release-please; выполнена параллельно front/guest/002, первый релиз v0.2.0 | — |
| [infra/009](infra/009-docker-deploy/) | завершена (10/10) | Внешнее требование учебной платформы: Dockerfile, старт по PORT, публичная ссылка. Раньше back/002 — решение владельца 2026-08-18: с базой задача про образ растёт, а переезд на неё потом образ не переписывает | — |
| [process/001](process/001-tasks-rework/) | завершена (23/23) | Переработка процесса: инструмент task, треки full/lite, миграция каталога, растворение ролей; выполнена 2026-08-16 | — |

## Таблица legacy-id

| Старый id | Где сейчас |
|---|---|
| contract-001 | [contract/001](contract/001-guest-flow-extensions/) |
| infra-001 | [infra/001](infra/001-postgres-compose/) |
| 004 | [infra/001](infra/001-postgres-compose/) |
| infra-002 | [infra/002](infra/002-android-builder/) |
| 005 | [infra/002](infra/002-android-builder/) |
| infra-003 | [infra/003](infra/003-http-security/) |
| INFRA-001 | [infra/003](infra/003-http-security/) |
| infra-004 | [infra/004](infra/004-contract-mock-prism/) |
| infra-005 | [infra/005](infra/005-generated-entrypoints/) |
| infra-006 | [infra/006](infra/006-ci-release-please/) |
| back-001 | [back/001](back/001-api-skeleton/) |
| front-ui-001 | [front/ui/001](front/ui/001-guest-uispec/) |
| front-ui-002 | [front/ui/002](front/ui/002-guest-uispec-rebuild/) |
| front-guest-001 | [front/guest/001](front/guest/001-client-foundation/) |
| front-guest-002 | [front/guest/002](front/guest/002-guest-screens/) |
| front-owner-001 | [front/owner/001](front/owner/001-owner-screens/) |
| process-001 | [process/001](process/001-tasks-rework/) |
| 000 | [archive/000](archive/000/) — дотиповая эпоха, как есть |
| 001 | [archive/001](archive/001/) — дотиповая эпоха, как есть |
| 002 | [archive/002](archive/002/) — дотиповая эпоха, как есть |
| 003 | [archive/003](archive/003/) — дотиповая эпоха, как есть |
| 006 | [archive/006](archive/006/) — дотиповая эпоха, как есть |
| front-001 | — декомпозирована 2026-08-12 на front/ui/001 и линейку front/guest; FR и acceptance criteria распределены по их brief |
