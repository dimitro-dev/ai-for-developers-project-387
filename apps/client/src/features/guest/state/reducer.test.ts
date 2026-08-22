import {
  guestFlowReducer,
  initialGuestFlowState,
  type GuestFlowState,
} from '@/features/guest/state/reducer';

const filledDraft: GuestFlowState = {
  draft: { name: 'Анна', email: 'anna@example.com', note: 'Обсудить контракт' },
  bookingKey: null,
};

describe('guestFlowReducer — черновик формы гостя', () => {
  it('обновляет поле черновика, не трогая остальные', () => {
    const next = guestFlowReducer(filledDraft, {
      type: 'draft/change',
      field: 'email',
      value: 'anna+new@example.com',
    });

    expect(next.draft).toEqual({
      name: 'Анна',
      email: 'anna+new@example.com',
      note: 'Обсудить контракт',
    });
  });

  // AC3: конфликт слота возвращает гостя на экран слотов; ни один шаг этого пути
  // черновик не очищает — он живёт в контейнере ветки, а не в параметрах route.
  it('черновик переживает возврат на экран слотов и новое монтирование формы', () => {
    const submitted = guestFlowReducer(filledDraft, { type: 'booking/init', key: 'key-1' });
    const remounted = guestFlowReducer(submitted, { type: 'booking/init', key: 'key-2' });

    expect(remounted.draft).toEqual(filledDraft.draft);
  });

  it('сбрасывает состояние ветки целиком по flow/reset', () => {
    const initialized = guestFlowReducer(filledDraft, { type: 'booking/init', key: 'key-1' });

    expect(guestFlowReducer(initialized, { type: 'flow/reset' })).toEqual(initialGuestFlowState);
  });
});

describe('guestFlowReducer — ключ идемпотентности', () => {
  it('выдаёт ключ при монтировании формы, до первой отправки', () => {
    const next = guestFlowReducer(initialGuestFlowState, { type: 'booking/init', key: 'key-1' });

    expect(next.bookingKey).toBe('key-1');
  });

  // Спека 14: «ключ живёт ровно монтирование». Смена слота меняет нагрузку, и тот же ключ
  // с другой нагрузкой дал бы DUPLICATE_BOOKING_ID — поэтому запись безусловная.
  it('новое монтирование формы заменяет ключ', () => {
    const first = guestFlowReducer(initialGuestFlowState, { type: 'booking/init', key: 'key-1' });
    const remounted = guestFlowReducer(first, { type: 'booking/init', key: 'key-2' });

    expect(remounted.bookingKey).toBe('key-2');
  });

  it('освобождает ключ после успеха', () => {
    const initialized = guestFlowReducer(initialGuestFlowState, {
      type: 'booking/init',
      key: 'key-1',
    });
    const succeeded = guestFlowReducer(initialized, { type: 'booking/succeeded' });

    expect(succeeded.bookingKey).toBeNull();
  });
});
