import { useEffect, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator } from 'react-native';

import { AppButton } from '@/design-system/components/AppButton';
import { AppIcon } from '@/design-system/components/AppIcon';
import { AppText } from '@/design-system/components/AppText';
import { AppSafeArea } from '@/design-system/layout/AppSafeArea';
import { Center } from '@/design-system/layout/Center';
import { Spacer } from '@/design-system/layout/Spacer';
import { useColors } from '@/design-system/theme';
import { sizes, spacing, typography } from '@/design-system/tokens';
import { AnimatedSetupIllustration } from '@/features/setup/components/AnimatedSetupIllustration';
import { StateView } from '@/shared/ui-state/StateView';

import type { SetupCheckState } from './generated/SetupCheck.types.generated';

export interface SetupCheckViewProps {
  state: SetupCheckState;
  onRetry: () => void;
}

/**
 * `$accessibility.reduceMotion` спеки: системная настройка «уменьшить анимацию», а не проп
 * контейнера — тот же приём, что `useWindowDimensions()` в `GuestEventTypesView` для адаптивной
 * раскладки: чтение платформы, а не данных use-case, поэтому остаётся во view.
 */
function useReduceMotionPreference(): boolean {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (mounted) {
        setReduceMotion(value);
      }
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  return reduceMotion;
}

/**
 * View экрана `owner.setup-check` (кадр 1). Чистая презентация: проверку setup и маршрутизацию
 * по результату ведёт контейнер, сюда приходит только состояние и колбэк «Повторить».
 *
 * TODO-COMPONENT: спека объявляет `<ProgressIndicator variant="circular" .../>`, зарегистрированный
 * в `components.registry.xml` на `@/design-system/components/ProgressIndicator` — файла с такой
 * реализацией в `design-system/` нет (P07–P12 его не заводили, а P15 эту зону не редактирует).
 * Плейсхолдер — встроенный RN `ActivityIndicator`: он тоже indeterminate и не рисует ложный
 * процент, что как раз соответствует Rules экрана («не симулирует ложный точный процент, если
 * backend его не предоставляет»). `accessibilityLabel` ниже несёт AC «Loader имеет доступный
 * текст» напрямую, независимо от статуса компонента — гейт не заблокирован.
 *
 * Иконка ошибки: спека даёт литерал `size="48"`, а не токен (все соседние error-состояния —
 * 05/12/13/15 — используют `$size.icon.large` для того же `Icon name="cloud-off"`). Хардкодить
 * число вместо токена запрещено (`apps/client/AGENTS.md`), поэтому здесь — `sizes.icon.large`,
 * как в уже реализованном `GuestEventTypesView`.
 */
export function SetupCheckView({ state, onRetry }: SetupCheckViewProps) {
  const colors = useColors();
  const reduceMotion = useReduceMotionPreference();

  return (
    <AppSafeArea background={colors.background.primary}>
      <StateView state="checking" current={state.kind}>
        {state.kind !== 'checking' ? null : (
          <Center flex={1} paddingHorizontal={spacing[24]}>
            <AnimatedSetupIllustration progress={state.progress} reduceMotion={reduceMotion} />
            <Spacer size={spacing[24]} />
            <AppText typography={typography.display.small} align="center">
              Calendar
            </AppText>
            <Spacer size={spacing[8]} />
            <AppText typography={typography.body.medium} color={colors.text.secondary} align="center">
              Проверяем настройки…
            </AppText>
            <Spacer size={spacing[20]} />
            <ActivityIndicator
              testID="setup-check-progress"
              size="large"
              color={colors.icon.secondary}
              accessibilityLabel="Проверяем настройки календаря"
            />
          </Center>
        )}
      </StateView>

      <StateView state="error" current={state.kind}>
        {state.kind !== 'error' ? null : (
          <Center flex={1} padding={spacing[24]}>
            <AppIcon name="cloud-off" size={sizes.icon.large} color={colors.icon.secondary} />
            <Spacer size={spacing[16]} />
            <AppText typography={typography.title.medium} align="center">
              Не удалось проверить настройки
            </AppText>
            <Spacer size={spacing[8]} />
            <AppText
              typography={typography.body.medium}
              color={colors.text.secondary}
              align="center"
              testID="setup-check-error-message"
            >
              {state.message}
            </AppText>
            <Spacer size={spacing[24]} />
            <AppButton
              variant="secondary"
              height={sizes.button.height}
              label="Повторить"
              onPress={onRetry}
            />
          </Center>
        )}
      </StateView>
    </AppSafeArea>
  );
}

export default SetupCheckView;
