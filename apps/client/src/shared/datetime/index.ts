/**
 * Helpers `@/shared/datetime` из `components.registry.xml`.
 *
 * Правила модуля (ADR §8):
 * - форматирование — только `Intl`, без date-библиотек;
 * - IANA-timezone приходит **явным параметром**: тестируемость не зависит от TZ окружения;
 *   значение `$system.timeZone` спеков даёт `guestTimeZone()`;
 * - клиент не занимается арифметикой поясов и не вычисляет `endAtUtc` — только форматирует
 *   UTC-моменты, посчитанные сервером;
 * - локаль подписей — `ru-RU` (язык продукта, i18n вне MVP).
 */

const LOCALE = 'ru-RU';

/** Значение `$system.timeZone` спеков: timezone устройства гостя. */
export function guestTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/**
 * Календарная дата `YYYY-MM-DD`, на которую попадает UTC-момент в указанной timezone.
 * В registry не значится: это внутренний примитив модуля, на нём стоят `availableDates`
 * и `slotsOnDate` из `@/features/slots/lib`.
 */
export function calendarDate(atUtc: string, timeZone: string): string {
  const parts = dateParts(new Date(atUtc), timeZone);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

/** Время «HH:mm» момента `atUtc` в timezone гостя. */
export function timeLabel(atUtc: string, timeZone: string): string {
  // hourCycle h23, а не hour12: false — иначе полночь части локалей форматируется как «24:00».
  return new Intl.DateTimeFormat(LOCALE, {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(atUtc));
}

/** Дата момента `atUtc` в timezone гостя — «31 июля 2026» (строка кадра 7). */
export function dateLabel(atUtc: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat(LOCALE, {
    timeZone,
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).formatToParts(new Date(atUtc));
  // Сборка по частям, а не `format()`: ru-RU добавляет к году « г.», которого на кадре нет.
  return `${partValue(parts, 'day')} ${partValue(parts, 'month')} ${partValue(parts, 'year')}`;
}

/**
 * Короткая подпись дня недели календарной даты — «Пт» (верхняя строка чипа даты).
 * Внутренний примитив модуля: в registry значится собирающий его `availableDates`.
 */
export function weekdayShortLabel(date: string): string {
  const parts = new Intl.DateTimeFormat(LOCALE, {
    timeZone: 'UTC',
    weekday: 'short',
  }).formatToParts(new Date(`${date}T00:00:00Z`));
  return capitalize(partValue(parts, 'weekday'));
}

/** Число месяца календарной даты — «31» (нижняя строка чипа даты). */
export function dayNumberLabel(date: string): string {
  return new Intl.DateTimeFormat(LOCALE, { timeZone: 'UTC', day: 'numeric' }).format(
    new Date(`${date}T00:00:00Z`),
  );
}

/**
 * Полная подпись календарной даты `YYYY-MM-DD` — «Пятница, 31 июля».
 * Аргумент уже календарная дата, а не момент: timezone здесь не нужна и не участвует.
 */
export function fullDateLabel(date: string): string {
  const parts = new Intl.DateTimeFormat(LOCALE, {
    timeZone: 'UTC',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).formatToParts(new Date(`${date}T00:00:00Z`));
  const weekday = partValue(parts, 'weekday');
  return `${capitalize(weekday)}, ${partValue(parts, 'day')} ${partValue(parts, 'month')}`;
}

/** Одна группа встреч владельца по календарной дате (registry `groupBookingsByOwnerDate`). */
export interface OwnerBookingGroup<T> {
  id: string;
  title: string;
  bookings: T[];
}

/**
 * Группировка встреч владельца по календарной дате в его timezone; группы идут по возрастанию
 * даты, встречи внутри группы — по возрастанию `startAt` (UX rules спеки 05).
 *
 * Дженерик `T` вместо контрактного `BookingView` из registry: owner view-model
 * (`features/owner/model`, `front/owner/001` P13) на момент этого хелпера ещё не определена, а
 * `shared/datetime` не должен получать зависимость от feature-модулей. Ограничение
 * `{ startAt: string }` — то же поле, которым uispec-модель `BookingView` называет
 * `Booking.startAtUtc` (спеки 05 и 11), поэтому реальная `BookingView` подходит под дженерик без
 * адаптеров.
 */
export function groupBookingsByOwnerDate<T extends { startAt: string }>(
  bookings: readonly T[],
  timeZone: string,
): OwnerBookingGroup<T>[] {
  const sorted = [...bookings].sort((left, right) =>
    left.startAt < right.startAt ? -1 : left.startAt > right.startAt ? 1 : 0,
  );

  const groups = new Map<string, T[]>();
  for (const booking of sorted) {
    const date = calendarDate(booking.startAt, timeZone);
    const bucket = groups.get(date);
    if (bucket) {
      bucket.push(booking);
    } else {
      groups.set(date, [booking]);
    }
  }

  return [...groups.keys()]
    .sort()
    .map((date) => ({ id: date, title: fullDateLabel(date), bookings: groups.get(date) ?? [] }));
}

/** Подпись выбранного слота — «31 июля · 10:00–10:30». Конец встречи считает сервер. */
export function formattedSlot(startAtUtc: string, endAtUtc: string, timeZone: string): string {
  const start = new Date(startAtUtc);
  const parts = new Intl.DateTimeFormat(LOCALE, {
    timeZone,
    day: 'numeric',
    month: 'long',
  }).formatToParts(start);
  const day = `${partValue(parts, 'day')} ${partValue(parts, 'month')}`;
  return `${day} · ${timeLabel(startAtUtc, timeZone)}–${timeLabel(endAtUtc, timeZone)}`;
}

/** Подпись смещения timezone на текущую дату — «UTC+02:00». */
export function formatUtcOffset(timeZone: string, at: Date = new Date()): string {
  const minutes = offsetMinutes(at, timeZone);
  const sign = minutes < 0 ? '-' : '+';
  const absolute = Math.abs(minutes);
  const hours = Math.floor(absolute / 60);
  return `UTC${sign}${pad2(hours)}:${pad2(absolute % 60)}`;
}

interface DateParts {
  year: string;
  month: string;
  day: string;
  hour: string;
  minute: string;
  second: string;
}

/**
 * Разбор момента на компоненты стенных часов указанной timezone.
 * `timeZoneName: 'longOffset'` намеренно не используется: на Hermes набор Intl урезан,
 * а компоненты даты доступны везде.
 */
function dateParts(at: Date, timeZone: string): DateParts {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(at);

  return {
    year: partValue(parts, 'year'),
    month: partValue(parts, 'month'),
    day: partValue(parts, 'day'),
    hour: partValue(parts, 'hour'),
    minute: partValue(parts, 'minute'),
    second: partValue(parts, 'second'),
  };
}

/** Смещение timezone от UTC в минутах: разница стенных часов зоны и того же момента в UTC. */
function offsetMinutes(at: Date, timeZone: string): number {
  const parts = dateParts(at, timeZone);
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  // Секунды исходного момента отбрасываются вместе с миллисекундами — смещения зон кратны минуте.
  return Math.round((asUtc - Math.floor(at.getTime() / 1000) * 1000) / 60_000);
}

function partValue(parts: readonly Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): string {
  return parts.find((part) => part.type === type)?.value ?? '';
}

function capitalize(value: string): string {
  return value.length === 0 ? value : `${value[0].toUpperCase()}${value.slice(1)}`;
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}
