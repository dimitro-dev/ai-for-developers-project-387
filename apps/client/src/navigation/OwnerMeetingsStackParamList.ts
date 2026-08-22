/**
 * Типы параметров вложенного стека вкладки «Встречи» — ручной перенос `<Tab id="MeetingsTab">`
 * из `docs/ui-spec-kit/specs/ui/navigation/navigation.uispec.xml` 1:1 (по образцу
 * `GuestStackParamList`). У всех трёх route в спеке нет `<Param>` — параметров навигации нет.
 */
export type OwnerMeetingsStackParamList = {
  OwnerMeetings: undefined;
  EventTypes: undefined;
  CreateEventType: undefined;
};

export const ownerMeetingsStackInitialRoute = 'OwnerMeetings' satisfies keyof OwnerMeetingsStackParamList;
