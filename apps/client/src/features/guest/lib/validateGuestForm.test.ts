import type { GuestDraft } from '@/features/guest/state/reducer';
import { isEmail, validateGuestForm } from '@/features/guest/lib/validateGuestForm';

function draft(overrides: Partial<GuestDraft> = {}): GuestDraft {
  return { name: 'Anna Novak', email: 'anna@example.com', note: '', ...overrides };
}

describe('validateGuestForm', () => {
  it('на заполненной форме ошибок нет', () => {
    expect(validateGuestForm(draft())).toEqual([]);
  });

  it('комментарий необязателен', () => {
    expect(validateGuestForm(draft({ note: '' }))).toEqual([]);
  });

  it('пустое имя — ошибка поля guest-name', () => {
    expect(validateGuestForm(draft({ name: '   ' }))).toEqual([
      { field: 'guest-name', message: 'Введите имя' },
    ]);
  });

  it('пустой email — ошибка «Введите email»', () => {
    expect(validateGuestForm(draft({ email: '' }))).toEqual([
      { field: 'guest-email', message: 'Введите email' },
    ]);
  });

  // Кадр 5: «anna@» — заполнено, но не email.
  it('некорректный email — ошибка формата', () => {
    expect(validateGuestForm(draft({ email: 'anna@' }))).toEqual([
      { field: 'guest-email', message: 'Введите корректный email' },
    ]);
  });

  it('пустые имя и email дают обе ошибки в порядке правил спеки', () => {
    expect(validateGuestForm(draft({ name: '', email: '' }))).toEqual([
      { field: 'guest-name', message: 'Введите имя' },
      { field: 'guest-email', message: 'Введите email' },
    ]);
  });
});

describe('isEmail', () => {
  it('принимает обычные адреса', () => {
    for (const value of ['anna@example.com', 'a.b+tag@mail.co.uk', ' anna@example.com ']) {
      expect(isEmail(value)).toBe(true);
    }
  });

  it('отклоняет структурно неполные', () => {
    for (const value of ['', 'anna', 'anna@', '@example.com', 'anna@example', 'a n@example.com', 'a@@b.com', 'anna@.com', 'anna@example.']) {
      expect(isEmail(value)).toBe(false);
    }
  });
});
