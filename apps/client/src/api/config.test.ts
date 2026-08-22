import { client } from '@minical/api-client';

import { configureApiClient, resolveApiBaseUrl } from './config';

const ENV_KEY = 'EXPO_PUBLIC_API_BASE_URL';

/** Дефолты разработки — литералы теста: модуль их не экспортирует (AC4, ADR §4). */
const PRISM_BASE_URL = 'http://localhost:4010';
const ANDROID_PRISM_BASE_URL = 'http://10.0.2.2:4010';

const globalWithDev = globalThis as typeof globalThis & { __DEV__: boolean };

/** В jest `__DEV__` всегда true; production-ветку проверяем на подменённом глобале. */
function withProductionMode<T>(run: () => T): T {
  const originalDev = globalWithDev.__DEV__;
  globalWithDev.__DEV__ = false;
  try {
    return run();
  } finally {
    globalWithDev.__DEV__ = originalDev;
  }
}

const originalValue = process.env[ENV_KEY];

// Файловый хук: каждый блок ниже задаёт переменную по-своему, восстановление у всех одно.
afterEach(() => {
  if (originalValue === undefined) {
    delete process.env[ENV_KEY];
  } else {
    process.env[ENV_KEY] = originalValue;
  }
});

describe('resolveApiBaseUrl', () => {
  it('без переменной окружения отдаёт Prism-дефолт', () => {
    delete process.env[ENV_KEY];

    expect(resolveApiBaseUrl()).toBe(PRISM_BASE_URL);
  });

  it('пустая переменная окружения считается незаданной', () => {
    process.env[ENV_KEY] = '   ';

    expect(resolveApiBaseUrl()).toBe(PRISM_BASE_URL);
  });

  it('переопределяется переменной окружения', () => {
    process.env[ENV_KEY] = 'http://localhost:3001';

    expect(resolveApiBaseUrl()).toBe('http://localhost:3001');
  });

  it('маркер same-origin даёт пустой base URL', () => {
    process.env[ENV_KEY] = 'same-origin';

    expect(resolveApiBaseUrl()).toBe('');
  });

  it('маркер same-origin распознаётся с пробелами вокруг', () => {
    process.env[ENV_KEY] = '  same-origin  ';

    expect(resolveApiBaseUrl()).toBe('');
  });
});

describe('resolveApiBaseUrl в production-сборке', () => {
  it('без переменной окружения отказывает, а не уходит на мок', () => {
    delete process.env[ENV_KEY];

    expect(() => withProductionMode(resolveApiBaseUrl)).toThrow(ENV_KEY);
  });

  it('пустая переменная окружения отказывает так же', () => {
    process.env[ENV_KEY] = '   ';

    expect(() => withProductionMode(resolveApiBaseUrl)).toThrow(ENV_KEY);
  });

  it('маркер same-origin работает и в production', () => {
    process.env[ENV_KEY] = 'same-origin';

    expect(withProductionMode(resolveApiBaseUrl)).toBe('');
  });

  it('явный адрес работает и в production', () => {
    process.env[ENV_KEY] = 'https://minical.example';

    expect(withProductionMode(resolveApiBaseUrl)).toBe('https://minical.example');
  });
});

describe('configureApiClient', () => {
  const originalBaseUrl = client.getConfig().baseUrl;

  afterEach(() => {
    client.setConfig({ baseUrl: originalBaseUrl });
  });

  it('кладёт дефолтный base URL в конфигурацию generated-клиента', () => {
    delete process.env[ENV_KEY];

    configureApiClient();

    expect(client.getConfig().baseUrl).toBe(PRISM_BASE_URL);
  });

  it('кладёт значение из переменной окружения', () => {
    process.env[ENV_KEY] = 'http://localhost:3001';

    configureApiClient();

    expect(client.getConfig().baseUrl).toBe('http://localhost:3001');
  });

  it('по маркеру same-origin кладёт пустой base URL', () => {
    process.env[ENV_KEY] = 'same-origin';

    configureApiClient();

    expect(client.getConfig().baseUrl).toBe('');
  });
});

describe('дефолт Android-эмулятора', () => {
  afterEach(() => {
    jest.resetModules();
    jest.dontMock('react-native');
  });

  it('на android отдаёт 10.0.2.2 вместо localhost', () => {
    // Платформа jest-окружения — ios (`haste.defaultPlatform` пресета), поэтому
    // android-ветку Platform.select проверяем на подменённом модуле; `select`
    // повторяет реализацию react-native/Libraries/Utilities/Platform.android.js.
    jest.resetModules();
    jest.doMock('react-native', () => ({
      Platform: {
        OS: 'android',
        select: <T,>(spec: { android?: T; native?: T; default?: T }): T | undefined =>
          'android' in spec ? spec.android : 'native' in spec ? spec.native : spec.default,
      },
    }));

    const reloaded: typeof import('./config') = require('./config');

    expect(reloaded.resolveApiBaseUrl()).toBe(ANDROID_PRISM_BASE_URL);
  });
});
