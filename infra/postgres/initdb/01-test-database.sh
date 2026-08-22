#!/bin/bash
# Создаёт вторую базу — для проверок back/002, чтобы они не разрушали данные разработки.
# Штатный entrypoint образа создаёт только POSTGRES_DB.
#
# Каталог /docker-entrypoint-initdb.d/ отрабатывает ТОЛЬКО при инициализации пустого каталога
# данных: на существующем volume правка этого файла ничего не изменит — нужна цель `make db-reset`.
set -euo pipefail

test_db="${POSTGRES_TEST_DB:-minical_test}"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
	CREATE DATABASE "$test_db" OWNER "$POSTGRES_USER";
EOSQL

echo "initdb: создана база $test_db"
