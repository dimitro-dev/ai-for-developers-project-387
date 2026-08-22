import { Pressable, View } from 'react-native';

import { AppIcon } from '@/design-system/components/AppIcon';
import { AppText } from '@/design-system/components/AppText';
import { Column } from '@/design-system/layout/Column';
import { Row } from '@/design-system/layout/Row';
import { useColors } from '@/design-system/theme';
import { radii, sizes, spacing, typography } from '@/design-system/tokens';

export interface ProgressHeaderProps {
  current: number;
  total: number;
  /** Кнопка «Назад» рендерится, только если действие передано — как `backAction` у `AppHeader`. */
  backAction?: () => void;
  testID?: string;
}

const BAR_HEIGHT = 4;

/**
 * UISpec-тег `ProgressHeader`: шаг онбординга — подпись «N / total» и полоса прогресса,
 * сама полоса не интерактивна (Rules спеки).
 *
 * Спека кладёт `<Spacer flex="1" />` между кнопкой «Назад» и подписью шага, но зарегистрированный
 * `Spacer` (`@/design-system/layout/Spacer`) держит только фиксированный вертикальный `size` —
 * оси у него нет (см. его комментарий). Тот же визуальный результат — подпись у правого края —
 * даёт `flex`+`align="right"` на самой подписи, как в `AppHeader` растягивает заголовок `flex={1}`
 * вместо отдельного распорного элемента.
 */
export function ProgressHeader({ current, total, backAction, testID }: ProgressHeaderProps) {
  const colors = useColors();
  const progress = Math.min(1, Math.max(0, total > 0 ? current / total : 0));

  return (
    <Column testID={testID} paddingHorizontal={spacing[16]} paddingTop={spacing[8]} gap={spacing[8]}>
      <Row align="center">
        {backAction === undefined ? null : (
          <Pressable
            testID="progress-header-back"
            onPress={backAction}
            accessibilityRole="button"
            accessibilityLabel="Назад"
            style={{
              width: sizes.touch.android,
              height: sizes.touch.android,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <AppIcon name="arrow-left" size={sizes.icon.medium} color={colors.icon.primary} />
          </Pressable>
        )}
        <AppText typography={typography.label.medium} color={colors.text.secondary} align="right" flex={1}>
          {`${current} / ${total}`}
        </AppText>
      </Row>
      {/* Прогресс отражает шаг, но не интерактивен (Rules) — скрыт от screen reader, как Skeleton. */}
      <View
        testID="progress-header-bar"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{
          height: BAR_HEIGHT,
          borderRadius: radii.pill,
          backgroundColor: colors.border.default,
          overflow: 'hidden',
        }}
      >
        <View
          testID="progress-header-bar-fill"
          style={{
            height: BAR_HEIGHT,
            width: `${progress * 100}%`,
            borderRadius: radii.pill,
            backgroundColor: colors.action.primary,
          }}
        />
      </View>
    </Column>
  );
}

export default ProgressHeader;
