# План TASK-front-guest-002

Декомпозиция по согласованным brief (этапы Э0–Э5) и ADR (решения 1–12). Перед переводом любого пункта в `завершено` — применимые проверки из «Обязательных проверок» `AGENTS.md`; для каждого пункта с UI-кодом обязателен `npm run uispec:validate` и `npm test -w @minical/client`.

## Ветка и изоляция (worktree)

Реализация ведётся **не в основном рабочем дереве**, а в отдельной ветке на изолированном git worktree — по протоколу скилла [`worktree-isolated-agent`](../../../../.opencode/skills/worktree-isolated-agent/SKILL.md), адаптированному к этому репозиторию:

- **Ветка**: `task/front-guest-002-guest-screens` от актуального `main` (образец именования — `task/front-guest-001-client-foundation`).
- **Worktree**: соседняя директория `../ai-for-developers-project-386-front-guest-002`; основное дерево остаётся на `main` и не переключается. Предусловие старта — чистый `git status` и в основном дереве, и в worktree.
- **Самодостаточность worktree.** Каталоги AI-процесса gitignored и в worktree не появятся сами; прокидываются **симлинками на основное дерево** (единый источник, без копий): `docs/` (UISpec — read-only вход реализации), `tasks/` (документы задачи — обновления состояний `plan.md` и `result.md` по ходу работы идут в общий источник), `.opencode/` (роли и скиллы), `CLAUDE.md`, при необходимости MCP — `.mcp.json`. Утверждённые спеки в worktree не правятся — расхождение оформляется задачей `front-ui`, как требует AC6.
- **Установка**: в worktree свой `npm install` (npm workspaces; `node_modules` не наследуется), все гейты гоняются внутри worktree.
- **Дисциплина**: вся работа P01–P15 — только внутри worktree (`git -C`, абсолютные пути); основное дерево — только чтение. `git add` — только конкретными файлами, никаких `-A`/`.`.
- **Коммиты и вливание**: по образцу `front-guest-001` — итоговый коммит(ы) в ветке после согласования `result.md`, вливание в `main` fast-forward. **Push в origin — только после явного ОК пользователя** (техническая договорённость протокола, не пожелание).
- **Верификация перед вливанием** — механизированная, по пункту 7 скилла: `git log --oneline main..HEAD`, `git diff --stat main..HEAD` (только ожидаемые файлы — `apps/client/**`, без `packages/**` и `apps/api/**`), чистый `git status --porcelain`; посторонние файлы в diff — красный флаг scope-creep, разбор до причины.
- **Уборка**: `git worktree remove` после вливания (не удалять директорию вручную).

## Декомпозиция

