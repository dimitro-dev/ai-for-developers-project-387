import type { ImageSourcePropType } from 'react-native';

import { AppButton } from '@/design-system/components/AppButton';
import { AppImage } from '@/design-system/components/AppImage';
import { AppText } from '@/design-system/components/AppText';
import { Center } from '@/design-system/layout/Center';
import { Spacer } from '@/design-system/layout/Spacer';
import { useColors } from '@/design-system/theme';
import { spacing, typography } from '@/design-system/tokens';

/**
 * Размеры иллюстрации и максимальная ширина текста заданы литералами прямо в спеке
 * empty-state.component.md — токенов для них нет.
 */
const ILLUSTRATION_WIDTH = 208;
const ILLUSTRATION_HEIGHT = 176;
const BODY_MAX_WIDTH = 304;

export interface EmptyStateProps {
  /**
   * Иллюстрация. В пакете UISpec векторных исходников нет (ASSETS.md, TODO-ASSET), поэтому
   * prop необязателен: без него блок рендерится без картинки.
   */
  asset?: ImageSourcePropType;
  title: string;
  body: string;
  ctaLabel?: string;
  ctaAction?: () => void;
}

/** UISpec-тег `EmptyState`. */
export function EmptyState({ asset, title, body, ctaLabel, ctaAction }: EmptyStateProps) {
  const colors = useColors();
  const hasCta = ctaLabel !== undefined && ctaAction !== undefined;

  return (
    <Center flex={1} paddingHorizontal={spacing[24]}>
      {asset === undefined ? null : (
        <>
          <AppImage source={asset} width={ILLUSTRATION_WIDTH} height={ILLUSTRATION_HEIGHT} />
          <Spacer size={spacing[24]} />
        </>
      )}
      <AppText typography={typography.title.medium} align="center">
        {title}
      </AppText>
      <Spacer size={spacing[8]} />
      <AppText
        typography={typography.body.medium}
        color={colors.text.secondary}
        align="center"
        maxWidth={BODY_MAX_WIDTH}
      >
        {body}
      </AppText>
      {hasCta ? (
        <>
          <Spacer size={spacing[24]} />
          <AppButton variant="primary" width="fill" label={ctaLabel} onPress={ctaAction} />
        </>
      ) : null}
    </Center>
  );
}

export default EmptyState;
