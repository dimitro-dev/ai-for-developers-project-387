/**
 * Типы параметров вложенного стека вкладки «Настройки» — ручной перенос `<Tab id="SettingsTab">`
 * из `navigation.uispec.xml` 1:1. `EventTypesFromSettings` — тот же экран `owner.event-types`,
 * что и `EventTypes` в стеке «Встречи» (спека регистрирует его вторым route ради собственного
 * back-стека вкладки), поэтому у обоих route параметров нет.
 */
export type OwnerSettingsStackParamList = {
  OwnerSettings: undefined;
  OwnerProfileSettings: undefined;
  OwnerWorkingHoursSettings: undefined;
  EventTypesFromSettings: undefined;
};

export const ownerSettingsStackInitialRoute = 'OwnerSettings' satisfies keyof OwnerSettingsStackParamList;
