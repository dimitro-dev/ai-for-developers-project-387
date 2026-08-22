---
id: component.progress-header
kind: component
status: approved
---

# Onboarding Progress Header

```uispec
<ComponentSpec version="0.1">
  <Meta id="component.progress-header" />
  <Props>
<Prop name="current" type="int32" required="true" />
<Prop name="total" type="int32" required="true" />
<Prop name="backAction" type="ActionRef" required="false" />
  </Props>
  <Layout>
<Column paddingHorizontal="$space.16" paddingTop="$space.8" gap="$space.8">
  <Row align="center">
    <IconButton when="$props.backAction != null" icon="arrow-left" size="$size.touch.android" onPress="$props.backAction" accessibilityLabel="Назад" />
    <Spacer flex="1" />
    <Text value="{$props.current + ' / ' + $props.total}" typography="$type.label.medium" color="$color.text.secondary" />
  </Row>
  <ProgressBar value="$props.current" max="$props.total" height="4" radius="$radius.pill" />
</Column>
  </Layout>
</ComponentSpec>
```

## Rules

- Прогресс отражает шаг, но не является интерактивным.

## Acceptance criteria

- Текст шага доступен screen reader.
- При current=total полоса заполнена полностью.
