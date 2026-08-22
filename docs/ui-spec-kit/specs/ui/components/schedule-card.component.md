---
id: component.schedule-card
kind: component
status: approved
---

# Schedule Summary Card

```uispec
<ComponentSpec version="0.1">
  <Meta id="component.schedule-card" />
  <Props>
<Prop name="interval" type="WorkingInterval" required="true" />
<Prop name="daysLabel" type="string" required="true" />
<Prop name="timeLabel" type="string" required="true" />
<Prop name="onPress" type="ActionRef" required="true" />
  </Props>
  <Layout>
<ScheduleCard interval="$props.interval" minHeight="$size.card.schedule.height" padding="$space.12" radius="$radius.12" borderColor="$color.border.default" onPress="$props.onPress">
  <Icon name="calendar" size="$size.icon.medium" color="$color.action.primary" />
  <Column flex="1" gap="$space.4">
    <Text value="$props.daysLabel" typography="$type.title.small" color="$color.text.primary" />
    <Text value="$props.timeLabel" typography="$type.body.medium" color="$color.text.primary" />
  </Column>
  <Icon name="chevron-right" size="$size.icon.small" color="$color.icon.secondary" />
</ScheduleCard>
  </Layout>
</ComponentSpec>
```

## Rules

- Карточка целиком нажимаема.
- `interval` — интервал своей строки (view-model `WorkingInterval` экранов 03, 04 и 07); карточка его не
  показывает, а несёт как нагрузку нажатия: `onPress` вызывается с событием `{ interval }`, и экраны 03/07
  биндят его как `$event.interval` в `editWorkingInterval`. Подписи `daysLabel`/`timeLabel` формирует экран
  (`formatWeekdays`, `startLocal–endLocal`), поэтому карточка не выводит их из `interval` сама.

## Acceptance criteria

- Дни и время читаются одной accessibility-фразой.
- Нажатие отдаёт интервал строки целиком: экрану не нужно искать его по id.
