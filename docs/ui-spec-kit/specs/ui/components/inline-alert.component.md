---
id: component.inline-alert
kind: component
platforms: [android, web]
status: approved
---

# Inline Alert

Встроенное предупреждение над контентом, общее для owner- и guest-флоу: «слот только что заняли» на экране
слотов (кадр 8 гостевой доски), серверная ошибка валидации над формой гостя и ошибка создания типа события
над формой владельца (кадр 6 доски `owner-mobile-settings-details.png`).

```uispec
<ComponentSpec version="0.1">
  <Meta id="component.inline-alert" />
  <Props>
<Prop name="variant" type="enum:warning|error" required="true" />
<Prop name="title" type="string" required="true" />
<Prop name="body" type="string" required="false" />
  </Props>
  <Layout>
<InlineAlert variant="$props.variant" width="fill" padding="$space.12" radius="$radius.12" accessibilityRole="alert">
  <Row align="start" gap="$space.12"><Column flex="1" gap="$space.4"><Text value="$props.title" typography="$type.label.large" /><Text when="$props.body != null" value="$props.body" typography="$type.body.small" color="$color.text.secondary" /></Column></Row>
</InlineAlert>
  </Layout>
</ComponentSpec>
```

## Rules

- Соответствие «вариант → токены и иконка» живёт в RN-реализации компонента (как `Button variant=`), а не в
  helper-функциях, возвращающих оформление:

  | `variant` | Подложка | Рамка и иконка | Иконка |
  |---|---|---|---|
  | `warning` | `$color.status.warningSurface` | `$color.status.warning` | `alert-triangle` |
  | `error` | `$color.status.errorSurface` | `$color.status.error` | `alert-circle` |

- Иконка варианта — ведущий графический элемент строки; она декоративна по отношению к тексту (заголовок
  сообщает то же самое словами), поэтому отдельного `accessibilityLabel` не требует.
- Фиксированной минимальной высоты нет: алерт растёт по контенту, поэтому длинный текст не обрезается и не
  оставляет пустоты у короткого.
- Алерт не заменяет контент: пользователь продолжает сценарий на том же экране, поэтому под алертом остаётся
  рабочая разметка — и у гостя (экраны 13, 14), и у владельца (экран 10).
- Алерт уровня экрана и `ValidationMessage` уровня поля дополняют друг друга, а не заменяют: занятый публичный
  id на экране 10 виден и баннером, и подписью у поля.
- Оба варианта подложки проверены на контраст к тексту: `warningSurface` — 16.47 / 13.00 к `$color.text.primary`
  и 4.56 / 6.71 к `$color.text.secondary`; `errorSurface` — 16.59 / 14.39 и 4.60 / 7.42 (light / dark).

## Acceptance criteria

- Оба варианта различимы не только цветом — иконка варианта обязательна.
- `body` необязателен: алерт из одного заголовка выглядит цельно.
- Текст остаётся читаемым при font scale 1.3.
