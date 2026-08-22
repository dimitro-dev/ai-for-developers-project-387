import { AppButton } from '@/design-system/components/AppButton';
import { AppHeader } from '@/design-system/components/AppHeader';
import { AppSelectField } from '@/design-system/components/AppSelectField';
import { AppText } from '@/design-system/components/AppText';
import { AppTextField } from '@/design-system/components/AppTextField';
import { Skeleton } from '@/design-system/components/Skeleton';
import { ValidationMessage } from '@/design-system/components/ValidationMessage';
import { AppSafeArea } from '@/design-system/layout/AppSafeArea';
import { AppScrollView } from '@/design-system/layout/AppScrollView';
import { Column } from '@/design-system/layout/Column';
import { Spacer } from '@/design-system/layout/Spacer';
import { useColors } from '@/design-system/theme';
import { sizes, spacing, typography } from '@/design-system/tokens';
import { fieldError } from '@/shared/forms';
import { StateView } from '@/shared/ui-state/StateView';

import { validateOwnerProfileSettingsDraft, type OwnerProfileSettingsState } from './OwnerProfileSettingsState';

export interface OwnerProfileSettingsViewProps {
  state: OwnerProfileSettingsState;
  onGoBack: () => void;
  onChangeDisplayName: (value: string) => void;
  onChangeTimezone: (value: string) => void;
  onSubmit: () => void;
}

/**
 * View экрана `owner.profile-settings` (спека 09, кадры 1/2/4). Кадр 3 (выбор timezone) —
 * внутренняя раскладка `AppSelectField` (P08), сюда не разворачивается (MANUAL §13).
 * `BottomNavigation` не рендерится: это кастомный `tabBar` `OwnerTabs` (P10), видимый
 * автоматически во всех состояниях.
 */
export function OwnerProfileSettingsView({
  state,
  onGoBack,
  onChangeDisplayName,
  onChangeTimezone,
  onSubmit,
}: OwnerProfileSettingsViewProps) {
  const colors = useColors();
  const saving = state.kind === 'saving';

  return (
    <AppSafeArea background={colors.background.primary} edges={['top', 'left', 'right']}>
      <AppHeader title="Профиль и timezone" backAction={onGoBack} />

      <StateView state="loading" current={state.kind}>
        <Column flex={1} padding={spacing[16]} gap={spacing[8]}>
          <AppText typography={typography.label.large}>Отображаемое имя</AppText>
          <Skeleton variant="field" height={sizes.input.height} />
          <Spacer size={spacing[16]} />
          <AppText typography={typography.label.large}>Timezone</AppText>
          <Skeleton variant="field" height={sizes.input.height} />
          <Spacer size={spacing[16]} />
          <Skeleton variant="text" />
        </Column>
      </StateView>

      <StateView state="editing|saving|error|saved" current={state.kind}>
        {state.kind === 'loading' ? null : (
          <>
            <AppScrollView flex={1} keyboardAvoiding contentPaddingHorizontal={spacing[16]}>
              {/*
                TODO-COMPONENT: спека несёт `disabled="{$state == saving}"` у `TextField» — `AppTextField`
                (design-system, read-only в этой задаче) такого пропа не поддерживает. `AppSelectField`
                ниже дизейблится штатно; текстовое поле остаётся editable во время сохранения — та же
                известная граница, что у `icon="plus"` `AppButton` (см. соседний экран 07).
              */}
              <AppTextField
                label="Отображаемое имя"
                value={state.form.displayName}
                onChangeText={onChangeDisplayName}
                error={fieldError(state.fieldErrors, 'display-name')}
                testID="display-name"
              />
              <Spacer size={spacing[24]} />
              <AppSelectField
                label="Timezone"
                value={state.form.timeZone}
                onChange={onChangeTimezone}
                optionsSource="system.ianaTimezones"
                searchable
                searchPlaceholder="Поиск timezone"
                error={fieldError(state.fieldErrors, 'timezone')}
                disabled={saving}
                testID="timezone"
              />
              <Spacer size={spacing[12]} />
              <AppText typography={typography.body.small} color={colors.text.secondary}>
                Новые слоты будут рассчитываться в этой timezone. Существующие встречи не изменятся.
              </AppText>
              {state.kind === 'error' ? (
                <>
                  <Spacer size={spacing[12]} />
                  <ValidationMessage message={state.message} testID="profile-settings-error" />
                </>
              ) : null}
            </AppScrollView>
            <AppSafeArea edges={['bottom']} background={colors.background.primary}>
              <Column padding={spacing[16]}>
                <AppButton
                  variant="primary"
                  width="fill"
                  label={saving ? 'Сохраняем...' : 'Сохранить изменения'}
                  onPress={onSubmit}
                  loading={saving}
                  disabled={saving || !state.dirty || validateOwnerProfileSettingsDraft(state.form).length > 0}
                  testID="save-profile-settings"
                />
              </Column>
            </AppSafeArea>
          </>
        )}
      </StateView>
    </AppSafeArea>
  );
}

export default OwnerProfileSettingsView;
