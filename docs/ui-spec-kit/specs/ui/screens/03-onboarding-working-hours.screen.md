---
id: owner.onboarding-working-hours
route: OnboardingWorkingHours
platforms: [android]
reference: ../assets/owner-mobile-flow.png
referenceFrame: 3
status: approved
---

# Onboarding — рабочее время

```uispec
<ScreenSpec version="0.1">
  <Meta id="owner.onboarding-working-hours" route="OnboardingWorkingHours" title="Рабочее время" />
  <Viewport width="360" height="800" unit="dp" safeArea="true" />
  <Data>
    <Enum name="Weekday" values="monday,tuesday,wednesday,thursday,friday,saturday,sunday" />
    <Model name="WorkingInterval"><Field name="id" type="string" /><Field name="daysOfWeek" type="Weekday[]" from="AvailabilityRule.daysOfWeek" /><Field name="startLocal" type="localTime" from="AvailabilityRule.startLocal" /><Field name="endLocal" type="localTime" from="AvailabilityRule.endLocal" /></Model>
    <Model name="WorkingHoursDraft"><Field name="availabilityRules" type="WorkingInterval[]" from="SetupRequest.availabilityRules" /><Field name="slotIntervalMinutes" type="int32" from="SetupRequest.slotIntervalMinutes" /><Field name="timeZone" type="string" from="SetupRequest.timeZone" /></Model>
    <Model name="OwnerProfileDraft"><Field name="displayName" type="string" required="true" from="SetupRequest.displayName" /><Field name="timeZone" type="string" required="true" from="SetupRequest.timeZone" /></Model>
  </Data>
  <StateMachine initial="editing">
    <State id="editing"><Property name="profileDraft" type="OwnerProfileDraft" /><Property name="form" type="WorkingHoursDraft" /><Property name="editedInterval" type="WorkingInterval" required="false" /></State>
    <State id="intervalSheet" extends="editing" />
    <State id="submitting" extends="editing" />
    <State id="error" extends="editing"><Property name="message" type="string" /></State>
  </StateMachine>
  <Validation><Rule id="interval-required" expression="$state.form.availabilityRules.length &gt; 0" message="Добавьте хотя бы один рабочий интервал" target="schedule-list" /></Validation>
  <Actions>
    <Action id="goBackProfile" kind="navigation.back" />
    <Action id="openAddWorkingHours" kind="local.update" path="$state.editedInterval" value="null" onSuccessState="intervalSheet" />
    <Action id="editWorkingInterval" kind="local.update" path="$state.editedInterval" value="$event.interval" onSuccessState="intervalSheet" />
    <Action id="applyWorkingInterval" kind="local.submit" onSuccessState="editing"><Payload><Field name="daysOfWeek" bind="$event.daysOfWeek" /><Field name="startLocal" bind="$event.startLocal" /><Field name="endLocal" bind="$event.endLocal" /></Payload></Action>
    <Action id="closeAddWorkingHours" kind="local.transition" target="editing" />
    <Action id="changeSlotStep" kind="local.update" path="$state.form.slotIntervalMinutes" value="$event.value" />
    <Action id="completeSetup" kind="api.command" disabledWhen="$validation.invalid || $state == submitting" onSuccessRoute="OwnerMeetings" onErrorState="error"><Payload><Field name="displayName" bind="$state.profileDraft.displayName" /><Field name="timeZone" bind="$state.profileDraft.timeZone" /><Field name="availabilityRules" bind="{toAvailabilityRules($state.form.availabilityRules)}" /><Field name="slotIntervalMinutes" bind="$state.form.slotIntervalMinutes" /></Payload></Action>
  </Actions>
  <Layout type="column" background="$color.background.primary" minHeight="fill">
    <ProgressHeader current="2" total="2" backAction="goBackProfile" />
    <ScrollView flex="1" contentPaddingHorizontal="$space.16" contentPaddingBottom="$space.24">
      <Text value="Рабочее время" typography="$type.title.large" marginTop="$space.24" />
      <Spacer size="$space.20" />
      <Text value="Текущий график" typography="$type.label.large" />
      <Spacer size="$space.8" />
      <Section id="schedule-list">
        <StateView when="$state.form.availabilityRules.length == 0"><Text value="Рабочее время ещё не настроено" typography="$type.body.medium" color="$color.text.secondary" /></StateView>
        <Repeat source="$state.form.availabilityRules" item="interval" key="$interval.id"><ScheduleCard interval="$interval" daysLabel="{formatWeekdays($interval.daysOfWeek)}" timeLabel="{$interval.startLocal + '–' + $interval.endLocal}" onPress="editWorkingInterval" /></Repeat>
      </Section>
      <Text value="{formatDaysOff($state.form.availabilityRules)}" typography="$type.body.medium" color="$color.text.secondary" marginTop="$space.12" />
      <Spacer size="$space.16" />
      <Button variant="secondary" icon="plus" width="fill" height="$size.button.height" label="Добавить рабочее время" onPress="openAddWorkingHours" />
      <Spacer size="$space.24" />
      <SelectField id="slot-step" label="Начало слотов каждые" value="$state.form.slotIntervalMinutes" options="15,30,60" height="$size.input.height" onChange="changeSlotStep" />
      <Spacer size="$space.12" />
      <TimezoneLabel timezone="$state.form.timeZone" offset="{formatUtcOffset($state.form.timeZone)}" />
      <ValidationMessage target="schedule-list" />
    </ScrollView>
    <SafeArea edges="bottom" padding="$space.16"><Button variant="primary" width="fill" height="$size.button.height" label="Завершить настройку" onPress="completeSetup" disabled="$validation.invalid" loading="{$state == submitting}" /></SafeArea>
  </Layout>
</ScreenSpec>
```

## UX rules

- Основной экран показывает только итоговый график.
- Выбор дней и времени открывается в bottom sheet — это локальный компонент экрана
  (спека `04-add-working-hours-sheet.screen.md`, конвенция `MANUAL.md` §2.1), а не route: он монтируется
  поверх контента в состоянии `intervalSheet`, вход получает пропсами (`interval` —
  `$state.editedInterval`, `currentIntervals` — `$state.form.availabilityRules`).
- `openAddWorkingHours` открывает sheet на создание (`editedInterval` = `null`), `editWorkingInterval` —
  на редактирование: событие нажатия `ScheduleCard` несёт интервал своей строки. `applyWorkingInterval`
  принимает `Payload` из sheet и возвращает экран в `editing`: если `editedInterval` не пуст, интервал
  **заменяется** (client-only `id` сохраняется), иначе добавляется новый. `closeAddWorkingHours` —
  закрытие без применения (backdrop, swipe-down, системная «назад»).
- `Добавить рабочее время` меняет локальный draft; API вызывается только по `Завершить настройку`.
- Payload `completeSetup` — плоский контрактный `SetupRequest`. `WorkingInterval` — view-model: поле `id` — client-only stable key списка, в payload не попадает; хелпер `toAvailabilityRules` отбрасывает `id` и приводит `Weekday` (нижний регистр) к контрактному `DayOfWeek`.

## Acceptance criteria

- Хотя бы один рабочий интервал обязателен.
- Одинаковые интервалы группируются.
- Timezone видна рядом с настройками времени.
