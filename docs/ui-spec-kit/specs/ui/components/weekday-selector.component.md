---
id: component.weekday-selector
kind: component
status: approved
---

# Weekday Selector

```uispec
<ComponentSpec version="0.1">
  <Meta id="component.weekday-selector" />
  <Props>
<Prop name="selectedDays" type="Weekday[]" required="true" />
<Prop name="onChange" type="ActionRef" required="true" />
  </Props>
  <Layout>
<WeekdaySelector bind="$props.selectedDays" firstDay="monday" minItemSize="$size.touch.android" gap="$space.8" selectedBackground="$color.action.primary" selectedTextColor="$color.text.onPrimary" unselectedBackground="$color.background.secondary" unselectedTextColor="$color.text.primary" onChange="$props.onChange" />
  </Layout>
</ComponentSpec>
```

## Rules

- Использовать короткие подписи Пн–Вс визуально и полные названия в accessibility.

## Acceptance criteria

- Каждый day chip не меньше 48×48 dp.
- Selected обозначен цветом и accessibility state.
