---
id: component.slot-grid
kind: component
platforms: [android, web]
status: draft
---

# Slot Grid

Сетка свободных слотов выбранной даты (кадры 3, 8).

```uispec
<ComponentSpec version="0.1">
  <Meta id="component.slot-grid" />
  <Data>
    <Model name="Slot" source="api" schema="Slot"><Field name="startAtUtc" type="utcDateTime" /><Field name="endAtUtc" type="utcDateTime" /><Field name="eventTypeId" type="string" /></Model>
  </Data>
  <Props>
<Prop name="slots" type="Slot[]" required="true" />
<Prop name="selectedStartAtUtc" type="utcDateTime" required="false" />
<Prop name="onSelect" type="ActionRef" required="true" />
<Prop name="columns" type="int32" required="true" />
  </Props>
  <Layout>
<SlotGrid columns="$props.columns" columnGap="$space.12" rowGap="$space.8" minItemHeight="$size.slot.height">
  <Repeat source="$props.slots" item="item" key="$item.startAtUtc"><SlotItem startAtUtc="$item.startAtUtc" endAtUtc="$item.endAtUtc" selected="{$item.startAtUtc == $props.selectedStartAtUtc}" onPress="$props.onSelect" /></Repeat>
</SlotGrid>
  </Layout>
</ComponentSpec>
```

## Rules

- Mobile default — 2 колонки; на большей ширине число колонок можно увеличить при min width элемента 112 dp.
- Порядок слотов — хронологический по `startAtUtc`; сортировку задаёт `slotsOnDate`, сетка её не меняет.
- `onSelect` несёт выбранный `Slot` целиком (`$event.slot`), а не только время начала: экрану нужен и
  `endAtUtc` — для параметров перехода к форме, где клиент не имеет права вычислять конец встречи.
- Сетка показывает только свободные слоты: занятого слота в наборе нет, поэтому disabled-элемента не существует.

## Acceptance criteria

- Не меньше двух колонок на 360 dp.
- Выбранным может быть не больше одного слота.
- Высота элемента не меньше `$size.slot.height` (64 dp).
