import { StackActions } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useReducer, useRef } from 'react';

import { errorMessage } from '@/api/errors';
import { validateGuestForm } from '@/features/guest/lib/validateGuestForm';
import { toBookingDto } from '@/features/guest/model/mappers';
import { useGuestFlow } from '@/features/guest/state/GuestFlowProvider';
import { createBooking } from '@/features/guest/usecases/guest';
import type { GuestStackParamList } from '@/navigation/GuestStackParamList';
import { guestTimeZone } from '@/shared/datetime';

import {
  guestBookingFormReducer,
  initialGuestBookingFormState,
} from './GuestBookingFormState';
import { GuestBookingFormView } from './GuestBookingFormView';

type Props = NativeStackScreenProps<GuestStackParamList, 'GuestBookingForm'>;

/** Коды, которые возвращают гостя на существующий экран слотов (ADR §4). */
const SLOT_CONFLICT_CODES = ['SLOT_UNAVAILABLE', 'SLOT_OUTSIDE_WINDOW', 'SLOT_NOT_ALIGNED'];

/**
 * Контейнер экрана `guest.booking-form` (спека 14).
 *
 * Конвенции жизненного цикла (ADR §3): при монтировании диспатчится `initBookingKey` — до первой
 * попытки создания брони, иначе повтор нераспознаваем. Ключ живёт ровно монтирование: возврат
 * к слотам размонтирует форму, и новое открытие получит новый ключ.
 */
export function GuestBookingFormScreen({ navigation, route }: Props) {
  const { eventTypeId, eventTypeName, startAtUtc, endAtUtc } = route.params;
  const { draft, setDraftField, initBookingKey, completeBooking } = useGuestFlow();
  const [state, dispatch] = useReducer(guestBookingFormReducer, initialGuestBookingFormState);

  // Ключ держится и в ref: повтор после обрыва сети не должен зависеть от того,
  // успел ли контекст перерисовать экран.
  const bookingKeyRef = useRef<string | null>(null);
  useEffect(() => {
    bookingKeyRef.current = initBookingKey();
  }, [initBookingKey]);

  const submit = useCallback(async () => {
    const fieldErrors = validateGuestForm(draft);
    if (fieldErrors.length > 0) {
      // Запрос не уходит: `before="validateGuestForm"` → `onConflict="validationError"`.
      dispatch({ type: 'validation/failed', fieldErrors });
      return;
    }

    dispatch({ type: 'submit/started' });

    const note = draft.note.trim();
    const result = await createBooking({
      eventTypeId,
      startAtUtc,
      id: bookingKeyRef.current ?? initBookingKey(),
      guest: {
        name: draft.name.trim(),
        email: draft.email.trim(),
        ...(note === '' ? {} : { note }),
      },
    });

    if (result.ok) {
      completeBooking();
      // Вход на подтверждение — reset, а не push: иначе системное «назад» вернуло бы гостя
      // в форму уже созданной брони и предложило отправить её снова (FR4.4).
      navigation.reset({
        index: 0,
        routes: [
          { name: 'GuestBookingConfirmation', params: { booking: toBookingDto(result.data) } },
        ],
      });
      return;
    }

    // Порядок ветвей — как в `onErrorWhen` спеки, сверху вниз.
    if (result.error.transport) {
      dispatch({ type: 'submit/transportFailed' });
      return;
    }

    if (result.error.code !== null && SLOT_CONFLICT_CODES.includes(result.error.code)) {
      // Возврат на существующий экран стека, а не второй push: сам конфликт распознает
      // экран слотов на focus-refresh и покажет алерт кадра 8.
      //
      // `popTo` идёт через `StackActions`, а не через `navigation.popTo('GuestSlots')`:
      // типы требуют от него полный набор обязательных параметров route, а форма получает
      // только часть (`durationMinutes` и `eventTypeDescription` ей не передаются).
      // `merge: true` с пустыми параметрами оставляет параметры существующего экрана слотов
      // нетронутыми — без него POP_TO перезаписал бы их значениями initialParams (ADR §4).
      navigation.dispatch(StackActions.popTo('GuestSlots', undefined, { merge: true }));
      return;
    }

    dispatch({ type: 'submit/serverFailed', message: errorMessage(result.error) });
  }, [
    completeBooking,
    draft,
    eventTypeId,
    initBookingKey,
    navigation,
    startAtUtc,
  ]);

  const onSubmit = useCallback(() => {
    void submit();
  }, [submit]);

  const onChooseAnotherTime = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  return (
    <GuestBookingFormView
      state={state}
      eventTypeName={eventTypeName}
      startAtUtc={startAtUtc}
      endAtUtc={endAtUtc}
      timeZone={guestTimeZone()}
      draft={draft}
      onChangeField={setDraftField}
      onSubmit={onSubmit}
      // `retryBooking` — тот же `createBooking` с тем же ключом и той же нагрузкой:
      // формы на экране кадра 9 нет, менять нагрузку нечем.
      onRetry={onSubmit}
      onChooseAnotherTime={onChooseAnotherTime}
    />
  );
}

export default GuestBookingFormScreen;