| ID | Цель / проблема | Решение | Состояние |
|---|---|---|---|
| P01 | Типы состояний/действий четырёх экранов — из спек, а не вручную (ADR §1) | `npm run uispec:validate` (errors=0) → `generate_scaffold.py` для спек 12–15 в scratch → в `src/features/guest/screens/generated/` переносятся четыре `Guest*.types.generated.ts` + `uispec-runtime.ts`; заглушки `*.generated.tsx` и `*.models.generated.tsp` не переносятся; заводится `tasks/task-front-guest-002/generation-report.md` (MANUAL §12) | завершено |
| P02 | Э0/FR0.1: `AppIcon` — плейсхолдер; гостевым спекам нужны реальные глифы | `npx expo install @expo/vector-icons`; сверить словарь имён grep'ом по спекам 12–15 и восьми компонент-спекам (ожидаемые 14 имён — в ADR §6); `AppIcon`: `name` → union `IconName`, семейство Feather, override `calendar-x` → MCI `calendar-remove`, `event-type` → глиф по мокапу; props-API и a11y-поведение сохранены; тесты `AppIcon` обновлены, плейсхолдер удалён | завершено |
| P03 | Datetime/forms-helpers по registry отсутствуют | `@/shared/datetime`: `dateLabel`, `timeLabel`, `fullDateLabel`, `formattedSlot`, `formatUtcOffset`, определение timezone гостя (`resolvedOptions().timeZone`); Intl, локаль `ru-RU`, timezone — явный параметр (ADR §8). `@/shared/forms`: `fieldError`. Юнит-тесты на фиксированных IANA-зонах, включая границы суток (слот 23:30 UTC ↔ другая календарная дата гостя) | завершено |
| P04 | Слот- и event-type-helpers по registry отсутствуют | `@/features/slots/lib`: `availableDates` (даты с ≥1 слотом, по возрастанию, с подписями), `slotsOnDate` (хронологически), `selectedSlotMissing` (`null` → `false`). `@/features/event-types/lib`: `durationLabel`, `eventTypeAccentIndex` (FNV-1a 32-bit mod 6). Юнит-тесты: детерминизм акцента (не зависит от порядка списка), группировка по timezone | завершено |
| P05 | Семантика ключа идемпотентности фундамента противоречит спеке 14 (ADR §5) | В `guest/state/reducer.ts` действие `booking/attempt` (set-once) заменяется на `booking/init` (безусловная запись нового ключа); `booking/succeeded` без изменений; тесты редьюсера и `GuestFlowProvider` переписываются под новую семантику; grep по клиенту — использований старого действия не осталось | завершено |
| P06 | Нет `InlineAlert` и констант адаптива | `@/design-system/components/InlineAlert`: варианты `warning`/`error` по таблице компонент-спеки (подложка/цвет/иконка), `accessibilityRole="alert"`, растёт по контенту. `@/design-system/layout`: константы правила раскладки — контент ≤ 760 dp, порог 768 dp (ADR §10). RNTL-тесты обоих вариантов | завершено |
| P07 | Нет компонентов выбора даты/времени | `@/features/slots/components`: `DateChip` (selected на `guest.selectedSurface`, `accessibilitySelected`, label = `fullDateLabel`, 64×72), `DateStrip` (горизонтальный список, состояние у чипов), `SlotItem` (только время начала `timeLabel`, selected-токен, `accessibilitySelected`, высота 64), `SlotGrid` (`columns` prop, `$event.slot` целиком в `onSelect`, порядок не меняет). RNTL-тесты: selected-состояния, a11y, отдача целого `Slot` | завершено |
| P08 | Нет гостевых карточек | `@/features/guest/components`: `PublicEventTypeCard` (плитка `colors.accent[accentIndex+1]`, глиф `event-type` на `text.onPrimary`, вся карточка — один тап-таргет, ≥112 dp), `BookingSummaryCard` (`formattedSlot`, `TimezoneLabel`, «Изменить» → `onEdit`, тап-таргет кнопки ≥48 dp), `ConfirmationDetails` (шесть строк кадра 7 с декоративными иконками, email `numberOfLines=1`, полностью доступен screen reader). RNTL-тесты | завершено |
| P09 | Э1: каталог встреч (`guest.event-types`) | Контейнер `GuestEventTypesScreen` + `GuestEventTypesView` + редьюсер на generated-типах: mount-эффект диспатчит пару `loadPublicCalendar`+`loadPublicEventTypes`, переходами владеет второй, «Повторить» перезапускает пару; `CALENDAR_NOT_CONFIGURED` и пустой список → `empty`; `selectEventType` → push `GuestSlots` с 4 параметрами; адаптив: контент ≤760 dp, две колонки карточек от 768 dp. Стаб удалён, `GuestStack` обновлён. Тесты: 4 состояния через мок use-cases, включая «retry перезапускает пару». Живой smoke против Prism `:4010` | завершено |
| P10 | Э2: выбор даты и времени (`guest.slots`) — 7 состояний | Контейнер `GuestSlotsScreen` + view + редьюсер: `useFocusEffect` + ref «первый фокус» (mount → `loadPublicSlots`, возврат → `refreshPublicSlots`); ветви refresh строго по порядку спеки (`empty` → `selectedSlotMissing` → `dateSelection` → `slotSelection`), неудачный refresh — no-op (`preserveContent`); `selectDate` сбрасывает слот; `continueToForm` disabled без слота, передаёт серверные `startAtUtc`/`endAtUtc`; `openCatalog` — reset; `EVENT_TYPE_NOT_FOUND`/`CALENDAR_NOT_CONFIGURED` → `unavailable`; полоска и сетка из одного `Slot[]` через helpers; сетка ≥2 колонок (min 112 dp). Стаб удалён. Тесты: все 7 состояний, порядок ветвей refresh, «второй фокус диспатчит refresh» | завершено |
| P11 | Э3: форма гостя (`guest.booking-form`) — 5 состояний | Контейнер `GuestBookingFormScreen` + view: mount-эффект — `booking/init` (новый ключ); поля — из `GuestFlowProvider.draft` (`draft/change`); `validateGuestForm` в `@/features/guest/lib` (три правила спеки, вызов только на submit, непустой результат → `validationError`, запрос не уходит); payload — плоский `CreateBookingRequest` (`eventTypeId`, `startAtUtc`, `id`, `guest{name,email,note?}`); ветви: `transport` → `networkError` (экран кадра 9, placeholder `TODO-ASSET`), `SLOT_UNAVAILABLE`/`SLOT_OUTSIDE_WINDOW`/`SLOT_NOT_ALIGNED` → `popTo('GuestSlots')`, иначе `serverValidationError` с текстом `errorMessage($error)`; `retryBooking` — тот же ключ и нагрузка; CTA блокируется только в `submitting`; успех → переход на подтверждение с `booking`. Стаб удалён. Тесты: 5 состояний, «повтор шлёт тот же ключ», «валидация не блокирует CTA» | завершено |
| P12 | Э4: подтверждение (`guest.booking-confirmation`) + гарантия «"назад" не в форму» | Контейнер `GuestBookingConfirmationScreen` + view: guard при монтировании — нет параметра `booking` → `error`; `ConfirmationDetails` только из полей ответа (`eventTypeName` из `Booking`); `backToCatalog` — reset. Вход на экран (успех `createBooking`) реализуется **reset'ом стека до `GuestBookingConfirmation`** — уточнение ADR §4 на уровне плана: push оставил бы системное «назад» в форму созданной брони (нарушение FR4.4/AC4), reset очищает историю. Стаб удалён. Тесты: content, guard → error, возврат из обоих состояний | завершено |
| P13 | Э5 (web): основной путь + кадры 8 и 9 против реального API | `back-001` на `:3001`; сидирование setup/admin-операциями (онбординг + ≥2 типа встреч); `EXPO_PUBLIC_API_BASE_URL=http://localhost:3001 npx expo export --platform web --clear`, раздача `dist`; браузерный прогон (Playwright): основной путь до подтверждения (FR5.1). Кадр 8: дойти до формы → занять слот сторонним `POST /bookings` (другой ключ/гость) → «Подтвердить» → возврат на слоты, выбор снят, слоты перезагружены, алерт, draft цел. Кадр 9: `page.route` на `POST /bookings` — `route.fetch()` (сервер обработал) → `abort()` (клиент получил обрыв) → экран кадра 9 → снять перехват → «Повторить» → 200 с той же бронью; `GET /admin/bookings` — ровно одна бронь. API-процесс не рестартуется на всём протяжении. Тексты ошибок — из словаря маппера | завершено |
| P14 | Э5 (Android): основной путь против реального API | Android-эмулятор, `EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:3001`, запуск через `npx expo run:android` (или `expo start --android`); основной путь целиком до подтверждения; кадр 8 повторить сторонним `POST /bookings` (дёшево, curl); кадр 9 на Android — при доступном времени, через airplane mode эмулятора (API-процесс на хосте не затрагивается); обязательный минимум по AC5 — основной путь | завершено |
| P15 | Финальные гейты, сверка AC, result.md | Полный набор «Обязательных проверок» `AGENTS.md` + `npx expo export --platform web` без ошибок; FR5.4 подтверждён (первый экран — каталог, шаблонного текста нет); сверка всех 9 acceptance criteria brief; `result.md` заполнен (включая протоколы Э5 и generation-report); реестр `tasks/README.md` обновлён | завершено |

