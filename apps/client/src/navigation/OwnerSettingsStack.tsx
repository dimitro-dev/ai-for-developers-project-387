import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { OwnerProfileSettingsScreen } from '@/features/owner/screens/OwnerProfileSettingsScreen';
import { OwnerSettingsScreen } from '@/features/owner/screens/OwnerSettingsScreen';
import { OwnerWorkingHoursSettingsScreen } from '@/features/owner/screens/OwnerWorkingHoursSettingsScreen';
import { EventTypesFromSettingsScreen } from '@/navigation/EventTypesFromSettingsScreen';

import {
  ownerSettingsStackInitialRoute,
  type OwnerSettingsStackParamList,
} from './OwnerSettingsStackParamList';

const Stack = createNativeStackNavigator<OwnerSettingsStackParamList>();

/**
 * `<Tab id="SettingsTab">` из `navigation.uispec.xml` — вложенный native-stack вкладки
 * «Настройки» внутри `OwnerTabs` (ADR §2). `EventTypesFromSettings` использует тот же компонент
 * экрана `owner.event-types`, что и `EventTypes` в стеке «Встречи»: спека регистрирует его под
 * вторым route ради собственного back-стека вкладки.
 * `headerShown: false` — экраны рисуют свой `AppHeader`.
 */
export function OwnerSettingsStack() {
  return (
    <Stack.Navigator
      initialRouteName={ownerSettingsStackInitialRoute}
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen name="OwnerSettings" component={OwnerSettingsScreen} />
      <Stack.Screen name="OwnerProfileSettings" component={OwnerProfileSettingsScreen} />
      <Stack.Screen name="OwnerWorkingHoursSettings" component={OwnerWorkingHoursSettingsScreen} />
      <Stack.Screen name="EventTypesFromSettings" component={EventTypesFromSettingsScreen} />
    </Stack.Navigator>
  );
}

export default OwnerSettingsStack;
