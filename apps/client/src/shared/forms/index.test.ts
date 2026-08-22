import { fieldError, type FieldError } from '@/shared/forms';

const errors: FieldError[] = [
  { field: 'guest-name', message: 'Введите имя' },
  { field: 'guest-email', message: 'Введите корректный email' },
];

describe('fieldError', () => {
  it('возвращает сообщение своего поля', () => {
    expect(fieldError(errors, 'guest-email')).toBe('Введите корректный email');
  });

  it('возвращает null, когда ошибки у поля нет', () => {
    expect(fieldError(errors, 'guest-note')).toBeNull();
    expect(fieldError([], 'guest-name')).toBeNull();
  });
});
