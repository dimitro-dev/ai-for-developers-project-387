import { render, screen } from '@testing-library/react-native';

// `App.tsx` — первый компонент в этой кодовой базе, рендерящий сам `SafeAreaProvider` (не только
// `AppSafeArea`/`SafeAreaView` под готовым провайдером снаружи): без native-модуля провайдер не
// получает layout-метрики и не отдаёт детей вовсе (проверено пробой — `<RNCSafeAreaProvider />`
// без children). Официальный jest-мок пакета решает это ровно для тестового окружения, поведение
// на реальных платформах не меняет.
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);

// Экран стартового route гостевого корня (`GuestEventTypes`) делает пару чтений на монтировании;
// сеть в этом тесте не нужна — usecases мокаются, как в `GuestEventTypes.test.tsx`. Промис,
// который не резолвится, держит экран в состоянии loading — этого достаточно, чтобы доказать
// отсутствие регрессии гостевого корня (сам факт успешного монтирования GuestStack + провайдера).
jest.mock('@/features/guest/usecases/guest', () => ({
  loadPublicCalendar: jest.fn(() => new Promise(() => {})),
  loadPublicEventTypes: jest.fn(() => new Promise(() => {})),
}));

// Стартовый route owner-корня (`SetupCheck`) тоже делает запрос на монтировании — держим его
// в состоянии `checking` тем же приёмом.
jest.mock('@/features/owner/usecases/owner', () => ({
  checkSetup: jest.fn(() => new Promise(() => {})),
}));

import App from './App';

const APP_MODE_ENV_KEY = 'EXPO_PUBLIC_APP_MODE';

/**
 * P14 (ADR §1/§2): `App.tsx` выбирает корень по `EXPO_PUBLIC_APP_MODE`. Владелец режима читает
 * переменную при каждом рендере (не на импорте модуля), поэтому `resetModules` не нужен — тот же
 * приём, что в `appMode.test.ts`.
 */
describe('App — выбор корня по режиму', () => {
  const originalValue = process.env[APP_MODE_ENV_KEY];

  afterEach(() => {
    if (originalValue === undefined) {
      delete process.env[APP_MODE_ENV_KEY];
    } else {
      process.env[APP_MODE_ENV_KEY] = originalValue;
    }
  });

  it('без переменной окружения монтирует гостевой корень без регрессии (GuestEventTypes)', async () => {
    delete process.env[APP_MODE_ENV_KEY];

    await render(<App />);

    expect(
      screen.getAllByTestId('skeleton-event-type-card', { includeHiddenElements: true }).length,
    ).toBeGreaterThan(0);
    expect(screen.queryByTestId('setup-check-progress')).toBeNull();
  });

  it('EXPO_PUBLIC_APP_MODE=owner монтирует owner-корень (SetupCheck)', async () => {
    process.env[APP_MODE_ENV_KEY] = 'owner';

    await render(<App />);

    expect(screen.getByTestId('setup-check-progress')).toBeTruthy();
  });
});
