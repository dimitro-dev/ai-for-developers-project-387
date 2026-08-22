import type { SlotView } from '@/features/guest/model/types';
import { availableDates, selectedSlotMissing, slotsOnDate } from '@/features/slots/lib';

const PRAGUE = 'Europe/Prague';
const KAMCHATKA = 'Asia/Kamchatka';

function slot(startAtUtc: string, endAtUtc: string): SlotView {
  return { startAtUtc, endAtUtc, eventTypeId: 'consultation' };
}

// Порядок в наборе намеренно перемешан: сервер отдаёт хронологию, но helpers на неё не полагаются.
const slots: SlotView[] = [
  slot('2026-08-01T07:00:00Z', '2026-08-01T07:30:00Z'),
  slot('2026-07-31T08:30:00Z', '2026-07-31T09:00:00Z'),
  slot('2026-07-31T06:00:00Z', '2026-07-31T06:30:00Z'),
  slot('2026-07-31T08:00:00Z', '2026-07-31T08:30:00Z'),
];

describe('availableDates', () => {
  it('оставляет только даты со слотами, по возрастанию и без дублей', () => {
    expect(availableDates(slots, PRAGUE)).toEqual([
      { date: '2026-07-31', weekdayLabel: 'Пт', dayLabel: '31' },
      { date: '2026-08-01', weekdayLabel: 'Сб', dayLabel: '1' },
    ]);
  });

  it('группирует по календарной дате гостя, а не по UTC', () => {
    // 21:00 UTC 31 июля — 09:00 1 августа на Камчатке: в её полоске это другая дата.
    const evening = [slot('2026-07-31T21:00:00Z', '2026-07-31T21:30:00Z')];

    expect(availableDates(evening, PRAGUE)[0].date).toBe('2026-07-31');
    expect(availableDates(evening, KAMCHATKA)[0].date).toBe('2026-08-01');
  });

  it('на пустом наборе дат не выдумывает', () => {
    expect(availableDates([], PRAGUE)).toEqual([]);
  });
});

describe('slotsOnDate', () => {
  it('отбирает слоты выбранной даты хронологически', () => {
    expect(slotsOnDate(slots, '2026-07-31', PRAGUE).map((item) => item.startAtUtc)).toEqual([
      '2026-07-31T06:00:00Z',
      '2026-07-31T08:00:00Z',
      '2026-07-31T08:30:00Z',
    ]);
  });

  it('на дату без слотов возвращает пустой набор', () => {
    expect(slotsOnDate(slots, '2026-08-02', PRAGUE)).toEqual([]);
  });

  it('относит слот к дате по timezone гостя', () => {
    const evening = [slot('2026-07-31T21:00:00Z', '2026-07-31T21:30:00Z')];

    expect(slotsOnDate(evening, '2026-08-01', KAMCHATKA)).toHaveLength(1);
    expect(slotsOnDate(evening, '2026-08-01', PRAGUE)).toHaveLength(0);
  });
});

describe('selectedSlotMissing', () => {
  it('без выбранного слота конфликта нет', () => {
    expect(selectedSlotMissing(slots, null)).toBe(false);
  });

  it('слот на месте — false', () => {
    expect(selectedSlotMissing(slots, slots[1])).toBe(false);
  });

  // Кадр 8: слот заняли, пока гость заполнял форму.
  it('исчезнувший слот — true', () => {
    const taken = slot('2026-07-31T08:00:00Z', '2026-07-31T08:30:00Z');
    const reloaded = slots.filter((item) => item.startAtUtc !== taken.startAtUtc);

    expect(selectedSlotMissing(reloaded, taken)).toBe(true);
  });

  it('пустой набор после выбора — тоже пропажа', () => {
    expect(selectedSlotMissing([], slots[0])).toBe(true);
  });
});
