// Ручной прогон миграций (Р6): вход цели `make db-migrate`. Приложение применяет их само
// при старте, но локальному контуру и разовой правке базы нужен запуск без поднятия API.

import pg from 'pg';

import { runMigrations } from './migrations.ts';

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  // Дефолта у CLI нет намеренно: адрес базы — решение вызывающего, и молча ходить
  // в локальный контур из чужого окружения он не должен.
  console.error('DATABASE_URL не задана: укажите строку подключения, например make db-migrate');
  process.exit(1);
}

const pool = new Pool({ connectionString });
try {
  const { applied } = await runMigrations(pool);
  console.log(applied.length === 0 ? 'нет новых миграций' : `применены миграции: ${applied.join(', ')}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  // Код возврата, а не process.exit: соединения обязаны закрыться, иначе процесс
  // оборвётся посреди отката незавершённой миграции.
  process.exitCode = 1;
} finally {
  await pool.end();
}
