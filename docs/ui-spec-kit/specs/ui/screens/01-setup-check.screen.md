---
id: owner.setup-check
route: SetupCheck
platforms: [android]
reference: ../assets/owner-mobile-flow.png
referenceFrame: 1
status: approved
---

# Проверка setup

```uispec
<ScreenSpec version="0.1">
  <Meta id="owner.setup-check" route="SetupCheck" title="Проверка setup" />
  <Viewport width="360" height="800" unit="dp" safeArea="true" />
  <Data>
    <Model name="SetupState" source="api" schema="SetupStateResponse"><Field name="onboardingCompleted" type="boolean" required="true" /></Model>
  </Data>
  <StateMachine initial="checking">
    <State id="checking"><Property name="progress" type="decimal" required="false" /></State>
    <State id="error"><Property name="message" type="string" /><Property name="canRetry" type="boolean" default="true" /></State>
  </StateMachine>
  <Actions>
    <Action id="checkSetup" kind="api.query" onSuccessWhen="$result.onboardingCompleted == true:OwnerMeetings;$result.onboardingCompleted == false:OnboardingProfile" onErrorState="error" />
    <Action id="retrySetup" kind="local.dispatch" target="checkSetup" />
  </Actions>
  <Layout type="column" background="$color.background.primary" minHeight="fill">
    <StateView state="checking">
      <Center flex="1" paddingHorizontal="$space.24">
        <AnimatedSetupIllustration progress="$state.progress" reduceMotion="$accessibility.reduceMotion" />
        <Spacer size="$space.24" />
        <Text value="Calendar" typography="$type.display.small" color="$color.text.primary" align="center" />
        <Spacer size="$space.8" />
        <Text value="Проверяем настройки…" typography="$type.body.medium" color="$color.text.secondary" align="center" accessibilityLiveRegion="polite" />
        <Spacer size="$space.20" />
        <ProgressIndicator variant="circular" value="$state.progress" size="64" motion="$motion.setupCheck" accessibilityLabel="Проверяем настройки календаря" />
      </Center>
    </StateView>
    <StateView state="error">
      <Center flex="1" padding="$space.24">
        <Icon name="cloud-off" size="48" color="$color.icon.secondary" />
        <Spacer size="$space.16" />
        <Text value="Не удалось проверить настройки" typography="$type.title.medium" align="center" />
        <Spacer size="$space.8" />
        <Text value="$state.message" typography="$type.body.medium" color="$color.text.secondary" align="center" />
        <Spacer size="$space.24" />
        <Button variant="secondary" height="$size.button.height" label="Повторить" onPress="retrySetup" />
      </Center>
    </StateView>
  </Layout>
</ScreenSpec>
```

## UX rules

- Экран не содержит административной навигации.
- Анимация состоит из иллюстрации и прогресса, но не симулирует ложный точный процент, если backend его не предоставляет.
- При reduce motion использовать статичную иллюстрацию.

## Acceptance criteria

- Успешная проверка маршрутизирует в onboarding или meetings.
- Ошибка допускает retry.
- Loader имеет доступный текст.
