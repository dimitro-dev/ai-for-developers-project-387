---
id: component.form-field
kind: component
status: approved
---

# Form Field

```uispec
<ComponentSpec version="0.1">
  <Meta id="component.form-field" />
  <Props>
<Prop name="id" type="string" required="true" />
<Prop name="label" type="string" required="true" />
<Prop name="value" type="string" required="true" />
<Prop name="placeholder" type="string" required="false" />
<Prop name="error" type="string" required="false" />
  </Props>
  <Layout>
<Column gap="$space.8">
  <Text value="$props.label" typography="$type.label.large" color="$color.text.primary" />
  <TextField id="$props.id" value="$props.value" placeholder="$props.placeholder" height="$size.input.height" error="$props.error" />
  <ValidationMessage when="$props.error != null" value="$props.error" target="$props.id" />
</Column>
  </Layout>
</ComponentSpec>
```

## Rules

- Placeholder не заменяет label.

## Acceptance criteria

- Error связан с input.
- Поле поддерживает keyboard type из конкретного screen spec.
