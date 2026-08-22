---
id: guest.event-types
route: GuestEventTypes
platforms: [android, web]
reference: ../assets/guest-mobile-flow.png
referenceFrame: 1
status: draft
---

# Каталог встреч

Точка входа гостевого флоу: имя владельца, список типов встреч, выбор типа.

```uispec
<ScreenSpec version="0.1">
  <Meta id="guest.event-types" route="GuestEventTypes" title="Каталог встреч" />
  <Viewport width="360" height="800" unit="dp" safeArea="true" />
  <Data>
    <Model name="Calendar" source="api" schema="PublicCalendarResponse"><Field name="displayName" type="string" /></Model>
    <Model name="EventType" source="api" schema="EventType"><Field name="id" type="string" /><Field name="name" type="string" /><Field name="description" type="string" required="false" /><Field name="durationMinutes" type="int32" /></Model>
  </Data>
  <StateMachine initial="loading">
    <State id="loading" />
    <State id="content"><Property name="calendar" type="Calendar" /><Property name="items" type="EventType[]" /></State>
    <State id="empty" />
    <State id="error"><Property name="message" type="string" /><Property name="canRetry" type="boolean" default="true" /></State>
  </StateMachine>
  <Actions>
    <Action id="loadPublicCalendar" kind="api.query" onErrorWhen="$error.code == 'CALENDAR_NOT_CONFIGURED':empty" onErrorState="error" />
    <Action id="loadPublicEventTypes" kind="api.query" onSuccessWhen="$result.length == 0:empty;$result.length &gt; 0:content" onErrorWhen="$error.code == 'CALENDAR_NOT_CONFIGURED':empty" onErrorState="error" />
    <Action id="selectEventType" kind="navigation.push" target="GuestSlots"><Param name="eventTypeId" type="string" bind="$event.id" /><Param name="eventTypeName" type="string" bind="$event.name" /><Param name="durationMinutes" type="int32" bind="$event.durationMinutes" /><Param name="eventTypeDescription" type="string" bind="$event.description" /></Action>
  </Actions>
  <Layout type="column" background="$color.background.primary" minHeight="fill">
    <StateView state="loading"><Column flex="1" paddingHorizontal="$space.24" paddingTop="$space.32" gap="$space.16"><Skeleton variant="text" /><Skeleton variant="text" /><Skeleton variant="event-type-card" height="$size.card.eventType.height" /><Skeleton variant="event-type-card" height="$size.card.eventType.height" /></Column></StateView>
    <StateView state="content">
      <ScrollView flex="1" contentPaddingHorizontal="$space.24" contentPaddingTop="$space.24" contentPaddingBottom="$space.32">
        <Text value="Calendar" typography="$type.title.small" color="$color.text.secondary" />
        <Spacer size="$space.24" />
        <Text value="{'Запланировать встречу с ' + $state.calendar.displayName}" typography="$type.title.large" />
        <Spacer size="$space.20" />
        <Text value="Выберите тип встречи" typography="$type.label.large" />
        <Spacer size="$space.12" />
        <Column gap="$space.12"><Repeat source="$state.items" item="item" key="$item.id"><PublicEventTypeCard id="$item.id" name="$item.name" description="$item.description" durationMinutes="$item.durationMinutes" accentIndex="{eventTypeAccentIndex($item.id)}" onPress="selectEventType" /></Repeat></Column>
      </ScrollView>
    </StateView>
    <StateView state="empty"><EmptyState asset="$asset.event-types" title="Встречи пока недоступны" body="У владельца календаря сейчас нет доступных типов встреч. Загляните позже." /></StateView>
    <StateView state="error"><Center flex="1" padding="$space.24"><Icon name="cloud-off" size="$size.icon.large" color="$color.icon.secondary" /><Spacer size="$space.16" /><Text value="Не удалось загрузить встречи" typography="$type.title.medium" align="center" /><Spacer size="$space.8" /><Text value="$state.message" typography="$type.body.medium" color="$color.text.secondary" align="center" /><Spacer size="$space.24" /><Button variant="primary" width="fill" height="$size.button.height" label="Повторить" onPress="loadPublicEventTypes" /></Center></StateView>
  </Layout>
</ScreenSpec>
```

## UX rules

- Экран публичный: ни аккаунта, ни owner-навигации, ни back — это первый экран гостевого стека.
- Шапки приложения на кадре 1 нет: вордмарк и заголовок — часть контента, а не `Header`.
- Заголовок требует **двух** чтений: имя владельца — `loadPublicCalendar` (`PublicCalendarResponse.displayName`),
  список — `loadPublicEventTypes` (голый `EventType[]`, без обёртки). Композиция двух операций на одном
  экране — прецедент owner-экрана 05.
- Конвенция контейнера: оба начальных `api.query` диспатчатся при монтировании экрана; грамматика UISpec
  триггеров жизненного цикла не описывает. Переходом состояний владеет `loadPublicEventTypes` — поэтому
  кнопка «Повторить» ссылается на него, а контейнер перезапускает пару целиком.
- Карточка целиком кликабельна; технический публичный id (`/slug`) гостю не показывается.
- Цвет плитки карточки — `eventTypeAccentIndex($item.id)`: детерминированный индекс акцента из `id`, а не
  поле контракта. Один тип встречи всегда одного цвета; при 7+ типах цвета повторяются (осознанный предел
  палитры из шести).
- Адаптив — правило раскладки, а не платформа: ширина контента ограничена 760 dp и центрируется, карточки
  раскладываются в две колонки от 768 dp.
- `CALENDAR_NOT_CONFIGURED` ведёт в `empty`, а не в отдельное состояние: гостю незачем различать «владелец
  не настроил календарь» и «типов встреч нет» — записаться в обоих случаях не на что.

### Пути входа в состояния

| Состояние | Путь входа |
|---|---|
| `loading` | `initial` StateMachine; контейнер диспатчит `loadPublicCalendar` и `loadPublicEventTypes` при монтировании |
| `content` | `loadPublicEventTypes` → `onSuccessWhen` ветвь `$result.length > 0:content` |
| `empty` | `loadPublicEventTypes` → `onSuccessWhen` ветвь `$result.length == 0:empty`; либо `onErrorWhen` ветвь `$error.code == 'CALENDAR_NOT_CONFIGURED':empty` любого из двух чтений |
| `error` | `onErrorState="error"` любого из двух чтений (транспортная ошибка или код, не покрытый ветвью) |

## Acceptance criteria

- Реализованы loading, content, empty, error; у каждого состояния есть путь входа из таблицы выше.
- Имя владельца в заголовке приходит из `PublicCalendarResponse.displayName`, а не из навигации или догадки.
- Название, описание и длительность видны из полей контрактного `EventType`; выдуманных полей нет.
- Tap по карточке открывает экран слотов и передаёт четыре параметра route: `eventTypeId`, `eventTypeName`,
  `durationMinutes`, `eventTypeDescription`.
- Один и тот же `EventType.id` всегда даёт один и тот же акцентный цвет, независимо от порядка в списке.
- Пустой каталог и ненастроенный календарь выглядят для гостя одинаково.
