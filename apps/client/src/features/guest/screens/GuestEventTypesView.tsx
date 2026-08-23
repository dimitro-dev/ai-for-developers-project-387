import { useWindowDimensions, View } from 'react-native';

import { AppButton } from '@/design-system/components/AppButton';
import { AppIcon } from '@/design-system/components/AppIcon';
import { AppText } from '@/design-system/components/AppText';
import { EmptyState } from '@/design-system/components/EmptyState';
import { Skeleton } from '@/design-system/components/Skeleton';
import { CONTENT_MAX_WIDTH, isWideLayout } from '@/design-system/layout/adaptive';
import { AppSafeArea } from '@/design-system/layout/AppSafeArea';
import { AppScrollView } from '@/design-system/layout/AppScrollView';
import { Center } from '@/design-system/layout/Center';
import { Column } from '@/design-system/layout/Column';
import { Row } from '@/design-system/layout/Row';
import { Spacer } from '@/design-system/layout/Spacer';
import { useColors } from '@/design-system/theme';
import { sizes, spacing, typography } from '@/design-system/tokens';
import { eventTypeAccentIndex } from '@/features/event-types/lib';
import { PublicEventTypeCard } from '@/features/guest/components/PublicEventTypeCard';
import type { EventTypeView } from '@/features/guest/model/types';
import { Repeat } from '@/shared/ui-state/Repeat';
import { StateView } from '@/shared/ui-state/StateView';

import type { GuestEventTypesState } from './GuestEventTypesState';

export interface GuestEventTypesViewProps {
  state: GuestEventTypesState;
  onSelectEventType: (eventType: EventTypeView) => void;
  onRetry: () => void;
}

/**
 * View экрана `guest.event-types` (кадр 1). Чистая презентация: данные и переходы —
 * ответственность контейнера, сюда приходит только состояние и колбэки действий.
 *
 * Шапки приложения на кадре 1 нет — вордмарк и заголовок часть контента.
 */
export function GuestEventTypesView({
  state,
  onSelectEventType,
  onRetry,
}: GuestEventTypesViewProps) {
  const colors = useColors();
  const { width } = useWindowDimensions();
  const twoColumns = isWideLayout(width);

  return (
    <AppSafeArea background={colors.background.primary}>
      <StateView state="loading" current={state.kind}>
        <Column flex={1} paddingHorizontal={spacing[24]} paddingTop={spacing[32]} gap={spacing[16]}>
          <Skeleton variant="text" />
          <Skeleton variant="text" />
          <Skeleton variant="event-type-card" height={sizes.card.eventType.height} />
          <Skeleton variant="event-type-card" height={sizes.card.eventType.height} />
        </Column>
      </StateView>

      <StateView state="content" current={state.kind}>
        {state.kind !== 'content' ? null : (
          <AppScrollView
            flex={1}
            contentPaddingHorizontal={spacing[24]}
            contentPaddingTop={spacing[24]}
            contentPaddingBottom={spacing[32]}
          >
            {/* Адаптив — правило раскладки: контент ограничен по ширине и центрируется.
                Процент вместо fill: fit-content при center игнорирует ширину родителя
                (тот же механизм, что у экрана слотов). */}
            <Column
              width="100%"
              maxWidth={CONTENT_MAX_WIDTH}
              alignSelf="center"
              testID="catalog-content-column"
            >
              <AppText typography={typography.title.small} color={colors.text.secondary}>
                Calendar
              </AppText>
              <Spacer size={spacing[24]} />
              <AppText typography={typography.title.large} testID="catalog-title">
                {`Запланировать встречу с ${state.calendar.displayName}`}
              </AppText>
              <Spacer size={spacing[20]} />
              <AppText typography={typography.label.large}>Выберите тип встречи</AppText>
              <Spacer size={spacing[12]} />
              <Row gap={spacing[12]} wrap>
                <Repeat items={state.items} keyExtractor={(item) => item.id}>
                  {(item) => (
                    <View style={{ width: twoColumns ? '48%' : '100%' }}>
                      <PublicEventTypeCard
                        id={item.id}
                        name={item.name}
                        {...(item.description === null ? {} : { description: item.description })}
                        durationMinutes={item.durationMinutes}
                        accentIndex={eventTypeAccentIndex(item.id)}
                        onPress={() => onSelectEventType(item)}
                      />
                    </View>
                  )}
                </Repeat>
              </Row>
            </Column>
          </AppScrollView>
        )}
      </StateView>

      <StateView state="empty" current={state.kind}>
        <EmptyState
          title="Встречи пока недоступны"
          body="У владельца календаря сейчас нет доступных типов встреч. Загляните позже."
        />
      </StateView>

      <StateView state="error" current={state.kind}>
        {state.kind !== 'error' ? null : (
          <Center flex={1} padding={spacing[24]}>
            <AppIcon name="cloud-off" size={sizes.icon.large} color={colors.icon.secondary} />
            <Spacer size={spacing[16]} />
            <AppText typography={typography.title.medium} align="center">
              Не удалось загрузить встречи
            </AppText>
            <Spacer size={spacing[8]} />
            <AppText
              typography={typography.body.medium}
              color={colors.text.secondary}
              align="center"
              testID="catalog-error-message"
            >
              {state.message}
            </AppText>
            <Spacer size={spacing[24]} />
            <AppButton variant="primary" width="fill" label="Повторить" onPress={onRetry} />
          </Center>
        )}
      </StateView>
    </AppSafeArea>
  );
}

export default GuestEventTypesView;
