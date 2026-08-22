---
id: owner.create-event-type
route: CreateEventType
platforms: [android]
reference: ../assets/owner-mobile-settings-details.png
referenceFrames: [5, 6]
status: approved
---

# Создание типа события

Форма нового типа события (кадр 5) и её ошибка создания (кадр 6): баннер над формой плюс подсветка поля
публичного id.

```uispec
<ScreenSpec version="0.1">
  <Meta id="owner.create-event-type" route="CreateEventType" title="Новый тип события" />
  <Viewport width="360" height="800" unit="dp" safeArea="true" />
  <Data>
    <Model name="CreateEventTypeDraft"><Field name="id" type="string" from="CreateEventTypeRequest.id" /><Field name="name" type="string" from="CreateEventTypeRequest.name" /><Field name="description" type="string" required="false" from="CreateEventTypeRequest.description" /><Field name="durationMinutes" type="int32" default="30" from="CreateEventTypeRequest.durationMinutes" /></Model>
    <Model name="FieldError"><Field name="field" type="string" /><Field name="message" type="string" /></Model>
  </Data>
  <StateMachine initial="editing"><State id="editing"><Property name="form" type="CreateEventTypeDraft" /><Property name="publicIdTouched" type="boolean" default="false" /><Property name="fieldErrors" type="FieldError[]" default="[]" /></State><State id="submitting" extends="editing" /><State id="error" extends="editing"><Property name="message" type="string" /></State></StateMachine>
  <Validation>
    <Rule id="title-required" expression="trim($state.form.name).length &gt; 0" message="Введите название" target="title" />
    <Rule id="duration-required" expression="$state.form.durationMinutes &gt; 0" message="Выберите длительность" target="duration" />
    <Rule id="public-id-format" expression="matches($state.form.id, '^[a-z0-9]+(?:-[a-z0-9]+)*$')" message="Используйте латинские строчные буквы, цифры и дефисы" target="public-id" />
  </Validation>
  <Actions>
    <Action id="goBackEventTypes" kind="navigation.back" />
    <Action id="changeTitle" kind="local.update" path="$state.form.name" value="$event.value" afterWhen="!$state.publicIdTouched:generatePublicId" />
    <Action id="changeDescription" kind="local.update" path="$state.form.description" value="$event.value" />
    <Action id="changeDuration" kind="local.update" path="$state.form.durationMinutes" value="$event.value" />
    <Action id="changePublicId" kind="local.update" path="$state.form.id" value="$event.value" after="markPublicIdTouched" />
    <Action id="submitEventType" kind="api.command" disabledWhen="$validation.invalid || $state == submitting" onSuccessRoute="EventTypes" onErrorState="error"><Payload><Field name="id" bind="$state.form.id" /><Field name="name" bind="$state.form.name" /><Field name="description" bind="$state.form.description" /><Field name="durationMinutes" bind="$state.form.durationMinutes" /></Payload></Action>
  </Actions>
  <Layout type="column" background="$color.background.primary" minHeight="fill">
    <Header title="Новый тип события" backAction="goBackEventTypes" />
    <ScrollView flex="1" keyboardAvoiding="true" contentPadding="$space.16"><StateView state="error"><InlineAlert variant="error" title="Не удалось создать тип события" body="$state.message" /><Spacer size="$space.20" /></StateView><TextField id="title" label="Название" value="$state.form.name" height="$size.input.height" onChange="changeTitle" /><Spacer size="$space.20" /><TextField id="description" label="Описание (необязательно)" value="$state.form.description" multiline="true" minHeight="$size.textarea.minHeight" onChange="changeDescription" /><Spacer size="$space.20" /><Column gap="$space.8"><Text value="Длительность" typography="$type.label.large" /><DurationSelector id="duration" value="$state.form.durationMinutes" onChange="changeDuration" /></Column><Spacer size="$space.20" /><TextField id="public-id" label="Публичный id" value="$state.form.id" prefix="/" height="$size.input.height" autoCapitalize="none" error="{fieldError('public-id')}" onChange="changePublicId" /><Text value="Публичный адрес формируется из id и окончательно проверяется сервером." typography="$type.body.small" color="$color.text.secondary" marginTop="$space.8" /></ScrollView>
    <SafeArea edges="bottom" padding="$space.16"><Button variant="primary" width="fill" height="$size.button.height" label="Создать" onPress="submitEventType" disabled="$validation.invalid" loading="{$state == submitting}" /></SafeArea>
  </Layout>
</ScreenSpec>
```

