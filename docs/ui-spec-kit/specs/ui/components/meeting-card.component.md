---
id: component.meeting-card
kind: component
status: approved
---

# Upcoming Meeting Card

```uispec
<ComponentSpec version="0.1">
  <Meta id="component.meeting-card" />
  <Props>
<Prop name="booking" type="BookingView" required="true" />
<Prop name="startTime" type="string" required="true" />
<Prop name="endTime" type="string" required="true" />
<Prop name="title" type="string" required="true" />
<Prop name="guestName" type="string" required="true" />
<Prop name="guestEmail" type="string" required="true" />
<Prop name="onPress" type="ActionRef" required="true" />
  </Props>
  <Layout>
<MeetingCard booking="$props.booking" minHeight="$size.card.meeting.height" padding="$space.12" radius="$radius.12" borderColor="$color.border.default" onPress="$props.onPress">
  <Column width="52" align="center"><Text value="$props.startTime" typography="$type.label.large" /><Text value="$props.endTime" typography="$type.label.medium" color="$color.text.secondary" /></Column>
  <Column flex="1" gap="$space.4"><Text value="$props.title" typography="$type.title.small" /><Text value="$props.guestName" typography="$type.body.medium" /><Text value="$props.guestEmail" typography="$type.body.small" color="$color.text.secondary" numberOfLines="1" /></Column>
  <Icon name="chevron-right" size="$size.icon.small" color="$color.icon.secondary" />
</MeetingCard>
  </Layout>
</ComponentSpec>
```

## Rules

- Email может сокращаться визуально, но остаётся доступен полностью в details.
- `booking` — `BookingView` своей встречи (view-model экранов 05 и 11); карточка его не отображает, а несёт
  как нагрузку нажатия: `onPress` вызывается с событием `{ booking }`, и экран 05 биндит его как
  `$event.booking` в `openBooking`, передавая тот же объект пропсом в sheet деталей. Подписи времени
  (`startTime`/`endTime`) считает экран в timezone владельца, поэтому карточка не выводит их из `booking`.

## Acceptance criteria

- Карточка озвучивает время, тип события и гостя.
- Нажатие отдаёт встречу целиком: sheet деталей не делает дополнительного запроса и не ищет её по id.
