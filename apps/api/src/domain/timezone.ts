// Примитивы перевода локального времени владельца в instant и обратно (Р6).
// Temporal в Node 26 недоступен, внешняя библиотека не добавляется: нужны ровно
// три операции, и все они локализованы в этом файле.

import type { LocalDateTime } from './model.ts';

interface ZonedParts extends LocalDateTime {
  second: number;
}

// Создание Intl.DateTimeFormat дороже самого форматирования, а candidateSlots
// вызывает его сотни раз на запрос — формат на зону кэшируется.
const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  const cached = formatters.get(timeZone);
  if (cached !== undefined) return cached;
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  formatters.set(timeZone, formatter);
  return formatter;
}

function zonedPartsOf(instant: Date, timeZone: string): ZonedParts {
  const parts = formatterFor(timeZone).formatToParts(instant);
  const values = new Map<string, string>();
  for (const part of parts) values.set(part.type, part.value);
  return {
    year: Number(values.get('year')),
    month: Number(values.get('month')),
    day: Number(values.get('day')),
    hour: Number(values.get('hour')),
    minute: Number(values.get('minute')),
    second: Number(values.get('second')),
  };
}

/**
 * Смещение зоны в момент `instant`: разница между локальными частями, прочитанными
 * как UTC, и самим instant'ом. Секунды самого instant'а отбрасываются — formatToParts
 * не отдаёт миллисекунды.
 */
function zoneOffsetMs(instant: Date, timeZone: string): number {
  const parts = zonedPartsOf(instant, timeZone);
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  const truncated = Math.floor(instant.getTime() / 1000) * 1000;
  return asUtc - truncated;
}

export function localPartsOf(instant: Date, timeZone: string): LocalDateTime {
  const parts = zonedPartsOf(instant, timeZone);
  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour,
    minute: parts.minute,
  };
}

/**
 * Instant, соответствующий локальному времени владельца.
 *
 * Двухпроходный алгоритм: первое смещение даёт кандидата, второе уточняет его на
 * границе перехода. Затем round-trip: если обратное форматирование не совпало с
 * запрошенным локальным временем, такого времени в этой зоне не существует
 * (весенний переход) и функция возвращает `null`. На неоднозначном локальном времени
 * (осенний переход) выбирается более раннее, до-переходное смещение.
 */
export function instantOfLocal(local: LocalDateTime, timeZone: string): Date | null {
  const naive = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute, 0);
  const firstGuess = new Date(naive - zoneOffsetMs(new Date(naive), timeZone));
  const candidate = new Date(naive - zoneOffsetMs(firstGuess, timeZone));

  const roundTrip = localPartsOf(candidate, timeZone);
  if (
    roundTrip.year !== local.year ||
    roundTrip.month !== local.month ||
    roundTrip.day !== local.day ||
    roundTrip.hour !== local.hour ||
    roundTrip.minute !== local.minute
  ) {
    return null;
  }
  return candidate;
}

/**
 * Семантическая проверка зоны (V4): regex контракта пропускает структурно верные,
 * но несуществующие идентификаторы вида `Foo/Bar`, на которых Intl бросает RangeError.
 */
export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}
