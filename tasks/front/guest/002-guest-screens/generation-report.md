---
status: черновик
---

# Generation report — TASK-front-guest-002

Отчёт первой реальной генерации UISpec-каркасов в `apps/client/` (`MANUAL.md` §12). Пункт плана — P01.

## Прогон генератора

```bash
npm run uispec:validate                       # errors=0, 38 файлов
python3 docs/ui-spec-kit/tools/uispec/generate_scaffold.py \
  docs/ui-spec-kit/specs/ui/screens/<12|13|14|15>.screen.md --out <scratch>
```

Валидация выполнена до генерации (требование скилла `uispec-generator`, шаг 3): `errors=0`,
`approved=26, draft=12`, открытые гапы — `GAP-003`, `GAP-004` (оба non-blocking для этой задачи).

Генератор дал по три файла на экран. Перенесено в
`apps/client/src/features/guest/screens/generated/` (решение ADR §1):

| Файл | Перенесён | Причина |
|---|---|---|
| `GuestEventTypes.types.generated.ts` | да | discriminated union State/Action экрана 12 |
| `GuestSlots.types.generated.ts` | да | то же для экрана 13 |
| `GuestBookingForm.types.generated.ts` | да | то же для экрана 14 |
| `GuestBookingConfirmation.types.generated.ts` | да | то же для экрана 15 |
| `uispec-runtime.ts` | да | branded-примитивы, общая зависимость типов |
| `*.generated.tsx` (4 шт.) | нет | заглушка `return null` без layout-логики; view пишутся вручную по registry |
| `*.models.generated.tsp` (4 шт.) | нет | контрактной работы в задаче нет (API impact `NONE`); локальные модели `AvailableDate`/`FieldError` остаются view-model клиента |

## Расхождения генератора со спеками и с фундаментом

Ни одно из них не является расхождением *реализации* со спекой: спека остаётся источником истины,
расходится с ней вывод генератора. Правки в `docs/ui-spec-kit/**` не вносились (non-goal brief).

1. **`required="false"` теряется.** Спека 13 объявляет `<Property name="selectedSlot" type="Slot"
   required="false" />`, генератор выдал `selectedSlot: Slot` без опциональности. Ветвь
   `refreshPublicSlots` `$state.selectedSlot == null:dateSelection` и `disabledWhen` CTA прямо требуют
   отсутствующего значения, поэтому ручной тип состояния экрана использует `selectedSlot: SlotView | null`.

2. **`source="api"` резолвится в контрактный DTO, а не во view-model.** Генератор импортирует
   `EventType`, `Slot`, `Booking`, `GuestDetails`, `PublicCalendarResponse` из `@minical/api-client`.
   Фундамент `front-guest-001` (и `MANUAL.md` §6.5) держит в UI view-model'и с нормализованными
   `| null` вместо `?:` — `EventTypeView`, `SlotView`, `BookingView`, `CalendarView`. `SlotView` и
   `CalendarView` структурно совпадают с DTO, `EventTypeView` и `BookingView` — нет (`description`,
   `guestNote`). Ручные состояния экранов типизированы view-model'ями; набор `kind` и имена свойств
   совпадают со сгенерированными.

3. **Branded-типы `UtcDateTime` в параметрах действий.** `continueToForm` получил
   `startAtUtc: UtcDateTime`, тогда как `GuestStackParamList` (ручной перенос `navigation.uispec.xml`)
   типизирует те же параметры как `string`. Branded-тип в navigation-типы не заводится: параметры
   route — канон навигационной спеки.

4. **Action-типы без нагрузки.** `changeName`, `selectDate`, `selectSlot` и прочие `local.update`
   сгенерированы как `{ type: '...' }` без поля значения (`$event.value`, `$event.date`, `$event.slot`
   грамматика в тип не выносит). Ручные редьюсеры экранов несут нагрузку явно.

Следствие для будущих задач: при изменении спек 12–15 перенос `*.types.generated.ts` повторяется
вручную (ADR «Последствия»), и эти четыре пункта воспроизведутся снова.

## Визуальная сверка (MANUAL §12, шаги 1–5)

Заполняется на этапе Э5 (P13/P14): reference frame → hierarchy/spacing/typography/CTA → узкий и
широкий viewport → font scale 1.0 и 1.3 → состояния loading/empty/content/error.

| Экран | Кадр | Результат сверки |
|---|---|---|
| `guest.event-types` | 1 | не выполнено |
| `guest.slots` | 2, 3, 8 | не выполнено |
| `guest.booking-form` | 4, 5, 6, 9 | не выполнено |
| `guest.booking-confirmation` | 7 | не выполнено |
