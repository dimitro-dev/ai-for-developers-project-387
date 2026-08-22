import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useReducer } from 'react';

import { toAvailabilityRules, type WorkingInterval } from '@/features/availability/lib';
import { errorMessage } from '@/features/owner/model/errors';
import { loadOwnerSettings, saveOwnerSettings } from '@/features/owner/usecases/owner';
import type { OwnerSettingsStackParamList } from '@/navigation/OwnerSettingsStackParamList';

import {
  initialOwnerWorkingHoursSettingsState,
  ownerWorkingHoursSettingsReducer,
  validateOwnerWorkingHoursDraft,
} from './OwnerWorkingHoursSettingsState';
import { OwnerWorkingHoursSettingsView } from './OwnerWorkingHoursSettingsView';

type Props = NativeStackScreenProps<OwnerSettingsStackParamList, 'OwnerWorkingHoursSettings'>;

/**
 * Контейнер экрана `owner.working-hours-settings` (спека 07).
 *
 * `loadWorkingHoursSettings` (`getAdminSettings`, `loadOwnerSettings` P13) грузится один раз при
 * монтировании — та же конвенция, что у соседнего экрана 09 (push из корня «Настройки», без
 * описанного в спеке повторного фокуса).
 *
 * `saveOwnerSettings` шлёт полный `SetupRequest`: `displayName`/`timeZone` берутся из того же
 * `form`, что и редактируемые `availabilityRules`/`slotIntervalMinutes` — read-modify-write без
 * отдельной модели `snapshot` (AC6 brief: сохранение рабочего времени не теряет профиль).
 */
export function OwnerWorkingHoursSettingsScreen({ navigation }: Props) {
  const [state, dispatch] = useReducer(
    ownerWorkingHoursSettingsReducer,
    initialOwnerWorkingHoursSettingsState,
  );

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
    if (validateOwnerWorkingHoursDraft(state.form) !== null || !state.dirty) {
      return;
    }

    dispatch({ type: 'save/started' });

    const result = await saveOwnerSettings({
      displayName: state.form.displayName,
      timeZone: state.form.timeZone,
      availabilityRules: toAvailabilityRules(state.form.availabilityRules),
      slotIntervalMinutes: state.form.slotIntervalMinutes,
    });

    if (result.ok) {
      dispatch({ type: 'save/succeeded' });
      return;
    }
    dispatch({ type: 'save/failed', message: errorMessage(result.error) });
  }, [state]);

  const onSubmit = useCallback(() => {
    void submit();
  }, [submit]);

  const onOpenAdd = useCallback(() => {
    dispatch({ type: 'openAddWorkingHours' });
  }, []);

  const onEditInterval = useCallback((interval: WorkingInterval) => {
    dispatch({ type: 'editWorkingInterval', interval });
  }, []);

  const onApplyInterval = useCallback(
    (payload: { daysOfWeek: WorkingInterval['daysOfWeek']; startLocal: string; endLocal: string }) => {
      dispatch({ type: 'applyWorkingInterval', ...payload });
    },
    [],
  );

  const onCloseSheet = useCallback(() => {
    dispatch({ type: 'closeAddWorkingHours' });
  }, []);

  const onChangeSlotStep = useCallback((value: number) => {
    dispatch({ type: 'changeSlotStep', value });
  }, []);

  const onOpenEventTypes = useCallback(() => {
    navigation.push('EventTypesFromSettings');
  }, [navigation]);

  return (
    <OwnerWorkingHoursSettingsView
      state={state}
      onOpenAdd={onOpenAdd}
      onEditInterval={onEditInterval}
      onApplyInterval={onApplyInterval}
      onCloseSheet={onCloseSheet}
      onChangeSlotStep={onChangeSlotStep}
      onOpenEventTypes={onOpenEventTypes}
      onSubmit={onSubmit}
    />
  );
}

export default OwnerWorkingHoursSettingsScreen;
