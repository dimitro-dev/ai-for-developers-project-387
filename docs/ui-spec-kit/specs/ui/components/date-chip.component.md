---
id: component.date-chip
kind: component
platforms: [android, web]
status: draft
---

# Date Chip

Чип одной доступной даты в полоске дат гостевого экрана слотов (кадр 2).

```uispec
<ComponentSpec version="0.1">
  <Meta id="component.date-chip" />
  <Props>
<Prop name="date" type="string" required="true" />
<Prop name="weekdayLabel" type="string" required="true" />
<Prop name="dayLabel" type="string" required="true" />
<Prop name="selected" type="boolean" required="true" />
<Prop name="onPress" type="ActionRef" required="true" />
  </Props>
  <Layout>
<DateChip width="$size.dateChip.width" height="$size.dateChip.height" radius="$radius.12" selected="$props.selected" selectedBackground="$color.guest.selectedSurface" selectedTextColor="$color.text.onPrimary" unselectedBackground="$color.surface.primary" unselectedTextColor="$color.text.primary" borderColor="$color.border.default" onPress="$props.onPress" accessibilityRole="button" accessibilitySelected="$props.selected" accessibilityLabel="{fullDateLabel($props.date)}">
  <Column align="center" justify="center" gap="$space.4"><Text value="$props.weekdayLabel" typography="$type.label.medium" /><Text value="$props.dayLabel" typography="$type.title.small" /></Column>
</DateChip>
  </Layout>
</ComponentSpec>
```

## Rules

- `date` — календарная дата формата `YYYY-MM-DD` в timezone гостя, а не момент времени: чип не занимается арифметикой часовых поясов.
- Вариант `selected`: заливка `$color.guest.selectedSurface`, обе подписи — `$color.text.onPrimary`. Отдельный guest-токен заведён, когда dark-значение `$color.action.primary` давало подписи 3.40 — ниже AA для текста 14sp; после фикса токена он остаётся ради запаса: 5.57 / 5.27 против 4.57 / 4.57 у `action.primary` (light / dark).
- `disabled`-варианта нет: недоступные даты в полоску не попадают вовсе, поэтому недоступного чипа не существует.
- Выбор кодируется не только цветом — `accessibilitySelected` обязателен (MANUAL §10).

## Acceptance criteria

- Touch target 64×72 dp — не меньше 48 dp по обеим осям.
- Screen reader озвучивает полную дату (`fullDateLabel`), а не «Пт 31».
- В обеих темах подпись на выбранном чипе читается с контрастом не ниже 4.5:1.
