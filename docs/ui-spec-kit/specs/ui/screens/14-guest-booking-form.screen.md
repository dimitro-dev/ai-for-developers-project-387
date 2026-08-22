---
id: guest.booking-form
route: GuestBookingForm
platforms: [android, web]
reference: ../assets/guest-mobile-flow.png
referenceFrames: [4, 5, 6, 9]
status: draft
---

# Данные гостя

Сводка выбранного слота, имя, email и необязательный комментарий; создание брони (кадры 4, 5, 6) и путь при
обрыве сети (кадр 9).

```uispec
<ScreenSpec version="0.1">
  <Meta id="guest.booking-form" route="GuestBookingForm" title="Ваши данные" />
  <Viewport width="360" height="800" unit="dp" safeArea="true" />
  <Data>
    <Model name="GuestDetails" source="api" schema="GuestDetails"><Field name="name" type="string" /><Field name="email" type="string" format="email" /><Field name="note" type="string" required="false" /></Model>
    <Model name="FieldError"><Field name="field" type="string" /><Field name="message" type="string" /></Model>
  </Data>
  <StateMachine initial="editing">
    <State id="editing"><Property name="form" type="GuestDetails" /><Property name="fieldErrors" type="FieldError[]" default="[]" /><Property name="bookingKey" type="string" /></State>
    <State id="validationError" extends="editing" />
    <State id="submitting" extends="editing" />
    <State id="serverValidationError" extends="editing"><Property name="message" type="string" /></State>
    <State id="networkError" extends="editing" />
  </StateMachine>
  <Validation>
    <Rule id="guest-name-required" expression="trim($state.form.name).length &gt; 0" message="Введите имя" target="guest-name" />
    <Rule id="guest-email-required" expression="trim($state.form.email).length &gt; 0" message="Введите email" target="guest-email" />
    <Rule id="guest-email-format" expression="isEmail($state.form.email)" message="Введите корректный email" target="guest-email" />
  </Validation>
  <Actions>
    <Action id="initBookingKey" kind="local.update" path="$state.bookingKey" value="{newBookingKey()}" />
    <Action id="changeName" kind="local.update" path="$state.form.name" value="$event.value" />
    <Action id="changeEmail" kind="local.update" path="$state.form.email" value="$event.value" />
    <Action id="changeNote" kind="local.update" path="$state.form.note" value="$event.value" />
    <Action id="createBooking" kind="api.command" before="validateGuestForm" onConflict="validationError" disabledWhen="$state == submitting" onSuccessRoute="GuestBookingConfirmation" onErrorWhen="$error.transport == true:networkError;$error.code == 'SLOT_UNAVAILABLE':GuestSlots;$error.code == 'SLOT_OUTSIDE_WINDOW':GuestSlots;$error.code == 'SLOT_NOT_ALIGNED':GuestSlots" onErrorState="serverValidationError" gap="GAP-004"><Payload><Field name="eventTypeId" bind="$route.params.eventTypeId" /><Field name="startAtUtc" bind="$route.params.startAtUtc" /><Field name="id" bind="$state.bookingKey" /><Field name="guest" bind="$state.form" /></Payload></Action>
    <Action id="retryBooking" kind="local.dispatch" target="createBooking" />
    <Action id="chooseAnotherTime" kind="navigation.back" />
  </Actions>
  <Layout type="column" background="$color.background.primary" minHeight="fill">
    <Header title="Ваши данные" backAction="chooseAnotherTime" />
    <StateView state="editing|validationError|submitting|serverValidationError">
      <ScrollView flex="1" keyboardAvoiding="true" contentPaddingHorizontal="$space.24" contentPaddingTop="$space.16" contentPaddingBottom="$space.32">
        <BookingSummaryCard eventTypeName="$route.params.eventTypeName" startAtUtc="$route.params.startAtUtc" endAtUtc="$route.params.endAtUtc" timeZone="$system.timeZone" onEdit="chooseAnotherTime" />
        <StateView state="serverValidationError"><Spacer size="$space.16" /><InlineAlert variant="error" title="Не удалось создать встречу" body="$state.message" /></StateView>
        <Spacer size="$space.20" />
        <Column gap="$space.8"><Text value="Имя" typography="$type.label.large" /><TextField id="guest-name" value="$state.form.name" placeholder="Введите ваше имя" height="$size.input.height" autoCapitalize="words" autoComplete="name" onChange="changeName" /><ValidationMessage when="{fieldError('guest-name') != null}" value="{fieldError('guest-name')}" target="guest-name" /></Column>
        <Spacer size="$space.16" />
        <Column gap="$space.8"><Text value="Email" typography="$type.label.large" /><TextField id="guest-email" value="$state.form.email" placeholder="Введите ваш email" height="$size.input.height" keyboardType="email-address" autoCapitalize="none" autoComplete="email" onChange="changeEmail" /><ValidationMessage when="{fieldError('guest-email') != null}" value="{fieldError('guest-email')}" target="guest-email" /></Column>
        <Spacer size="$space.16" />
        <Column gap="$space.8"><Text value="Комментарий (необязательно)" typography="$type.label.large" /><TextField id="guest-note" value="$state.form.note" placeholder="Необязательное сообщение" multiline="true" minHeight="$size.textarea.minHeight" onChange="changeNote" /></Column>
        <Spacer size="$space.24" />
        <Button when="$state != submitting" variant="primary" width="fill" height="$size.button.height" label="Подтвердить встречу" onPress="createBooking" />
        <Button when="$state == submitting" variant="primary" width="fill" height="$size.button.height" label="Создаём встречу..." loading="true" disabled="true" />
      </ScrollView>
    </StateView>
    <StateView state="networkError"><Center flex="1" padding="$space.24"><Image source="$asset.network-error" width="208" height="176" resizeMode="contain" /><Spacer size="$space.16" /><Text value="Не удалось создать встречу" typography="$type.title.medium" align="center" /><Spacer size="$space.8" /><Text value="Проверьте подключение. Ваши данные сохранены." typography="$type.body.medium" color="$color.text.secondary" align="center" /><Spacer size="$space.24" /><Button variant="primary" width="fill" height="$size.button.height" label="Повторить" onPress="retryBooking" /><Spacer size="$space.12" /><Button variant="secondary" width="fill" height="$size.button.height" label="Выбрать другое время" onPress="chooseAnotherTime" /></Center></StateView>
  </Layout>
</ScreenSpec>
```

