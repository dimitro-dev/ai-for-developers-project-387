import { boxStyle } from '@/design-system/layout/box';

describe('boxStyle', () => {
  it('процентную ширину пробрасывает в стиль как есть', () => {
    expect(boxStyle({ width: '100%' }).width).toBe('100%');
  });

  it("'fill' даёт alignSelf stretch и не задаёт числовую или процентную width", () => {
    const style = boxStyle({ width: 'fill' });

    expect(style.alignSelf).toBe('stretch');
    expect(style.width).toBeUndefined();
  });

  it('число даёт фиксированную ширину в dp', () => {
    expect(boxStyle({ width: 320 }).width).toBe(320);
  });

  it('явный alignSelf перекрывает stretch от fill', () => {
    const style = boxStyle({ width: 'fill', alignSelf: 'center' });

    expect(style.alignSelf).toBe('center');
    expect(style.width).toBeUndefined();
  });

  it('процент, maxWidth и alignSelf center попадают в стиль все трое', () => {
    const style = boxStyle({ width: '100%', maxWidth: 640, alignSelf: 'center' });

    expect(style.width).toBe('100%');
    expect(style.maxWidth).toBe(640);
    expect(style.alignSelf).toBe('center');
  });
});
