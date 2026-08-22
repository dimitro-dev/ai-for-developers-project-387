include ../../make/common.mk

typecheck: ## Проверить типы зоны
	$(RUN) tsc --noEmit

test: ## Тесты зоны рядом с кодом; без TEST_DATABASE_URL БД-набор пропускается
	node --test

gates: ## Проверки зоны: типы и тесты
	$(MAKE) typecheck
	$(MAKE) test

.PHONY: typecheck test gates
