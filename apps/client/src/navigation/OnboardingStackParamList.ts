import type { OwnerProfileDraft } from '@/features/owner/screens/generated/OnboardingProfile.types.generated';

/**
 * Типы параметров вложенного стека `<Stack id="OnboardingStack">` из `navigation.uispec.xml` —
 * ручной перенос 1:1 (по образцу `GuestStackParamList`). `OnboardingWorkingHours` принимает
 * черновик профиля параметром навигации: действие `continueOnboarding` спеки экрана 02 несёт
 * `<Param name="profileDraft">`, а сквозного owner-состояния нет (ADR §4) — черновик едет
 * только так. `OwnerProfileDraft` — общий generated-тип экранов 02/03 (`displayName`,
 * `timeZone`), реэкспортирован генератором каркасов в обоих `*.types.generated.ts`.
 */
export type OnboardingStackParamList = {
  OnboardingProfile: undefined;
  OnboardingWorkingHours: {
    profileDraft: OwnerProfileDraft;
  };
};

export const onboardingStackInitialRoute = 'OnboardingProfile' satisfies keyof OnboardingStackParamList;
