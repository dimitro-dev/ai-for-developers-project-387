import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { SetupCheckScreen } from '@/features/owner/screens/SetupCheckScreen';
import { OnboardingStack } from '@/navigation/OnboardingStack';
import { OwnerTabs } from '@/navigation/OwnerTabs';

import { ownerRootInitialRoute, type OwnerRootStackParamList } from './OwnerRootStackParamList';

const Stack = createNativeStackNavigator<OwnerRootStackParamList>();

/**
 * Корень owner-режима — `<Root initial="SetupCheck">` из `navigation.uispec.xml`, ветка owner:
 * `SetupCheck → OnboardingStack → OwnerTabs` (ADR §2). Монтируется `App.tsx` вместо гостевого
 * корня при `EXPO_PUBLIC_APP_MODE=owner` (ADR §1), внутри собственного `NavigationContainer` —
 * `linking` не настраивается (ADR §2: черновик онбординга и данные sheets в URL/history не
 * попадают). `headerShown: false` — экраны рисуют свой `AppHeader`.
 */
export function OwnerRoot() {
  return (
    <Stack.Navigator initialRouteName={ownerRootInitialRoute} screenOptions={{ headerShown: false }}>
      <Stack.Screen name="SetupCheck" component={SetupCheckScreen} />
      <Stack.Screen name="OnboardingStack" component={OnboardingStack} />
      <Stack.Screen name="OwnerTabs" component={OwnerTabs} />
    </Stack.Navigator>
  );
}

export default OwnerRoot;
