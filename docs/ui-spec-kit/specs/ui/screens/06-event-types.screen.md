---
id: owner.event-types
route: EventTypes
platforms: [android]
reference: ../assets/owner-mobile-settings-details.png
referenceFrame: 7
status: approved
---

# Типы событий

```uispec
<ScreenSpec version="0.1">
  <Meta id="owner.event-types" route="EventTypes" title="Типы событий" />
  <Viewport width="360" height="800" unit="dp" safeArea="true" />
  <Data><Model name="EventType" source="api" schema="EventType"><Field name="id" type="string" /><Field name="name" type="string" /><Field name="description" type="string" required="false" /><Field name="durationMinutes" type="int32" /></Model></Data>
  <StateMachine initial="loading"><State id="loading" /><State id="empty" /><State id="content"><Property name="items" type="EventType[]" /></State><State id="error"><Property name="message" type="string" /></State></StateMachine>
  <Actions>
    <Action id="loadEventTypes" kind="api.query" onSuccessWhen="$result.length == 0:empty;$result.length &gt; 0:content" onErrorState="error" />
    <Action id="createEventType" kind="navigation.push" target="CreateEventType" />
    <Action id="goBack" kind="navigation.back" />
  </Actions>
  <Layout type="column" background="$color.background.primary" minHeight="fill">
    <Header title="Типы событий" backAction="goBack" rightActions="[{id:'create',icon:'plus',accessibilityLabel:'Создать тип события',onPress:'createEventType'}]" />
    <StateView state="loading"><Column padding="$space.16" gap="$space.12"><Skeleton variant="event-type-card" height="$size.card.eventType.height" /><Skeleton variant="event-type-card" height="$size.card.eventType.height" /></Column></StateView>
    <StateView state="empty"><EmptyState asset="$asset.event-types" title="Типов событий пока нет" body="Создайте первый тип события, чтобы гости могли выбрать формат встречи." ctaLabel="Создать тип события" ctaAction="createEventType" /></StateView>
    <StateView state="content"><ScrollView flex="1" contentPadding="$space.16"><Column gap="$space.12"><Repeat source="$state.items" item="item" key="$item.id"><EventTypeCard id="$item.id" title="$item.name" description="$item.description" durationLabel="{durationLabel($item.durationMinutes)}" publicId="$item.id" accentIndex="{eventTypeAccentIndex($item.id)}" /></Repeat></Column></ScrollView></StateView>
    <StateView state="error"><Center flex="1" padding="$space.24"><Text value="Не удалось загрузить типы событий" typography="$type.title.medium" align="center" /><Spacer size="$space.16" /><Button variant="secondary" label="Повторить" onPress="loadEventTypes" /></Center></StateView>
    <BottomNavigation activeTab="none" />
  </Layout>
</ScreenSpec>
```

## UX rules

- Экран открывается из header action встреч или из settings row, поэтому действие возврата называется нейтрально `goBack`: `navigation.back` возвращает на тот экран, с которого пришли (`OwnerMeetings` либо `OwnerSettings` через route `EventTypesFromSettings`), и привязывать его имя к встречам нельзя.
- Типы событий не являются отдельным bottom-tab.
- Редактирование и удаление не входят в MVP.
- Публичный id типа события в контракте — само поле `id` (его выбирает владелец); карточка получает `publicId="$item.id"`, а заголовок — контрактное `name`.
- Цвет плитки карточки — `eventTypeAccentIndex($item.id)`: детерминированный индекс акцента из `id`, а не поле контракта (тот же приём, что у гостевого каталога, экран 12). Глиф в плитке один для всех типов события; разные глифы на кадре 7 — вольность отрисовки макета.
- Длительность выводится полной формой `durationLabel()` («30 минут», кадр 7), а не короткой подписью чипов формы создания. Текст helper'а приоритетнее пикселей макета (MANUAL §3, приоритет 4): для 60 минут карточка покажет «1 час», как описано в реестре helper'ов, а не «60 минут» с кадра 7.

## Acceptance criteria

- В header есть Back и Create.
- Реализованы loading, empty, content, error.
- Карточка не даёт действий редактирования и удаления: тапа по ней нет, chevron остаётся визуальным заделом (см. `../components/event-type-card.component.md`).
- Один и тот же `EventType.id` всегда даёт один и тот же акцентный цвет, независимо от порядка в списке.
