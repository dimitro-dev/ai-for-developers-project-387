import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { OnboardingProfileScreen } from '@/features/owner/screens/OnboardingProfileScreen';
import { OnboardingWorkingHoursScreen } from '@/features/owner/screens/OnboardingWorkingHoursScreen';

import {
  onboardingStackInitialRoute,
  type OnboardingStackParamList,
} from './OnboardingStackParamList';

const Stack = createNativeStackNavigator<OnboardingStackParamList>();

/**
 * `<Stack id="OnboardingStack">` из `navigation.uispec.xml` — вложенный native-stack корневого
 * owner-навигатора (ADR §2). `headerShown: false` — экраны 02/03 рисуют собственный
 * `ProgressHeader`/`AppHeader`, второй системный заголовок был бы дублем (тот же приём, что
 * в `GuestStack`).
 */
export function OnboardingStack() {
  return (
    <Stack.Navigator initialRouteName={onboardingStackInitialRoute} screenOptions={{ headerShown: false }}>
      <Stack.Screen name="OnboardingProfile" component={OnboardingProfileScreen} />
      <Stack.Screen name="OnboardingWorkingHours" component={OnboardingWorkingHoursScreen} />
    </Stack.Navigator>
  );
}

export default OnboardingStack;
