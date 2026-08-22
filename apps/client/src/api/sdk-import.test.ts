import { client, getPublicCalendar } from '@minical/api-client';

/**
 * Спайк P01: `@minical/api-client` отдаёт сырой TypeScript (`exports: "./src/generated/index.ts"`)
 * и резолвится симлинком npm workspaces. Тест доказывает, что jest-окружение его транспилирует.
 */
describe('@minical/api-client в jest-окружении', () => {
  it('импортирует client и функции операций из корневого входа', () => {
    expect(typeof client.setConfig).toBe('function');
    expect(typeof getPublicCalendar).toBe('function');
  });

  it('client создан без baseUrl — явная конфигурация обязательна', () => {
    expect(client.getConfig().baseUrl).toBeUndefined();
  });
});
