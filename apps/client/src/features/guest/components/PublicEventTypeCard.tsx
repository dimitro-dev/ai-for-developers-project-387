import { Pressable } from 'react-native';

import { AppIcon } from '@/design-system/components/AppIcon';
import { AppText } from '@/design-system/components/AppText';
import { Center } from '@/design-system/layout/Center';
import { Column } from '@/design-system/layout/Column';
import { Row } from '@/design-system/layout/Row';
import { useColors } from '@/design-system/theme';
import { radii, sizes, spacing, typography } from '@/design-system/tokens';
import { durationLabel } from '@/features/event-types/lib';

export interface PublicEventTypeCardProps {
  id: string;
  name: string;
  description?: string;
  durationMinutes: number;
  /** `0…5` от `eventTypeAccentIndex($props.id)`; токены палитры нумерованы с единицы. */
  accentIndex: number;
  onPress: () => void;
  testID?: string;
}

/**
 * UISpec-тег `PublicEventTypeCard`: карточка типа встречи в публичном каталоге.
 * Отдельный компонент от owner-овского `EventTypeCard`: публичный id (`/slug`) гостю
 * не показывается, а плитка иконки красится акцентным цветом.
 */
export function PublicEventTypeCard({
  id,
  name,
  description,
  durationMinutes,
  accentIndex,
  onPress,
  testID,
}: PublicEventTypeCardProps) {
  const colors = useColors();
  const duration = durationLabel(durationMinutes);
  // `accentIndex` — данные, а не оформление: сопоставление с токеном живёт здесь,
  // как `Button variant="primary"` сопоставляет вариант со стилем.
  const accent = colors.accent[((accentIndex % 6) + 1) as 1 | 2 | 3 | 4 | 5 | 6];

  return (
    <Pressable
      testID={testID ?? `event-type-card-${id}`}
      onPress={onPress}
      accessibilityRole="button"
      // Вся карточка — один интерактивный элемент, и screen reader читает её одним блоком.
      accessible
      accessibilityLabel={[name, description, duration].filter(Boolean).join('. ')}
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
      <Row align="center" gap={spacing[12]}>
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
          <AppText typography={typography.title.small}>{name}</AppText>
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
            {duration}
          </AppText>
        </Column>
        <AppIcon name="chevron-right" size={sizes.icon.medium} color={colors.icon.secondary} />
      </Row>
    </Pressable>
  );
}

export default PublicEventTypeCard;
