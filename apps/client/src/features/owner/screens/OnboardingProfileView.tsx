import { AppButton } from '@/design-system/components/AppButton';
import { AppSelectField } from '@/design-system/components/AppSelectField';
import { AppText } from '@/design-system/components/AppText';
import { AppTextField } from '@/design-system/components/AppTextField';
import { ProgressHeader } from '@/design-system/components/ProgressHeader';
import { AppSafeArea } from '@/design-system/layout/AppSafeArea';
import { AppScrollView } from '@/design-system/layout/AppScrollView';
import { Column } from '@/design-system/layout/Column';
import { Spacer } from '@/design-system/layout/Spacer';
import { useColors } from '@/design-system/theme';
import { spacing, typography } from '@/design-system/tokens';
import { fieldError, type FieldError } from '@/shared/forms';

import type { OwnerProfileDraft } from './generated/OnboardingProfile.types.generated';

export interface OnboardingProfileViewProps {
  form: OwnerProfileDraft;
  fieldErrors: FieldError[];
  invalid: boolean;
  onChangeDisplayName: (value: string) => void;
  onChangeTimezone: (value: string) => void;
  onContinue: () => void;
}

/**
 * View экрана `owner.onboarding-profile` (кадр 2). Корень — `AppSafeArea` без нижнего края: его
 * отдельно берёт `AppSafeArea edges={['bottom']}` вокруг CTA (`SafeArea edges="bottom"` спеки),
 * иначе нижний inset посчитался бы дважды (тот же приём, что в `OwnerBottomNavigation`).
 */
export function OnboardingProfileView({
  form,
  fieldErrors,
  invalid,
  onChangeDisplayName,
  onChangeTimezone,
  onContinue,
}: OnboardingProfileViewProps) {
  const colors = useColors();

  return (
    <AppSafeArea background={colors.background.primary} edges={['top', 'left', 'right']}>
      <ProgressHeader current={1} total={2} />
      <AppScrollView
        flex={1}
        keyboardAvoiding
        contentPaddingHorizontal={spacing[16]}
        contentPaddingBottom={spacing[24]}
      >
        <Spacer size={spacing[24]} />
        <AppText typography={typography.title.large}>Настройка календаря</AppText>
        <Spacer size={spacing[24]} />
        <AppTextField
          label="Отображаемое имя"
          value={form.displayName}
          onChangeText={onChangeDisplayName}
          error={fieldError(fieldErrors, 'display-name')}
          testID="display-name"
        />
        <Spacer size={spacing[24]} />
        <AppSelectField
          label="Timezone"
          value={form.timeZone}
          onChange={onChangeTimezone}
          optionsSource="system.ianaTimezones"
          searchable
          error={fieldError(fieldErrors, 'timezone')}
          testID="timezone"
        />
        <Spacer size={spacing[8]} />
        <AppText typography={typography.body.small} color={colors.text.secondary}>
          Встречи владельца будут отображаться в этой timezone.
        </AppText>
      </AppScrollView>
      <AppSafeArea edges={['bottom']} background={colors.background.primary}>
        <Column padding={spacing[16]}>
          <AppButton
            variant="primary"
            width="fill"
            label="Продолжить"
            onPress={onContinue}
            disabled={invalid}
            testID="continue-onboarding"
          />
        </Column>
      </AppSafeArea>
    </AppSafeArea>
  );
}

export default OnboardingProfileView;
