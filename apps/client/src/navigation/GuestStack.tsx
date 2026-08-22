import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { GuestBookingConfirmationScreen } from '@/features/guest/screens/GuestBookingConfirmationScreen';
import { GuestBookingFormScreen } from '@/features/guest/screens/GuestBookingFormScreen';
import { GuestEventTypesScreen } from '@/features/guest/screens/GuestEventTypesScreen';
import { GuestSlotsScreen } from '@/features/guest/screens/GuestSlotsScreen';

import { guestStackInitialRoute, type GuestStackParamList } from './GuestStackParamList';

const Stack = createNativeStackNavigator<GuestStackParamList>();

/**
 * `<Stack id="GuestStack">` из `navigation.uispec.xml`. Состав route и типы их параметров —
 * от фундамента `front-guest-001`; `front-guest-002` заменил стаб-экраны реализациями,
 * ничего в самом каркасе не меняя.
 *
 * Заголовок навигатора выключен: спеки экранов рисуют собственный тег `Header`
 * (`AppHeader`) внутри `Layout`, второй системный заголовок был бы дублем.
 */
export function GuestStack() {
  return (
    <Stack.Navigator initialRouteName={guestStackInitialRoute} screenOptions={{ headerShown: false }}>
      <Stack.Screen name="GuestEventTypes" component={GuestEventTypesScreen} />
      <Stack.Screen name="GuestSlots" component={GuestSlotsScreen} />
      <Stack.Screen name="GuestBookingForm" component={GuestBookingFormScreen} />
      <Stack.Screen name="GuestBookingConfirmation" component={GuestBookingConfirmationScreen} />
    </Stack.Navigator>
  );
}

export default GuestStack;
