import type { AvailabilityRule } from '@minical/api-client';

import {
  applyDaysLabel,
  formatAvailabilitySummary,
  formatDaysOff,
  formatWeekdays,
  overwriteMessage,
  toAvailabilityRules,
  toDayOfWeek,
  type WorkingInterval,
} from '@/features/availability/lib';

function rule(
  daysOfWeek: AvailabilityRule['daysOfWeek'],
  startLocal: string,
  endLocal: string,
): AvailabilityRule {
  return { daysOfWeek, startLocal, endLocal };
}

function interval(
  id: string,
  daysOfWeek: WorkingInterval['daysOfWeek'],
  startLocal: string,
  endLocal: string,
): WorkingInterval {
  return { id, daysOfWeek, startLocal, endLocal };
}

describe('formatWeekdays', () => {
  it('сворачивает смежные дни в диапазон', () => {
    expect(formatWeekdays(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'])).toBe('Пн–Пт');
  });

  it('несмежные дни перечисляет через запятую', () => {
    expect(formatWeekdays(['Monday', 'Wednesday', 'Friday'])).toBe('Пн, Ср, Пт');
  });

  it('все дни недели сворачиваются в один диапазон', () => {
    expect(
      formatWeekdays([
        'Monday',
        'Tuesday',
        'Wednesday',
        'Thursday',
        'Friday',
        'Saturday',
        'Sunday',
      ]),
    ).toBe('Пн–Вс');
  });

  it('несколько смежных диапазонов разделяются запятой', () => {
    expect(formatWeekdays(['Monday', 'Tuesday', 'Thursday', 'Friday'])).toBe('Пн–Вт, Чт–Пт');
  });

  it('порядок и повторы во входе не влияют на результат', () => {
    expect(formatWeekdays(['Friday', 'Monday', 'Friday'])).toBe('Пн, Пт');
  });

  it('пустой список даёт пустую строку', () => {
    expect(formatWeekdays([])).toBe('');
  });
});

describe('formatAvailabilitySummary', () => {
  it('пустые правила — фолбэк-подпись, а не падение', () => {
    expect(formatAvailabilitySummary([])).toBe('Рабочее время не настроено');
  });

  it('одно правило — дни и время через точку (кадр 2 экрана 08)', () => {
    expect(
      formatAvailabilitySummary([
        rule(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], '09:00', '18:00'),
      ]),
    ).toBe('Пн–Пт · 09:00–18:00');
  });

  it('все дни недели в одном правиле', () => {
    expect(
      formatAvailabilitySummary([
        rule(
          ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
          '00:00',
          '23:45',
        ),
      ]),
    ).toBe('Пн–Вс · 00:00–23:45');
  });

  it('несколько правил с одинаковым интервалом перечисляются через «; »', () => {
    expect(
      formatAvailabilitySummary([
        rule(['Monday', 'Tuesday', 'Wednesday'], '09:00', '18:00'),
        rule(['Thursday', 'Friday'], '09:00', '18:00'),
      ]),
    ).toBe('Пн–Ср · 09:00–18:00; Чт–Пт · 09:00–18:00');
  });

  it('несколько правил с разными интервалами', () => {
    expect(
      formatAvailabilitySummary([
        rule(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], '09:00', '18:00'),
        rule(['Saturday'], '10:00', '14:00'),
      ]),
    ).toBe('Пн–Пт · 09:00–18:00; Сб · 10:00–14:00');
  });
});

describe('toDayOfWeek', () => {
  it('приводит нижний регистр UISpec Weekday к контрактному DayOfWeek', () => {
    expect(toDayOfWeek('monday')).toBe('Monday');
    expect(toDayOfWeek('sunday')).toBe('Sunday');
  });
});

describe('formatDaysOff', () => {
  it('пустой график — все дни выходные', () => {
    expect(formatDaysOff([])).toBe('Выходные: Пн–Вс');
  });

  it('будни заняты — выходные Сб–Вс, смежные дни сворачиваются в диапазон (кадр 3 экрана 03)', () => {
    expect(formatDaysOff([interval('1', ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'], '09:00', '18:00')])).toBe(
      'Выходные: Сб–Вс',
    );
  });

  it('все семь дней заняты — пустая строка', () => {
    expect(
      formatDaysOff([
        interval(
          '1',
          ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
          '00:00',
          '23:45',
        ),
      ]),
    ).toBe('');
  });

  it('несколько интервалов объединяют покрытые дни', () => {
    expect(
      formatDaysOff([
        interval('1', ['monday', 'tuesday', 'wednesday'], '09:00', '18:00'),
        interval('2', ['thursday', 'friday'], '10:00', '14:00'),
      ]),
    ).toBe('Выходные: Сб–Вс');
  });
});

describe('toAvailabilityRules', () => {
  it('отбрасывает client-only id и приводит Weekday к DayOfWeek', () => {
    expect(
      toAvailabilityRules([interval('client-1', ['monday', 'wednesday'], '09:00', '18:00')]),
    ).toEqual([{ daysOfWeek: ['Monday', 'Wednesday'], startLocal: '09:00', endLocal: '18:00' }]);
  });

  it('несколько интервалов сохраняют порядок', () => {
    expect(
      toAvailabilityRules([
        interval('a', ['monday'], '09:00', '12:00'),
        interval('b', ['saturday'], '10:00', '14:00'),
      ]),
    ).toEqual([
      { daysOfWeek: ['Monday'], startLocal: '09:00', endLocal: '12:00' },
      { daysOfWeek: ['Saturday'], startLocal: '10:00', endLocal: '14:00' },
    ]);
  });

  it('пустой список даёт пустой список', () => {
    expect(toAvailabilityRules([])).toEqual([]);
  });
});

describe('overwriteMessage', () => {
  it('перечисляет дни перезаписываемых интервалов и новое время', () => {
    expect(
      overwriteMessage(
        [interval('old', ['monday', 'wednesday'], '08:00', '12:00')],
        '09:00',
        '18:00',
      ),
    ).toBe('Пн, Ср: рабочее время будет заменено на 09:00–18:00.');
  });

  it('объединяет дни нескольких перезаписываемых интервалов без повторов', () => {
    expect(
      overwriteMessage(
        [
          interval('old-1', ['monday'], '08:00', '12:00'),
          interval('old-2', ['monday', 'friday'], '13:00', '17:00'),
        ],
        '09:00',
        '18:00',
      ),
    ).toBe('Пн, Пт: рабочее время будет заменено на 09:00–18:00.');
  });
});

describe('applyDaysLabel', () => {
  it('единственное число — «дню»', () => {
    expect(applyDaysLabel(1)).toBe('Применить к 1 дню');
  });

  it('множественное число — «дням»', () => {
    expect(applyDaysLabel(2)).toBe('Применить к 2 дням');
    expect(applyDaysLabel(5)).toBe('Применить к 5 дням');
    expect(applyDaysLabel(7)).toBe('Применить к 7 дням');
  });
});
