---
id: owner.working-hours-settings
route: OwnerWorkingHoursSettings
platforms: [android]
reference: ../assets/owner-mobile-flow.png
referenceFrame: 8
status: approved
---

# Настройки рабочего времени

```uispec
<ScreenSpec version="0.1">
  <Meta id="owner.working-hours-settings" route="OwnerWorkingHoursSettings" title="Рабочее время" />
  <Viewport width="360" height="800" unit="dp" safeArea="true" />
  <Data>
    <Enum name="Weekday" values="monday,tuesday,wednesday,thursday,friday,saturday,sunday" />
    <Model name="WorkingInterval"><Field name="id" type="string" /><Field name="daysOfWeek" type="Weekday[]" from="AvailabilityRule.daysOfWeek" /><Field name="startLocal" type="localTime" from="AvailabilityRule.startLocal" /><Field name="endLocal" type="localTime" from="AvailabilityRule.endLocal" /></Model>
    <Model name="OwnerSettingsDraft"><Field name="displayName" type="string" from="CalendarSettingsResponse.displayName" /><Field name="timeZone" type="string" from="CalendarSettingsResponse.timeZone" /><Field name="availabilityRules" type="WorkingInterval[]" from="CalendarSettingsResponse.availabilityRules" /><Field name="slotIntervalMinutes" type="int32" from="CalendarSettingsResponse.slotIntervalMinutes" /></Model>
  </Data>
  <StateMachine initial="loading"><State id="loading" /><State id="editing"><Property name="form" type="OwnerSettingsDraft" /><Property name="dirty" type="boolean" default="false" /><Property name="editedInterval" type="WorkingInterval" required="false" /></State><State id="intervalSheet" extends="editing" /><State id="saving" extends="editing" /><State id="error" extends="editing"><Property name="message" type="string" /></State><State id="saved" extends="editing" /></StateMachine>
  <Validation><Rule id="interval-required" expression="$state.form.availabilityRules.length &gt; 0" message="Добавьте хотя бы один рабочий интервал" target="schedule-list" /></Validation>
  <Actions>
    <Action id="loadWorkingHoursSettings" kind="api.query" onSuccessState="editing" />
    <Action id="openAddWorkingHours" kind="local.update" path="$state.editedInterval" value="null" onSuccessState="intervalSheet" />
    <Action id="editWorkingInterval" kind="local.update" path="$state.editedInterval" value="$event.interval" onSuccessState="intervalSheet" />
    <Action id="applyWorkingInterval" kind="local.submit" markDirty="true" onSuccessState="editing"><Payload><Field name="daysOfWeek" bind="$event.daysOfWeek" /><Field name="startLocal" bind="$event.startLocal" /><Field name="endLocal" bind="$event.endLocal" /></Payload></Action>
    <Action id="closeAddWorkingHours" kind="local.transition" target="editing" />
    <Action id="changeSlotStep" kind="local.update" path="$state.form.slotIntervalMinutes" value="$event.value" markDirty="true" />
    <Action id="openEventTypes" kind="navigation.push" target="EventTypesFromSettings" />
    <Action id="saveOwnerSettings" kind="api.command" disabledWhen="$validation.invalid || !$state.dirty || $state == saving" onSuccessState="saved" onErrorState="error"><Payload><Field name="displayName" bind="$state.form.displayName" /><Field name="timeZone" bind="$state.form.timeZone" /><Field name="availabilityRules" bind="{toAvailabilityRules($state.form.availabilityRules)}" /><Field name="slotIntervalMinutes" bind="$state.form.slotIntervalMinutes" /></Payload></Action>
    <Action id="openMeetings" kind="navigation.tab" target="OwnerMeetings" />
  </Actions>
  <Layout type="column" background="$color.background.primary" minHeight="fill">
    <Header title="Рабочее время" />
    <StateView state="loading"><Column padding="$space.16" gap="$space.12"><Skeleton variant="schedule-card" height="$size.card.schedule.height" /><Skeleton variant="schedule-card" height="$size.card.schedule.height" /><Skeleton variant="field" height="$size.input.height" /></Column></StateView>
    <StateView state="editing|intervalSheet|saving|error|saved">
      <ScrollView flex="1" contentPaddingHorizontal="$space.16" contentPaddingBottom="$space.24">
        <Text value="Текущий график" typography="$type.label.large" />
        <Spacer size="$space.8" />
        <Section id="schedule-list"><Repeat source="$state.form.availabilityRules" item="interval" key="$interval.id"><ScheduleCard interval="$interval" daysLabel="{formatWeekdays($interval.daysOfWeek)}" timeLabel="{$interval.startLocal + '–' + $interval.endLocal}" onPress="editWorkingInterval" /></Repeat></Section>
        <Text value="{formatDaysOff($state.form.availabilityRules)}" typography="$type.body.medium" color="$color.text.secondary" marginTop="$space.12" />
        <Spacer size="$space.16" />
        <Button variant="secondary" icon="plus" width="fill" height="$size.button.height" label="Добавить рабочее время" onPress="openAddWorkingHours" />
        <Spacer size="$space.24" />
        <SelectField id="slot-step" label="Начало слотов каждые" value="$state.form.slotIntervalMinutes" options="15,30,60" height="$size.input.height" onChange="changeSlotStep" />
        <Text value="Изменения не затронут существующие встречи." typography="$type.body.small" color="$color.text.secondary" marginTop="$space.12" />
        <Spacer size="$space.20" />
        <SettingsRow title="Типы событий" subtitle="Управление типами встреч" onPress="openEventTypes" />
        <ValidationMessage target="schedule-list" />
        <ValidationMessage when="$state == error" value="$state.message" target="screen" />
      </ScrollView>
      <SafeArea edges="bottom" padding="$space.16"><Button variant="primary" width="fill" height="$size.button.height" label="Сохранить изменения" onPress="saveOwnerSettings" disabled="{$validation.invalid || !$state.dirty}" loading="{$state == saving}" /></SafeArea>
    </StateView>
    <BottomNavigation activeTab="settings" />
  </Layout>
</ScreenSpec>
```

