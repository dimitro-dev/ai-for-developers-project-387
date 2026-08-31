include make/common.mk

# Зоны фан-аута вычисляются, а не перечисляются: зона с Makefile включается сама.
ZONES := $(patsubst %/Makefile,%,$(wildcard apps/*/Makefile packages/*/Makefile \
                                            infra/Makefile tests/Makefile tasks/Makefile))

GENERATED := packages/contracts/generated \
             packages/api-client/src/generated \
             packages/backend-contract/src/generated

setup: ## Установить зависимости репозитория
	npm ci

generate: ## Перегенерировать OpenAPI и generated-пакеты
	$(MAKE) -C packages/contracts build
	$(RUN) openapi-ts -f packages/api-client/openapi-ts.config.ts
	$(RUN) openapi-ts -f packages/backend-contract/openapi-ts.config.ts

generate-check: ## Перегенерировать и упасть при diff в generated (защита от drift)
	$(MAKE) generate
	git diff --exit-code -- $(GENERATED)

typecheck: ## Проверить типы во всех зонах
	@for zone in $(ZONES); do $(MAKE) -C $$zone typecheck || exit 1; done

test: uispec-validate task-check contract-test ## Проверки уровня репозитория (вход авточекера Hexlet)

contract-test: ## Контрактный гейт: точный список routes и операций
	node --experimental-strip-types tests/contract-validation.test.ts

task-check: ## Проверить целостность дерева задач и свежесть реестра
	test ! -d tasks || scripts/task check

uispec-validate: ## Проверить UISpec owner-flow и guest-flow
	python3 docs/ui-spec-kit/tools/uispec/validate_uispec.py --config docs/ui-spec-kit/uispec.config.json

lint-docs: ## Контракт размещения: сырые вызовы и существование целей make
	scripts/lint-docs

gates: ## Полный набор фазы «Проверка»: репозиторий и все зоны
	$(MAKE) lint-docs
	$(MAKE) generate-check
	$(MAKE) test
	@for zone in $(ZONES); do $(MAKE) -C $$zone gates || exit 1; done

zones: ## Показать зоны, участвующие в фан-ауте
	@for zone in $(ZONES); do echo $$zone; done

mock: ## Поднять Prism-мок контракта на порту 4010
	$(RUN) prism mock packages/contracts/generated/openapi.yaml -p 4010

db-up: ## Поднять PostgreSQL и дождаться healthy
	$(MAKE) -C infra up

db-down: ## Остановить PostgreSQL, сохранив данные
	$(MAKE) -C infra down

db-logs: ## Читать логи PostgreSQL
	$(MAKE) -C infra logs

db-reset: ## Остановить PostgreSQL и удалить volume с данными
	$(MAKE) -C infra reset

db-migrate: ## Применить миграции к базе (DATABASE_URL=postgres://minical:minical@localhost:5432/minical)
	$(MAKE) -C infra db-migrate

db-test: ## Прогнать БД-тесты против контура (TEST_DATABASE_URL=...minical_test)
	$(MAKE) -C infra db-test

image-build: ## Собрать образ приложения (IMAGE=minical)
	$(MAKE) -C infra image-build

image-run: ## Запустить приложение из образа (PORT=3001, PUBLIC_WEB_URL, SEED_DEMO)
	$(MAKE) -C infra image-run

lighthouse: ## Прогнать Lighthouse по поднятому контуру, отчёт в .lighthouseci/
	$(MAKE) -C infra lighthouse

lighthouse-report: ## Markdown-сводка последнего прогона Lighthouse в stdout
	$(MAKE) -C infra lighthouse-report

.PHONY: setup generate generate-check typecheck test contract-test task-check uispec-validate \
        lint-docs gates zones mock db-up db-down db-logs db-reset db-migrate db-test \
        image-build image-run lighthouse lighthouse-report
