import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { useReducer } from 'react';

import { toAvailabilityRules, type WorkingInterval } from '@/features/availability/lib';
import { errorMessage } from '@/features/owner/model/errors';
import { completeSetup } from '@/features/owner/usecases/owner';
import type { OnboardingStackParamList } from '@/navigation/OnboardingStackParamList';
import type { OwnerRootStackParamList } from '@/navigation/OwnerRootStackParamList';

import {
  initialOnboardingWorkingHoursState,
  onboardingWorkingHoursReducer,
  validateWorkingHoursDraft,
} from './OnboardingWorkingHoursState';
import { OnboardingWorkingHoursView } from './OnboardingWorkingHoursView';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'OnboardingWorkingHours'>;

/**
 * Контейнер экрана `owner.onboarding-working-hours` (спека 03, route `OnboardingWorkingHours`).
 *
 * `completeSetup` (`onSuccessRoute="OwnerMeetings"`) — переход в другую ветку корневого
 * навигатора (`OwnerRoot`: `OnboardingStack` и `OwnerTabs` — соседние route, не предки друг
 * друга), поэтому нужен `navigation.getParent()` до корневого стека и `reset`, а не `navigate`
 * вложенного `OnboardingStack`: онбординг завершён необратимо, системная «назад» не должна
 * возвращать в его экраны (тот же принцип, что `navigation.reset` после успешной брони гостя).
 */
export function OnboardingWorkingHoursScreen({ navigation, route }: Props) {
  const { profileDraft } = route.params;
  const [state, dispatch] = useReducer(
    onboardingWorkingHoursReducer,
    profileDraft.timeZone,
    initialOnboardingWorkingHoursState,
  );

  async function submit() {
    if (validateWorkingHoursDraft(state.form) !== null || state.kind === 'submitting') {
      return;
    }

    dispatch({ type: 'submit/started' });

    const result = await completeSetup({
      displayName: profileDraft.displayName,
      timeZone: profileDraft.timeZone,
      availabilityRules: toAvailabilityRules(state.form.availabilityRules),
      slotIntervalMinutes: state.form.slotIntervalMinutes,
    });

    if (result.ok) {
      const parent = navigation.getParent<NativeStackNavigationProp<OwnerRootStackParamList> | undefined>();
      parent?.reset({
        index: 0,
        routes: [{ name: 'OwnerTabs', params: { screen: 'MeetingsTab', params: { screen: 'OwnerMeetings' } } }],
      });
      return;
    }

    dispatch({ type: 'submit/failed', message: errorMessage(result.error) });
  }

  return (
    <OnboardingWorkingHoursView
      state={state}
      onBack={() => navigation.goBack()}
      onOpenAdd={() => dispatch({ type: 'openAddWorkingHours' })}
      onEditInterval={(interval: WorkingInterval) => dispatch({ type: 'editWorkingInterval', interval })}
      onApplyInterval={(payload) => dispatch({ type: 'applyWorkingInterval', ...payload })}
      onCloseSheet={() => dispatch({ type: 'closeAddWorkingHours' })}
      onChangeSlotStep={(value) => dispatch({ type: 'changeSlotStep', value })}
      onSubmit={() => {
        void submit();
      }}
    />
  );
}

export default OnboardingWorkingHoursScreen;
