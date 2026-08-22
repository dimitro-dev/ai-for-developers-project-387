import { AppButton } from '@/design-system/components/AppButton';
import { AppHeader } from '@/design-system/components/AppHeader';
import { AppText } from '@/design-system/components/AppText';
import { AppTextField } from '@/design-system/components/AppTextField';
import { InlineAlert } from '@/design-system/components/InlineAlert';
import { AppSafeArea } from '@/design-system/layout/AppSafeArea';
import { AppScrollView } from '@/design-system/layout/AppScrollView';
import { Column } from '@/design-system/layout/Column';
import { Spacer } from '@/design-system/layout/Spacer';
import { useColors } from '@/design-system/theme';
import { spacing, typography } from '@/design-system/tokens';
import { DurationSelector } from '@/features/event-types/components/DurationSelector';
import { fieldError } from '@/shared/forms';

import { isCreateEventTypeFormValid } from './CreateEventTypeState';
import type { CreateEventTypeState } from './CreateEventTypeState';

export interface CreateEventTypeViewProps {
  state: CreateEventTypeState;
  onChangeTitle: (value: string) => void;
  onChangeDescription: (value: string) => void;
  onChangeDuration: (value: number) => void;
  onChangePublicId: (value: string) => void;
  onSubmit: () => void;
  onGoBack: () => void;
}

/**
 * View экрана `owner.create-event-type` (спека 10, кадры 5 и 6). Чистая презентация: валидация,
 * submit и переход на успех — ответственность контейнера.
 *
 * Кнопка «Создать» — фиксированный футер вне `ScrollView` (спека: `<SafeArea edges="bottom">`
 * сосед `<ScrollView>`, а не его часть), поэтому safe-area разбита на два блока: основной без
 * нижнего края (его отдаёт футер) и футер только с нижним — иначе вложенные `AppSafeArea` с
 * одинаковым `edges` удвоили бы нижний отступ.
 */
export function CreateEventTypeView({
  state,
  onChangeTitle,
  onChangeDescription,
  onChangeDuration,
  onChangePublicId,
  onSubmit,
  onGoBack,
}: CreateEventTypeViewProps) {
  const colors = useColors();
  const submitting = state.kind === 'submitting';
  const disabled = submitting || !isCreateEventTypeFormValid(state.form);

  return (
    <AppSafeArea background={colors.background.primary} edges={['top', 'left', 'right']}>
      <AppHeader title="Новый тип события" backAction={onGoBack} />

      <AppScrollView flex={1} keyboardAvoiding contentPadding={spacing[16]}>
        {state.kind !== 'error' ? null : (
          <>
            <InlineAlert
              variant="error"
              title="Не удалось создать тип события"
              body={state.message}
            />
            <Spacer size={spacing[20]} />
          </>
        )}

        <AppTextField
          label="Название"
          value={state.form.name}
          onChangeText={onChangeTitle}
          testID="title"
        />
        <Spacer size={spacing[20]} />

        <AppTextField
          label="Описание (необязательно)"
          value={state.form.description}
          onChangeText={onChangeDescription}
          multiline
          testID="description"
        />
        <Spacer size={spacing[20]} />

        <Column gap={spacing[8]}>
          <AppText typography={typography.label.large}>Длительность</AppText>
          <DurationSelector id="duration" value={state.form.durationMinutes} onChange={onChangeDuration} />
        </Column>
        <Spacer size={spacing[20]} />

        <AppTextField
          label="Публичный id"
          value={state.form.id}
          onChangeText={onChangePublicId}
          prefix="/"
          autoCapitalize="none"
          error={fieldError(state.fieldErrors, 'public-id')}
          testID="public-id"
        />
        <Spacer size={spacing[8]} />
        <AppText typography={typography.body.small} color={colors.text.secondary}>
          Публичный адрес формируется из id и окончательно проверяется сервером.
        </AppText>
      </AppScrollView>

      <AppSafeArea background={colors.background.primary} edges={['bottom']}>
        <Column padding={spacing[16]}>
          <AppButton
            variant="primary"
            width="fill"
            label="Создать"
            onPress={onSubmit}
            disabled={disabled}
            loading={submitting}
            testID="submit-create-event-type"
          />
        </Column>
      </AppSafeArea>
    </AppSafeArea>
  );
}

export default CreateEventTypeView;
