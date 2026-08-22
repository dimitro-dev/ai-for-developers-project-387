import { NavigationContainer } from '@react-navigation/native';
import { render, screen } from '@testing-library/react-native';

import { OwnerRoot } from '@/navigation/OwnerRoot';

/**
 * Корень owner-навигации собирается и открывается на `SetupCheck` (`initial="SetupCheck"` из
 * `navigation.uispec.xml`). Экран проверки делает запрос при монтировании, поэтому use-case
 * замокан: здесь проверяется маршрутизация корня, а не поведение самого экрана (его состояния
 * покрыты в `features/owner/screens/SetupCheck.test.tsx`). Пока промис висит, экран остаётся
 * в состоянии `checking` — по нему и опознаём начальный route.
 */
jest.mock('@/features/owner/usecases/owner', () => ({
  checkSetup: jest.fn(() => new Promise(() => {})),
}));

describe('OwnerRoot', () => {
  it('открывается на SetupCheck — initial route корня', async () => {
    await render(
      <NavigationContainer>
        <OwnerRoot />
      </NavigationContainer>,
    );

    expect(screen.getByTestId('setup-check-progress')).toBeTruthy();
    expect(screen.queryByTestId('owner-bottom-navigation')).toBeNull();
  });
});
