import { View } from 'react-native';

import { AppIcon } from '@/design-system/components/AppIcon';
import { AppText } from '@/design-system/components/AppText';
import { Center } from '@/design-system/layout/Center';
import { Column } from '@/design-system/layout/Column';
import { Row } from '@/design-system/layout/Row';
import { useColors } from '@/design-system/theme';
import { radii, sizes, spacing, typography } from '@/design-system/tokens';

export interface EventTypeCardProps {
  id: string;
  title: string;
  description?: string;
  /** Готовая подпись длительности — формирует экран через `durationLabel(durationMinutes)`. */
  durationLabel: string;
  publicId: string;
  /** `0…5` от `eventTypeAccentIndex($props.id)`; токены палитры нумерованы с единицы. */
  accentIndex: number;
  testID?: string;
}

/**
 * UISpec-тег `EventTypeCard`: карточка типа события в списке владельца (экран 06). В отличие от
 * гостевой `PublicEventTypeCard`, показывает публичный id и не нажимаема — в MVP `onPress` у
 * карточки нет; chevron нарисован как визуальный задел под будущий экран деталей типа события.
 */
export function EventTypeCard({
  id,
  title,
  description,
  durationLabel,
  publicId,
  accentIndex,
  testID,
}: EventTypeCardProps) {
  const colors = useColors();
  // `accentIndex` — данные, а не оформление: сопоставление с токеном живёт здесь, как
  // `Button variant="primary"` сопоставляет вариант со стилем.
  const accent = colors.accent[((accentIndex % 6) + 1) as 1 | 2 | 3 | 4 | 5 | 6];

  return (
    <View
      testID={testID ?? `event-type-card-${id}`}
      style={{
        minHeight: sizes.card.eventType.height,
        justifyContent: 'center',
        padding: spacing[16],
        borderRadius: radii[12],
        borderWidth: 1,
        borderColor: colors.border.default,
        backgroundColor: colors.surface.primary,
      }}
    >
      <Row align="flex-start" gap={spacing[12]}>
        {/* Плитка декоративна — глиф единый для всех типов события, различается только цвет. */}
        <Center
          testID="event-type-accent"
          width={sizes.touch.android}
          height={sizes.touch.android}
          radius={radii[12]}
          background={accent}
        >
          <AppIcon name="event-type" size={sizes.icon.medium} color={colors.text.onPrimary} />
        </Center>
        <Column flex={1} gap={spacing[4]}>
          <AppText typography={typography.title.small}>{title}</AppText>
          {description === undefined ? null : (
            <AppText
              typography={typography.body.small}
              color={colors.text.secondary}
              numberOfLines={2}
            >
              {description}
            </AppText>
          )}
          <AppText typography={typography.label.medium} color={colors.text.secondary}>
            {durationLabel}
          </AppText>
          <AppText typography={typography.body.small} color={colors.text.secondary}>
            {`/${publicId}`}
          </AppText>
        </Column>
        <AppIcon name="chevron-right" size={sizes.icon.small} color={colors.icon.secondary} />
      </Row>
    </View>
  );
}

export default EventTypeCard;
