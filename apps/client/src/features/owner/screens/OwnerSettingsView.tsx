import { View } from 'react-native';

import { AppButton } from '@/design-system/components/AppButton';
import { AppHeader } from '@/design-system/components/AppHeader';
import { AppIcon } from '@/design-system/components/AppIcon';
import { AppText } from '@/design-system/components/AppText';
import { Skeleton } from '@/design-system/components/Skeleton';
import { AppSafeArea } from '@/design-system/layout/AppSafeArea';
import { AppScrollView } from '@/design-system/layout/AppScrollView';
import { Center } from '@/design-system/layout/Center';
import { Column } from '@/design-system/layout/Column';
import { Spacer } from '@/design-system/layout/Spacer';
import { useColors } from '@/design-system/theme';
import { radii, sizes, spacing, typography } from '@/design-system/tokens';
import { SettingsRow } from '@/features/settings/components/SettingsRow';
import { StateView } from '@/shared/ui-state/StateView';

import type { OwnerSettingsState } from './OwnerSettingsState';

export interface OwnerSettingsViewProps {
  state: OwnerSettingsState;
  onOpenProfileSettings: () => void;
  onOpenWorkingHoursSettings: () => void;
  onOpenEventTypes: () => void;
  onRetry: () => void;
}

/**
 * View экрана `owner.settings` (спека 08, корень вкладки «Настройки»). Таб-бар
 * (`BottomNavigation`) не рендерится здесь: это `OwnerBottomNavigation` — кастомный `tabBar`
 * `OwnerTabs` (P10), видимый во всех состояниях автоматически, вне ответственности этого view.
 */
export function OwnerSettingsView({
  state,
  onOpenProfileSettings,
  onOpenWorkingHoursSettings,
  onOpenEventTypes,
  onRetry,
}: OwnerSettingsViewProps) {
  const colors = useColors();

  return (
    <AppSafeArea background={colors.background.primary}>
      <AppHeader title="Настройки" />

      <StateView state="loading" current={state.kind}>
        <Column padding={spacing[16]} gap={spacing[8]}>
          <Skeleton variant="settings-row" height={sizes.row.settings.height} />
          <Skeleton variant="settings-row" height={sizes.row.settings.height} />
          <Skeleton variant="settings-row" height={sizes.row.settings.height} />
        </Column>
      </StateView>

      <StateView state="content" current={state.kind}>
        {state.kind !== 'content' ? null : (
          <AppScrollView flex={1} contentPaddingTop={spacing[8]}>
            <SettingsRow
              icon="user"
              title="Профиль и timezone"
              subtitle={`${state.data.displayName} · ${state.data.timeZone}`}
              onPress={onOpenProfileSettings}
              testID="settings-row-profile"
            />
            <SettingsRow
              icon="calendar"
              title="Рабочее время"
              subtitle={state.data.workingHoursSummary}
              onPress={onOpenWorkingHoursSettings}
              testID="settings-row-working-hours"
            />
            <SettingsRow
              icon="event-type"
              title="Типы событий"
              subtitle="Управление форматами встреч"
              onPress={onOpenEventTypes}
              testID="settings-row-event-types"
            />
          </AppScrollView>
        )}
      </StateView>

      <StateView state="error" current={state.kind}>
        <Center flex={1} padding={spacing[24]}>
          <NetworkErrorIllustration />
          <Spacer size={spacing[16]} />
          <AppText typography={typography.title.medium} align="center">
            Не удалось загрузить настройки
          </AppText>
          <Spacer size={spacing[8]} />
          <AppText typography={typography.body.medium} color={colors.text.secondary} align="center">
            Проверьте подключение и попробуйте ещё раз.
          </AppText>
          <Spacer size={spacing[24]} />
          <AppButton variant="primary" width="fill" label="Повторить" onPress={onRetry} testID="retry-settings-summary" />
        </Center>
      </StateView>
    </AppSafeArea>
  );
}

/**
 * TODO-ASSET: иллюстрации `$asset.network-error` в пакете UISpec нет (ASSETS.md), вырезать её
 * из PNG макета нельзя. Тот же приём-плейсхолдер, что у `GuestBookingFormView`/`EmptyState`.
 */
function NetworkErrorIllustration() {
  const colors = useColors();
  return (
    <View
      testID="asset-network-error"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: 208,
        height: 176,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: radii[16],
        backgroundColor: colors.background.secondary,
      }}
    >
      <AppIcon name="cloud-off" size={sizes.icon.hero} color={colors.icon.secondary} />
    </View>
  );
}

export default OwnerSettingsView;
