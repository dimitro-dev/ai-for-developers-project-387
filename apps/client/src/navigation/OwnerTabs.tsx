import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { OwnerBottomNavigation } from '@/navigation/OwnerBottomNavigation';
import { OwnerMeetingsStack } from '@/navigation/OwnerMeetingsStack';
import { OwnerSettingsStack } from '@/navigation/OwnerSettingsStack';

import type { OwnerTabsParamList } from './OwnerTabsParamList';

const Tab = createBottomTabNavigator<OwnerTabsParamList>();

/**
 * `<Tabs id="OwnerTabs">` из `navigation.uispec.xml`: два таба, каждый — вложенный native-stack
 * (`OwnerMeetingsStack`/`OwnerSettingsStack`, ADR §2). Таб-бар — `OwnerBottomNavigation` (P10) в
 * режиме `tabBar`, системный бар не соответствует токенам кита. `headerShown: false` — экраны
 * рисуют свой `AppHeader`.
 */
export function OwnerTabs() {
  return (
    <Tab.Navigator
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <OwnerBottomNavigation {...props} />}
    >
      <Tab.Screen name="MeetingsTab" component={OwnerMeetingsStack} />
      <Tab.Screen name="SettingsTab" component={OwnerSettingsStack} />
    </Tab.Navigator>
  );
}

export default OwnerTabs;
