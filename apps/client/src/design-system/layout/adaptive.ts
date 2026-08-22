/**
 * Правило раскладки из UX rules экранов каталога и слотов (ADR §10).
 *
 * Это не токены: таких значений в ките нет, и в `tokens.ts` им не место. Отдельных экранов или
 * platform-файлов под web тоже нет — адаптив выражается шириной окна, а не платформой.
 */

/** Максимальная ширина контента; шире окно — контент центрируется. */
export const CONTENT_MAX_WIDTH = 760;

/** Порог, с которого карточки каталога раскладываются в две колонки. */
export const TWO_COLUMN_MIN_WIDTH = 768;

/** Две колонки карточек допустимы только на широком окне. */
export function isWideLayout(windowWidth: number): boolean {
  return windowWidth >= TWO_COLUMN_MIN_WIDTH;
}
