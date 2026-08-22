import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Динамическая надстройка над `app.json`: базовый префикс web-экспорта и проверки переменных
 * сборки. Конфиг исполняется до бандлинга, поэтому мусор в окружении здесь ловится дешевле, чем
 * в рантайме у посетителя.
 *
 * `expo export --platform web` адресует ассеты абсолютно от корня (`/_expo/static/...`), поэтому
 * бандл, который раздаётся не с корня сайта (владельческий — с `/admin`), без префикса просил бы
 * их из чужого бандла. `EXPO_WEB_BASE_URL` намеренно не `EXPO_PUBLIC_*`: её значение нужно конфигу
 * в момент запуска Expo CLI, а не коду внутри бандла. Пустая или незаданная переменная конфиг
 * не меняет — dev-запуск и гостевой экспорт остаются без префикса.
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  const baseUrl = process.env.EXPO_WEB_BASE_URL?.trim() ?? '';
  const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim() ?? '';

  // Без ведущего слэша Expo ограничивается жёлтым предупреждением, но адресует ассеты
  // относительно запросившего их кода (`admin/_expo/...`), и раздача молча ломается.
  if (baseUrl !== '' && !baseUrl.startsWith('/')) {
    throw new Error(
      `EXPO_WEB_BASE_URL должен начинаться со слэша, получено "${baseUrl}": без него ассеты ` +
        'адресуются относительно запросившего их кода и бандл ломается при раздаче не с корня',
    );
  }

  // NODE_ENV=production ставит сам Expo CLI на экспорте (`expo start` оставляет development).
  // Тот же отказ есть в рантайме (`src/api/config.ts`), но там он доходит до посетителя белой
  // страницей, тогда как здесь факт «переменную забыли задать» известен уже на этапе сборки.
  if (process.env.NODE_ENV === 'production' && apiBaseUrl === '') {
    throw new Error(
      'EXPO_PUBLIC_API_BASE_URL не задана: production-сборке нужен адрес API или маркер same-origin',
    );
  }

  if (baseUrl === '') {
    return config as ExpoConfig;
  }

  return {
    ...(config as ExpoConfig),
    experiments: { ...config.experiments, baseUrl },
  };
};