## UX rules

- Public id генерируется из названия, пока пользователь не изменил его вручную; в контракте это поле `id` (`CreateEventTypeRequest.id`), поле «Название» — контрактное `name`.
- Payload `submitEventType` — плоский контрактный `CreateEventTypeRequest`.
- Уникальность проверяет backend.
- При network/server error форма сохраняется.
- **Длительность — ряд чипов, кадр 5.** `DurationSelector` вместо `SelectField`: набор закрыт четырьмя
  значениями (15/30/45/60 минут), и выбор одним тапом короче открытия пикера. Пустой длительности у формы не
  бывает, поэтому правило `duration-required` остаётся страховкой, а не рабочим сценарием.
- **Начальное значение длительности — 30 минут** (кадр 5), объявлено `default="30"` у поля
  `CreateEventTypeDraft.durationMinutes`. Прецедент дефолтов — состояние `editing` экрана 04
  (`default="09:00"`), но там поля формы лежат прямо в `<Property>` состояния, а здесь форма — одно свойство
  модельного типа: генератор собирает `…Defaults` только из `default=` у `<Property>` (MANUAL §7), поэтому
  вложенное поле он в константу не переносит. Значение проставляет контейнер при монтировании экрана —
  как и `initBookingKey` на экране 14, это конвенция контейнера, а не выражаемая грамматикой конструкция.
- **Ошибка создания — два элемента, кадр 6.** Баннер `InlineAlert variant="error"` над формой с заголовком
  «Не удалось создать тип события» и текстом сервера в `body`, плюс подсветка поля публичного id с подписью
  под ним. Баннер выбран вместо `ValidationMessage target="screen"`: у него есть иконка варианта и заголовок,
  то есть ошибка различима не только цветом и читается как один блок, тогда как `ValidationMessage` — это
  сообщение уровня поля, а полевые сообщения на этом экране рисует сам `TextField` (правило ниже). Прецедент —
  `serverValidationError` гостевой формы (экран 14).
- **Привязка серверной ошибки к полю.** Контракт отдаёт `ErrorResponse {code, message}` без по-полевых
  данных, но код `DUPLICATE_EVENT_TYPE_ID` сам называет поле: контейнер раскладывает его в
  `fieldErrors['public-id']` («Публичный id уже занят»), а коды, не привязанные к полю, остаются только в
  баннере. Отдельного gap здесь нет — в отличие от гостевой формы (GAP-004), нужное различение достигается
  кодом ошибки. Сам маппинг «код ответа → полевая ошибка» живёт вне UISpec: грамматика разбора ошибки в
  состояние формы не описывает (`onErrorWhen` выбирает только state или route), поэтому это конвенция
  контейнера, и валидатор её не проверяет — как черновик гостя на экране 14.
- Ошибка поля выводится один раз — атрибутом `error=` у `TextField` (паттерн экрана 02); отдельный
  `ValidationMessage` рядом с полем не ставится, иначе тот же текст показывается дважды: сообщение по
  `error=` рисует сам `AppTextField`.
- Префикс «/» у поля публичного id (кадр 5) — атрибут `prefix=` у `TextField`; текущий `AppTextField` его не
  поддерживает. TODO-COMPONENT: доработка компонента входит в front/owner/001 вместе с реализацией экрана;
  до неё префикс на экране не появится.

## Acceptance criteria

- Повторный submit заблокирован.
- Field errors отображаются у соответствующих полей.
- После успеха новый тип появляется в списке.
- Длительность выбирается чипами, выбран ровно один; с первого рендера это «30 мин», значение уходит в payload числом минут.
- Занятый публичный id виден и баннером над формой, и подписью у поля; введённые значения сохраняются.
