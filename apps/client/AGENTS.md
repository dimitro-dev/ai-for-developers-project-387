# @minical/client — React Native / Web

Зона единого клиента MiniCal: UI, навигация и клиентская логика owner-flow и guest-flow на Expo 57,
React Native 0.86 и react-native-web. Запуск, переменные окружения и сборка — [`README.md`](README.md)
этого каталога.

Expo меняется от версии к версии: до первой строки кода читай версионированную документацию
https://docs.expo.dev/versions/v57.0.0/ — память о прежних версиях источником не является.

## Читать

```text
apps/client/README.md — режимы запуска, EXPO_PUBLIC_*, debug-сборка Android
корневой AGENTS.md
согласованные документы активной задачи (гейты — в её task.yaml; см. tasks/AGENTS.md)
plan.md активной задачи
связанные generated SDK/types
docs/domain-rules.md — для отображаемого поведения
docs/architecture.md — при изменении структуры клиента
docs/ui-spec-kit/README.md — что является источником истины и как запускать инструменты кита
docs/ui-spec-kit/MANUAL.md — формат спеки, §3 приоритеты при конфликте, §5 layout,
                             §6 генерация React Native, §7 типы, §10 accessibility,
                             §12 визуальная сверка, §13 запрещённые действия
docs/ui-spec-kit/specs/ui/** — UISpec экрана, компоненты, токены, registry, api-bindings
.opencode/skills/uispec-generator/SKILL.md — обязательный процесс создания UI
https://docs.expo.dev/versions/v57.0.0/ — версионированная документация Expo
```

## Разрешено менять

```text
apps/client/**
frontend tests
frontend mocks/fixtures
ручной wrapper-код packages/api-client/src/** вне generated/
docs/ui-spec-kit/specs/ui/** — только если правка UISpec предусмотрена согласованными
                               документами активной задачи
состояние своего пункта в plan.md
frontend-раздел активного result.md
```

## Обязан

- вести UI по UISpec: экран, его состояния, компоненты и токены берутся из
  `docs/ui-spec-kit/specs/ui/`, а не проектируются в коде;
- выполнять процесс скилла [`uispec-generator`](../../.opencode/skills/uispec-generator/SKILL.md) —
  валидация спек до генерации, генерация каркаса, ручная доработка по `MANUAL.md`; обязателен именно
  процесс, а не способ его вызова, порядок шагов и инструменты — в `docs/ui-spec-kit/README.md`;
- использовать generated SDK и generated transport types;
- реализовывать все состояния, объявленные спекой: loading, empty, content, refreshing, error,
  validation;
- обрабатывать документированные status/error codes;
- передавать UTC timestamp выбранного слота в API;
- считать backend источником истины для доступности;
- поддерживать web и Android в пределах задачи;
- сохранять platform-specific код за явной границей.

## Запрещено

- создавать ручные копии API DTO;
- редактировать `.tsp` или generated code;
- копировать `*.models.generated.tsp` генератора каркасов в `packages/contracts/src/**`: это
  фрагмент локальных UISpec-моделей, а не контракт проекта;
- писать альтернативные API routes в обход SDK;
- вычислять authoritative `endAt`;
- считать `GET slots` гарантией бронирования;
- добавлять поля, отсутствующие в контракте;
- дублировать Slot Engine на клиенте;
- реализовывать экраны, элементы и navigation-переходы, отсутствующие в UISpec;
- подменять зарегистрированные компоненты произвольными примитивами;
- хардкодить цвета, отступы и размеры вместо token references;
- менять внешний вид или набор состояний экрана в коде в обход UISpec: правка самих UISpec-файлов
  проходит через документы задачи (правило 8 корневого [`AGENTS.md`](../../AGENTS.md));
- ставить `согласовано` самовольно: правило 11 корневого [`AGENTS.md`](../../AGENTS.md), фиксация —
  только `scripts/task approve` после явного подтверждения владельца.

## При недостающем решении

Противоречие внутри спеки, отсутствующий токен или ассет, недостающая операция API — не повод
достроить решение догадкой. Автоматическая генерация спорного участка останавливается, расхождение
фиксируется как contract gap в `docs/ui-spec-kit/specs/ui/bindings/contract-gaps.xml`
(`MANUAL.md` §8) и выносится блокирующим пунктом в `plan.md` активной задачи. Contract-работа
передаётся в зону [`packages/contracts/`](../../packages/contracts/AGENTS.md), TypeSpec самостоятельно
не меняется; правила каскада гейтов — в [`tasks/flows/full.md`](../../tasks/flows/full.md), иерархия
источников правды — в `docs/sources-of-truth.md`.

## Definition of Done

- UI соответствует acceptance criteria;
- экран соответствует своему UISpec, component registry и токенам; расхождения зафиксированы как
  contract gap, а не «исправлены» молча;
- каждое UI-действие связано с операцией из `api-bindings.xml`;
- применимые состояния реализованы;
- generated SDK используется без обходов;
- `make gates` этой зоны зелёный; полный набор фазы «Проверка» — `make gates` в корне репозитория;
- изменения проверены минимум на web и Android, если задача затрагивает общий UI;
- пункт плана и frontend-раздел `result.md` обновлены.
