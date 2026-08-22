---
id: component.timezone-label
kind: component
status: approved
---

# Timezone Label

```uispec
<ComponentSpec version="0.1">
  <Meta id="component.timezone-label" />
  <Props>
<Prop name="timezone" type="string" required="true" />
<Prop name="offset" type="string" required="true" />
  </Props>
  <Layout>
<TimezoneLabel icon="globe" text="{$props.timezone + ' · ' + $props.offset}" typography="$type.label.medium" color="$color.text.secondary" />
  </Layout>
</ComponentSpec>
```

## Rules

- Использовать IANA timezone и вычисленный offset для текущей даты.

## Acceptance criteria

- Label находится рядом со временем/списком, а не скрыт в tooltip.
