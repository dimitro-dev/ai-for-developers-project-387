import { act, renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { GuestFlowProvider, useGuestFlow } from '@/features/guest/state/GuestFlowProvider';

// Криптография платформы подменяется: проверяется обвязка контейнера, а не генератор UUID.
// Префикс `mock` обязателен — иначе jest не пускает переменную в фабрику `jest.mock`.
const mockNewBookingKey = jest.fn<string, []>();
jest.mock('@/features/guest/lib/newBookingKey', () => ({
  newBookingKey: () => mockNewBookingKey(),
}));

function wrapper({ children }: { children: ReactNode }) {
  return <GuestFlowProvider>{children}</GuestFlowProvider>;
}

beforeEach(() => {
  mockNewBookingKey.mockReset();
  mockNewBookingKey.mockReturnValueOnce('uuid-1').mockReturnValueOnce('uuid-2');
});

describe('GuestFlowProvider', () => {
  it('хранит черновик формы вне параметров route', async () => {
    const { result } = await renderHook(() => useGuestFlow(), { wrapper });

    await act(() => result.current.setDraftField('name', 'Анна'));
    await act(() => result.current.setDraftField('email', 'anna@example.com'));

    expect(result.current.draft).toEqual({ name: 'Анна', email: 'anna@example.com', note: '' });
  });

  it('выдаёт ключ идемпотентности при монтировании формы', async () => {
    const { result } = await renderHook(() => useGuestFlow(), { wrapper });

    let key = '';
    await act(() => {
      key = result.current.initBookingKey();
    });

    expect(key).toBe('uuid-1');
    expect(result.current.bookingKey).toBe('uuid-1');
  });

  // Кадр 9: повтор после обрыва сети идёт внутри того же монтирования — форма не размонтируется,
  // `initBookingKey` заново не диспатчится, и на сервер уходит тот же ключ.
  it('внутри монтирования ключ не меняется', async () => {
    const { result } = await renderHook(() => useGuestFlow(), { wrapper });

    await act(() => {
      result.current.initBookingKey();
    });
    const retryKey = result.current.bookingKey;

    expect(retryKey).toBe('uuid-1');
    expect(mockNewBookingKey).toHaveBeenCalledTimes(1);
  });

  // Спека 14: смена слота размонтирует форму, и новое монтирование обязано дать новый ключ,
  // иначе тот же ключ с другой нагрузкой получит DUPLICATE_BOOKING_ID.
  it('новое монтирование формы даёт новый ключ', async () => {
    const { result } = await renderHook(() => useGuestFlow(), { wrapper });

    let first = '';
    let second = '';
    await act(() => {
      first = result.current.initBookingKey();
    });
    await act(() => {
      second = result.current.initBookingKey();
    });

    expect(first).toBe('uuid-1');
    expect(second).toBe('uuid-2');
    expect(result.current.bookingKey).toBe('uuid-2');
  });

  it('после успеха ключ освобождается', async () => {
    const { result } = await renderHook(() => useGuestFlow(), { wrapper });

    await act(() => {
      result.current.initBookingKey();
    });
    await act(() => result.current.completeBooking());

    expect(result.current.bookingKey).toBeNull();
  });

  it('useGuestFlow вне провайдера падает явной ошибкой', async () => {
    await expect(renderHook(() => useGuestFlow())).rejects.toThrow('вне GuestFlowProvider');
  });
});
