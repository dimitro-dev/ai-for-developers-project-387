import { client } from '@minical/api-client';
import { Platform } from 'react-native';

export function resolveApiBaseUrl(): string {
  // Expo инлайнит EXPO_PUBLIC_* только при статическом обращении через точку:
  // деструктуризация и process.env[key] не инлайнятся и в сборке дадут undefined.
  const configured = process.env.EXPO_PUBLIC_API_BASE_URL?.trim() ?? '';

  // Маркер same-origin: пустой baseUrl оставляет SDK относительный путь (`baseUrl + path`),
  // и запрос уходит на origin страницы — так собираются web-бандлы образа.
  if (configured === 'same-origin') {
    return '';
  }

  if (configured !== '') {
    return configured;
  }

  if (__DEV__) {
    // Дев-адреса намеренно не экспортируются и живут только внутри этой ветки: Metro заменяет
    // __DEV__ на false в production-экспорте и выкидывает мёртвую ветку вместе с литералами,
    // но экспорт модуля пережил бы минификацию и попал в бандл.
    return Platform.select({
      // Android-эмулятор видит хост-машину как `10.0.2.2`; `localhost` внутри эмулятора — он сам.
      android: 'http://10.0.2.2:4010',
      // Prism-мок `task-infra-004` — дефолт разработки. Реальный API — порт 3001.
      default: 'http://localhost:4010',
    });
  }

  // В production молчаливый уход на мок неотличим от «переменную забыли задать», поэтому
  // незаданный адрес — отказ старта, а не тихая подмена.
  throw new Error(
    'EXPO_PUBLIC_API_BASE_URL не задана: production-сборке нужен адрес API или маркер same-origin',
  );
}

/**
 * Экспортируемый `client` создан без `baseUrl` (`task-infra-005`): без этого вызова
 * запросы уходят по относительному адресу. Вызывается bootstrap приложения до первого рендера.
 */
export function configureApiClient(): void {
  client.setConfig({ baseUrl: resolveApiBaseUrl() });
}
