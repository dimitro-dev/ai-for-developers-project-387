# infra — build, runtime и CI

Зона `infra/` отвечает за воспроизводимый build, локальный runtime, Android artifact и CI-интерфейс
проекта. Состав контура, установка провайдера, запуск и сброс данных — в [`README.md`](README.md);
код без задачи, которая это предусматривает, здесь не появляется.

## Читать

```text
корневой AGENTS.md
согласованные документы активной задачи (гейты — в её task.yaml; см. tasks/AGENTS.md)
plan.md активной задачи
infra/README.md — фактическое устройство контура и его эксплуатация
docs/architecture.md
docs/contract-pipeline.md — если меняется generation build
```

## Разрешено менять

```text
infra/**
Dockerfile*
.dockerignore — парный Dockerfile файл, лежит с ним рядом в корне репозитория
compose*.yml
корневой Makefile и make/common.mk — цели generate/generate-check совместно
                                     с зоной packages/contracts/
корневой Makefile — делегаты целей зоны (db-*, image-*) принадлежат ей целиком:
                    строка команды живёт в infra/Makefile, в корне только вызов
CI configuration — кроме .github/workflows/hexlet-check.yml
environment examples
состояние своего пункта в plan.md
infrastructure-раздел активного result.md
```

`.github/workflows/hexlet-check.yml` — внешний генерируемый чек учебной платформы. В его шапке стоит
`DO NOT DELETE OR EDIT THIS FILE`; редактирование, удаление и переименование репозитория ломают
проверку. Свой CI добавляется отдельным workflow-файлом, а не правкой этого.

## Обязан

Ниже — целевое состояние зоны целиком; закрывается по частям, отдельными задачами (статус — в
Definition of Done).

- поднимать web, API и PostgreSQL через Docker Compose (PostgreSQL — `infra/001`; `api` — сделано
  `back/002`, за профилем `app`; отдельного сервиса `web` нет — оба бандла раздаёт тот же процесс);
- использовать multi-stage builds там, где уместно;
- добавить healthchecks и dependency readiness (для `postgres` и `api` — сделано);
- хранить config/secrets в environment, не в images;
- обеспечить воспроизводимый TypeSpec/codegen build;
- поддержать Android builder как build-time image (`infra/002`);
- сохранять APK в документированный artifact path;
- учитывать, что Android Emulator работает на host;
- оставлять iOS build macOS/Xcode toolchain-у.

## Запрещено

- менять API или бизнес-правила ради удобства инфраструктуры;
- пытаться запускать iOS toolchain в Linux container;
- публиковать admin API без auth как production-safe сервис;
- встраивать secrets в repository или image;
- вводить Redis, worker или новый runtime-сервис без отдельной задачи и решения в ADR;
- редактировать, удалять или переименовывать `.github/workflows/hexlet-check.yml`;
- ставить `согласовано` самовольно: правило 11 корневого [`AGENTS.md`](../AGENTS.md), фиксация —
  только `scripts/task approve` после явного подтверждения владельца.

## При недостающем решении

Если runtime-топология, порядок запуска или способ доставки артефакта не зафиксированы
в согласованных документах активной задачи, не выбирай их молча: зафиксируй блокирующий пункт
в `plan.md` и верни соответствующий гейт в `черновик` — `scripts/task draft <id> <гейт>`, правила
каскада — в [`tasks/flows/full.md`](../tasks/flows/full.md).

Решения задач, которые расширяют контур, зона не принимает за них. Форму строки подключения
и момент применения миграций выбрала своим ADR `back/002`: `DATABASE_URL` целиком, миграции
применяет сам процесс API на старте — контур их не предопределял, он лишь предоставляет параметры
`POSTGRES_*`, порт и имя базы. Что именно добавляется в контур дальше и какой задачей —
в [`README.md`](README.md), раздел «Расширение контура».

## Definition of Done

Целевое состояние зоны целиком, закрывается по частям — ниже отмечено, что уже сделано и чем.

- build воспроизводится из чистого checkout — в контуре появилась сборка образа `api` из корневого
  `Dockerfile` (`back/002`); `postgres` использует официальный образ `postgres:18`;
- `make -C infra up` поднимает контур до healthy — для `postgres` сделано в `infra/001`, сервис
  `api` со сборкой образа — в `back/002` (`make -C infra up-app`, профиль `app`);
- healthchecks проходят — для `postgres` и `api` сделано;
- migrations/startup order документированы — сделано `back/002`: миграции применяет процесс API
  на старте, порядок описан в [`README.md`](README.md);
- Android builder создаёт APK artifact — `infra/002`;
- smoke test и применимые CI checks проходят — сделано: job `compose` в `ci.yml` поднимает
  `postgres` и обязательным шагом гоняет против него `make db-test`;
- пункт плана и infrastructure-раздел `result.md` обновлены.
