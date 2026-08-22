# Architecture decision — TASK-FRONT-UI-001

## Контекст

`docs/ui-spec-kit/` описывает только owner-flow. Публичный сценарий гостя (`front-001`) требует 4 экрана, которых в ките нет, а frontend-agent запрещает реализовывать экраны вне UISpec. Нужно решить, как расширить кит под гостевую ветку без нарушения правил проекта.

## Решение

1. **Кит расширяется гостевой веткой.** В `docs/ui-spec-kit/specs/ui/` добавляются 4 гостевых экрана, guest-стек в `navigation.uispec.xml`, 3 guest-привязки в `api-bindings.xml` и компонент `slot-item` в registry. Кит остаётся единым источником истины для внешнего вида, состояний и токенов и гостевых экранов.
2. **Data-модели `source="api"` повторяют поля контракта дословно.** Контракт `EventType` имеет поля `id`/`name`. На момент решения owner-спека `06-event-types.screen.md` использовала внутренние имена (`title`/`publicId`) — в R1 она тоже приведена к контрактным именам, так что теперь обе ветки контрактны на уровне Data Model; решение «гостевые данные буквально по контракту, без owner-соглашений об именовании» сохраняется.
3. **Guest-стек без bottom-tab.** Гостевые маршруты оформлены как отдельный `GuestStack` с presentation `screen`. Новый bottom-tab не создаётся (MANUAL §13: «не создавать третий bottom-tab»).
4. **Имена операций в `api-bindings.xml` — точные `operationId` контракта.** `operation=` = `getPublicEventTypes`/`getPublicSlots`/`createPublicBooking`, привязка выполнена сразу (решение AUDIT.md 8.1); отдельной задачи на связывание с реальной операцией не требуется.
5. **Ошибки создания брони обрабатываются на форме, а не на экране подтверждения.** `createPublicBooking` вызывается на `guest.booking-form`; его ошибки (`SLOT_UNAVAILABLE`, `EVENT_TYPE_NOT_FOUND` и пр.) отображаются в состоянии `error` формы с сохранением заполненных данных и возможностью вернуться к выбору слота. `guest.booking-confirmation` — экран успеха с данными из ответа сервера.

## Затронутые компоненты

```text
docs/ui-spec-kit/specs/ui/screens/{12-public-event-types,13-public-slots,14-guest-booking-form,15-booking-confirmation}.screen.md  (новые)
docs/ui-spec-kit/specs/ui/components/slot-item.component.md                                                                      (новый)
docs/ui-spec-kit/specs/ui/navigation/navigation.uispec.xml                                                                       (добавлен GuestStack)
docs/ui-spec-kit/specs/ui/bindings/api-bindings.xml                                                                              (добавлены 3 binding)
docs/ui-spec-kit/specs/ui/registry/components.registry.xml                                                                       (добавлен SlotItem)
```

## Последствия и компромиссы

- Кит становится двухветочным (owner + guest). Гостевые и owner-файлы независимы; изменения одной ветки не должны затрагивать другую.
- Расхождение полей `EventType`, существовавшее на момент решения (owner `title`/`publicId` против контрактного `name`), устранено в R1 — обе ветки контрактны на уровне Data Model. На view-слое пропсы `EventTypeCard` по-прежнему называются `title`/`publicId`: owner передаёт `title="$item.name"`, `publicId="$item.id"`, гость — `publicId=""`; при реализации `front-guest-002` карточка либо дорабатывается, либо выносится в гостевой вариант.
- Создание UISpec — правка согласованной спецификации: проходит через task-документы (правило 8 `AGENTS.md`).
- Валидатор расширен: в allowlist известных reference-корней `validate_uispec.py` добавлен `$route` (navigation-параметры). Правка внесена в канонический файл кита `docs/ui-spec-kit/tools/uispec/validate_uispec.py`; с R2 копия в `.opencode/skills/uispec-generator/scripts` — symlink, отдельная синхронизация не требуется. Генератор не менялся.

## Рассмотренные альтернативы

- **Реализация гостевых экранов ad hoc без UISpec.** Отклонено: запрещено frontend-agent (экраны и navigation-переходы вне UISpec).
- **Расширение owner-экранов под гостя** (например, адаптация `06-event-types` и `11-booking-details`). Отклонено: гостевой UI структурно отличается — нет действий владельца (create), нет bottom-navigation и owner-данных; смешение веток ухудшает читаемость кита.
- **Перенос поля `title`/`publicId` в контракт `EventType`.** Отклонено: выходит за API impact `NONE` и решает задачу неспекации, а контракта — отдельное решение вне scope.

## Совместимость и миграция

- Существующие 26 спеки остаются без изменений; правки navigation/bindings/registry аддитивны.
- Новые файлы совместимы с текущими инструментами кита: `validate_uispec.py` проходит без правок спеки (единственное изменение инструмента — `$route` в allowlist канонического `docs/ui-spec-kit/tools/uispec/validate_uispec.py`; с R2 копия в скилле — symlink); `generate_scaffold.py` smoke-проверен на всех 5 новых файлах.
- Обратной миграции не требуется: guest-файлы ортогональны owner-файлам.
