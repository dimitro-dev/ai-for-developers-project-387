// Конфигурация из окружения (FR8, Р10). process.env читается только здесь и только в
// момент вызова: обработчики env не читают, иначе тесты зависели бы от окружения.

export interface AppConfig {
  port: number;
  /** Канонический публичный адрес гостевой половины → `publicUrl` в owner-ответах настроек. */
  publicWebUrl: string;
  /** Наполнять ли пустое хранилище демо-календарём на старте (`SEED_DEMO`), по умолчанию нет. */
  seedDemo: boolean;
  /**
   * Строка подключения к PostgreSQL (`DATABASE_URL`); `null` — режим in-memory (Р2). Мусорное
   * значение отказывает старт, а не откатывает в память тихо: переменную задают там, где данные
   * обязаны пережить рестарт, и молчаливый эфемерный режим означал бы их потерю без единой строки
   * в логах.
   */
  databaseUrl: string | null;
}

const DEFAULT_PORT = 3001;
const DEFAULT_PUBLIC_WEB_URL = 'http://localhost:8081';

/**
 * Мусорное значение — отказ старта, а не тихий откат к дефолту: это адрес, который
 * владелец раздаёт гостям, и отдаётся он полем `publicUrl` в owner-ответах настроек
 * (`CalendarSettingsResponse`); самим гостям поле не отдаётся вовсе. Подмена всплыла бы
 * не здесь, а у того, кто прошёл по ссылке.
 * Бросает `Error`; `server.ts` печатает сообщение и завершает процесс.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return {
    port: parsePort(env.PORT),
    publicWebUrl: parsePublicWebUrl(env.PUBLIC_WEB_URL),
    seedDemo: parseSeedDemo(env.SEED_DEMO),
    databaseUrl: parseDatabaseUrl(env.DATABASE_URL),
  };
}

function parsePort(raw: string | undefined): number {
  if (raw === undefined || raw === '') return DEFAULT_PORT;
  // Форма проверяется до `Number()`: тот принимает `0x10`, `1e3` и `+3001` и молча
  // отдаёт другое число вместо отказа — порт слушают не тот, который задавали.
  // Обрамляющие пробелы прощаются: платформы и `.env`-файлы их добавляют сами.
  const value = raw.trim();
  const port = /^\d+$/.test(value) ? Number(value) : Number.NaN;
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`PORT must be an integer in 1..65535, got "${raw}"`);
  }
  return port;
}

function parsePublicWebUrl(raw: string | undefined): string {
  if (raw === undefined || raw === '') return DEFAULT_PUBLIC_WEB_URL;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`PUBLIC_WEB_URL must be an absolute http(s) URL, got "${raw}"`);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`PUBLIC_WEB_URL must use http or https, got "${raw}"`);
  }
  return raw;
}

/**
 * Список принимаемых написаний закрыт намеренно: `yes`, `on` или `True` — не
 * синонимы, а признак того, что окружение задано наугад, и молча стартовать без
 * сида (или с ним) хуже, чем отказать с перечислением допустимых значений.
 */
function parseSeedDemo(raw: string | undefined): boolean {
  if (raw === undefined || raw === '' || raw === '0' || raw === 'false') return false;
  if (raw === '1' || raw === 'true') return true;
  throw new Error(`SEED_DEMO must be one of "1", "true", "0", "false", got "${raw}"`);
}

/**
 * Отсутствие переменной — осознанный in-memory режим, а вот заданная строка обязана быть
 * рабочей: опечатка в схеме или обрезанное значение иначе увели бы процесс в память с
 * настроенной персистентностью. Проверяется только форма — доступность базы выясняет
 * первое подключение на старте, и её отказ тоже завершает процесс (Р2).
 * Значение в сообщение об ошибке не попадает, в отличие от остальных переменных: строка
 * подключения содержит пароль, а сообщение уходит в лог старта.
 * Обрамляющие пробелы прощаются и обрезаются: платформы и `.env`-файлы их добавляют сами.
 */
function parseDatabaseUrl(raw: string | undefined): string | null {
  if (raw === undefined || raw === '') return null;
  const value = raw.trim();
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('DATABASE_URL must be an absolute postgres:// or postgresql:// URL');
  }
  if (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:') {
    throw new Error('DATABASE_URL must be an absolute postgres:// or postgresql:// URL');
  }
  return value;
}
