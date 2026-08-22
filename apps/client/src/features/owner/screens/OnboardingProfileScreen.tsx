import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useReducer } from 'react';

import type { OnboardingStackParamList } from '@/navigation/OnboardingStackParamList';
import { guestTimeZone } from '@/shared/datetime';

import { onboardingProfileReducer, validateOwnerProfileDraft } from './OnboardingProfileState';
import { OnboardingProfileView } from './OnboardingProfileView';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'OnboardingProfile'>;

/**
 * Контейнер экрана `owner.onboarding-profile` (спека 02, route `OnboardingProfile`).
 *
 * `guestTimeZone()` (`@/shared/datetime`) — то же самое `$system.timeZone` устройства, которым
 * пользуется гостевой флоу под этим именем: helper общий (`shared/`, не `features/guest/**`),
 * так что здесь он читает timezone устройства владельца, а не гостя (UX rule «timezone по
 * умолчанию определяется устройством»).
 *
 * `continueOnboarding` — синхронный `navigation.push` (ADR §2, §4: сквозного owner-состояния
 * нет, черновик едет параметром навигации): экран не размонтируется react-navigation при push,
 * поэтому возврат со второго шага сохраняет введённые значения без отдельной синхронизации
 * (UX rule «черновик... сохраняется при возврате»).
 */
export function OnboardingProfileScreen({ navigation }: Props) {
  const [state, dispatch] = useReducer(onboardingProfileReducer, undefined, () => ({
    form: { displayName: '', timeZone: guestTimeZone() },
  }));

  const fieldErrors = validateOwnerProfileDraft(state.form);
  const invalid = fieldErrors.length > 0;

  function onContinue() {
    if (invalid) {
      return;
    }
    navigation.push('OnboardingWorkingHours', { profileDraft: state.form });
  }

  return (
    <OnboardingProfileView
      form={state.form}
      fieldErrors={fieldErrors}
      invalid={invalid}
      onChangeDisplayName={(value) => dispatch({ type: 'changeDisplayName', value })}
      onChangeTimezone={(value) => dispatch({ type: 'changeTimezone', value })}
      onContinue={onContinue}
    />
  );
}

export default OnboardingProfileScreen;
