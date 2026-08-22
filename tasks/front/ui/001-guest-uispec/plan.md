# План TASK-FRONT-UI-001

## Декомпозиция

| ID | Цель / проблема | Решение | Состояние |
|---|---|---|---|
| P01 | Общая обвязка гостевой ветки: маршруты и привязки операций | Добавлен `GuestStack` в `navigation.uispec.xml` (4 маршрута, presentation screen); добавлены 3 binding'а в `api-bindings.xml` | завершено |
| P02 | Компонент слота отсутствует в реестре | Создан `components/slot-item.component.md`; `<SlotItem>` зарегистрирован в `components.registry.xml` | завершено |
| P03 | Экран «Публичный список типов событий» | Создан `12-public-event-types.screen.md`: Data `EventType` по контракту, states loading/empty/content/error, reuse `EventTypeCard`, действие `selectEventType` → `guest.slots` | завершено |
| P04 | Экран «Выбор слота» | Создан `13-public-slots.screen.md`: Data `Slot`, группировка по датам, states, reuse `SlotItem`/`EmptyState`/`Skeleton` | завершено |
| P05 | Экран «Форма гостя» | Создан `14-guest-booking-form.screen.md`: `GuestDetails`, Validation, states editing/submitting/error, действие `createBooking` + возврат к слотам | завершено |
| P06 | Экран «Подтверждение бронирования» | Создан `15-booking-confirmation.screen.md`: Data `Booking`, states content/error, действие `bookAnother` | завершено |
| P07 | Валидация всего набора спек | `validate_uispec.py` → `Validated 31 files; errors=0`; smoke `generate_scaffold.py` на 5 новых файлах | завершено |

Допустимые состояния:

```text
в плане
выполняется
завершено
```

## Порядок и зависимости

P01 и P02 выполнялись первыми и независимо; P03–P06 зависели от P01 и P02; P07 — финальная проверка всего набора.

## Блокеры и открытые вопросы

- Маппинг `EventTypeCard` под гостевой флоу (`name → title`, без `publicId`) — зафиксирован в ADR, доработка карточки при реализации `front-guest-002`.
- Валидатор расширен корнем `$route`: правка внесена в канонический файл кита `docs/ui-spec-kit/tools/uispec/validate_uispec.py`; с R2 копия в `.opencode/skills/uispec-generator/scripts` — symlink, отдельная синхронизация не требуется — отражено в ADR.
- `generate_scaffold.py` генерировал каркасы во временный каталог как smoke-проверку; результаты не коммитятся.
