import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { StateView } from '@/shared/ui-state/StateView';

// В @testing-library/react-native 14 `render` асинхронный — его обязательно await.
describe('StateView', () => {
  it('показывает children, когда текущее состояние есть в списке', async () => {
    await render(
      <StateView state="dateSelection|slotSelection|slotUnavailable" current="slotSelection">
        <Text>Сетка слотов</Text>
      </StateView>,
    );

    expect(screen.getByText('Сетка слотов')).toBeTruthy();
  });

  it('скрывает children при несовпадении состояния', async () => {
    await render(
      <StateView state="dateSelection|slotSelection" current="loading">
        <Text>Сетка слотов</Text>
      </StateView>,
    );

    expect(screen.queryByText('Сетка слотов')).toBeNull();
  });
});
