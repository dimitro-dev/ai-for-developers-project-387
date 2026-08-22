---
id: component.slot-item
kind: component
platforms: [android, web]
status: draft
---

# Slot Item

Кнопка одного свободного слота внутри `SlotGrid` (кадры 3, 8).

```uispec
<ComponentSpec version="0.1">
  <Meta id="component.slot-item" />
  <Props>
<Prop name="startAtUtc" type="utcDateTime" required="true" />
<Prop name="endAtUtc" type="utcDateTime" required="true" />
<Prop name="selected" type="boolean" required="true" />
<Prop name="onPress" type="ActionRef" required="true" />
  </Props>
  <Layout>
<SlotItem height="$size.slot.height" radius="$radius.8" selected="$props.selected" selectedBackground="$color.guest.selectedSurface" selectedTextColor="$color.text.onPrimary" unselectedBackground="$color.surface.primary" unselectedTextColor="$color.text.primary" borderColor="$color.border.default" onPress="$props.onPress" accessibilityRole="button" accessibilitySelected="$props.selected" accessibilityLabel="{'Выбрать время ' + timeLabel($props.startAtUtc)}">
  <Text value="{timeLabel($props.startAtUtc)}" typography="$type.label.large" align="center" />
</SlotItem>
  </Layout>
</ComponentSpec>
```

## Rules

- Подпись — время начала в timezone гостя; `endAtUtc` на метке не выводится, но уходит в параметры перехода к форме вместе с `startAtUtc`.
- Вариант `selected`: заливка `$color.guest.selectedSurface`, подпись `$color.text.onPrimary` — тот же guest-токен, что у `DateChip`, с запасом к порогу 4.5:1 в обеих темах (5.57 / 5.27).
- Выбор кодируется не только цветом — `accessibilitySelected` обязателен (MANUAL §10).
- После конфликта (`slotUnavailable`) занятый слот исчезает из набора, поэтому `selected` на нём не остаётся.

## Acceptance criteria

- Touch target не меньше 48 dp (фактически `$size.slot.height` = 64 dp).
- Screen reader читает «Выбрать время 10:00», а не только «10:00».
- В обеих темах подпись на выбранном слоте читается с контрастом не ниже 4.5:1.
