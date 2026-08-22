# План front/owner/001

Реализация — в изолированном worktree на ветке задачи (протокол `worktree-isolated-agent`),
коммит на завершённый пункт (`feat: front/owner/001 PNN — суть`). Экранные пункты фазы 3
допускают параллельных агентов в одном worktree (паттерн `front/guest/002`). Перед `завершено`
у пункта — гейты затронутой области: `npm run typecheck`, `npm test -w @minical/client`,
`npm run uispec:validate`; полный набор — в фазе «Проверка» (P22).

Сквозные условия: только generated SDK (без ручных DTO), стили только токенами, тексты и
структура экранов — из спек кита после `front/ui/003`; sheets 04/11 реализуются внутри
родительских экранов (каркасы генератором для них не собираются — MANUAL §2.1); RNTL v14
асинхронный (`await render/act`); `AppSafeArea` — корень каждого экрана.

Фазы: 1 — фундамент (P01–P06), 2 — компоненты (P07–P12), 3 — фичи и экраны (P13–P19,
каждый экранный пункт: контейнер + чистый редьюсер + view + тесты состояний и действий с моком
usecases), 4 — сквозная проверка (P20–P22).

## Пункты

| ID | Фаза | Цель / проблема | Решение | Состояние |
|---|---|---|---|---|
| P01 | 1 | Нет пакета табовой навигации | Добавить `@react-navigation/bottom-tabs` в `apps/client`, дополнить `transformIgnorePatterns` jest при необходимости | завершено |
| P02 | 1 | Приложение монтирует только гостевой флоу | `EXPO_PUBLIC_APP_MODE=guest\|owner` (дефолт guest, только статическое обращение), App.tsx выбирает корень; гостевое поведение без переменной — байт-в-байт прежнее | завершено |
| P03 | 1 | Токены клиента разошлись с китом | Синхронизировать `tokens.ts`: dark `action.primary` #246BFD, dark `action.primaryPressed` #1554D6; прогнать гостевые тесты на регрессию | завершено |
| P04 | 1 | `AppHeader` не умеет правые действия | Реализовать `rightActions` по спеке `app-header` (нужно экранам 05, 06) | завершено |
| P05 | 1 | Owner-хелперов нет | `features/owner/lib`: `formatAvailabilitySummary`, генерация публичного id из названия (до первой ручной правки), `groupBookingsByOwnerDate`, подписи длительности; юниты | завершено |
| P06 | 1 | Каркасы экранов не сгенерированы | `generate_scaffold.py` по owner-спекам (кроме sheets), перенос generated-типов в `features/owner/**/generated/` | завершено |
| P07 | 2 | Нет базового bottom-sheet и диалога | `BottomSheet` (RN Modal transparent, scrim, drag handle, свайп/backdrop/`onRequestClose`) и `ConfirmationDialog` по спекам; тесты | завершено |
| P08 | 2 | Нет searchable-выбора | `SelectField` c `pickerMode="bottom-sheet"` и поиском (timezone-пикер экранов 02/09); тесты | завершено |
| P09 | 2 | Нет полей расписания и длительности | `TimeField`, `WeekdaySelector`, `DurationSelector` по спекам; тесты | завершено |
| P10 | 2 | Нет таб-бара по токенам | `BottomNavigation` — кастомный tabBar для bottom-tabs по спеке; тесты | завершено |
| P11 | 2 | Нет онбординг-обвязки | `ProgressHeader`, `AnimatedSetupIllustration` (placeholder, `TODO-ASSET`) по спекам | завершено |
| P12 | 2 | Нет owner-карточек и строк | `SettingsRow` (ведущая иконка), `MeetingCard` (нагрузка `booking`), `EventTypeCard` (accent из id, единый глиф), `ScheduleCard` (нагрузка `interval`); компонентные тесты | завершено |
| P13 | 3 | Нет owner-модели и usecases | `features/owner/model` (view-модели, мапперы DTO) и `usecases` (7 admin-операций через `runOperation`), owner-словарь ошибок в каноне `$error`; юниты | завершено |
| P14 | 3 | Нет owner-навигации | OwnerRoot: `SetupCheck → OnboardingStack → OwnerTabs`, ручные param lists, интеграция в App.tsx (режим owner) | завершено |
| P15 | 3 | Экран 01 | SetupCheck: `getAdminSetup`, роутинг по `onboardingCompleted`, состояния checking/error | завершено |
| P16 | 3 | Экраны 02–04 | Онбординг: профиль (черновик параметром навигации), рабочие часы, sheet 04 внутри обоих родителей (создание/редактирование с префиллом, замена интервала, `ConfirmationDialog` перезаписи), submit `completeAdminSetup` | завершено |
| P17 | 3 | Экраны 05 и 11 | Встречи: две операции, группировка по датам владельца, `eventTypeName` из Booking, refresh с `preserveContent`, empty c share `publicUrl`, sheet деталей пропсами | завершено |
| P18 | 3 | Экраны 06 и 10 | Типы событий: список с accent, создание с `DurationSelector` (дефолт 30 ставит контейнер), автогенерацией id, баннером `InlineAlert`, `DUPLICATE_EVENT_TYPE_ID → fieldErrors['public-id']`; поддержка `prefix` в `AppTextField` (TODO-COMPONENT спеки 10) | завершено |
| P19 | 3 | Экраны 08, 09, 07 | Настройки: сводка, профиль и рабочее время read-modify-write полным `SetupRequest`, dirty-гейт кнопок, sheet 04 из настроек | завершено |
| P20 | 4 | Работоспособность web не доказана | Прогон против реального `back/001` в браузере: сценарии A–D brief, оба режима (guest без регрессий), `expo export --platform web`; фиксация в result | завершено |
| P21 | 4 | Работоспособность Android не доказана | Прогон на эмуляторе: сценарии A–D, безопасные зоны, системная «назад» у sheets; фиксация в result | завершено |
| P22 | 4 | Задача не закрыта | Фаза «Проверка»: полный набор обязательных проверок, `result.md`, режимы запуска в корневом `README.md`, реестр и уборка workspace | завершено |
