---
id: component.animated-setup-illustration
kind: component
status: approved
---

# Animated Setup Illustration

```uispec
<ComponentSpec version="0.1">
  <Meta id="component.animated-setup-illustration" />
  <Props>
<Prop name="progress" type="decimal" required="false" />
<Prop name="reduceMotion" type="boolean" required="true" />
  </Props>
  <Layout>
<AnimatedSetupIllustration asset="$asset.setup-check" width="232" height="196" motion="$motion.setupCheck" progress="$props.progress" reduceMotion="$props.reduceMotion" />
  </Layout>
</ComponentSpec>
```

## Rules

- Анимация: мягкое покачивание календаря, pulse checkmark, orbit двух декоративных точек.
- При reduce motion показывать статичную иллюстрацию и determinate/indeterminate progress.

## Acceptance criteria

- Не блокирует screen reader.
- Нет вспышек и резких циклов.
