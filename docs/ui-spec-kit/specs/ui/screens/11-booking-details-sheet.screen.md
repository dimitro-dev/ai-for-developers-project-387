---
id: owner.booking-details
platforms: [android]
reference: ../assets/owner-mobile-settings-details.png
referenceFrame: 8
status: approved
---

# Детали встречи

```uispec
<ScreenSpec version="0.1">
  <Meta id="owner.booking-details" title="Детали встречи" presentation="bottom-sheet" parent="owner.upcoming-meetings" />
  <Viewport width="360" unit="dp" safeAreaBottom="true" />
  <Data>
    <Model name="GuestView"><Field name="name" type="string" from="Booking.guestName" /><Field name="email" type="string" format="email" from="Booking.guestEmail" /><Field name="comment" type="string" required="false" from="Booking.guestNote" /></Model>
    <Model name="BookingView"><Field name="id" type="string" from="Booking.id" /><Field name="eventTypeTitle" type="string" from="Booking.eventTypeName" /><Field name="startAt" type="utcDateTime" from="Booking.startAtUtc" /><Field name="endAt" type="utcDateTime" from="Booking.endAtUtc" /><Field name="guest" type="GuestView" /></Model>
  </Data>
  <Props>
    <Prop name="booking" type="BookingView" required="true" />
    <Prop name="dateText" type="string" required="true" />
    <Prop name="timeZone" type="string" required="true" />
  </Props>
  <StateMachine initial="content"><State id="content" /></StateMachine>
  <Actions><Action id="closeBookingDetails" kind="local.submit" result="close" /></Actions>
  <Layout type="overlay">
    <BottomSheet snapPoint="content" maxHeight="$size.sheet.maxHeight" cornerRadius="$radius.24" background="$color.surface.primary" backdropColor="$color.background.scrim" dismissOnBackdropPress="true" dismissOnSwipeDown="true" motion="$motion.sheet.enter">
      <DragHandle width="$size.dragHandle.width" height="$size.dragHandle.height" marginTop="$space.8" marginBottom="$space.16" />
      <ScrollView contentPaddingHorizontal="$space.16" contentPaddingBottom="$space.24">
        <Text value="$props.booking.eventTypeTitle" typography="$type.title.medium" />
        <Spacer size="$space.24" />
        <Text value="Дата и время" typography="$type.label.large" />
        <Row width="fill" align="center" gap="$space.12" marginTop="$space.8" padding="$space.12" radius="$radius.12" borderColor="$color.border.default" background="$color.surface.primary">
          <Icon name="calendar" size="$size.icon.small" color="$color.action.primary" />
          <Column flex="1" gap="$space.4">
            <Text value="{$props.dateText + ', ' + formatTime($props.booking.startAt, $props.timeZone) + '–' + formatTime($props.booking.endAt, $props.timeZone)}" typography="$type.body.medium" />
            <TimezoneLabel timezone="$props.timeZone" offset="{formatUtcOffset($props.timeZone)}" />
          </Column>
        </Row>
        <Spacer size="$space.24" />
        <Text value="Гость" typography="$type.label.large" />
        <Row width="fill" align="center" gap="$space.12" marginTop="$space.8" padding="$space.12" radius="$radius.12" borderColor="$color.border.default" background="$color.surface.primary">
          <Icon name="user" size="$size.icon.small" color="$color.action.primary" />
          <Column flex="1" gap="$space.4">
            <Text value="$props.booking.guest.name" typography="$type.body.medium" />
            <Text value="$props.booking.guest.email" typography="$type.body.small" color="$color.text.secondary" numberOfLines="1" />
          </Column>
        </Row>
        <Section when="$props.booking.guest.comment != null" marginTop="$space.24">
          <Text value="Комментарий" typography="$type.label.large" />
          <Row width="fill" align="start" gap="$space.12" marginTop="$space.8" padding="$space.12" radius="$radius.12" borderColor="$color.border.default" background="$color.surface.primary">
            <Icon name="message-square" size="$size.icon.small" color="$color.action.primary" />
            <Text value="$props.booking.guest.comment" typography="$type.body.medium" flex="1" />
          </Row>
        </Section>
        <Spacer size="$space.24" />
        <Button variant="secondary" width="fill" height="$size.button.height" label="Закрыть" onPress="closeBookingDetails" />
      </ScrollView>
    </BottomSheet>
  </Layout>
</ScreenSpec>
```

## UX rules

- Это sheet-компонент экрана `owner.upcoming-meetings` (05), а не route: в
  `navigation/navigation.uispec.xml` записи для него нет, открытие и закрытие — состояние родителя
  (`bookingDetails`), вход — блок `<Props>`. Конвенция описана в `MANUAL.md` §2.1 и одинакова с
  `04-add-working-hours-sheet.screen.md`.
- Вход — готовый `BookingView` из view-model списка встреч (та же модель, что в спеке 05, все поля
  замаплены родителем). Собственных запросов к backend и route-параметров у sheet нет.
- `eventTypeTitle` — контрактное `Booking.eventTypeName`, snapshot названия на момент бронирования;
  client-side join по словарю типов событий снят — контракт 0.2.0 отдаёт название в ответе с бронью.
- `dateText` и `timeZone` — контекст родителя: подпись даты берётся из заголовка группы, в которой
  лежит встреча (`groupBookingsByOwnerDate`), timezone — из `UpcomingMeetingsData.timezone`. Время
  внутри sheet считает `formatTime` в timezone владельца; отдельного хелпера для даты в кит не добавляется.
- Секции «Дата и время», «Гость» и «Комментарий» оформлены строками с ведущей иконкой (кадр 8);
  строка — локальная композиция `Row` + `Icon`, отдельного компонента реестра для неё нет.
- Комментарий — необязательное `Booking.guestNote`: без него секция не показывается.

## Acceptance criteria

- Sheet закрывается swipe/backdrop/system back.
- Timezone видна рядом со временем.
- Дополнительных запросов к backend нет: все данные приходят пропсами из списка встреч.
