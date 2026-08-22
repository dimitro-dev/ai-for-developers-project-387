---
id: owner.onboarding-profile
route: OnboardingProfile
platforms: [android]
reference: ../assets/owner-mobile-flow.png
referenceFrame: 2
status: approved
---

# Onboarding — профиль

```uispec
<ScreenSpec version="0.1">
  <Meta id="owner.onboarding-profile" route="OnboardingProfile" title="Настройка календаря" />
  <Viewport width="360" height="800" unit="dp" safeArea="true" />
  <Data>
    <Model name="OwnerProfileDraft"><Field name="displayName" type="string" required="true" from="SetupRequest.displayName" /><Field name="timeZone" type="string" required="true" from="SetupRequest.timeZone" /></Model>
    <Model name="FieldError"><Field name="field" type="string" /><Field name="message" type="string" /></Model>
  </Data>
  <StateMachine initial="editing">
    <State id="editing"><Property name="form" type="OwnerProfileDraft" /><Property name="fieldErrors" type="FieldError[]" default="[]" /></State>
    <State id="submitting" extends="editing" />
  </StateMachine>
  <Validation>
    <Rule id="display-name-required" expression="trim($state.form.displayName).length &gt; 0" message="Введите отображаемое имя" target="display-name" />
    <Rule id="timezone-required" expression="$state.form.timeZone.length &gt; 0" message="Выберите timezone" target="timezone" />
  </Validation>
  <Actions>
    <Action id="changeDisplayName" kind="local.update" path="$state.form.displayName" value="$event.value" />
    <Action id="changeTimezone" kind="local.update" path="$state.form.timeZone" value="$event.value" />
    <Action id="continueOnboarding" kind="navigation.push" target="OnboardingWorkingHours" disabledWhen="$validation.invalid || $state == submitting"><Param name="profileDraft" type="OwnerProfileDraft" bind="$state.form" /></Action>
  </Actions>
  <Layout type="column" background="$color.background.primary" minHeight="fill">
    <ProgressHeader current="1" total="2" />
    <ScrollView flex="1" keyboardAvoiding="true" contentPaddingHorizontal="$space.16" contentPaddingBottom="$space.24">
      <Text value="Настройка календаря" typography="$type.title.large" marginTop="$space.24" />
      <Spacer size="$space.24" />
      <TextField id="display-name" label="Отображаемое имя" value="$state.form.displayName" height="$size.input.height" onChange="changeDisplayName" error="{fieldError('display-name')}" />
      <Spacer size="$space.24" />
      <SelectField id="timezone" label="Timezone" value="$state.form.timeZone" optionsSource="$system.ianaTimezones" searchable="true" height="$size.input.height" onChange="changeTimezone" error="{fieldError('timezone')}" />
      <Text value="Встречи владельца будут отображаться в этой timezone." typography="$type.body.small" color="$color.text.secondary" marginTop="$space.8" />
    </ScrollView>
    <SafeArea edges="bottom" padding="$space.16"><Button variant="primary" width="fill" height="$size.button.height" label="Продолжить" onPress="continueOnboarding" disabled="$validation.invalid" /></SafeArea>
  </Layout>
</ScreenSpec>
```

## UX rules

- Timezone по умолчанию определяется устройством, но владелец может изменить её.
- Черновик профиля передаётся на второй шаг и сохраняется при возврате.

## Acceptance criteria

- Имя и timezone обязательны.
- Клавиатура не перекрывает CTA.
- Административной навигации нет.
