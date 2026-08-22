/**
 * Helpers `@/features/event-types/lib` из `components.registry.xml`.
 */

const MINUTES_IN_HOUR = 60;

/** Число акцентов палитры (`$color.accent.1 … $color.accent.6`). */
export const ACCENT_COUNT = 6;

/**
 * Читаемая длительность встречи: «30 минут», «1 час», «1 час 30 минут».
 * Кадр 1 макета показывает «60 минут», но registry задаёт «1 час» — при расхождении
 * текст спеки приоритетнее пикселей макета (MANUAL §3).
 */
export function durationLabel(durationMinutes: number): string {
  const hours = Math.floor(durationMinutes / MINUTES_IN_HOUR);
  const minutes = durationMinutes % MINUTES_IN_HOUR;

  if (hours === 0) {
    return `${minutes} ${pluralRu(minutes, 'минута', 'минуты', 'минут')}`;
  }

  const hoursPart = `${hours} ${pluralRu(hours, 'час', 'часа', 'часов')}`;
  if (minutes === 0) {
    return hoursPart;
  }
  return `${hoursPart} ${minutes} ${pluralRu(minutes, 'минута', 'минуты', 'минут')}`;
}

/**
 * Индекс акцентного цвета плитки типа встречи: 32-битный FNV-1a от `EventType.id` по модулю 6.
 * Один id всегда даёт один индекс; результат не зависит ни от порядка элементов в списке,
 * ни от появления новых типов. Вызывающий код обращается к `colors.accent[index + 1]`.
 */
export function eventTypeAccentIndex(id: string): number {
  const FNV_OFFSET_BASIS = 0x811c9dc5;
  const FNV_PRIME = 0x01000193;

  let hash = FNV_OFFSET_BASIS;
  for (const byte of utf8Bytes(id)) {
    hash = (hash ^ byte) >>> 0;
    hash = Math.imul(hash, FNV_PRIME) >>> 0;
  }
  return hash % ACCENT_COUNT;
}

/**
 * UTF-8 байты строки. Явная кодировка, а не code units: `TextEncoder` в Hermes не гарантирован,
 * а хеш обязан совпадать для одинаковых id независимо от платформы.
 */
function* utf8Bytes(value: string): Generator<number> {
  for (const character of value) {
    const code = character.codePointAt(0) ?? 0;
    if (code < 0x80) {
      yield code;
    } else if (code < 0x800) {
      yield 0xc0 | (code >> 6);
      yield 0x80 | (code & 0x3f);
    } else if (code < 0x10000) {
      yield 0xe0 | (code >> 12);
      yield 0x80 | ((code >> 6) & 0x3f);
      yield 0x80 | (code & 0x3f);
    } else {
      yield 0xf0 | (code >> 18);
      yield 0x80 | ((code >> 12) & 0x3f);
      yield 0x80 | ((code >> 6) & 0x3f);
      yield 0x80 | (code & 0x3f);
    }
  }
}

/** Русская форма числительного: 1 минута, 2 минуты, 5 минут. */
function pluralRu(value: number, one: string, few: string, many: string): string {
  const mod100 = value % 100;
  if (mod100 >= 11 && mod100 <= 14) {
    return many;
  }
  const mod10 = value % 10;
  if (mod10 === 1) {
    return one;
  }
  if (mod10 >= 2 && mod10 <= 4) {
    return few;
  }
  return many;
}
