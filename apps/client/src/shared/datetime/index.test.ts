import {
  calendarDate,
  dateLabel,
  formatUtcOffset,
  formattedSlot,
  fullDateLabel,
  groupBookingsByOwnerDate,
  guestTimeZone,
  timeLabel,
} from '@/shared/datetime';

// Зоны фиксированные: результат не должен зависеть от TZ машины, где идёт прогон (ADR §8).
const PRAGUE = 'Europe/Prague';
const KAMCHATKA = 'Asia/Kamchatka'; // UTC+12 — граница суток «вперёд»
const HONOLULU = 'Pacific/Honolulu'; // UTC−10 — граница суток «назад»

describe('timeLabel', () => {
  it('форматирует время начала слота в timezone гостя', () => {
    expect(timeLabel('2026-07-31T08:00:00Z', PRAGUE)).toBe('10:00');
    expect(timeLabel('2026-07-31T08:30:00Z', PRAGUE)).toBe('10:30');
  });

  it('полночь — 00:00, а не 24:00', () => {
    expect(timeLabel('2026-07-31T22:00:00Z', PRAGUE)).toBe('00:00');
  });

  it('одна и та же метка в разных зонах даёт разное время', () => {
    expect(timeLabel('2026-07-31T20:30:00Z', KAMCHATKA)).toBe('08:30');
    expect(timeLabel('2026-07-31T20:30:00Z', HONOLULU)).toBe('10:30');
  });
});

describe('dateLabel', () => {
  it('даёт дату кадра 7 без сокращения «г.»', () => {
    expect(dateLabel('2026-07-31T08:00:00Z', PRAGUE)).toBe('31 июля 2026');
  });

  it('на границе суток берёт календарный день гостя, а не UTC', () => {
    // 23:30 UTC 31 июля — это уже 1 августа на Камчатке и ещё 31 июля на Гавайях.
    expect(dateLabel('2026-07-31T23:30:00Z', KAMCHATKA)).toBe('1 августа 2026');
    expect(dateLabel('2026-07-31T23:30:00Z', HONOLULU)).toBe('31 июля 2026');
  });
});

describe('calendarDate', () => {
  it('возвращает YYYY-MM-DD в timezone гостя', () => {
    expect(calendarDate('2026-07-31T08:00:00Z', PRAGUE)).toBe('2026-07-31');
  });

  it('на границе суток относит слот к календарному дню гостя', () => {
    expect(calendarDate('2026-07-31T23:30:00Z', KAMCHATKA)).toBe('2026-08-01');
    expect(calendarDate('2026-07-31T23:30:00Z', HONOLULU)).toBe('2026-07-31');
    expect(calendarDate('2026-08-01T00:30:00Z', PRAGUE)).toBe('2026-08-01');
    expect(calendarDate('2026-07-31T22:30:00Z', PRAGUE)).toBe('2026-08-01');
  });
});

describe('fullDateLabel', () => {
  it('озвучивает полную дату с прописной буквы', () => {
    expect(fullDateLabel('2026-07-31')).toBe('Пятница, 31 июля');
    expect(fullDateLabel('2026-08-01')).toBe('Суббота, 1 августа');
  });
});

describe('formattedSlot', () => {
  it('собирает подпись слота из даты и интервала', () => {
    expect(formattedSlot('2026-07-31T08:00:00Z', '2026-07-31T08:30:00Z', PRAGUE)).toBe(
      '31 июля · 10:00–10:30',
    );
  });

  it('интервал через полночь остаётся читаемым', () => {
    expect(formattedSlot('2026-07-31T21:45:00Z', '2026-07-31T22:15:00Z', PRAGUE)).toBe(
      '31 июля · 23:45–00:15',
    );
  });
});

describe('formatUtcOffset', () => {
  it('форматирует положительное и отрицательное смещение', () => {
    const summer = new Date('2026-07-31T12:00:00Z');
    expect(formatUtcOffset(PRAGUE, summer)).toBe('UTC+02:00');
    expect(formatUtcOffset(KAMCHATKA, summer)).toBe('UTC+12:00');
    expect(formatUtcOffset(HONOLULU, summer)).toBe('UTC-10:00');
    expect(formatUtcOffset('UTC', summer)).toBe('UTC+00:00');
  });

  it('учитывает переход на зимнее время', () => {
    expect(formatUtcOffset(PRAGUE, new Date('2026-01-15T12:00:00Z'))).toBe('UTC+01:00');
  });

  it('поддерживает получасовые зоны', () => {
    expect(formatUtcOffset('Asia/Kolkata', new Date('2026-07-31T12:00:00Z'))).toBe('UTC+05:30');
  });
});

describe('guestTimeZone', () => {
  it('возвращает IANA-имя зоны устройства', () => {
    expect(guestTimeZone()).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone);
  });
});

describe('groupBookingsByOwnerDate', () => {
  const booking = (id: string, startAt: string) => ({ id, startAt });

  it('пустой список броней — пустой список групп', () => {
    expect(groupBookingsByOwnerDate([], PRAGUE)).toEqual([]);
  });

  it('группирует по календарной дате владельца и сортирует брони внутри группы по startAt', () => {
    const bookings = [
      booking('c', '2026-07-31T09:00:00Z'),
      booking('a', '2026-07-31T07:00:00Z'),
      booking('b', '2026-08-01T07:00:00Z'),
    ];

    const groups = groupBookingsByOwnerDate(bookings, PRAGUE);

    expect(groups.map((group) => group.id)).toEqual(['2026-07-31', '2026-08-01']);
    expect(groups[0].title).toBe('Пятница, 31 июля');
    expect(groups[0].bookings.map((item) => item.id)).toEqual(['a', 'c']);
    expect(groups[1].bookings.map((item) => item.id)).toEqual(['b']);
  });

  it('несколько дат группируются по возрастанию независимо от порядка на входе', () => {
    const bookings = [
      booking('later', '2026-08-05T07:00:00Z'),
      booking('earlier', '2026-07-30T07:00:00Z'),
    ];

    expect(groupBookingsByOwnerDate(bookings, PRAGUE).map((group) => group.id)).toEqual([
      '2026-07-30',
      '2026-08-05',
    ]);
  });

  it('граница суток относит бронь к календарному дню владельца, а не UTC', () => {
    const bookings = [booking('a', '2026-07-31T23:30:00Z')];

    expect(groupBookingsByOwnerDate(bookings, KAMCHATKA)[0].id).toBe('2026-08-01');
    expect(groupBookingsByOwnerDate(bookings, HONOLULU)[0].id).toBe('2026-07-31');
  });
});
