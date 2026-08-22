import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useReducer } from 'react';

import { errorMessage } from '@/features/owner/model/errors';
import { createEventType } from '@/features/owner/usecases/owner';
import type { OwnerMeetingsStackParamList } from '@/navigation/OwnerMeetingsStackParamList';

import {
  createEventTypeReducer,
  initialCreateEventTypeState,
  isCreateEventTypeFormValid,
} from './CreateEventTypeState';
import { CreateEventTypeView } from './CreateEventTypeView';

type Props = NativeStackScreenProps<OwnerMeetingsStackParamList, 'CreateEventType'>;

/**
 * Раскладка серверного кода в полевую ошибку публичного id (UX rule спеки 10, комментарий
 * в `features/owner/model/errors.ts`) — конвенция контейнера, грамматика UISpec её не описывает.
 */
const DUPLICATE_EVENT_TYPE_ID = 'DUPLICATE_EVENT_TYPE_ID';

/**
 * Контейнер экрана `owner.create-event-type` (спека 10).
 *
 * `submitEventType` спеки шлёт плоский `CreateEventTypeRequest`; повторный submit заблокирован —
 * функция выходит рано, если форма невалидна или запрос уже в полёте, тем же условием, что
 * держит CTA недоступной (`disabledWhen`).
 */
export function CreateEventTypeScreen({ navigation }: Props) {
  const [state, dispatch] = useReducer(createEventTypeReducer, initialCreateEventTypeState);

  const submit = useCallback(async () => {
    if (state.kind === 'submitting' || !isCreateEventTypeFormValid(state.form)) {
      return;
    }

    dispatch({ type: 'submit/started' });

    const { name, description, durationMinutes, id } = state.form;
    const trimmedDescription = description.trim();
    const result = await createEventType({
      id,
      name: name.trim(),
      durationMinutes,
      ...(trimmedDescription === '' ? {} : { description: trimmedDescription }),
    });

    if (result.ok) {
      // `onSuccessRoute="EventTypes"`: route уже в стеке (он его открыл), поэтому `navigate`
      // возвращается к существующему экземпляру, а не создаёт новый.
      navigation.navigate('EventTypes');
      return;
    }

    const message = errorMessage(result.error);
    const fieldErrors =
      result.error.code === DUPLICATE_EVENT_TYPE_ID ? [{ field: 'public-id', message }] : [];
    dispatch({ type: 'submit/failed', fieldErrors, message });
  }, [navigation, state.form, state.kind]);

  const onSubmit = useCallback(() => {
    void submit();
  }, [submit]);

  const onChangeTitle = useCallback((value: string) => {
    dispatch({ type: 'changeName', value });
  }, []);

  const onChangeDescription = useCallback((value: string) => {
    dispatch({ type: 'changeDescription', value });
  }, []);

  const onChangeDuration = useCallback((value: number) => {
    dispatch({ type: 'changeDuration', value });
  }, []);

  const onChangePublicId = useCallback((value: string) => {
    dispatch({ type: 'changePublicId', value });
  }, []);

  const onGoBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  return (
    <CreateEventTypeView
      state={state}
      onChangeTitle={onChangeTitle}
      onChangeDescription={onChangeDescription}
      onChangeDuration={onChangeDuration}
      onChangePublicId={onChangePublicId}
      onSubmit={onSubmit}
      onGoBack={onGoBack}
    />
  );
}

export default CreateEventTypeScreen;
