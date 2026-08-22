---
id: owner.profile-settings
route: OwnerProfileSettings
platforms: [android]
reference: ../assets/owner-mobile-settings-details.png
referenceFrames: [1, 2, 3, 4]
status: approved
---

# Профиль и timezone

Отображаемое имя и timezone владельца: загрузка (кадр 1), форма (кадр 2), выбор timezone в bottom sheet
(кадр 3), сохранение (кадр 4).

```uispec
<ScreenSpec version="0.1">
  <Meta id="owner.profile-settings" route="OwnerProfileSettings" title="Профиль и timezone" />
  <Viewport width="360" height="800" unit="dp" safeArea="true" />
  <Data>
    <Model name="OwnerProfileSettingsDraft"><Field name="displayName" type="string" from="CalendarSettingsResponse.displayName" /><Field name="timeZone" type="string" from="CalendarSettingsResponse.timeZone" /></Model>
    <Model name="AvailabilityRule" source="api" schema="AvailabilityRule" />
    <Model name="CalendarSettingsSnapshot"><Field name="availabilityRules" type="AvailabilityRule[]" from="CalendarSettingsResponse.availabilityRules" /><Field name="slotIntervalMinutes" type="int32" from="CalendarSettingsResponse.slotIntervalMinutes" /></Model>
    <Model name="FieldError"><Field name="field" type="string" /><Field name="message" type="string" /></Model>
  </Data>
  <StateMachine initial="loading"><State id="loading" /><State id="editing"><Property name="form" type="OwnerProfileSettingsDraft" /><Property name="snapshot" type="CalendarSettingsSnapshot" /><Property name="dirty" type="boolean" default="false" /><Property name="fieldErrors" type="FieldError[]" default="[]" /></State><State id="saving" extends="editing" /><State id="error" extends="editing"><Property name="message" type="string" /></State><State id="saved" extends="editing" /></StateMachine>
  <Validation><Rule id="display-name-required" expression="trim($state.form.displayName).length &gt; 0" message="Введите отображаемое имя" target="display-name" /><Rule id="timezone-required" expression="$state.form.timeZone.length &gt; 0" message="Выберите timezone" target="timezone" /></Validation>
  <Actions>
    <Action id="goBackSettings" kind="navigation.back" />
    <Action id="loadProfileSettings" kind="api.query" onSuccessState="editing" onErrorState="error" />
    <Action id="changeDisplayName" kind="local.update" path="$state.form.displayName" value="$event.value" markDirty="true" />
    <Action id="changeTimezone" kind="local.update" path="$state.form.timeZone" value="$event.value" markDirty="true" />
    <Action id="saveProfileSettings" kind="api.command" gap="GAP-003" disabledWhen="$validation.invalid || !$state.dirty || $state == saving" onSuccessState="saved" onErrorState="error"><Payload><Field name="displayName" bind="$state.form.displayName" /><Field name="timeZone" bind="$state.form.timeZone" /><Field name="availabilityRules" bind="$state.snapshot.availabilityRules" /><Field name="slotIntervalMinutes" bind="$state.snapshot.slotIntervalMinutes" /></Payload></Action>
  </Actions>
  <Layout type="column" background="$color.background.primary" minHeight="fill">
    <Header title="Профиль и timezone" backAction="goBackSettings" />
    <StateView state="loading"><Column flex="1" padding="$space.16" gap="$space.8"><Text value="Отображаемое имя" typography="$type.label.large" /><Skeleton variant="field" height="$size.input.height" /><Spacer size="$space.16" /><Text value="Timezone" typography="$type.label.large" /><Skeleton variant="field" height="$size.input.height" /><Spacer size="$space.16" /><Skeleton variant="text" /></Column></StateView>
    <StateView state="editing|saving|error|saved"><ScrollView flex="1" keyboardAvoiding="true" contentPadding="$space.16"><TextField id="display-name" label="Отображаемое имя" value="$state.form.displayName" height="$size.input.height" disabled="{$state == saving}" error="{fieldError('display-name')}" onChange="changeDisplayName" /><Spacer size="$space.24" /><SelectField id="timezone" label="Timezone" value="$state.form.timeZone" optionsSource="$system.ianaTimezones" searchable="true" pickerMode="bottom-sheet" searchPlaceholder="Поиск timezone" height="$size.input.height" disabled="{$state == saving}" error="{fieldError('timezone')}" onChange="changeTimezone" /><Text value="Новые слоты будут рассчитываться в этой timezone. Существующие встречи не изменятся." typography="$type.body.small" color="$color.text.secondary" marginTop="$space.12" /><ValidationMessage when="$state == error" value="$state.message" target="screen" /></ScrollView></StateView>
    <SafeArea edges="bottom" padding="$space.16"><Button when="$state != saving" variant="primary" width="fill" height="$size.button.height" label="Сохранить изменения" onPress="saveProfileSettings" disabled="{$validation.invalid || !$state.dirty}" /><Button when="$state == saving" variant="primary" width="fill" height="$size.button.height" label="Сохраняем..." loading="true" disabled="true" /></SafeArea>
    <BottomNavigation activeTab="settings" />
  </Layout>
</ScreenSpec>
```

