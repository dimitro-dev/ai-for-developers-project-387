---
id: component.bottom-sheet
kind: component
status: approved
---

# Application Bottom Sheet

```uispec
<ComponentSpec version="0.1">
  <Meta id="component.bottom-sheet" />
  <Props>
<Prop name="title" type="string" required="true" />
<Prop name="dismissible" type="boolean" default="true" />
<Slot name="content" />
  </Props>
  <Layout>
<BottomSheet snapPoint="content" maxHeight="$size.sheet.maxHeight" cornerRadius="$radius.24" background="$color.surface.primary" backdropColor="$color.background.scrim" dismissOnBackdropPress="$props.dismissible" dismissOnSwipeDown="$props.dismissible" motion="$motion.sheet.enter">
  <DragHandle width="$size.dragHandle.width" height="$size.dragHandle.height" marginTop="$space.8" marginBottom="$space.16" />
  <Text value="$props.title" typography="$type.title.medium" color="$color.text.primary" paddingHorizontal="$space.16" />
  <SlotRef name="content" />
</BottomSheet>
  </Layout>
</ComponentSpec>
```

## Rules

- Фон parent screen остаётся виден под scrim.
- При keyboard sheet должен избегать перекрытия CTA.

## Acceptance criteria

- Возвращает focus вызвавшему элементу.
- Заголовок объявляется как modal title.