## Порядок и зависимости

```text
P01 (generated-типы)  ─┐
P02 (иконки)          ─┤ независимы между собой, выполняются первыми
P03 (shared-helpers)  ─┤
P04 (slot/et-helpers) ─┤
P05 (ключ)            ─┘

P06 (InlineAlert, адаптив) ← P02
P07 (компоненты слотов)    ← P02, P03
P08 (гостевые карточки)    ← P02, P03

P09 (Э1 каталог)      ← P01, P02, P04, P06, P08
P10 (Э2 слоты)        ← P01, P02, P03, P04, P06, P07
P11 (Э3 форма)        ← P01, P03, P05, P06, P08
P12 (Э4 подтверждение)← P01, P03, P08
P13 (Э5 web)          ← P09–P12
P14 (Э5 Android)      ← P13 (отработанный протокол и сидирование)
P15 (гейты, result)   ← всё
```

Экраны P09–P12 линейно связаны сценарием, но реализуемы в любом порядке после своих зависимостей; сквозные пути (кадры 8, 9) проверяются только в P13–P14.

## Блокеры и открытые вопросы

1. **Глиф для имени `event-type`** — прямого аналога в Feather нет; выбирается при P02 визуальной сверкой с мокапом (кандидаты из ADR §6: Feather `grid`/`tag`, MCI `shape-outline`). Решение фиксируется в `result.md`.
2. **Prism и данные слотов**: мок отдаёт статические example-даты — для отладки `DateStrip`/`SlotGrid` они могут быть непригодны (прошедшие даты). Допустимый обход без изменения этапности — локальный `back-001` как источник данных при разработке Э2; обязательность реального API остаётся требованием только Э5.
3. **Android-toolchain**: в предыдущих задачах эмулятор в сессиях не поднимался; если toolchain недоступен, P14 блокируется — фиксируется как блокер в `result.md` и решается с пользователем отдельно (brief требует Android обязательно, молча скипать нельзя).
4. **Вход на подтверждение — reset** (P12): уточнение согласованного ADR §4 (он покрывает возвраты, но не вход на экран 15). Не отклонение, а деталь реализации в пользу AC4; если reviewer считает иначе — обсудить до реализации P12.
