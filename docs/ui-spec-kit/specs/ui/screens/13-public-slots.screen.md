---
id: guest.slots
route: GuestSlots
platforms: [android, web]
reference: ../assets/guest-mobile-flow.png
referenceFrames: [2, 3, 8]
status: draft
---

# Выбор даты и времени

Один экран в трёх стадиях: выбор даты (кадр 2), выбор слота (кадр 3), «слот только что заняли» (кадр 8).

```uispec
<ScreenSpec version="0.1">
  <Meta id="guest.slots" route="GuestSlots" title="Выбор даты и времени" />
  <Viewport width="360" height="800" unit="dp" safeArea="true" />
  <Data>
    <Model name="Slot" source="api" schema="Slot"><Field name="startAtUtc" type="utcDateTime" /><Field name="endAtUtc" type="utcDateTime" /><Field name="eventTypeId" type="string" /></Model>
    <Model name="AvailableDate"><Field name="date" type="string" derived="true" /><Field name="weekdayLabel" type="string" derived="true" /><Field name="dayLabel" type="string" derived="true" /></Model>
  </Data>
  <StateMachine initial="loading">
    <State id="loading" />
    <State id="dateSelection"><Property name="slots" type="Slot[]" /><Property name="selectedDate" type="string" /><Property name="selectedSlot" type="Slot" required="false" /></State>
    <State id="slotSelection" extends="dateSelection" />
    <State id="slotUnavailable" extends="dateSelection" />
    <State id="empty" />
    <State id="unavailable"><Property name="message" type="string" /></State>
    <State id="error"><Property name="message" type="string" /><Property name="canRetry" type="boolean" default="true" /></State>
  </StateMachine>
  <Actions>
    <Action id="loadPublicSlots" kind="api.query" onSuccessWhen="$result.length == 0:empty;$result.length &gt; 0:dateSelection" onErrorWhen="$error.code == 'EVENT_TYPE_NOT_FOUND':unavailable;$error.code == 'CALENDAR_NOT_CONFIGURED':unavailable" onErrorState="error"><Param name="eventTypeId" type="string" bind="$route.params.eventTypeId" /></Action>
    <Action id="refreshPublicSlots" kind="api.query" preserveContent="true" onSuccessWhen="$result.length == 0:empty;selectedSlotMissing($result, $state.selectedSlot) == true:slotUnavailable;$state.selectedSlot == null:dateSelection;true:slotSelection"><Param name="eventTypeId" type="string" bind="$route.params.eventTypeId" /></Action>
    <Action id="selectDate" kind="local.update" path="$state.selectedDate" value="$event.date" onSuccessState="dateSelection" after="clearSelectedSlot" />
    <Action id="selectSlot" kind="local.update" path="$state.selectedSlot" value="$event.slot" onSuccessState="slotSelection" />
    <Action id="continueToForm" kind="navigation.push" target="GuestBookingForm" disabledWhen="$state.selectedSlot == null"><Param name="eventTypeId" type="string" bind="$route.params.eventTypeId" /><Param name="eventTypeName" type="string" bind="$route.params.eventTypeName" /><Param name="startAtUtc" type="utcDateTime" bind="$state.selectedSlot.startAtUtc" /><Param name="endAtUtc" type="utcDateTime" bind="$state.selectedSlot.endAtUtc" /></Action>
    <Action id="goBack" kind="navigation.back" />
    <Action id="openCatalog" kind="navigation.reset" target="GuestEventTypes" />
  </Actions>
  <Layout type="column" background="$color.background.primary" minHeight="fill">
    <Header title="$route.params.eventTypeName" backAction="goBack" />
    <StateView state="loading"><Column flex="1" padding="$space.24" gap="$space.16"><Skeleton variant="text" /><Skeleton variant="date-strip" height="$size.dateChip.height" /><Skeleton variant="slot-grid" height="$size.slot.height" /><Skeleton variant="slot-grid" height="$size.slot.height" /></Column></StateView>
    <StateView state="dateSelection|slotSelection|slotUnavailable">
      <ScrollView flex="1" contentPaddingHorizontal="$space.24" contentPaddingBottom="$space.32">
        <Row align="center" gap="$space.8"><Icon name="event-type" size="$size.icon.medium" color="$color.action.primary" /><Text value="{durationLabel($route.params.durationMinutes)}" typography="$type.label.large" /></Row>
        <Spacer size="$space.8" />
        <Text when="$route.params.eventTypeDescription != null" value="$route.params.eventTypeDescription" typography="$type.body.medium" color="$color.text.secondary" />
        <Spacer size="$space.8" />
        <TimezoneLabel timezone="$system.timeZone" offset="{formatUtcOffset($system.timeZone)}" />
        <StateView state="slotUnavailable"><Spacer size="$space.16" /><InlineAlert variant="warning" title="Этот слот только что заняли" body="Выберите другое доступное время." /></StateView>
        <Spacer size="$space.16" />
        <Text value="Выберите дату" typography="$type.label.large" />
        <Spacer size="$space.12" />
        <DateStrip dates="{availableDates($state.slots, $system.timeZone)}" selectedDate="$state.selectedDate" onSelect="selectDate" />
        <Spacer size="$space.20" />
        <Text value="{fullDateLabel($state.selectedDate)}" typography="$type.title.small" />
        <Spacer size="$space.12" />
        <SlotGrid slots="{slotsOnDate($state.slots, $state.selectedDate, $system.timeZone)}" selectedStartAtUtc="$state.selectedSlot.startAtUtc" onSelect="selectSlot" columns="2" />
        <Spacer size="$space.12" />
        <Row align="center" gap="$space.8"><Icon name="info" size="$size.icon.small" color="$color.icon.secondary" /><Text value="Слоты доступны на ближайшие 14 дней" typography="$type.body.small" color="$color.text.secondary" /></Row>
        <Spacer size="$space.24" />
        <Button variant="primary" width="fill" height="$size.button.height" label="Продолжить" onPress="continueToForm" disabled="{$state.selectedSlot == null}" />
      </ScrollView>
    </StateView>
    <StateView state="empty"><EmptyState asset="$asset.event-types" title="Нет свободного времени" body="В ближайшие 14 дней у этого типа встреч нет свободных слотов." ctaLabel="Посмотреть другие встречи" ctaAction="openCatalog" /></StateView>
    <StateView state="unavailable"><Center flex="1" padding="$space.24"><Icon name="calendar-x" size="$size.icon.large" color="$color.icon.secondary" /><Spacer size="$space.16" /><Text value="Эта встреча недоступна" typography="$type.title.medium" align="center" /><Spacer size="$space.8" /><Text value="$state.message" typography="$type.body.medium" color="$color.text.secondary" align="center" /><Spacer size="$space.24" /><Button variant="secondary" width="fill" height="$size.button.height" label="К другим встречам" onPress="openCatalog" /></Center></StateView>
    <StateView state="error"><Center flex="1" padding="$space.24"><Icon name="cloud-off" size="$size.icon.large" color="$color.icon.secondary" /><Spacer size="$space.16" /><Text value="Не удалось загрузить свободное время" typography="$type.title.medium" align="center" /><Spacer size="$space.8" /><Text value="$state.message" typography="$type.body.medium" color="$color.text.secondary" align="center" /><Spacer size="$space.24" /><Button variant="primary" width="fill" height="$size.button.height" label="Повторить" onPress="loadPublicSlots" /><Spacer size="$space.12" /><Button variant="secondary" width="fill" height="$size.button.height" label="К другим встречам" onPress="openCatalog" /></Center></StateView>
  </Layout>
</ScreenSpec>
```

