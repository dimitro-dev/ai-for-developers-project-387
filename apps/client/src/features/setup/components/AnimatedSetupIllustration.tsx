import { useEffect, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';

import { AppIcon } from '@/design-system/components/AppIcon';
import { useColors } from '@/design-system/theme';
import { motion, radii, sizes } from '@/design-system/tokens';

const ILLUSTRATION_WIDTH = 232;
const ILLUSTRATION_HEIGHT = 196;

export interface AnimatedSetupIllustrationProps {
  /**
   * `$state.progress` экрана 01 (0..1) — заглушке ничего визуально не добавляет: определённый
   * прогресс backend не гарантирует (UX rules экрана), поэтому placeholder не рисует ложный %.
   * Проп принят для совместимости с component spec и будущей заменой на реальный asset.
   */
  progress?: number;
  /** `$accessibility.reduceMotion` экрана: при `true` иллюстрация полностью статична. */
  reduceMotion: boolean;
  testID?: string;
}

/**
 * UISpec-тег `AnimatedSetupIllustration`.
 *
 * TODO-ASSET: `$asset.setup-check` в пакете UISpec нет (`ASSETS.md`) — календарь, pulse checkmark
 * и orbit двух декоративных точек из Rules спеки появятся вместе с реальным ассетом. До этого —
 * плейсхолдер тех же размеров с глифом `check-circle` (тот же приём, что `$asset.network-error`
 * в `EmptyState`/`GuestBookingFormView`). MANUAL §11: генератор не строит тяжёлую анимацию из
 * предположений, Reanimated/Lottie — только под согласованный asset; новых зависимостей нет.
 * Единственное движение placeholder — мягкий opacity-pulse глифа на встроенном RN `Animated`
 * (длительность/повтор — токен `$motion.setupCheck`, без вспышек и резких циклов — AC спеки);
 * при `reduceMotion` анимация не запускается вовсе.
 */
export function AnimatedSetupIllustration({ reduceMotion, testID }: AnimatedSetupIllustrationProps) {
  const colors = useColors();
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (reduceMotion) {
      opacity.setValue(1);
      return;
    }
    const half = motion.setupCheck.duration / 2;
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.5,
          duration: half,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: half,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [opacity, reduceMotion]);

  return (
    <View
      testID={testID ?? 'asset-setup-check'}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: ILLUSTRATION_WIDTH,
        height: ILLUSTRATION_HEIGHT,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: radii[24],
        backgroundColor: colors.background.secondary,
      }}
    >
      <Animated.View style={{ opacity: reduceMotion ? 1 : opacity }}>
        <AppIcon name="check-circle" size={sizes.icon.hero} color={colors.icon.secondary} />
      </Animated.View>
    </View>
  );
}

export default AnimatedSetupIllustration;
