---
id: component.empty-state
kind: component
status: approved
---

# Empty State

```uispec
<ComponentSpec version="0.1">
  <Meta id="component.empty-state" />
  <Props>
<Prop name="asset" type="AssetRef" required="true" />
<Prop name="title" type="string" required="true" />
<Prop name="body" type="string" required="true" />
<Prop name="ctaLabel" type="string" required="false" />
<Prop name="ctaAction" type="ActionRef" required="false" />
  </Props>
  <Layout>
<Center flex="1" paddingHorizontal="$space.24">
  <Image source="$props.asset" width="208" height="176" resizeMode="contain" />
  <Spacer size="$space.24" />
  <Text value="$props.title" typography="$type.title.medium" align="center" />
  <Spacer size="$space.8" />
  <Text value="$props.body" typography="$type.body.medium" color="$color.text.secondary" align="center" maxWidth="304" />
  <Spacer when="$props.ctaLabel != null" size="$space.24" />
  <Button when="$props.ctaLabel != null" variant="primary" width="fill" height="$size.button.height" label="$props.ctaLabel" onPress="$props.ctaAction" />
</Center>
  </Layout>
</ComponentSpec>
```

## Rules

- CTA показывается только при полезном действии.

## Acceptance criteria

- Контент остаётся читаемым при font scale 1.3.