## UX rules

- Слоты и `endAtUtc` считает сервер (`getPublicSlots`); клиент не вычисляет ни доступность, ни конец встречи
  и не занимается арифметикой часовых поясов — только форматирует UTC-моменты в timezone гостя.
- Timezone на экране — **своя timezone гостя** (`$system.timeZone`), а не владельца: контракт публично
  timezone владельца не отдаёт и отдавать не должен.
- Длительность, описание и заголовок экрана приходят параметрами route от каталога: операции «получить один
  тип встречи» в контракте нет, а повторный `getPublicEventTypes` ради подписи — лишний запрос.
- Полоска дат присутствует во **всех трёх** стадиях. Кадры 3 и 8 её не рисуют из-за размера кадра доски —
  макет не является источником состава элементов (MANUAL §3, приоритет 4).
- Недоступные даты в полоску не попадают вовсе (кадр 2: 2-е число пропущено), поэтому отключённого чипа не
  существует. То же со слотами: занятого слота в наборе нет.
- Сетка слотов видна и в `dateSelection` — иначе выбрать слот было бы нечем. `slotSelection` отличается от
  `dateSelection` ровно выбранным слотом и активной CTA.
- Смена даты сбрасывает выбранный слот (`after="clearSelectedSlot"` — свободная метка хука, как `before`;
  валидатор её не резолвит).
