import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { CreateEventTypeScreen } from '@/features/owner/screens/CreateEventTypeScreen';
import { EventTypesScreen } from '@/features/owner/screens/EventTypesScreen';
import { OwnerMeetingsScreen } from '@/features/owner/screens/OwnerMeetingsScreen';

import {
  ownerMeetingsStackInitialRoute,
  type OwnerMeetingsStackParamList,
} from './OwnerMeetingsStackParamList';

const Stack = createNativeStackNavigator<OwnerMeetingsStackParamList>();

/**
 * `<Tab id="MeetingsTab">` из `navigation.uispec.xml` — вложенный native-stack вкладки «Встречи»
 * внутри `OwnerTabs` (ADR §2). `headerShown: false` — экраны рисуют свой `AppHeader`.
 */
export function OwnerMeetingsStack() {
  return (
    <Stack.Navigator
      initialRouteName={ownerMeetingsStackInitialRoute}
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen name="OwnerMeetings" component={OwnerMeetingsScreen} />
      <Stack.Screen name="EventTypes" component={EventTypesScreen} />
      <Stack.Screen name="CreateEventType" component={CreateEventTypeScreen} />
    </Stack.Navigator>
  );
}

export default OwnerMeetingsStack;
