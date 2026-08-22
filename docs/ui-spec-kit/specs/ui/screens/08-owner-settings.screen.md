---
id: owner.settings
route: OwnerSettings
platforms: [android]
reference: ../assets/owner-mobile-settings.png
referenceFrames: [1, 2, 3]
status: approved
---

# Настройки

Корень вкладки «Настройки» в трёх состояниях: загрузка (кадр 1), три строки настроек (кадр 2), ошибка
загрузки (кадр 3).

```uispec
<ScreenSpec version="0.1">
  <Meta id="owner.settings" route="OwnerSettings" title="Настройки" />
  <Viewport width="360" height="800" unit="dp" safeArea="true" />
  <Data><Model name="OwnerSettingsSummary"><Field name="displayName" type="string" from="CalendarSettingsResponse.displayName" /><Field name="timeZone" type="string" from="CalendarSettingsResponse.timeZone" /><Field name="workingHoursSummary" type="string" derived="true" /></Model></Data>
  <StateMachine initial="loading"><State id="loading" /><State id="content"><Property name="data" type="OwnerSettingsSummary" /></State><State id="error"><Property name="message" type="string" /></State></StateMachine>
  <Actions>
    <Action id="loadSettingsSummary" kind="api.query" onSuccessState="content" onErrorState="error" />
    <Action id="openProfileSettings" kind="navigation.push" target="OwnerProfileSettings" />
    <Action id="openWorkingHoursSettings" kind="navigation.push" target="OwnerWorkingHoursSettings" />
    <Action id="openEventTypes" kind="navigation.push" target="EventTypesFromSettings" />
    <Action id="openMeetings" kind="navigation.tab" target="OwnerMeetings" />
  </Actions>
  <Layout type="column" background="$color.background.primary" minHeight="fill">
    <Header title="Настройки" />
    <StateView state="loading"><Column padding="$space.16" gap="$space.8"><Skeleton variant="settings-row" height="$size.row.settings.height" /><Skeleton variant="settings-row" height="$size.row.settings.height" /><Skeleton variant="settings-row" height="$size.row.settings.height" /></Column></StateView>
    <StateView state="content"><ScrollView flex="1" contentPaddingTop="$space.8"><SettingsRow icon="user" title="Профиль и timezone" subtitle="{$state.data.displayName + ' · ' + $state.data.timeZone}" onPress="openProfileSettings" /><SettingsRow icon="calendar" title="Рабочее время" subtitle="$state.data.workingHoursSummary" onPress="openWorkingHoursSettings" /><SettingsRow icon="event-type" title="Типы событий" subtitle="Управление форматами встреч" onPress="openEventTypes" /></ScrollView></StateView>
    <StateView state="error"><Center flex="1" padding="$space.24"><Image source="$asset.network-error" width="208" height="176" resizeMode="contain" /><Spacer size="$space.16" /><Text value="Не удалось загрузить настройки" typography="$type.title.medium" align="center" /><Spacer size="$space.8" /><Text value="Проверьте подключение и попробуйте ещё раз." typography="$type.body.medium" color="$color.text.secondary" align="center" /><Spacer size="$space.24" /><Button variant="primary" width="fill" height="$size.button.height" label="Повторить" onPress="loadSettingsSummary" /></Center></StateView>
    <BottomNavigation activeTab="settings" />
  </Layout>
</ScreenSpec>
```

## UX rules

- Это корневой экран вкладки Настройки.
- Рабочее время и типы событий открываются вложенными route внутри `SettingsTab` (`EventTypesFromSettings` — не route чужой вкладки).
- `OwnerSettingsSummary` — view-model над `CalendarSettingsResponse`: `workingHoursSummary` — derived-подпись из `availabilityRules` (helper `formatAvailabilitySummary`).
- Ведущие иконки строк — `user`, `calendar`, `event-type` (кадр 2): существующие глифы кита, новых не заводится. Иконка декоративна, смысл строки несёт её название (правило `component.settings-row`).
- Ошибка загрузки — полноэкранное состояние по кадру 3: иллюстрация, заголовок, подсказка и одна CTA на всю ширину. Иллюстрация `$asset.network-error` в пакете отсутствует — placeholder-компонент, TODO-ASSET; вырезать её из PNG нельзя.
- Скелет загрузки — три строки высотой `$size.row.settings.height` (кадр 1), то есть ровно столько, сколько строк в `content`.

## Acceptance criteria

- Bottom navigation содержит Встречи и Настройки.
- Настройки разделены по самостоятельным задачам.
- Реализованы loading, content, error; ошибка предлагает повтор той же операции `loadSettingsSummary`.
- Каждая строка настроек имеет ведущую иконку и подпись — текущее значение либо пояснение.