- `SlotGrid` отдаёт в `selectSlot` выбранный слот целиком (`$event.slot`), `DateChip` — календарную дату
  (`$event.date`). При `selectedSlot == null` обращение к `$state.selectedSlot.startAtUtc` в разметке
  null-safe: сетка просто не имеет выбранного элемента.
- Конвенция контейнера: `loadPublicSlots` диспатчится при монтировании; **при возврате** на этот экран
  (в том числе из формы по конфликту слота) контейнер диспатчит `refreshPublicSlots`. Грамматика UISpec
  триггеров жизненного цикла не описывает, поэтому это правило, а не атрибут.
- `refreshPublicSlots` закрывает исходы полностью и по порядку ветвей: пустой набор → `empty`; выбранного
  слота больше нет → `slotUnavailable` (кадр 8); слот не выбирался → `dateSelection`; иначе → `slotSelection`.
  Неудачный фоновый refresh состояние не меняет (`preserveContent="true"`, без `onErrorState`) — гость
  остаётся с уже показанными слотами.
- Тот же путь срабатывает, если слот заняли, пока гость просто смотрел на список, — без участия формы.
- «Слоты доступны на ближайшие 14 дней» — статический текст: 14 дней документированная семантика операции
  (сервер считает 14-дневное окно), а не поле ответа. Гапом это не является: отсутствует не данное, а
  константа; при изменении окна правится текст.
- `openCatalog` — `navigation.reset`, а не `push`: экран слотов может быть точкой входа по web-deep-link, и
  «назад» после сброса не должен вести в чужую историю.
- Адаптив — правило раскладки: сетка слотов не меньше двух колонок при min width элемента 112 dp; на широком
  экране даты и слоты можно разложить в две колонки от 768 dp.

### Пути входа в состояния

| Состояние | Путь входа |
|---|---|
| `loading` | `initial` StateMachine; контейнер диспатчит `loadPublicSlots` при монтировании |
| `dateSelection` | `loadPublicSlots` → `onSuccessWhen` ветвь `$result.length > 0:dateSelection`; `selectDate` → `onSuccessState="dateSelection"`; `refreshPublicSlots` → ветвь `$state.selectedSlot == null:dateSelection` |
| `slotSelection` | `selectSlot` → `onSuccessState="slotSelection"`; `refreshPublicSlots` → ветвь по умолчанию `true:slotSelection` |
| `slotUnavailable` | `refreshPublicSlots` → ветвь `selectedSlotMissing($result, $state.selectedSlot) == true:slotUnavailable` (кадр 8) |
| `empty` | `loadPublicSlots` → ветвь `$result.length == 0:empty`; `refreshPublicSlots` → та же ветвь |
| `unavailable` | `loadPublicSlots` → `onErrorWhen` ветви `EVENT_TYPE_NOT_FOUND` и `CALENDAR_NOT_CONFIGURED` |
| `error` | `loadPublicSlots` → `onErrorState="error"` (транспортная ошибка или код, не покрытый ветвями) |

## Acceptance criteria

- Реализованы loading, dateSelection, slotSelection, slotUnavailable, empty, unavailable, error; у каждого
  есть путь входа из таблицы выше.
- Полоска дат содержит только даты со свободными слотами, по возрастанию; выбранная дата ровно одна.
- Сетка показывает слоты выбранной даты хронологически, не меньше двух колонок.
- «Продолжить» недоступна без выбранного слота и передаёт в форму `startAtUtc` и `endAtUtc` серверного слота.
- После конфликта прежний выбор не остаётся `selected`, слоты перезагружены, показан алерт кадра 8.
- Модели `Slot` — точное подмножество контрактной схемы; `AvailableDate` объявлена view-model с `derived`.