## UX rules

- На основном экране сначала показывается текущий график.
- Добавление/изменение интервала выполняется в том же bottom sheet, что и onboarding: это локальный
  компонент экрана (спека `04-add-working-hours-sheet.screen.md`, конвенция `MANUAL.md` §2.1), а не route.
  Sheet монтируется поверх контента в состоянии `intervalSheet`, вход получает пропсами (`interval` —
  `$state.editedInterval`, `currentIntervals` — `$state.form.availabilityRules`).
- `openAddWorkingHours` открывает sheet на создание (`editedInterval` = `null`), `editWorkingInterval` —
  на редактирование: событие нажатия `ScheduleCard` несёт интервал своей строки. `applyWorkingInterval`
  принимает `Payload` из sheet, помечает экран изменённым и возвращает его в `editing`: если
  `editedInterval` не пуст, интервал **заменяется** (client-only `id` сохраняется), иначе добавляется
  новый. `closeAddWorkingHours` — закрытие без применения (backdrop, swipe-down, системная «назад»).
- Типы событий доступны через settings row (route `EventTypesFromSettings` внутри вкладки Настройки).
- Существующие Booking не изменяются.
- `OwnerSettingsDraft` — view-model над `CalendarSettingsResponse` (маппинг — атрибуты `from=`); `id` интервала — client-only stable key. Payload `saveOwnerSettings` — полный контрактный `SetupRequest`; `toAvailabilityRules` отбрасывает `id` и приводит `Weekday` к контрактному `DayOfWeek`.

## Acceptance criteria

- Save недоступен без изменений.
- Network error не очищает draft.
- Bottom navigation содержит два пункта.