## UX rules

- Смена timezone не переписывает UTC-моменты существующих Booking.
- Ошибка сети сохраняет форму.
- **Выбор timezone — bottom sheet, кадр 3.** `searchable="true"` вместе с `pickerMode="bottom-sheet"` значит:
  тап по полю открывает sheet поверх экрана с drag handle, полем поиска (`searchPlaceholder` — «Поиск
  timezone») и списком зон из `$system.ianaTimezones`; текущее значение отмечено галочкой и
  `accessibilitySelected`, а не только цветом (MANUAL §10). Выбор строки закрывает sheet и диспатчит
  `changeTimezone`; свайп вниз и тап по scrim закрывают sheet, не меняя значение; focus возвращается на поле.
  Внутренняя раскладка пикера — часть RN-реализации `AppSelectField`, как native time picker у `TimeField` и
  как чипы внутри `WeekdaySelector`: в разметку экрана она не разворачивается и отдельным route не становится
  (MANUAL §13).
- **Сохранение — кадр 4.** В `saving` CTA показывает спиннер и подпись «Сохраняем...», поля и пикер
  недоступны, повторный submit невозможен. Подпись различается по состоянию через `when=`, а не выражением
  `if(...)`: такой конструкции в каноне нет (прецедент экрана 14).
- **Загрузка — кадр 1.** Подписи полей видны сразу, значения приходят скелетами; CTA видна и недоступна,
  потому что до первой правки `dirty` нет.
- Таб-бар виден во всех состояниях (кадры 1, 2, 4): экран лежит внутри вкладки «Настройки», поэтому
  `BottomNavigation` — последний элемент `Layout`, вне `StateView`, как на соседнем экране 07.
- **Ошибка сохранения видна двумя каналами.** Общий текст сервера — `ValidationMessage target="screen"` под
  формой (паттерн экрана 07), сообщения правил валидации — атрибутом `error=` у самих полей по ключам
  `display-name` и `timezone`, совпадающим с `target=` правил. Раскладка сообщений правил и серверного ответа
  по `$state.fieldErrors` — работа контейнера: грамматика UISpec связь «правило → элемент состояния» не
  описывает, и валидатор её не проверяет.
- Контракт поддерживает только PUT = full replace, поэтому сохранение — read-modify-write: `loadProfileSettings` (`getAdminSettings`) загружает текущие настройки, правки владельца сливаются с нетронутыми `availabilityRules`/`slotIntervalMinutes` из `snapshot`, отправляется полный `SetupRequest`. TODO-CONTRACT-GAP(GAP-003): опциональный PATCH — не блокирует.

## Acceptance criteria

- Обязательные поля валидируются.
- Save блокирует повторный submit.
- Реализованы loading, editing, saving, error, saved; форма показывается во всех, кроме loading.
- Пикер timezone имеет поиск, отмечает текущее значение и возвращает focus на поле после закрытия.
- Ошибка сохранения видна на экране: общий текст — под формой, сообщения правил — у своих полей.
- Таб-бар «Встречи / Настройки» присутствует во всех состояниях экрана.
