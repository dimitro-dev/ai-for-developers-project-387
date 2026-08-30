# infra/010 — OpenCode GitHub App: вызов агента из комментария и авто-ревью PR

## Контекст и цель

Внешнее требование учебной платформы: подключить к репозиторию GitHub App с агентом OpenCode
и показать, что агент вызывается из комментария к issue командой `/oc explain this issue`.

Сейчас OpenCode живёт только в локальной рабочей копии: `.opencode/opencode.jsonc` перечислен
в `.gitignore` и до раннера не доезжает. В CI агент будет читать то, что лежит в git, — корневой
`AGENTS.md` и зональные. Собственного workflow у агента нет; в `.github/workflows/` три workflow:
`ci.yml` (обязательные проверки), `release-please.yml` (release-PR) и `hexlet-check.yml` —
внешний генерируемый чек платформы, который зона `infra/` не редактирует и не переименовывает.

Три обстоятельства репозитория определяют решение:

- **репозиторий публичный** (`dimitro-dev/ai-for-developers-project-387`) — комментарий любого
  пользователя GitHub способен запустить workflow, а текст комментария становится промптом агента;
- **дефолтная ветка `master`** — событие `issue_comment` берёт workflow с дефолтной ветки, поэтому
  до merge комментарий `/oc` не сработает ни в issue, ни в PR;
- **секретов у репозитория один** (`HEXLET_ID`), провайдера для агента нет вообще.

Трек lite: одна зона (`infra/` владеет CI configuration), HTTP-контракт и схема БД не затронуты,
архитектурного выбора за рамками решения ниже нет, работы меньше дня — все пять критериев
`flows/lite.md` отвечены «нет».

Цель: агент отвечает на `/oc` в issue и в PR-ревью, а не-draft PR получает автоматическое ревью;
ключ провайдера не хранится в репозитории.

## Решение

Вариант из документации OpenCode: GitHub App `opencode-agent` плюс один workflow, который
обменивает OIDC-токен раннера на installation-токен App. Права на запись даёт установленный App,
поэтому workflow объявляет только `id-token: write` и не получает ни `contents`, ни `issues`.

Провайдер — **OpenCode Zen** (id провайдера `opencode`, секрет `OPENCODE_API_KEY`), модель
`opencode/deepseek-v4-flash-free` — бесплатная, с tool-calling. Бесплатная модель выбрана
осознанно как компенсация отсутствующего фильтра автора (ниже): цена чужого `/oc` — минуты
Actions, не деньги.

Список моделей Zen берётся только из живого каталога `https://opencode.ai/zen/v1/models`
(63 модели, из них семь с суффиксом `-free`). Агрегатор models.dev для этого непригоден:
первая редакция решения назвала по нему `opencode/grok-code`, которой в Zen нет вовсе,
и прогон 33304637048 упал с `Model not found`. Ошибка стоила одного прогона и зафиксирована
здесь, чтобы следующая правка `model:` сверялась с каталогом, а не с агрегатором. Обратная связка обязательна: перевод строки `model:` на платную модель
требует вернуть фильтр по `author_association`, иначе публичный триггер сможет тянуть баланс
Zen (в аккаунте Zen может быть включено авто-пополнение $20 при остатке ниже $5).

`.github/workflows/opencode.yml` — один файл, два job'а: «интерфейс агента к CI» держится
в одном месте, а не в двух файлах с дублированием `env`, `model` и `share`.

```yaml
name: opencode

on:
  issue_comment:
    types: [created]
  pull_request_review_comment:
    types: [created]
  pull_request:
    types: [opened, ready_for_review]

jobs:
  comment:
    if: |
      github.event_name != 'pull_request' &&
      (contains(github.event.comment.body, '/oc') ||
       contains(github.event.comment.body, '/opencode'))
    runs-on: ubuntu-latest
    timeout-minutes: 15
    permissions:
      id-token: write
    steps:
      - uses: actions/checkout@v7
        with:
          fetch-depth: 1
          persist-credentials: false
      - uses: anomalyco/opencode/github@latest
        env:
          OPENCODE_API_KEY: ${{ secrets.OPENCODE_API_KEY }}
        with:
          model: opencode/deepseek-v4-flash-free
          share: false

  review:
    if: |
      github.event_name == 'pull_request' &&
      github.event.pull_request.draft == false &&
      github.event.pull_request.head.repo.full_name == github.repository
    runs-on: ubuntu-latest
    timeout-minutes: 15
    permissions:
      id-token: write
    steps:
      - uses: actions/checkout@v7
        with:
          persist-credentials: false
      - uses: anomalyco/opencode/github@latest
        env:
          OPENCODE_API_KEY: ${{ secrets.OPENCODE_API_KEY }}
        with:
          model: opencode/deepseek-v4-flash-free
          share: false
          prompt: |
            Сделай ревью этого pull request на русском языке: корректность,
            соответствие правилам репозитория из AGENTS.md затронутых зон,
            риски. Только комментарий — не пушь коммиты и не открывай PR.
```

Отличия от примера документации и их причины:

1. **`actions/checkout@v7`** вместо `@v6` — версия, на которой уже стоит `ci.yml`.
2. **`timeout-minutes: 15`** — как в обоих job'ах `ci.yml`; зависший прогон агента иначе занимает
   раннер до штатных шести часов.
