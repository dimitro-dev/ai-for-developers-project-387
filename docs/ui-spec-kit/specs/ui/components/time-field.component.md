---
id: component.time-field
kind: component
status: approved
---

# Time Field

```uispec
<ComponentSpec version="0.1">
  <Meta id="component.time-field" />
  <Props>
<Prop name="label" type="string" required="true" />
<Prop name="value" type="localTime" required="true" />
<Prop name="onChange" type="ActionRef" required="true" />
<Prop name="error" type="string" required="false" />
  </Props>
  <Layout>
<Column gap="$space.8">
  <Text value="$props.label" typography="$type.label.large" color="$color.text.primary" />
  <TimeField value="$props.value" height="$size.input.height" icon="clock" onChange="$props.onChange" error="$props.error" />
</Column>
  </Layout>
</ComponentSpec>
```

## Rules

- Android открывает native time picker или согласованный cross-platform picker.

## Acceptance criteria

- Значение хранится как HH:mm.
- Ошибка видима и озвучивается.
