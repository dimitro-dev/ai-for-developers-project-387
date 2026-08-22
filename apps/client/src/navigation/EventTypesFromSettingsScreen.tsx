import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo } from 'react';

import { EventTypesScreen } from '@/features/owner/screens/EventTypesScreen';
import type { OwnerMeetingsStackParamList } from '@/navigation/OwnerMeetingsStackParamList';
import type { OwnerSettingsStackParamList } from '@/navigation/OwnerSettingsStackParamList';
import type { OwnerTabsParamList } from '@/navigation/OwnerTabsParamList';

type Props = NativeStackScreenProps<OwnerSettingsStackParamList, 'EventTypesFromSettings'>;
type MeetingsNavigation = NativeStackScreenProps<OwnerMeetingsStackParamList, 'EventTypes'>['navigation'];

/**
 * Route `EventTypesFromSettings` — тот же экран `owner.event-types` (спека 06), открытый из
 * вкладки «Настройки»; спека регистрирует его вторым route ради собственного back-стека вкладки.
 *
 * Расхождение спеки навигации, закрытое здесь: `navigation.uispec.xml` объявляет во вкладке
 * «Настройки» только `EventTypesFromSettings`, парного `CreateEventType` в ней нет, а спека
 * экрана 06 требует header action «Создать тип события» (`navigation.push` → `CreateEventType`).
 * Единственный существующий route создания живёт во вкладке «Встречи», поэтому действие уходит
 * туда переключением таба; `goBack` остаётся внутри вкладки «Настройки» и возвращает на сводку.
 * Сам экран не меняется — он получает те же два метода навигации, что и в стеке «Встречи».
 */
export function EventTypesFromSettingsScreen({ navigation, route }: Props) {
  const adapter = useMemo(
    () =>
      ({
        goBack: () => navigation.goBack(),
        navigate: (screen: keyof OwnerMeetingsStackParamList) => {
          navigation
            .getParent<BottomTabNavigationProp<OwnerTabsParamList>>()
            ?.navigate('MeetingsTab', { screen });
        },
        // Экран использует только `goBack` и `navigate`; остальную поверхность
        // `NativeStackNavigationProp` адаптер не реализует — отсюда приведение.
      }) as unknown as MeetingsNavigation,
    [navigation],
  );

  const meetingsRoute = { key: route.key, name: 'EventTypes' } as NativeStackScreenProps<
    OwnerMeetingsStackParamList,
    'EventTypes'
  >['route'];

  return <EventTypesScreen navigation={adapter} route={meetingsRoute} />;
}

export default EventTypesFromSettingsScreen;
