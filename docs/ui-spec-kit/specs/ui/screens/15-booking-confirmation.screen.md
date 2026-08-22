---
id: guest.booking-confirmation
route: GuestBookingConfirmation
platforms: [android, web]
reference: ../assets/guest-mobile-flow.png
referenceFrame: 7
status: draft
---

# Встреча запланирована

Подтверждение созданной брони (кадр 7): что, когда, в какой timezone и на кого записано.

```uispec
<ScreenSpec version="0.1">
  <Meta id="guest.booking-confirmation" route="GuestBookingConfirmation" title="Встреча запланирована" />
  <Viewport width="360" height="800" unit="dp" safeArea="true" />
  <Data>
    <Model name="Booking" source="api" schema="Booking"><Field name="eventTypeName" type="string" /><Field name="startAtUtc" type="utcDateTime" /><Field name="endAtUtc" type="utcDateTime" /><Field name="guestName" type="string" /><Field name="guestEmail" type="string" /></Model>
  </Data>
  <StateMachine initial="content">
    <State id="content"><Property name="booking" type="Booking" /></State>
    <State id="error"><Property name="message" type="string" /></State>
  </StateMachine>
  <Actions>
    <Action id="backToCatalog" kind="navigation.reset" target="GuestEventTypes" />
  </Actions>
  <Layout type="column" background="$color.background.primary" minHeight="fill">
    <StateView state="content">
      <ScrollView flex="1" contentPaddingHorizontal="$space.24" contentPaddingTop="$space.32" contentPaddingBottom="$space.32">
        <Center><Icon name="check-circle" size="$size.icon.hero" color="$color.status.success" /></Center>
        <Spacer size="$space.20" />
        <Text value="Встреча запланирована" typography="$type.title.large" align="center" />
        <Spacer size="$space.24" />
        <ConfirmationDetails eventTypeName="$state.booking.eventTypeName" dateText="{dateLabel($state.booking.startAtUtc)}" timeRangeText="{timeLabel($state.booking.startAtUtc) + ' – ' + timeLabel($state.booking.endAtUtc)}" timeZone="$system.timeZone" guestName="$state.booking.guestName" guestEmail="$state.booking.guestEmail" />
        <Spacer size="$space.20" />
        <Text value="Можно закрыть эту страницу." typography="$type.body.medium" color="$color.text.secondary" align="center" />
        <Spacer size="$space.16" />
        <Button variant="secondary" width="fill" height="$size.button.height" label="К другим встречам" onPress="backToCatalog" />
      </ScrollView>
    </StateView>
    <StateView state="error"><Center flex="1" padding="$space.24"><Icon name="cloud-off" size="$size.icon.large" color="$color.icon.secondary" /><Spacer size="$space.16" /><Text value="Не удалось показать подтверждение" typography="$type.title.medium" align="center" /><Spacer size="$space.8" /><Text value="$state.message" typography="$type.body.medium" color="$color.text.secondary" align="center" /><Spacer size="$space.24" /><Button variant="secondary" width="fill" height="$size.button.height" label="К другим встречам" onPress="backToCatalog" /></Center></StateView>
  </Layout>
</ScreenSpec>
```

## UX rules

- Экран показывает только данные ответа сервера на `createPublicBooking` (`Booking`); дополнительного запроса
  не делает и `endAtUtc` не вычисляет.
- Название типа встречи — контрактное `Booking.eventTypeName` (snapshot на момент бронирования). Property
  состояния `eventTypeName`, приходившая из навигации, снята: GAP-002 закрыт `task-contract-001`, и это ровно
  то, что запись GAP-002 поручала этой задаче.
- Шапки и кнопки «назад» на кадре 7 нет: сценарий гостя здесь заканчивается.
- Возврат к каталогу — `navigation.reset`, а не `push`: иначе системное «назад» вернуло бы гостя в форму уже
  созданной брони и предложило отправить её снова.
- Timezone — timezone устройства гостя (`$system.timeZone`), та же, в которой гость выбирал слот.
- Состояние `error` — не декоративное: экран может быть открыт без данных брони (deep-link, восстановление
  стека после выгрузки процесса), и тогда показывать пустое подтверждение нельзя.

### Пути входа в состояния

| Состояние | Путь входа |
|---|---|
| `content` | `initial` StateMachine при переходе `createBooking` → `onSuccessRoute="GuestBookingConfirmation"`; контейнер передаёт `Booking` из ответа в параметр route `booking` (типизирован в `navigation.uispec.xml`) |
| `error` | экран открыт без параметра `booking` — контейнер-guard переводит StateMachine в `error`; действия, которое бы это делало, нет и быть не должно |

## Acceptance criteria

- Реализованы content и error; возврат к каталогу доступен из обоих состояний.
- Показаны тип встречи, дата, интервал, timezone, имя и email гостя — все шесть строк кадра 7.
- Все значения приходят из полей контрактной схемы `Booking`; `eventTypeName` не берётся из навигации.
- «Назад» после подтверждения не возвращает в форму созданной брони.