3. **`share: false`** — вход `share` по умолчанию `true` **для публичных репозиториев**,
   то есть транскрипт каждой сессии публиковался бы по share-ссылке OpenCode. Код и так открыт,
   секреты в логе маскируются, но публикация наружу выбирается явно, а не достаётся по умолчанию.
4. **`github.event.pull_request.draft == false`** — авто-ревью не трогает черновики. PR, открытый
   как draft, порождает `opened` с `draft: true` и отсеивается; ревью приходит на
   `ready_for_review`, когда владелец снял черновик.
5. **`head.repo.full_name == github.repository`** — на `pull_request` из форка GitHub не передаёт
   секреты workflow'у, `OPENCODE_API_KEY` приехал бы пустым и job падал бы на каждом чужом PR.
   Комментариев это не касается: `issue_comment` исполняется в контексте базового репозитория
   и секреты видит, поэтому `/oc` в форк-PR продолжает работать.
6. **`types: [opened, ready_for_review]` без `synchronize`** — переревью на каждый push
   на длинном PR даёт столбец комментариев агента; повторное ревью после правок запрашивается
   комментарием `/oc`, механизм для этого всё равно есть.
7. **OIDC в обоих job'ах.** Документация в примере авто-ревью использует `use_github_token: true`
   со встроенным `GITHUB_TOKEN`; при установленном App это лишний способ делать то же самое.
   Если обмен OIDC на событии `pull_request` не сработает, откат известен и локален:
   `use_github_token: true` плюс `contents/pull-requests/issues: write` в job'е `review`.

Фильтра по автору комментария нет — решение владельца от 2026-08-30, принятое после разбора
риска: на публичном репозитории `/oc` доступен любому пользователю GitHub, и текст его
комментария попадает агенту как промпт. Риск ограничен бесплатной моделью и правами App.
Возврат фильтра — одно условие `github.event.comment.author_association == 'OWNER'` в job'е
`comment`.

Ключ провайдера в репозиторий не попадает: он лежит в Actions secrets, GitHub подставляет его
в env раннера на время job'а и маскирует в логах, а в git-дереве остаётся только строка
`${{ secrets.OPENCODE_API_KEY }}`. Локальный `.opencode/` к этому отношения не имеет.

`anomalyco/opencode/github@latest` остаётся неприпиненным, как в документации: сторонний action
обновляется без нашего участия — цена за то, чтобы не следить за его версиями вручную.

Дом факта «какие workflow есть в репозитории» один — блок дерева в `docs/architecture.md`
(строки 159–161, где перечислены `hexlet-check.yml`, `ci.yml` и `release-please.yml`);
`infra/README.md` про CI не пишет, дублировать перечень туда нельзя.

Отвергнутые альтернативы: **`use_github_token: true` вместо App** — проще (App ставить не надо),
но не выполняет требование задания про GitHub App, и агент комментировал бы от `github-actions[bot]`;
**отдельный `opencode-review.yml`** — дублирует env, модель и `share` во втором файле;
**расширение на `schedule` и `issues`** — за рамками требования, а на публичном репозитории без
фильтра автора умножает поверхность запуска.

## Чеклист

| ID | Цель / проблема | Решение | Состояние |
|---|---|---|---|
| P01 | Ни App, ни ключа провайдера у репозитория нет | Владелец ставит GitHub App `opencode-agent` на `dimitro-dev/ai-for-developers-project-387` (браузерный шаг, API для установки App нет) и вводит ключ OpenCode Zen; ключ кладётся в секрет `OPENCODE_API_KEY` через `gh secret set` — в транскрипт сессии он не попадает. Проверка: `gh secret list` показывает `OPENCODE_API_KEY` | завершено |
| P02 | Агент не вызывается из GitHub | `.github/workflows/opencode.yml` по решению выше: job `comment` на `issue_comment` и `pull_request_review_comment`, job `review` на `pull_request` с отсевом draft и форков. `hexlet-check.yml` не затрагивается | завершено |
| P03 | Дерево репозитория в `docs/architecture.md` не знает про новый workflow | Строка про `opencode.yml` в блоке `.github/workflows/` рядом с `ci.yml` и `release-please.yml` | завершено |
| P04 | Авто-ревью и обмен OIDC на событии `pull_request` не проверены | PR с P02–P03 открывается не-draft и служит проверкой самому себе: job `review` обязан стартовать на нём. `gh run view` — job зелёный, комментарий агента в PR. При отказе OIDC — откат на `use_github_token: true` в этом job'е, зафиксировать в результате | выполняется |
| P05 | Комментарийный триггер не проверен; до merge он не работает в принципе | После merge PR в `master`: `gh issue create` — публичный тестовый issue с нейтральным текстом про сам эксперимент; `gh issue comment` с `/oc explain this issue`; `gh run list --workflow=opencode.yml` и `gh run view --log`; `gh issue view --comments` — ответ агента от имени App. Это приёмка задания | в плане |
| P06 | Гейты | `make -C infra gates` (зона своих проверок не имеет) и полный `make gates` из корня перед `task approve infra/010 result`; из корневого набора новый файл задевает только `lint-docs` | в плане |

## Результат и проверки
