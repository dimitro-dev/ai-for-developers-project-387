import { generatePublicId } from '@/features/owner/lib';

describe('generatePublicId', () => {
  it('переводит латинское название в slug', () => {
    expect(generatePublicId('Product Review')).toBe('product-review');
  });

  it('схлопывает разделители и обрезает края', () => {
    expect(generatePublicId('  Demo   --  Meeting!! ')).toBe('demo-meeting');
  });

  it('транслитерирует кириллицу', () => {
    expect(generatePublicId('Консультация')).toBe('konsultaciya');
    expect(generatePublicId('Демо-встреча')).toBe('demo-vstrecha');
  });

  it('пустое или пробельное название — пустой id', () => {
    expect(generatePublicId('')).toBe('');
    expect(generatePublicId('   ')).toBe('');
  });

  it('сохраняет цифры', () => {
    expect(generatePublicId('Встреча 1 на 1')).toBe('vstrecha-1-na-1');
  });

  it('результат всегда соответствует серверному формату public-id', () => {
    // Правило `public-id-format` спеки 10: латиница в нижнем регистре, цифры, одиночные дефисы.
    expect(generatePublicId('Проверка / Тест_123')).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    expect(generatePublicId('!!!')).toBe('');
  });
});
