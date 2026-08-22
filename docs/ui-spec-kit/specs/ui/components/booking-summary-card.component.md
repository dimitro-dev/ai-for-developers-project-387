---
id: component.booking-summary-card
kind: component
platforms: [android, web]
status: draft
---

# Booking Summary Card

Сводка «что именно бронируется» над формой данных гостя (кадры 4–6) с возможностью вернуться к выбору
времени.

```uispec
<ComponentSpec version="0.1">
  <Meta id="component.booking-summary-card" />
  <Props>
<Prop name="eventTypeName" type="string" required="true" />
<Prop name="startAtUtc" type="utcDateTime" required="true" />
<Prop name="endAtUtc" type="utcDateTime" required="true" />
<Prop name="timeZone" type="string" required="true" />
<Prop name="onEdit" type="ActionRef" required="true" />
  </Props>
  <Layout>
<BookingSummaryCard minHeight="$size.card.summary.height" width="fill" padding="$space.16" radius="$radius.12" borderColor="$color.border.default" background="$color.surface.primary">
  <Row align="start" gap="$space.12">
    <Center width="$size.touch.android" height="$size.touch.android" radius="$radius.12" background="$color.surface.selected"><Icon name="event-type" size="$size.icon.medium" color="$color.action.primary" /></Center>
    <Column flex="1" gap="$space.4"><Text value="$props.eventTypeName" typography="$type.title.small" /><Text value="{formattedSlot($props.startAtUtc, $props.endAtUtc)}" typography="$type.body.small" color="$color.text.secondary" /><TimezoneLabel timezone="$props.timeZone" offset="{formatUtcOffset($props.timeZone)}" /></Column>
    <Button variant="text" label="Изменить" minHeight="$size.touch.android" onPress="$props.onEdit" />
  </Row>
</BookingSummaryCard>
  </Layout>
</ComponentSpec>
```

## Rules

- Карточка не источник истины: `eventTypeName`, `startAtUtc` и `endAtUtc` приходят параметрами route от экрана
  слотов, timezone — timezone устройства гостя (`$system.timeZone`), а не владельца.
- Подпись слота — `formattedSlot(startAtUtc, endAtUtc)` («31 июля · 10:00–10:30»); клиент не пересчитывает
  `endAtUtc`, он приходит из серверного `Slot`.
- «Изменить» — то же действие возврата, что back в шапке экрана формы: возврат на экран слотов без потери
  введённых данных.
- Плитка иконки здесь не акцентная: сводка описывает уже выбранную встречу, различать типы цветом незачем.

## Acceptance criteria

- Карточка остаётся видимой над полями формы во всех состояниях, где форма показана.
- Touch target ссылки «Изменить» не меньше 48 dp и не перекрывает тап по карточке.
- Screen reader читает сводку как один блок: тип встречи, дата и интервал, timezone.
