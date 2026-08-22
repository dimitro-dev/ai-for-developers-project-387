import { resolveAppMode } from './appMode';

const ENV_KEY = 'EXPO_PUBLIC_APP_MODE';

describe('resolveAppMode', () => {
  const originalValue = process.env[ENV_KEY];

  afterEach(() => {
    if (originalValue === undefined) {
      delete process.env[ENV_KEY];
    } else {
      process.env[ENV_KEY] = originalValue;
    }
  });

  it('без переменной окружения отдаёт guest', () => {
    delete process.env[ENV_KEY];

    expect(resolveAppMode()).toBe('guest');
  });

  it('точное значение owner переключает режим', () => {
    process.env[ENV_KEY] = 'owner';

    expect(resolveAppMode()).toBe('owner');
  });

  it('пустая строка считается guest', () => {
    process.env[ENV_KEY] = '';

    expect(resolveAppMode()).toBe('guest');
  });

  it('произвольный мусор считается guest', () => {
    process.env[ENV_KEY] = 'Owner';

    expect(resolveAppMode()).toBe('guest');
  });
});
