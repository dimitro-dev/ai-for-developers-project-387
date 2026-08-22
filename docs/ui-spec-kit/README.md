# Calendar UISpec Kit

Декларативная UX/UI-спецификация owner-flow и guest-flow учебного сервиса бронирования встреч.

Пакет предназначен для AI-агента или генератора, который должен:

1. прочитать `*.screen.md` и `*.component.md`;
2. извлечь XML-подобный блок `uispec`;
3. проверить его по правилам из `MANUAL.md`;
4. сгенерировать TypeScript-типы, React Native-каркасы и TypeSpec-фрагменты;
5. дополнить сгенерированный каркас бизнес-логикой и API-интеграцией.

## Что является источником истины

| Область | Источник истины |
|---|---|
| Внешний вид и структура экрана | UISpec-файлы |
| Цвета, размеры, шрифты, отступы | `specs/ui/tokens/*.xml` |
| Поведение и состояния | `StateMachine`, `Actions`, `Validation` внутри UISpec |
| HTTP API | основной TypeSpec проекта |
| Связь UI-действий с API | `specs/ui/bindings/api-bindings.xml` |
| Визуальное направление | доски в `specs/ui/assets/`, перечень — `specs/ui/assets/ASSETS.md` |

## Быстрый старт

Запускать из корня кита (`docs/ui-spec-kit/`). Нужен Python 3; интерпретатор вызывается как `python3` — `python` в PATH может отсутствовать.

```bash
python3 tools/uispec/validate_uispec.py specs/ui
python3 tools/uispec/generate_scaffold.py specs/ui/screens/05-upcoming-meetings.screen.md --out generated
```

Генератор создаёт только безопасный каркас. Сложная бизнес-логика, запросы, timezone-преобразования и анимации дорабатываются вручную агентом по правилам `MANUAL.md`.
