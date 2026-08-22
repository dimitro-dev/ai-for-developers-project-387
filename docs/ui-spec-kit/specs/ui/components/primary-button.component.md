---
id: component.primary-button
kind: component
status: approved
---

# Primary Button

```uispec
<ComponentSpec version="0.1">
  <Meta id="component.primary-button" />
  <Props>
<Prop name="label" type="string" required="true" />
<Prop name="onPress" type="ActionRef" required="true" />
<Prop name="disabled" type="boolean" default="false" />
<Prop name="loading" type="boolean" default="false" />
  </Props>
  <Layout>
<Button variant="primary" width="fill" height="$size.button.height" label="$props.label" onPress="$props.onPress" disabled="$props.disabled" loading="$props.loading" />
  </Layout>
</ComponentSpec>
```

## Rules

- Ширина не меняется при loading.
- Повторный submit заблокирован.

## Acceptance criteria

- Touch target 48 dp.
- Loading имеет текстовое accessibility state.
