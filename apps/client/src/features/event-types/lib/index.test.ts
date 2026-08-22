import {
  ACCENT_COUNT,
  durationLabel,
  eventTypeAccentIndex,
} from '@/features/event-types/lib';

describe('durationLabel', () => {
  it('форматирует минуты с русским числительным', () => {
    expect(durationLabel(30)).toBe('30 минут');
    expect(durationLabel(1)).toBe('1 минута');
    expect(durationLabel(2)).toBe('2 минуты');
    expect(durationLabel(45)).toBe('45 минут');
    expect(durationLabel(11)).toBe('11 минут');
  });

  it('переводит целые часы в часы', () => {
    expect(durationLabel(60)).toBe('1 час');
    expect(durationLabel(120)).toBe('2 часа');
    expect(durationLabel(300)).toBe('5 часов');
  });

  it('смешанную длительность собирает из часов и минут', () => {
    expect(durationLabel(90)).toBe('1 час 30 минут');
    expect(durationLabel(135)).toBe('2 часа 15 минут');
  });
});

describe('eventTypeAccentIndex', () => {
  it('всегда попадает в диапазон палитры', () => {
    for (const id of ['consultation', 'product-review', 'x', 'демо-встреча', '']) {
      const index = eventTypeAccentIndex(id);
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(ACCENT_COUNT);
      expect(Number.isInteger(index)).toBe(true);
    }
  });

  // AC1: один и тот же id всегда даёт один и тот же акцент, независимо от порядка в списке.
  it('детерминирован и не зависит от порядка и соседей', () => {
    const catalog = ['consultation', 'product-review', 'demo'];
    const shuffled = ['demo', 'consultation', 'product-review', 'новый-тип'];

    const first = catalog.map(eventTypeAccentIndex);
    const second = shuffled.filter((id) => catalog.includes(id)).map(eventTypeAccentIndex);

    expect(catalog.map(eventTypeAccentIndex)).toEqual(first);
    expect(second).toEqual(['demo', 'consultation', 'product-review'].map(eventTypeAccentIndex));
  });

  it('разные id разводит по палитре', () => {
    const indexes = new Set(
      ['consultation', 'product-review', 'demo', 'intro', 'sync', 'review-1'].map(
        eventTypeAccentIndex,
      ),
    );

    expect(indexes.size).toBeGreaterThan(1);
  });

  // FNV-1a зафиксирован registry: значение — часть контракта helper'а, а не деталь реализации.
  it('совпадает с эталонными значениями FNV-1a mod 6', () => {
    expect(eventTypeAccentIndex('')).toBe(0x811c9dc5 % 6);
    expect(eventTypeAccentIndex('a')).toBe(0xe40c292c % 6);
    expect(eventTypeAccentIndex('foobar')).toBe(0xbf9cf968 % 6);
  });
});
