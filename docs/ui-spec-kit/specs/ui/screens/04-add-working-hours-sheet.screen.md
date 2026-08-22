---
id: owner.add-working-hours
platforms: [android]
reference: ../assets/owner-mobile-flow.png
referenceFrame: 4
status: approved
---

# Bottom sheet — добавить рабочее время

```uispec
<ScreenSpec version="0.1">
  <Meta id="owner.add-working-hours" title="Добавить рабочее время" presentation="bottom-sheet" parent="owner.onboarding-working-hours|owner.working-hours-settings" />
  <Viewport width="360" unit="dp" safeAreaBottom="true" />
  <Data>
    <Enum name="Weekday" values="monday,tuesday,wednesday,thursday,friday,saturday,sunday" />
    <Model name="WorkingInterval"><Field name="id" type="string" /><Field name="daysOfWeek" type="Weekday[]" from="AvailabilityRule.daysOfWeek" /><Field name="startLocal" type="localTime" from="AvailabilityRule.startLocal" /><Field name="endLocal" type="localTime" from="AvailabilityRule.endLocal" /></Model>
  </Data>
  <Props>
    <Prop name="interval" type="WorkingInterval" required="false" />
    <Prop name="currentIntervals" type="WorkingInterval[]" required="true" />
  </Props>
  <StateMachine initial="editing">
    <State id="editing"><Property name="selectedDays" type="Weekday[]" default="[monday,tuesday,wednesday,thursday,friday]" /><Property name="startLocal" type="localTime" default="09:00" /><Property name="endLocal" type="localTime" default="18:00" /><Property name="overwrittenIntervals" type="WorkingInterval[]" default="[]" /></State>
    <State id="confirmOverwrite" extends="editing" />
    <State id="submitting" extends="editing" />
  </StateMachine>
  <Validation>
    <Rule id="days-required" expression="$state.selectedDays.length &gt; 0" message="Выберите хотя бы один день" target="weekday-selector" />
    <Rule id="end-after-start" expression="$state.endLocal &gt; $state.startLocal" message="Время окончания должно быть позже времени начала" target="time-fields" />
  </Validation>
  <Actions>
    <Action id="changeDays" kind="local.update" path="$state.selectedDays" value="$event.value" />
    <Action id="changeStartTime" kind="local.update" path="$state.startLocal" value="$event.value" />
    <Action id="changeEndTime" kind="local.update" path="$state.endLocal" value="$event.value" />
    <Action id="applyWorkingHours" kind="local.submit" disabledWhen="$validation.invalid" before="detectOverwrites" onConflict="confirmOverwrite" result="close"><Payload><Field name="daysOfWeek" bind="$state.selectedDays" /><Field name="startLocal" bind="$state.startLocal" /><Field name="endLocal" bind="$state.endLocal" /></Payload></Action>
    <Action id="confirmOverwriteApply" kind="local.submit" result="close"><Payload><Field name="daysOfWeek" bind="$state.selectedDays" /><Field name="startLocal" bind="$state.startLocal" /><Field name="endLocal" bind="$state.endLocal" /></Payload></Action>
    <Action id="cancelOverwrite" kind="local.transition" target="editing" />
  </Actions>
  <Layout type="overlay">
    <BottomSheet snapPoint="content" maxHeight="$size.sheet.maxHeight" cornerRadius="$radius.24" background="$color.surface.primary" backdropColor="$color.background.scrim" dismissOnBackdropPress="true" dismissOnSwipeDown="true" keyboardAvoiding="true" motion="$motion.sheet.enter">
      <DragHandle width="$size.dragHandle.width" height="$size.dragHandle.height" marginTop="$space.8" marginBottom="$space.16" />
      <Column paddingHorizontal="$space.16" paddingBottom="$space.16">
        <Text when="$props.interval == null" value="Добавить рабочее время" typography="$type.title.medium" />
        <Text when="$props.interval != null" value="Изменить рабочее время" typography="$type.title.medium" />
        <Spacer size="$space.24" />
        <Text value="Выберите дни" typography="$type.label.large" />
        <Spacer size="$space.8" />
        <WeekdaySelector id="weekday-selector" selectedDays="$state.selectedDays" onChange="changeDays" />
        <ValidationMessage target="weekday-selector" marginTop="$space.8" />
        <Spacer size="$space.24" />
        <TimeField id="start-time" label="Время начала" value="$state.startLocal" onChange="changeStartTime" />
        <Spacer size="$space.12" />
        <TimeField id="end-time" label="Время окончания" value="$state.endLocal" onChange="changeEndTime" />
        <ValidationMessage target="time-fields" marginTop="$space.8" />
        <Spacer size="$space.24" />
        <Button variant="primary" width="fill" height="$size.button.height" label="{applyDaysLabel($state.selectedDays.length)}" onPress="applyWorkingHours" disabled="$validation.invalid" />
      </Column>
    </BottomSheet>
    <ConfirmationDialog when="$state == confirmOverwrite" title="Заменить индивидуальные часы?" body="{overwriteMessage($state.overwrittenIntervals, $state.startLocal, $state.endLocal)}" cancelLabel="Отмена" confirmLabel="Заменить" onCancel="cancelOverwrite" onConfirm="confirmOverwriteApply" />
  </Layout>
</ScreenSpec>
```

## UX rules

- Это sheet-компонент экранов `owner.onboarding-working-hours` (03) и `owner.working-hours-settings` (07),
  а не route: в `navigation/navigation.uispec.xml` записи для него нет, открытие и закрытие — состояние
  родителя (`intervalSheet`), вход — блок `<Props>`. Конвенция описана в `MANUAL.md` §2.1 и одинакова
  с `11-booking-details-sheet.screen.md`.
- `interval` — интервал, открытый на редактирование; `null` означает создание нового. При `null` действуют
  `default=` состояния `editing` (будни, 09:00–18:00), при непустом `interval` форма префиллится его днями
  и временем.
- Заголовок зависит от режима: при `$props.interval == null` — «Добавить рабочее время», иначе —
  «Изменить рабочее время»; доступное имя sheet'а совпадает с видимым заголовком, а `Meta title` —
  подпись режима создания.
- `applyWorkingHours` (`local.submit` с `result="close"`) отдаёт `Payload` родителю и закрывает sheet.
  Если `interval` передан, родитель **заменяет** им исходный интервал, сохраняя его client-only `id`;
  если `null` — добавляет новый интервал. Guest/backend API не вызывается.
- `currentIntervals` — текущий график родителя: по нему проверка `detectOverwrites` находит пересечения,
  заполняет `overwrittenIntervals` и уводит в `confirmOverwrite` (компонент `confirmation-dialog`).
  Редактируемый `interval` собой себя не перезаписывает.
- Выбранный интервал применяется ко всем выбранным дням.
- Закрытие без применения — backdrop, swipe-down и системная «назад» на Android; отдельного действия
  в спеке нет, sheet размонтирует родитель (`closeAddWorkingHours`).

## Acceptance criteria

- Дни и время валидируются до применения.
- CTA меняет подпись по количеству дней.
- Guest/backend API не вызывается.
- Sheet, открытый на существующем интервале, показывает его дни и время, а применение не создаёт второй интервал.
- Системная «назад» закрывает sheet, а не экран-родитель.
