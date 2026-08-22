---
id: component.app-header
kind: component
status: approved
---

# App Header

```uispec
<ComponentSpec version="0.1">
  <Meta id="component.app-header" />
  <Props>
<Prop name="title" type="string" required="true" />
<Prop name="backAction" type="ActionRef" required="false" />
<Prop name="rightActions" type="HeaderAction[]" required="false" />
  </Props>
  <Layout>
<Header height="$size.header.height" paddingHorizontal="$space.16" align="center">
  <IconButton when="$props.backAction != null" icon="arrow-left" size="$size.touch.android" onPress="$props.backAction" accessibilityLabel="Назад" />
  <Text value="$props.title" typography="$type.title.medium" color="$color.text.primary" flex="1" />
  <Repeat source="$props.rightActions" item="action" key="$action.id">
    <IconButton icon="$action.icon" size="$size.touch.android" onPress="$action.onPress" accessibilityLabel="$action.accessibilityLabel" />
  </Repeat>
</Header>
  </Layout>
</ComponentSpec>
```

## Rules

- Максимум две header actions справа.
- Иконки не уменьшают touch target.

## Acceptance criteria

- Высота 56 dp.
- Каждая icon action имеет accessibility label.
