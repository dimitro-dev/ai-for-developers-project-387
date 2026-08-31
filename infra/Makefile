include ../make/common.mk

# Тот же файл переопределений, что читает compose (`-` — его может не быть): без него цели
# db-* собирали бы строку подключения из своих дефолтов и стучались бы в чужую базу, тогда как
# контур поднят с другими POSTGRES_*. Для db-test это не мелочь — набор начинается с DROP TABLE.
-include .env

COMPOSE := docker compose -f compose.yml

# Образ приложения. Порт совпадает с дефолтом config.ts: внутри контейнера и на хосте он один
# и тот же, иначе проброс пришлось бы задавать двумя переменными.
IMAGE ?= minical
PORT ?= 3001
# Порт входит в имя контейнера: с фиксированным именем два прогона на разных портах подрались бы
# за него, хотя мешать друг другу им нечем.
CONTAINER ?= $(IMAGE)-$(PORT)
# Единственная переменная окружения, дефолт которой цель обязана держать сама. Дефолт config.ts —
# `http://localhost:8081`, адрес dev-сервера Expo, — для запуска из образа неверен всегда:
# гостевую половину раздаёт тот же процесс, и живёт она на том же порту, что и API.
PUBLIC_WEB_URL ?= http://localhost:$(PORT)

# Параметры контура: дефолты те же, что подставляет compose.yml, но заданные в .env выше
# побеждают — цель обязана смотреть в ту базу, которая реально поднята.
POSTGRES_USER ?= minical
POSTGRES_PASSWORD ?= minical
POSTGRES_DB ?= minical
POSTGRES_TEST_DB ?= minical_test
POSTGRES_PORT ?= 5432

# Строки подключения собираются из тех же параметров. Рабочая база и база тестов разные:
# прогон тестов чистит схему целиком.
DATABASE_URL ?= postgres://$(POSTGRES_USER):$(POSTGRES_PASSWORD)@localhost:$(POSTGRES_PORT)/$(POSTGRES_DB)
TEST_DATABASE_URL ?= postgres://$(POSTGRES_USER):$(POSTGRES_PASSWORD)@localhost:$(POSTGRES_PORT)/$(POSTGRES_TEST_DB)

# Версия аудитора прибита здесь: пакета нет в lockfile — он вызывается разово и качается на
# запуск, — поэтому единственное место, где версия зафиксирована, это строка команды.
LHCI_VERSION ?= 0.15.1

typecheck: ## Проверять нечего: зона не содержит TypeScript
	@:

test: ## Запускать нечего: контур проверяется job compose в CI
	@:

gates: ## Проверок зоны нет: валидация compose требует Docker и вынесена в CI
	@:

up: ## Поднять контур и дождаться healthy
	$(COMPOSE) up -d --wait

# Сервис приложения спрятан за профилем `app`, поэтому подъём полного контура — отдельная цель:
# подъём базы не должен тянуть сборку образа. Остановка, сброс и валидация, наоборот, обязаны
# видеть оба сервиса — иначе `down` оставил бы приложение работать, а `config` не проверил бы его.
up-app: ## Поднять полный контур (postgres + api) и дождаться healthy
	$(COMPOSE) --profile app up -d --build --wait

down: ## Остановить контур, сохранив данные
	$(COMPOSE) --profile app down

logs: ## Читать логи PostgreSQL
	$(COMPOSE) logs -f postgres

reset: ## Остановить контур и удалить volume с данными
	$(COMPOSE) --profile app down -v

config: ## Проверить конфигурацию compose без запуска
	$(COMPOSE) --profile app config -q

# Значения в кавычках: в строке подключения легально встречается спецсимвол оболочки.
db-migrate: ## Применить миграции к базе (DATABASE_URL=postgres://minical:minical@localhost:5432/minical)
	$(RUN) DATABASE_URL='$(DATABASE_URL)' node $(REPO_ROOT)/packages/database/src/cli.ts

# Зоны перечислены обе: БД-наборы обеих читают одну переменную, и без неё молча скипаются —
# запускать их по отдельности значило бы забыть половину проверки.
db-test: ## Прогнать БД-тесты зон database и api против контура (TEST_DATABASE_URL=...minical_test)
	$(RUN) TEST_DATABASE_URL='$(TEST_DATABASE_URL)' $(MAKE) -C $(REPO_ROOT)/packages/database test
	$(RUN) TEST_DATABASE_URL='$(TEST_DATABASE_URL)' $(MAKE) -C $(REPO_ROOT)/apps/api test

image-build: ## Собрать образ приложения (IMAGE=minical)
	docker build -t $(IMAGE) $(REPO_ROOT)

# PORT и PUBLIC_WEB_URL передаются всегда — их дефолты держит цель (см. выше). SEED_DEMO
# передаётся только заданным: пустое значение и отсутствие переменной для конфига API — разные
# вещи, и дефолт по нему остаётся за ним. Значения в кавычках: в адресе легально встречается
# `&`, который иначе разорвал бы рецепт.
# Проверка образа отдельным шагом: без неё docker молча полез бы за `latest` в реестр.
image-run: ## Запустить образ (PORT=3001, PUBLIC_WEB_URL, SEED_DEMO; контейнер minical-<PORT>)
	@docker image inspect $(IMAGE) >/dev/null 2>&1 || \
	  { echo "образ «$(IMAGE)» не собран — выполните make image-build"; exit 1; }
	docker run --rm --name $(CONTAINER) -p $(PORT):$(PORT) -e PORT=$(PORT) \
	  -e PUBLIC_WEB_URL='$(PUBLIC_WEB_URL)' \
	  $(if $(SEED_DEMO),-e SEED_DEMO='$(SEED_DEMO)') \
	  $(IMAGE)

# Аудит идёт по уже поднятому контуру: цель его не поднимает и не гасит — адрес задаётся
# переменной LHCI_BASE_URL, которую читает lighthouserc.js в корне.
# Прогон из корня обязателен: конфиг lhci ищет только в текущем каталоге, вверх по дереву не
# поднимается (`healthcheck` из этой зоны отвечает «Configuration file not found»), и туда же,
# в текущий каталог, кладёт .lighthouseci/ — путь артефакта в CI и строка .gitignore корневые.
lighthouse: ## Прогнать Lighthouse по поднятому контуру, отчёт в .lighthouseci/
	cd $(REPO_ROOT) && npx --yes @lhci/cli@$(LHCI_VERSION) autorun

# Медиана прогона — строка с isRepresentativeRun; остальные запуски того же URL в сводку
# не попадают.
lighthouse-report: ## Markdown-сводка последнего прогона в stdout
	@if [ ! -f $(REPO_ROOT)/.lighthouseci/manifest.json ]; then \
	  echo "Отчёт не сформирован: прогон не дошёл до записи manifest.json"; \
	else \
	  echo "| URL | Perf | A11y | BP | SEO |"; \
	  echo "|---|---|---|---|---|"; \
	  jq -r '.[] | select(.isRepresentativeRun) | "| \(.url) | \(.summary.performance*100|round) | \(.summary.accessibility*100|round) | \(.summary["best-practices"]*100|round) | \(.summary.seo*100|round) |"' $(REPO_ROOT)/.lighthouseci/manifest.json; \
	fi

.PHONY: typecheck test gates up up-app down logs reset config db-migrate db-test image-build image-run \
        lighthouse lighthouse-report
