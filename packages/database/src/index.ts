// Публичный вход пакета: потребители импортируют `@minical/database`, не внутренние модули.

export { MIGRATIONS_DIR, runMigrations } from './migrations.ts';
export type { MigrationResult } from './migrations.ts';

/**
 * Имя exclusion constraint из `migrations/001_initial-schema.sql`. Экспортируется потому, что на
 * него завязан перевод отказа в 409 на стороне API: разъехавшись с миграцией, имя превратило бы
 * штатную гонку двух гостей в 500.
 */
export const BOOKINGS_NO_OVERLAP_CONSTRAINT = 'bookings_no_overlap';
