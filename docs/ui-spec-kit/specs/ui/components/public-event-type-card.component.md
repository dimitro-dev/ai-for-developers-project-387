---
id: component.public-event-type-card
kind: component
platforms: [android, web]
status: draft
---

# Public Event Type Card

Карточка типа встречи в публичном каталоге гостя (кадр 1). Отдельный компонент от owner-овского
`EventTypeCard`: гостю не показывается публичный id, а плитка иконки красится акцентным цветом.

```uispec
<ComponentSpec version="0.1">
  <Meta id="component.public-event-type-card" />
  <Props>
<Prop name="id" type="string" required="true" />
<Prop name="name" type="string" required="true" />
<Prop name="description" type="string" required="false" />
<Prop name="durationMinutes" type="int32" required="true" />
<Prop name="accentIndex" type="int32" required="true" />
<Prop name="onPress" type="ActionRef" required="true" />
  </Props>
  <Layout>
<PublicEventTypeCard minHeight="$size.card.eventType.height" padding="$space.16" radius="$radius.12" borderColor="$color.border.default" background="$color.surface.primary" onPress="$props.onPress" accessibilityRole="button">
  <Row align="center" gap="$space.12">
    <Center width="$size.touch.android" height="$size.touch.android" radius="$radius.12" accentIndex="$props.accentIndex"><Icon name="event-type" size="$size.icon.medium" color="$color.text.onPrimary" /></Center>
    <Column flex="1" gap="$space.4"><Text value="$props.name" typography="$type.title.small" /><Text when="$props.description != null" value="$props.description" typography="$type.body.small" color="$color.text.secondary" numberOfLines="2" /><Text value="{durationLabel($props.durationMinutes)}" typography="$type.label.medium" color="$color.text.secondary" /></Column>
    <Icon name="chevron-right" size="$size.icon.medium" color="$color.icon.secondary" />
  </Row>
</PublicEventTypeCard>
  </Layout>
</ComponentSpec>
```

## Rules

- Иконка одна для всех типов встреч — существующая `event-type`; различается только цвет плитки под ней.
- `accentIndex` — данные, а не оформление: индекс `0…5` сопоставляется с токенами `$color.accent.1 … $color.accent.6` внутри RN-реализации компонента, тем же способом, каким `Button variant="primary"` сопоставляет вариант со стилем. Значение индекса даёт helper `eventTypeAccentIndex($props.id)` на стороне экрана.
- Глиф внутри плитки — `$color.text.onPrimary`; все шесть акцентов проверены на контраст к нему (порог 3:1 WCAG 1.4.11).
- Цвет декоративен и смысла не кодирует: при 7+ типах встреч у одного владельца цвета повторяются, и это допустимо.
- Публичный id (`/slug`) в гостевой карточке не выводится вовсе, в отличие от owner-карточки.
- Вся карточка — один интерактивный touch target.

## Acceptance criteria

- Высота карточки не меньше `$size.card.eventType.height`; touch target не меньше 48 dp.
- Название, описание и длительность доступны screen reader одним логическим элементом.
- Описание необязательно: без него карточка не ломает раскладку.
