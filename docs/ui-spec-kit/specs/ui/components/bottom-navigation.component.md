---
id: component.bottom-navigation
kind: component
status: approved
---

# Owner Bottom Navigation

```uispec
<ComponentSpec version="0.1">
  <Meta id="component.bottom-navigation" />
  <Props>
<Prop name="activeTab" type="string" required="true" />
  </Props>
  <Layout>
<BottomNavigation height="$size.bottomNav.height">
  <BottomNavigationItem id="meetings" route="OwnerMeetings" icon="calendar" label="Встречи" active="{$props.activeTab == 'meetings'}" />
  <BottomNavigationItem id="settings" route="OwnerSettings" icon="settings" label="Настройки" active="{$props.activeTab == 'settings'}" />
</BottomNavigation>
  </Layout>
</ComponentSpec>
```

## Rules

- Только два пункта: Встречи и Настройки.
- Типы событий не являются tab.

## Acceptance criteria

- Active state обозначен не только цветом.
- Каждый пункт имеет touch target не меньше 48 dp.
