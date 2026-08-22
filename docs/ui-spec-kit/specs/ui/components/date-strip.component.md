---
id: component.date-strip
kind: component
platforms: [android, web]
status: draft
---

# Date Strip

Горизонтальная полоска доступных дат серверного 14-дневного окна (кадр 2).

```uispec
<ComponentSpec version="0.1">
  <Meta id="component.date-strip" />
  <Data>
    <Model name="AvailableDate"><Field name="date" type="string" derived="true" /><Field name="weekdayLabel" type="string" derived="true" /><Field name="dayLabel" type="string" derived="true" /></Model>
  </Data>
  <Props>
<Prop name="dates" type="AvailableDate[]" required="true" />
<Prop name="selectedDate" type="string" required="false" />
<Prop name="onSelect" type="ActionRef" required="true" />
  </Props>
  <Layout>
<DateStrip horizontal="true" showsScrollIndicator="false" gap="$space.8" paddingVertical="$space.4">
  <Repeat source="$props.dates" item="item" key="$item.date"><DateChip date="$item.date" weekdayLabel="$item.weekdayLabel" dayLabel="$item.dayLabel" selected="{$item.date == $props.selectedDate}" onPress="$props.onSelect" /></Repeat>
</DateStrip>
  </Layout>
</ComponentSpec>
```

## Rules

- Полоска получает только даты, у которых есть хотя бы один свободный слот (`availableDates`): пропуск в ряду чисел — это отсутствие свободного времени, а не отключённый чип.
- Собственной высоты у полоски нет — её задают чипы (`$size.dateChip.height`) плюс вертикальный отступ.
- `AvailableDate` — view-model, целиком выведенная из `Slot[]` на клиенте; в контракте такой сущности нет. Копия модели живёт в спеке-потребителе по конвенции самодостаточности спеков.
- На mobile — горизонтальный список ближайших дат, а не уменьшенный месячный календарь.

## Acceptance criteria

- Выбранная дата — ровно одна; сравнение по строке `YYYY-MM-DD`.
- Список скроллится горизонтально, первая доступная дата видна без скролла.
- Порядок дат — по возрастанию.
