include ../../make/common.mk

typecheck: ## Проверить типы зоны
	$(RUN) tsc --noEmit

test: ## Тесты backend рядом с кодом
	node --test

gates: ## Проверки зоны: типы и тесты
	$(MAKE) typecheck
	$(MAKE) test

start: ## Запустить API из исходников
	node src/server.ts

dev: ## Запустить API с перезапуском по изменениям
	node --watch src/server.ts

.PHONY: typecheck test gates start dev
