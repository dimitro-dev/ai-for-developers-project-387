/**
 * Состояние гостевой ветки, живущее вне параметров route (brief FR7):
 * черновик формы — это PII, а на web параметры route уезжают в URL и историю браузера.
 *
 * Редьюсер — чистый: UUID ключа идемпотентности генерируется вызывающим кодом
 * и приходит в действии `booking/init`. Это делает правила ключа проверяемыми
 * без обращения к криптографии платформы.
 */

export type GuestDraft = {
  name: string;
  email: string;
  note: string;
};

export type GuestFlowState = {
  draft: GuestDraft;
  /** `CreateBookingRequest.id` — живёт ровно монтирование формы (спека 14, ADR §5). */
  bookingKey: string | null;
};

export type GuestFlowAction =
  | { type: 'draft/change'; field: keyof GuestDraft; value: string }
  | { type: 'booking/init'; key: string }
  | { type: 'booking/succeeded' }
  | { type: 'flow/reset' };

export const emptyDraft: GuestDraft = { name: '', email: '', note: '' };

export const initialGuestFlowState: GuestFlowState = {
  draft: emptyDraft,
  bookingKey: null,
};

export function guestFlowReducer(state: GuestFlowState, action: GuestFlowAction): GuestFlowState {
  switch (action.type) {
    case 'draft/change':
      return { ...state, draft: { ...state.draft, [action.field]: action.value } };

    // Ключ выдаётся заново на каждое монтирование формы — до первой попытки отправки
    // (`initBookingKey` спеки 14). Внутри монтирования он не меняется, поэтому повтор после
    // обрыва сети уходит с тем же ключом и той же нагрузкой; новое монтирование после смены
    // слота получает новый ключ, и старый ключ с другой нагрузкой на сервер уйти не может.
    case 'booking/init':
      return { ...state, bookingKey: action.key };

    case 'booking/succeeded':
      return { ...state, bookingKey: null };

    case 'flow/reset':
      return initialGuestFlowState;
  }
}
