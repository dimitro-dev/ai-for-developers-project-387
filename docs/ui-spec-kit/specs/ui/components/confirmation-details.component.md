---
id: component.confirmation-details
kind: component
platforms: [android, web]
status: draft
---

# Confirmation Details

Блок строк подтверждения созданной брони (кадр 7): тип встречи, дата, интервал, timezone, имя и email
гостя.

```uispec
<ComponentSpec version="0.1">
  <Meta id="component.confirmation-details" />
  <Props>
<Prop name="eventTypeName" type="string" required="true" />
<Prop name="dateText" type="string" required="true" />
<Prop name="timeRangeText" type="string" required="true" />
<Prop name="timeZone" type="string" required="true" />
<Prop name="guestName" type="string" required="true" />
<Prop name="guestEmail" type="string" required="true" />
  </Props>
  <Layout>
<ConfirmationDetails width="fill" padding="$space.16" radius="$radius.12" borderColor="$color.border.default" background="$color.surface.primary">
  <Column gap="$space.12">
    <Row align="center" gap="$space.12"><Icon name="event-type" size="$size.icon.small" color="$color.icon.secondary" /><Text value="$props.eventTypeName" typography="$type.label.large" /></Row>
    <Row align="center" gap="$space.12"><Icon name="calendar" size="$size.icon.small" color="$color.icon.secondary" /><Text value="$props.dateText" typography="$type.body.medium" /></Row>
    <Row align="center" gap="$space.12"><Icon name="clock" size="$size.icon.small" color="$color.icon.secondary" /><Text value="$props.timeRangeText" typography="$type.body.medium" /></Row>
    <Row align="center" gap="$space.12"><TimezoneLabel timezone="$props.timeZone" offset="{formatUtcOffset($props.timeZone)}" /></Row>
    <Row align="center" gap="$space.12"><Icon name="user" size="$size.icon.small" color="$color.icon.secondary" /><Text value="$props.guestName" typography="$type.body.medium" /></Row>
    <Row align="center" gap="$space.12"><Icon name="mail" size="$size.icon.small" color="$color.icon.secondary" /><Text value="$props.guestEmail" typography="$type.body.medium" numberOfLines="1" /></Row>
  </Column>
</ConfirmationDetails>
  </Layout>
</ComponentSpec>
```

## Rules

- Порядок строк фиксирован: тип встречи → дата → интервал → timezone → имя → email.
- Строки — данные ответа `createPublicBooking` (`Booking`), а не локальный черновик формы; подписи даты и
  интервала форматирует экран через `dateLabel`/`timeLabel`, компонент получает готовые строки.
- Иконки строк декоративны: значение каждой строки понятно из текста, поэтому отдельные
  `accessibilityLabel` у них не нужны.
- Timezone показывается через существующий `TimezoneLabel` — это timezone устройства гостя.

## Acceptance criteria

- Все шесть строк видны без скролла на 360×800.
- Email может визуально сокращаться, но полностью доступен screen reader.
- Блок не содержит интерактивных элементов: действие возврата живёт на экране.
