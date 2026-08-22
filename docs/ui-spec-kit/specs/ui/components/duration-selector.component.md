---
id: component.duration-selector
kind: component
platforms: [android]
status: approved
---

# Duration Selector

Ряд чипов длительности встречи в форме создания типа события (кадры 5, 6 доски
`owner-mobile-settings-details.png`): «15 мин», «30 мин», «45 мин», «60 мин», выбран ровно один.

```uispec
<ComponentSpec version="0.1">
  <Meta id="component.duration-selector" />
  <Props>
<Prop name="id" type="string" required="true" />
<Prop name="value" type="int32" required="true" />
<Prop name="onChange" type="ActionRef" required="true" />
  </Props>
  <Layout>
<DurationSelector id="$props.id" options="15,30,45,60" value="$props.value" minItemSize="$size.touch.android" gap="$space.8" radius="$radius.8" selectedBackground="$color.action.primary" selectedTextColor="$color.text.onPrimary" unselectedBackground="$color.background.secondary" unselectedTextColor="$color.text.primary" borderColor="$color.border.default" onChange="$props.onChange" />
  </Layout>
</ComponentSpec>
```

## Rules

- Набор длительностей закрыт: 15, 30, 45, 60 минут. Чип отдаёт в `onChange` число минут (`$event.value`),
  а не подпись.
- Подпись чипа — короткая, «N мин» (кадр 5). Полная форма `durationLabel()` («30 минут») остаётся у карточки
  типа события: в ряду из четырёх чипов длинная подпись не помещается.
- Выбор единственный и всегда непустой: пустого состояния у ряда нет, начальное значение задаёт экран.
- Выбор кодируется не только цветом — `accessibilitySelected` у чипа обязателен (MANUAL §10).
- Компонент собственный, а не переиспользованный `DateChip`: у чипа даты две подписи, accessibility-имя из
  `fullDateLabel()` и динамический набор из данных, здесь — одна подпись и закрытый список из четырёх
  значений. Внутреннюю раскладку ряда компонент скрывает сам, как `WeekdaySelector` — свои дни недели.
- Подпись на выбранном чипе — `$color.text.onPrimary` на `$color.action.primary`: контраст 4.57 в обеих
  темах (см. комментарий у токена в `../tokens/colors.tokens.xml`).

## Acceptance criteria

- Каждый чип не меньше 48 dp по обеим осям.
- Ровно один чип выбран; выбранный озвучивается как selected.
- Ряд не переносится на вторую строку при font scale 1.0 и остаётся читаемым при 1.3.
