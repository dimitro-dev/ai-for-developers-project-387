import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { OwnerProfileDraft } from '@/features/owner/screens/generated/OnboardingProfile.types.generated';

import {
  onboardingStackInitialRoute,
  type OnboardingStackParamList,
} from '@/navigation/OnboardingStackParamList';
import {
  ownerMeetingsStackInitialRoute,
  type OwnerMeetingsStackParamList,
} from '@/navigation/OwnerMeetingsStackParamList';
import { ownerRootInitialRoute, type OwnerRootStackParamList } from '@/navigation/OwnerRootStackParamList';
import {
  ownerSettingsStackInitialRoute,
  type OwnerSettingsStackParamList,
} from '@/navigation/OwnerSettingsStackParamList';
import type { OwnerTabsParamList } from '@/navigation/OwnerTabsParamList';

/**
 * AC1 (по образцу `GuestStackParamList.test.ts`): параметры route типизированы, пропуск
 * обязательного и передача лишнего ловятся компилятором. Проверку выполняет
 * `npm run typecheck -w @minical/client`: каждый `@ts-expect-error` ниже обязан гаснуть об
 * реальную ошибку типов — если типизация ослабнет, tsc сообщит «Unused '@ts-expect-error'
 * directive». Owner-навигация состоит из пяти param list (root + 4 вложенных навигатора) —
 * один файл проверяет все пять, вместо пяти почти одинаковых копий `GuestStackParamList.test.ts`.
 */

declare const rootNavigation: NativeStackNavigationProp<OwnerRootStackParamList>;
declare const onboardingNavigation: NativeStackNavigationProp<OnboardingStackParamList>;
declare const meetingsNavigation: NativeStackNavigationProp<OwnerMeetingsStackParamList>;
declare const settingsNavigation: NativeStackNavigationProp<OwnerSettingsStackParamList>;
declare const tabsNavigation: BottomTabNavigationProp<OwnerTabsParamList>;

const profileDraft: OwnerProfileDraft = { displayName: 'Дмитрий', timeZone: 'Europe/Berlin' };

export function rootParamsAreTyped(): void {
  rootNavigation.navigate('SetupCheck');
  rootNavigation.navigate('OnboardingStack');
  rootNavigation.navigate('OnboardingStack', { screen: 'OnboardingProfile' });
  rootNavigation.navigate('OwnerTabs');
  rootNavigation.navigate('OwnerTabs', { screen: 'MeetingsTab' });

  // @ts-expect-error route вне OwnerRootStackParamList
  rootNavigation.navigate('GuestEventTypes');

  // @ts-expect-error у SetupCheck параметров нет
  rootNavigation.navigate('SetupCheck', { profileDraft });
}

export function onboardingParamsAreTyped(): void {
  onboardingNavigation.navigate('OnboardingProfile');
  onboardingNavigation.navigate('OnboardingWorkingHours', { profileDraft });

  // @ts-expect-error пропущен обязательный profileDraft
  onboardingNavigation.navigate('OnboardingWorkingHours');

  onboardingNavigation.navigate('OnboardingWorkingHours', {
    profileDraft,
    // @ts-expect-error лишний параметр route
    slotIntervalMinutes: 30,
  });

  // @ts-expect-error route вне OnboardingStackParamList
  onboardingNavigation.navigate('SetupCheck');
}

export function meetingsParamsAreTyped(): void {
  meetingsNavigation.navigate('OwnerMeetings');
  meetingsNavigation.navigate('EventTypes');
  meetingsNavigation.navigate('CreateEventType');

  // @ts-expect-error route вне OwnerMeetingsStackParamList (принадлежит вкладке «Настройки»)
  meetingsNavigation.navigate('OwnerSettings');
}

export function settingsParamsAreTyped(): void {
  settingsNavigation.navigate('OwnerSettings');
  settingsNavigation.navigate('OwnerProfileSettings');
  settingsNavigation.navigate('OwnerWorkingHoursSettings');
  settingsNavigation.navigate('EventTypesFromSettings');

  // @ts-expect-error route вне OwnerSettingsStackParamList (принадлежит вкладке «Встречи»)
  settingsNavigation.navigate('CreateEventType');
}

export function tabsParamsAreTyped(): void {
  tabsNavigation.navigate('MeetingsTab');
  tabsNavigation.navigate('MeetingsTab', { screen: 'CreateEventType' });
  tabsNavigation.navigate('SettingsTab', { screen: 'OwnerProfileSettings' });

  // @ts-expect-error route вне OwnerTabsParamList
  tabsNavigation.navigate('SetupCheck');
}

describe('owner-навигация — начальные route вложенных навигаторов', () => {
  it('корень открывается на SetupCheck', () => {
    expect(ownerRootInitialRoute).toBe('SetupCheck');
  });

  it('онбординг открывается на профиле', () => {
    expect(onboardingStackInitialRoute).toBe('OnboardingProfile');
  });

  it('вкладка «Встречи» открывается на списке встреч', () => {
    expect(ownerMeetingsStackInitialRoute).toBe('OwnerMeetings');
  });

  it('вкладка «Настройки» открывается на сводке', () => {
    expect(ownerSettingsStackInitialRoute).toBe('OwnerSettings');
  });
});
