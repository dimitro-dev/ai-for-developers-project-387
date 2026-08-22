# Соответствие макетов и UISpec

Досок четыре: общая owner-доска, доска настроек владельца, доска дочерних экранов настроек и гостевая доска.

## Общий owner-флоу: доска `owner-mobile-flow.png`

| Кадр | Макет | UISpec |
|---|---|---|
| 1 | Проверка | `01-setup-check.screen.md`, state `checking` |
| 2 | Настройка календаря 1/2 | `02-onboarding-profile.screen.md` |
| 3 | Рабочее время 2/2 | `03-onboarding-working-hours.screen.md` |
| 4 | Добавить рабочее время | `04-add-working-hours-sheet.screen.md` |
| 5 | Предстоящие встречи, пусто | `05-upcoming-meetings.screen.md`, state `empty` |
| 6 | Предстоящие встречи, список | `05-upcoming-meetings.screen.md`, state `content` |
| 7 | Типы событий | `06-event-types.screen.md` — спек ссылается на кадр 7 детальной доски (та же сцена, свежая отрисовка) |
| 8 | Рабочее время в настройках | `07-working-hours-settings.screen.md` |

`../assets/owner-mobile-flow.png` — доска 2×4, ровно 8 кадров (1448×1086 px). Кадра 9 и далее на ней нет.

## Настройки владельца: доска `owner-mobile-settings.png`

`../assets/owner-mobile-settings.png` — доска 1×3, ровно 3 кадра (1448×1086 px), слева-вправо. Все три —
состояния одного экрана.

| Кадр | Макет | UISpec | Состояние |
|---|---|---|---|
| 1 | Настройки — loading | `08-owner-settings.screen.md` | `loading` |
| 2 | Настройки — список из трёх строк | `08-owner-settings.screen.md` | `content` |
| 3 | Настройки — ошибка загрузки | `08-owner-settings.screen.md` | `error` |

## Дочерние экраны настроек: доска `owner-mobile-settings-details.png`

`../assets/owner-mobile-settings-details.png` — доска 2×4, ровно 8 кадров (1448×1086 px), слева-вправо,
сверху-вниз. Кадры 1–4 — стадии экрана 09, кадры 5–6 — состояния экрана 10.

| Кадр | Макет | UISpec | Состояние |
|---|---|---|---|
| 1 | Профиль и timezone — loading | `09-owner-profile-settings.screen.md` | `loading` |
| 2 | Профиль и timezone — форма | `09-owner-profile-settings.screen.md` | `editing` |
| 3 | Поиск timezone (bottom sheet пикера) | `09-owner-profile-settings.screen.md` | `editing`, открыт пикер `SelectField` |
| 4 | Сохранение профиля | `09-owner-profile-settings.screen.md` | `saving` |
| 5 | Новый тип события | `10-create-event-type.screen.md` | `editing` |
| 6 | Ошибки создания | `10-create-event-type.screen.md` | `error` |
| 7 | Типы событий | `06-event-types.screen.md` | `content` |
| 8 | Детали встречи | `11-booking-details-sheet.screen.md` | `content` |

Кадр 3 отдельным route не является: пикер timezone — bottom sheet внутри `AppSelectField`, поэтому у него нет
ни своего спека, ни своего состояния StateMachine. Кадр 7 повторяет кадр 7 общей доски `owner-mobile-flow.png`,
и экран 06 ссылается на детальную доску как на более свежую отрисовку карточек.

### Состояния без кадра

Макет их не рисует, но спеки обязаны их описывать:

| UISpec | Состояния без кадра |
|---|---|
| `06-event-types.screen.md` | `loading`, `empty`, `error` |
| `09-owner-profile-settings.screen.md` | `error`, `saved` |
| `10-create-event-type.screen.md` | `submitting` |

## Guest-экраны 12–15

`../assets/guest-mobile-flow.png` — отдельная доска гостевого флоу: 3×3, ровно 9 кадров (1448×1086 px),
слева-вправо, сверху-вниз. Один кадр не обязан означать отдельный route: кадры 2/3/8 — стадии одного экрана
слотов, кадры 4/5/6/9 — состояния одного экрана формы.

| Кадр | Макет | UISpec | Состояние |
|---|---|---|---|
| 1 | Каталог встреч | `12-public-event-types.screen.md` | `content` |
| 2 | Выбор даты | `13-public-slots.screen.md` | `dateSelection` |
| 3 | Слоты выбранной даты | `13-public-slots.screen.md` | `slotSelection` |
| 4 | Данные гостя | `14-guest-booking-form.screen.md` | `editing` |
| 5 | Ошибки формы | `14-guest-booking-form.screen.md` | `validationError` |
| 6 | Создание брони | `14-guest-booking-form.screen.md` | `submitting` |
| 7 | Подтверждение | `15-booking-confirmation.screen.md` | `content` |
| 8 | Слот уже занят | `13-public-slots.screen.md` | `slotUnavailable` |
| 9 | Ошибка сети | `14-guest-booking-form.screen.md` | `networkError` |

### Состояния без кадра

Макет их не рисует, но спеки обязаны их описывать (сценарий 7 brief `task-front-ui-002`):

| UISpec | Состояния без кадра |
|---|---|
| `12-public-event-types.screen.md` | `loading`, `empty`, `error` |
| `13-public-slots.screen.md` | `loading`, `empty`, `unavailable`, `error` |
| `14-guest-booking-form.screen.md` | `serverValidationError` |
| `15-booking-confirmation.screen.md` | `error` |

Полоска дат нарисована только на кадре 2, но присутствует и в `slotSelection`, и в `slotUnavailable`: кадры 3
и 8 не рисуют её из-за размера кадра доски, а макет не является источником состава элементов (MANUAL §3,
приоритет 4). По той же причине сетка слотов показана начиная с `dateSelection`, хотя кадр 2 её не рисует.

Дополнительные UISpec-файлы описывают переходы, необходимые для работающего приложения, но не показанные
отдельными кадрами на общих досках.
