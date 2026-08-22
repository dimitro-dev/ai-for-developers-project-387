---
id: component.confirmation-dialog
kind: component
platforms: [android, web]
status: approved
---

# Confirmation Dialog

Модальный вопрос перед необратимым изменением. Единственное применение MVP — подтверждение перезаписи
индивидуальных рабочих интервалов в sheet «Добавить рабочее время» (состояние `confirmOverwrite` спеки
`04-add-working-hours-sheet.screen.md`).

```uispec
<ComponentSpec version="0.1">
  <Meta id="component.confirmation-dialog" />
  <Props>
<Prop name="title" type="string" required="true" />
<Prop name="body" type="string" required="true" />
<Prop name="cancelLabel" type="string" required="true" />
<Prop name="confirmLabel" type="string" required="true" />
<Prop name="onCancel" type="ActionRef" required="true" />
<Prop name="onConfirm" type="ActionRef" required="true" />
  </Props>
  <Layout>
<ConfirmationDialog backdropColor="$color.background.scrim" background="$color.surface.primary" radius="$radius.20" padding="$space.24" marginHorizontal="$space.24" dismissOnBackdropPress="true" accessibilityRole="alertdialog" motion="$motion.standard">
  <Column gap="$space.8">
    <Text value="$props.title" typography="$type.title.medium" color="$color.text.primary" />
    <Text value="$props.body" typography="$type.body.medium" color="$color.text.secondary" />
  </Column>
  <Row justify="end" gap="$space.8" marginTop="$space.24">
    <Button variant="secondary" height="$size.button.height" label="$props.cancelLabel" onPress="$props.onCancel" />
    <Button variant="primary" height="$size.button.height" label="$props.confirmLabel" onPress="$props.onConfirm" />
  </Row>
</ConfirmationDialog>
  </Layout>
</ComponentSpec>
```

## Rules

- Диалог показывается только по условию родителя (`when="$state == confirmOverwrite"` в спеке 04) — своего
  состояния не держит и сам ничего не применяет: оба исхода уходят в действия родителя.
- Подтверждающее действие — primary-кнопка, отмена — secondary; порядок «Отмена → Подтвердить» одинаков
  на всех экранах.
- Backdrop и системная «назад» на Android эквивалентны отмене (`onCancel`), а не подтверждению.
- Диалог перекрывает и сам sheet, и его backdrop: рисуется в `Layout type="overlay"` родителя последним.
- `body` — готовый текст от родителя (в спеке 04 его собирает хелпер `overwriteMessage`), компонент
  ничего не форматирует.

## Acceptance criteria

- Заголовок объявляется как название модального окна, фокус после закрытия возвращается вызвавшему элементу.
- Обе кнопки — touch target не меньше 48 dp, подписи приходят пропсами (в диалоге нет зашитых текстов).
- Диалог не закрывается сам по себе: без выбора владельца исходное состояние сохраняется.