## UX rules

- Payload — плоский контрактный `CreateBookingRequest`: `eventTypeId`, `startAtUtc`, `id` (ключ
  идемпотентности) и вложенный `guest` (`GuestDetails`: `name`, `email`, `note?`). Поле комментария — `note`,
  как в контракте. `endAtUtc` в запросе не участвует: конец встречи считает сервер.
- Карточка сводки заполняется параметрами route (`eventTypeName`, `startAtUtc`, `endAtUtc`) и timezone
  устройства гостя — полей без источника на экране не остаётся.
- **Ключ идемпотентности.** `initBookingKey` диспатчится контейнером при монтировании экрана — до первой
  попытки создания брони, иначе повтор нераспознаваем. Повтор после обрыва сети отправляет **тот же** ключ и
  ту же нагрузку и получает 200 с ранее созданной бронью вместо второй брони. Ключ живёт ровно монтирование:
  смена слота меняет `startAtUtc`, а тот же ключ с другой нагрузкой даёт `DUPLICATE_BOOKING_ID`.
- Редактирование полей после серверной ошибки безопасно: 400 брони не создаёт. После обрыва сети формы на
  экране нет (кадр 9), поэтому изменить нагрузку и сломать ключ невозможно.
- **Черновик гостя** (имя, email, комментарий) хранит guest-flow state контейнера, а не параметры route:
  `navigation.back` параметров не несёт, а на web параметры уезжают в URL и историю браузера — это PII.
  Форма при монтировании берёт значения из черновика, если он есть. Сущность живёт вне UISpec — грамматика
  способ хранения состояния не описывает, и валидатор этого не проверяет.
- Валидация — на submit, как на кадрах 4/5: CTA активна при пустых и невалидных полях, подсказки появляются
  после нажатия (`before="validateGuestForm"`, `onConflict="validationError"`). `$validation.invalid` в
  `disabledWhen` не используется — при заблокированной кнопке гость не получил бы подсказок вообще, а запрос
  с пустым именем всё равно не уйдёт. Клиентская валидация не заменяет серверную (MANUAL §9).
- Подпись CTA различается по состоянию (`when=`), а не выражением `if(...)`: такой конструкции в каноне нет.
- Конфликт слота, слот вне окна и слот не по сетке возвращают гостя на экран слотов (route-цель ветви
  `onErrorWhen`) — как возврат на существующий экран стека, а не второй `push`. Сам конфликт распознаёт экран
  слотов: на возврате контейнер диспатчит `refreshPublicSlots`, и гость видит алерт кадра 8.
- Серверная ошибка валидации показывается общим текстом сервера в `InlineAlert variant="error"` над формой,
  без подсветки конкретного поля: `ErrorResponse {code, message}` по-полевых данных не даёт.
  TODO-CONTRACT-GAP(GAP-004).
- Иллюстрация `$asset.network-error` в пакете отсутствует — placeholder-компонент, TODO-ASSET; вырезать её из
  PNG нельзя.

### Пути входа в состояния

| Состояние | Путь входа |
|---|---|
| `editing` | `initial` StateMachine; контейнер диспатчит `initBookingKey` при монтировании и восстанавливает черновик |
| `validationError` | `createBooking` → `before="validateGuestForm"` сообщил о конфликте → `onConflict="validationError"` |
| `submitting` | диспатч `createBooking` — in-flight состояние `api.command` (та же конвенция, что у owner-экрана 10) |
| `serverValidationError` | `createBooking` → `onErrorState="serverValidationError"` (сервер ответил ошибкой, не покрытой ветвями) |
| `networkError` | `createBooking` → `onErrorWhen` ветвь `$error.transport == true:networkError` |

## Acceptance criteria

- Реализованы editing, validationError, submitting, serverValidationError, networkError; у каждого есть путь
  входа из таблицы выше.
- Имя и email обязательны, комментарий необязателен; ошибки связаны с полями через `target`.
- CTA активна при пустых полях и блокируется только во время отправки; повторный submit во время
  `submitting` невозможен.
- Введённые данные сохраняются и при возврате к слотам, и при обрыве сети.
- «Повторить» после обрыва сети отправляет тот же ключ идемпотентности и ту же нагрузку.
- Модель `GuestDetails` — точное подмножество контрактной схемы; поле комментария называется `note`.
- Ни одно поле формы не уходит в параметры навигации.
