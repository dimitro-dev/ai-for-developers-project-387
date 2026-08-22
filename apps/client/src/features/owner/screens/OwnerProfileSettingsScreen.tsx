import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useReducer } from 'react';

import { errorMessage } from '@/features/owner/model/errors';
import { toSetupRequest } from '@/features/owner/model/mappers';
import { loadOwnerSettings, saveOwnerSettings } from '@/features/owner/usecases/owner';
import type { OwnerSettingsStackParamList } from '@/navigation/OwnerSettingsStackParamList';

import {
  initialOwnerProfileSettingsState,
  ownerProfileSettingsReducer,
  validateOwnerProfileSettingsDraft,
} from './OwnerProfileSettingsState';
import { OwnerProfileSettingsView } from './OwnerProfileSettingsView';

type Props = NativeStackScreenProps<OwnerSettingsStackParamList, 'OwnerProfileSettings'>;

/**
 * Контейнер экрана `owner.profile-settings` (спека 09).
 *
 * `loadProfileSettings` (`getAdminSettings`, единый usecase P13 `loadOwnerSettings`) грузится
 * один раз при монтировании — экран открыт push'ем из корня «Настройки» (спека 08), повторного
 * фокуса здесь не описано ни одним UX rule, в отличие от root-экранов таба.
 *
 * `saveProfileSettings` (GAP-003): read-modify-write полным `SetupRequest` — `toSetupRequest`
 * (P13) берёт нетронутые `availabilityRules`/`slotIntervalMinutes` из `snapshot` (реальный
 * `getAdminSettings`, загруженный при входе), поверх накладывает правки `displayName`/`timeZone`
 * (AC6 brief: сохранение профиля не должно терять рабочее время).
 */
export function OwnerProfileSettingsScreen({ navigation }: Props) {
  const [state, dispatch] = useReducer(ownerProfileSettingsReducer, initialOwnerProfileSettingsState);

  useEffect(() => {
    let cancelled = false;

    void loadOwnerSettings().then((result) => {
      if (cancelled) {
        return;
      }
      if (result.ok) {
        dispatch({ type: 'load/succeeded', view: result.data });
        return;
      }
      dispatch({ type: 'load/failed', message: errorMessage(result.error) });
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const submit = useCallback(async () => {
    if (state.kind === 'loading' || state.kind === 'saving') {
      return;
    }
    if (!state.dirty || validateOwnerProfileSettingsDraft(state.form).length > 0) {
      return;
    }

    dispatch({ type: 'save/started' });

    const request = toSetupRequest(state.snapshot, {
      displayName: state.form.displayName,
      timeZone: state.form.timeZone,
    });
    const result = await saveOwnerSettings(request);

    if (result.ok) {
      dispatch({ type: 'save/succeeded' });
      return;
    }
    dispatch({ type: 'save/failed', message: errorMessage(result.error) });
  }, [state]);

  const onSubmit = useCallback(() => {
    void submit();
  }, [submit]);

  const onChangeDisplayName = useCallback((value: string) => {
    dispatch({ type: 'changeDisplayName', value });
  }, []);

  const onChangeTimezone = useCallback((value: string) => {
    dispatch({ type: 'changeTimezone', value });
  }, []);

  const onGoBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  return (
    <OwnerProfileSettingsView
      state={state}
      onGoBack={onGoBack}
      onChangeDisplayName={onChangeDisplayName}
      onChangeTimezone={onChangeTimezone}
      onSubmit={onSubmit}
    />
  );
}

export default OwnerProfileSettingsScreen;
