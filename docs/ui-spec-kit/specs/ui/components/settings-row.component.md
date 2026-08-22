---
id: component.settings-row
kind: component
status: approved
---

# Settings Navigation Row

Строка корневого экрана настроек: ведущая иконка в плитке, название, подпись и chevron
(кадр 2 доски `owner-mobile-settings.png`).

```uispec
<ComponentSpec version="0.1">
  <Meta id="component.settings-row" />
  <Props>
<Prop name="title" type="string" required="true" />
<Prop name="subtitle" type="string" required="false" />
<Prop name="icon" type="string" required="false" />
<Prop name="onPress" type="ActionRef" required="true" />
  </Props>
  <Layout>
<SettingsRow minHeight="$size.row.settings.height" paddingHorizontal="$space.16" onPress="$props.onPress">
  <Row align="center" gap="$space.12">
    <Center when="$props.icon != null" width="$size.touch.android" height="$size.touch.android" radius="$radius.12" background="$color.surface.selected"><Icon name="$props.icon" size="$size.icon.medium" color="$color.action.primary" /></Center>
    <Column flex="1" gap="$space.4"><Text value="$props.title" typography="$type.title.small" /><Text when="$props.subtitle != null" value="$props.subtitle" typography="$type.body.small" color="$color.text.secondary" /></Column>
    <Icon name="chevron-right" size="$size.icon.small" color="$color.icon.secondary" />
  </Row>
</SettingsRow>
  </Layout>
</ComponentSpec>
```

## Rules

- Строка целиком нажимаема.
- Ведущая иконка необязательна: имя глифа приходит пропом `icon` из набора глифов кита (`user`, `calendar`,
  `event-type`, `clock`, …), плитка под ним — `$color.surface.selected` (тот же приём, что у
  `BookingSummaryCard`). Без пропа строка выглядит как раньше.
- Иконка декоративна: название строки сообщает то же словами, поэтому отдельного `accessibilityLabel` у неё
  нет и порог WCAG 1.4.11 к ней не применяется. Пара «глиф `$color.action.primary` на плитке
  `$color.surface.selected`» даёт 4.03 в light и 2.68 в dark — см. комментарий у токена в
  `../tokens/colors.tokens.xml`.

## Acceptance criteria

- Subtitle не обязателен.
- Иконка не обязательна: строка без неё сохраняет раскладку и высоту.
- Touch target не меньше 64 dp по высоте.
