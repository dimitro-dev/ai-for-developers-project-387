import type { NavigatorScreenParams } from '@react-navigation/native';

import type { OnboardingStackParamList } from '@/navigation/OnboardingStackParamList';
import type { OwnerTabsParamList } from '@/navigation/OwnerTabsParamList';

/**
 * Типы параметров корневого owner-навигатора — `<Root initial="SetupCheck">` из
 * `navigation.uispec.xml`, ветка owner (`GuestStack` того же `<Root>` навигации не касается:
 * им управляет отдельный корень режима guest в `App.tsx`, см. ADR §1). Три route: `SetupCheck` —
 * экран, `OnboardingStack` и `OwnerTabs` — вложенные навигаторы (`NavigatorScreenParams`).
 * `| undefined` — тот же рецепт, что в `OwnerTabsParamList`: переход на вложенный навигатор без
 * указания его внутреннего экрана иначе требовал бы параметров как обязательных.
 */
export type OwnerRootStackParamList = {
  SetupCheck: undefined;
  OnboardingStack: NavigatorScreenParams<OnboardingStackParamList> | undefined;
  OwnerTabs: NavigatorScreenParams<OwnerTabsParamList> | undefined;
};

export const ownerRootInitialRoute = 'SetupCheck' satisfies keyof OwnerRootStackParamList;
