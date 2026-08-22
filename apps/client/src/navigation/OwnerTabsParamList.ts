import type { NavigatorScreenParams } from '@react-navigation/native';

import type { OwnerMeetingsStackParamList } from '@/navigation/OwnerMeetingsStackParamList';
import type { OwnerSettingsStackParamList } from '@/navigation/OwnerSettingsStackParamList';

/**
 * Типы параметров `<Tabs id="OwnerTabs">` из `navigation.uispec.xml`: два таба, каждый —
 * вложенный native-stack (ADR §2), поэтому параметр таба — `NavigatorScreenParams` его стека.
 * `| undefined` обязателен (рецепт react-navigation для вложенных навигаторов): без него
 * `NavigatorScreenParams<...>` не содержит bare-`undefined`-ветку сам по себе (все route
 * вложенного стека — `undefined`, но их объединение — union из объектов `{screen, params?}`,
 * а не `undefined`), поэтому переход на таб без указания вложенного экрана требовал бы
 * параметров как обязательных.
 */
export type OwnerTabsParamList = {
  MeetingsTab: NavigatorScreenParams<OwnerMeetingsStackParamList> | undefined;
  SettingsTab: NavigatorScreenParams<OwnerSettingsStackParamList> | undefined;
};
