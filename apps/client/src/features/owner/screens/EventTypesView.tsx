import { AppButton } from '@/design-system/components/AppButton';
import { AppHeader } from '@/design-system/components/AppHeader';
import { AppText } from '@/design-system/components/AppText';
import { EmptyState } from '@/design-system/components/EmptyState';
import { Skeleton } from '@/design-system/components/Skeleton';
import { AppSafeArea } from '@/design-system/layout/AppSafeArea';
import { AppScrollView } from '@/design-system/layout/AppScrollView';
import { Center } from '@/design-system/layout/Center';
import { Column } from '@/design-system/layout/Column';
import { Spacer } from '@/design-system/layout/Spacer';
import { useColors } from '@/design-system/theme';
import { sizes, spacing, typography } from '@/design-system/tokens';
import { EventTypeCard } from '@/features/event-types/components/EventTypeCard';
import { durationLabel, eventTypeAccentIndex } from '@/features/event-types/lib';
import { Repeat } from '@/shared/ui-state/Repeat';
import { StateView } from '@/shared/ui-state/StateView';

import type { EventTypesState } from './EventTypesState';

export interface EventTypesViewProps {
  state: EventTypesState;
  onGoBack: () => void;
  onCreate: () => void;
  onRetry: () => void;
}

/**
 * View экрана `owner.event-types` (спека 06, кадр 7). Чистая презентация: контейнер отвечает
 * за загрузку и навигацию, сюда приходит только состояние и колбэки.
 *
 * Карточка не нажимаема в MVP (правило спеки): `EventTypeCard` не принимает `onPress`.
 */
export function EventTypesView({ state, onGoBack, onCreate, onRetry }: EventTypesViewProps) {
  const colors = useColors();

  return (
    <AppSafeArea background={colors.background.primary}>
      <AppHeader
        title="Типы событий"
        backAction={onGoBack}
        rightActions={[
          { id: 'create', icon: 'plus', accessibilityLabel: 'Создать тип события', onPress: onCreate },
        ]}
      />

      <StateView state="loading" current={state.kind}>
        <Column padding={spacing[16]} gap={spacing[12]}>
          <Skeleton variant="event-type-card" height={sizes.card.eventType.height} />
          <Skeleton variant="event-type-card" height={sizes.card.eventType.height} />
        </Column>
      </StateView>

      <StateView state="empty" current={state.kind}>
        <EmptyState
          title="Типов событий пока нет"
          body="Создайте первый тип события, чтобы гости могли выбрать формат встречи."
          ctaLabel="Создать тип события"
          ctaAction={onCreate}
        />
      </StateView>

      <StateView state="content" current={state.kind}>
        {state.kind !== 'content' ? null : (
          <AppScrollView flex={1} contentPadding={spacing[16]} contentGap={spacing[12]}>
            <Repeat items={state.items} keyExtractor={(item) => item.id}>
              {(item) => (
                <EventTypeCard
                  id={item.id}
                  title={item.name}
                  {...(item.description === undefined ? {} : { description: item.description })}
                  durationLabel={durationLabel(item.durationMinutes)}
                  publicId={item.id}
                  accentIndex={eventTypeAccentIndex(item.id)}
                />
              )}
            </Repeat>
          </AppScrollView>
        )}
      </StateView>

      <StateView state="error" current={state.kind}>
        <Center flex={1} padding={spacing[24]}>
          <AppText typography={typography.title.medium} align="center">
            Не удалось загрузить типы событий
          </AppText>
          <Spacer size={spacing[16]} />
          <AppButton variant="secondary" label="Повторить" onPress={onRetry} />
        </Center>
      </StateView>
    </AppSafeArea>
  );
}

export default EventTypesView;
