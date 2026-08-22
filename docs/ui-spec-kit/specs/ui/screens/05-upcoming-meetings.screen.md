---
id: owner.upcoming-meetings
route: OwnerMeetings
platforms: [android]
reference: ../assets/owner-mobile-flow.png
referenceFrames: [5, 6]
status: approved
---

# Предстоящие встречи

```uispec
<ScreenSpec version="0.1">
  <Meta id="owner.upcoming-meetings" route="OwnerMeetings" title="Предстоящие встречи" />
  <Viewport width="360" height="800" unit="dp" safeArea="true" />
  <Data>
    <Model name="GuestView"><Field name="name" type="string" from="Booking.guestName" /><Field name="email" type="string" format="email" from="Booking.guestEmail" /><Field name="comment" type="string" required="false" from="Booking.guestNote" /></Model>
    <Model name="BookingView"><Field name="id" type="string" from="Booking.id" /><Field name="eventTypeTitle" type="string" from="Booking.eventTypeName" /><Field name="startAt" type="utcDateTime" from="Booking.startAtUtc" /><Field name="endAt" type="utcDateTime" from="Booking.endAtUtc" /><Field name="guest" type="GuestView" /></Model>
    <Model name="UpcomingMeetingsData"><Field name="timezone" type="string" from="CalendarSettingsResponse.timeZone" /><Field name="publicUrl" type="url" from="CalendarSettingsResponse.publicUrl" /><Field name="bookings" type="BookingView[]" /></Model>
  </Data>
  <StateMachine initial="loading">
    <State id="loading" />
    <State id="empty"><Property name="data" type="UpcomingMeetingsData" /></State>
    <State id="content"><Property name="data" type="UpcomingMeetingsData" /><Property name="selectedBooking" type="BookingView" required="false" /></State>
    <State id="refreshing" extends="content" />
    <State id="bookingDetails" extends="content" />
    <State id="error"><Property name="message" type="string" /><Property name="canRetry" type="boolean" default="true" /></State>
  </StateMachine>
  <Actions>
    <Action id="loadUpcomingMeetings" kind="api.query" onSuccessWhen="$result.length == 0:empty;$result.length &gt; 0:content" onErrorState="error" />
    <Action id="refreshUpcomingMeetings" kind="api.query" preserveContent="true" />
    <Action id="loadMeetingsSettings" kind="api.query" />
    <Action id="shareCalendar" kind="native.share"><Param name="url" type="url" bind="$state.data.publicUrl" /></Action>
    <Action id="openEventTypes" kind="navigation.push" target="EventTypes" />
    <Action id="openBooking" kind="local.update" path="$state.selectedBooking" value="$event.booking" onSuccessState="bookingDetails" />
    <Action id="closeBooking" kind="local.transition" target="content" />
    <Action id="openSettings" kind="navigation.tab" target="OwnerSettings" />
  </Actions>
  <Layout type="column" background="$color.background.primary" minHeight="fill">
    <Header title="Предстоящие встречи" rightActions="[{id:'event-types',icon:'layout-grid',accessibilityLabel:'Открыть типы событий',onPress:'openEventTypes'}]" />
    <StateView state="loading"><Column flex="1" padding="$space.16" gap="$space.12"><Skeleton variant="text" width="180" height="16" /><Skeleton variant="meeting-card" height="$size.card.meeting.height" /><Skeleton variant="meeting-card" height="$size.card.meeting.height" /><Skeleton variant="meeting-card" height="$size.card.meeting.height" /></Column></StateView>
    <StateView state="empty"><EmptyState asset="$asset.calendar-share" title="У вас пока нет предстоящих встреч" body="Поделитесь ссылкой на свой календарь, чтобы гости могли забронировать встречу. Когда появятся бронирования, вы увидите их здесь." ctaLabel="Поделиться календарём" ctaAction="shareCalendar" /></StateView>
    <StateView state="content|refreshing|bookingDetails">
      <ScrollView flex="1" contentPaddingHorizontal="$space.16" contentPaddingBottom="$space.24" refreshAction="refreshUpcomingMeetings">
        <TimezoneLabel timezone="$state.data.timezone" offset="{formatUtcOffset($state.data.timezone)}" />
        <Spacer size="$space.20" />
        <Repeat source="{groupBookingsByOwnerDate($state.data.bookings, $state.data.timezone)}" item="group" key="$group.id">
          <Section marginBottom="$space.24"><Text value="$group.title" typography="$type.title.small" marginBottom="$space.8" /><Column gap="$space.8"><Repeat source="$group.bookings" item="booking" key="$booking.id"><MeetingCard booking="$booking" startTime="{formatTime($booking.startAt, $state.data.timezone)}" endTime="{formatTime($booking.endAt, $state.data.timezone)}" title="$booking.eventTypeTitle" guestName="$booking.guest.name" guestEmail="$booking.guest.email" onPress="openBooking" /></Repeat></Column></Section>
        </Repeat>
      </ScrollView>
    </StateView>
    <StateView state="error"><Center flex="1" padding="$space.24"><Icon name="cloud-off" size="48" color="$color.icon.secondary" /><Spacer size="$space.16" /><Text value="Не удалось загрузить встречи" typography="$type.title.medium" align="center" /><Spacer size="$space.8" /><Text value="$state.message" typography="$type.body.medium" color="$color.text.secondary" align="center" /><Spacer size="$space.24" /><Button variant="secondary" label="Повторить" height="$size.button.height" onPress="loadUpcomingMeetings" /></Center></StateView>
    <BottomNavigation activeTab="meetings" />
  </Layout>
</ScreenSpec>
```

## UX rules

- Empty state предлагает поделиться календарём, а не создать тип события.
- Типы событий открываются header action.
- Bottom navigation содержит только Встречи и Настройки.
- Owner UI форматирует время в timezone владельца.
- `UpcomingMeetingsData` — view-model, собираемая контейнером из двух операций: `bookings` ← `loadUpcomingMeetings` (`getAdminUpcomingBookings`, голый `Booking[]`), `timezone` и `publicUrl` ← `loadMeetingsSettings` (`getAdminSettings`). Маппинг полей — атрибуты `from=` моделей.
- `eventTypeTitle` — контрактное `Booking.eventTypeName` (snapshot названия на момент бронирования): отдельного запроса словаря типов событий и client-side join'а больше нет.
- `publicUrl` приходит тем же вызовом `getAdminSettings`, что и `timezone` (поле `CalendarSettingsResponse.publicUrl`; значение задаёт env backend `PUBLIC_WEB_URL`) — GAP-001 закрыт в R5.
- Детали встречи — sheet-компонент этого экрана (спека `11-booking-details-sheet.screen.md`, конвенция `MANUAL.md` §2.1), а не route: он монтируется поверх списка в состоянии `bookingDetails`, вход получает пропсами (`booking` — `$state.selectedBooking`, `dateText` — заголовок группы нажатой встречи, `timeZone` — `$state.data.timezone`). `openBooking` берёт `BookingView` из события нажатия `MeetingCard`, `closeBooking` возвращает экран в `content` (backdrop, swipe-down, системная «назад»).

## Acceptance criteria

- Реализованы loading, empty, content, refreshing, bookingDetails и error.
- Refresh не скрывает текущие карточки.
- Встречи сортируются по startAt.
- Системный share получает публичный URL.
