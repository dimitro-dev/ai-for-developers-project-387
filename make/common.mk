# Общая часть всех Makefile репозитория: корень, PATH до бинарей npm и механика help.
# Подключается директивой include первой строкой каждого Makefile.
# Совместимо с GNU Make 3.81 (версия из macOS): без .ONESHELL, undefine и ::=.

# Корень репозитория вычисляется относительно самого common.mk, а не вызывающего Makefile.
REPO_ROOT := $(abspath $(dir $(lastword $(MAKEFILE_LIST)))..)

# Услуга, которую раньше оказывал npm run: инструменты вызываются по имени, без npx.
# Локальный .bin зоны идёт первым — у apps/client свой TypeScript, он должен побеждать корневой.
# Уже присутствующие каталоги не добавляются повторно: рецепты рекурсивно зовут $(MAKE),
# и без этой проверки один и тот же путь копился бы в PATH на каждом уровне рекурсии.
BIN_DIRS := $(if $(filter-out $(REPO_ROOT),$(CURDIR)),$(CURDIR)/node_modules/.bin) \
            $(REPO_ROOT)/node_modules/.bin
NEW_BIN_DIRS := $(foreach dir,$(BIN_DIRS),$(if $(findstring $(dir):,$(PATH)),,$(dir):))
empty :=
space := $(empty) $(empty)
export PATH := $(subst $(space),,$(NEW_BIN_DIRS))$(PATH)

# GNU Make 3.81 исполняет простой рецепт сама, минуя shell, и ищет программу в PATH, который
# унаследовала при старте: export выше на этот поиск не влияет, и прямой `make -C <зона> typecheck`
# не находит tsc. Префикс передаёт запуск программе `env`, которая PATH из окружения уважает.
# Нужен только для инструментов из node_modules/.bin; node, git, docker и python3 берутся из системы.
RUN := env

.DEFAULT_GOAL := help

help: ## Показать цели этого Makefile
	@echo "Цели ($(CURDIR)):"
	@awk 'BEGIN { FS = ":.*## " } /^[a-zA-Z0-9_.-]+:.*## / { printf "  %-16s %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

.PHONY: help
