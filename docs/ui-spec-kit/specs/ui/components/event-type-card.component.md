---
id: component.event-type-card
kind: component
status: approved
---

# Event Type Card

Карточка типа события в списке владельца (кадр 7 доски `owner-mobile-settings-details.png`): акцентная
плитка с глифом, название, описание, длительность, публичный id и chevron.

```uispec
<ComponentSpec version="0.1">
  <Meta id="component.event-type-card" />
  <Props>
<Prop name="id" type="string" required="true" />
<Prop name="title" type="string" required="true" />
<Prop name="description" type="string" required="false" />
<Prop name="durationLabel" type="string" required="true" />
<Prop name="publicId" type="string" required="true" />
<Prop name="accentIndex" type="int32" required="true" />
  </Props>
  <Layout>
<EventTypeCard minHeight="$size.card.eventType.height" padding="$space.16" radius="$radius.12" borderColor="$color.border.default" background="$color.surface.primary">
  <Row align="start" gap="$space.12">
    <Center width="$size.touch.android" height="$size.touch.android" radius="$radius.12" accentIndex="$props.accentIndex"><Icon name="event-type" size="$size.icon.medium" color="$color.text.onPrimary" /></Center>
    <Column flex="1" gap="$space.4"><Text value="$props.title" typography="$type.title.small" /><Text when="$props.description != null" value="$props.description" typography="$type.body.small" color="$color.text.secondary" numberOfLines="2" /><Text value="$props.durationLabel" typography="$type.label.medium" color="$color.text.secondary" /><Text value="{'/' + $props.publicId}" typography="$type.body.small" color="$color.text.secondary" /></Column>
    <Icon name="chevron-right" size="$size.icon.small" color="$color.icon.secondary" />
  </Row>
</EventTypeCard>
  </Layout>
</ComponentSpec>
```

## Rules

- Глиф в плитке один для всех типов события — `event-type`; различается только цвет плитки (решение FR4
  `contract/001`, путь «б»). На кадре 7 у двух карточек нарисованы разные глифы — это вольность отрисовки
  макета, а не требование: разных иконок по типам встреч в ките нет и заводить их не нужно.
- `accentIndex` — данные, а не оформление: индекс `0…5` сопоставляется с токенами `$color.accent.1 …
  $color.accent.6` внутри RN-реализации, как `Button variant="primary"` сопоставляет вариант со стилем.
  Значение даёт helper `eventTypeAccentIndex($props.id)` на стороне экрана; один `id` всегда даёт один цвет.
- Цвет плитки декоративен и смысла не кодирует: при 7+ типах события цвета повторяются, и это допустимо.
  Глиф внутри — `$color.text.onPrimary`, все шесть акцентов проверены к нему на порог 3:1 (WCAG 1.4.11).
- Публичный id выводится строкой `/slug` — в отличие от гостевой `PublicEventTypeCard`, где его нет вовсе.
- В MVP карточка не редактируется и не удаляется: `onPress` у неё нет. Chevron нарисован по кадру 7 как
  задел под будущий экран деталей типа события — расхождение с «карточка не выглядит редактируемой»
  осознанное и решается владельцем вместе с появлением такого экрана.

## Acceptance criteria

- Все значения доступны screen reader; плитка с глифом в озвучивание не попадает.
- Описание необязательно: без него карточка не ломает раскладку.
- Один и тот же `id` всегда даёт один и тот же акцентный цвет, независимо от порядка в списке.
