import { View } from 'react-native';

import { AppButton } from '@/design-system/components/AppButton';
import { AppHeader } from '@/design-system/components/AppHeader';
import { AppIcon } from '@/design-system/components/AppIcon';
import { AppText } from '@/design-system/components/AppText';
import { AppTextField } from '@/design-system/components/AppTextField';
import { InlineAlert } from '@/design-system/components/InlineAlert';
import { AppSafeArea } from '@/design-system/layout/AppSafeArea';
import { AppScrollView } from '@/design-system/layout/AppScrollView';
import { Center } from '@/design-system/layout/Center';
import { Column } from '@/design-system/layout/Column';
import { Spacer } from '@/design-system/layout/Spacer';
import { useColors } from '@/design-system/theme';
import { radii, sizes, spacing, typography } from '@/design-system/tokens';
import { BookingSummaryCard } from '@/features/guest/components/BookingSummaryCard';
import type { GuestDraft } from '@/features/guest/state/reducer';
import { fieldError } from '@/shared/forms';
import { StateView } from '@/shared/ui-state/StateView';

import type { GuestBookingFormState } from './GuestBookingFormState';

export interface GuestBookingFormViewProps {
  state: GuestBookingFormState;
  eventTypeName: string;
  startAtUtc: string;
  endAtUtc: string;
  /** `$system.timeZone` — timezone устройства гостя. */
  timeZone: string;
  draft: GuestDraft;
  onChangeField: (field: keyof GuestDraft, value: string) => void;
  onSubmit: () => void;
  onRetry: () => void;
  /** Одно действие для back в шапке, «Изменить» в сводке и «Выбрать другое время». */
  onChooseAnotherTime: () => void;
}

/**
 * View экрана `guest.booking-form` (кадры 4, 5, 6, 9). Чистая презентация: запросы, ветвление
 * ошибок и навигация — ответственность контейнера.
 */
export function GuestBookingFormView({
  state,
  eventTypeName,
  startAtUtc,
  endAtUtc,
  timeZone,
  draft,
  onChangeField,
  onSubmit,
  onRetry,
  onChooseAnotherTime,
}: GuestBookingFormViewProps) {
  const colors = useColors();
  const submitting = state.kind === 'submitting';
  const serverMessage = state.kind === 'serverValidationError' ? state.message : null;

  return (
    <AppSafeArea background={colors.background.primary}>
      <AppHeader title="Ваши данные" backAction={onChooseAnotherTime} />

      <StateView
        state="editing|validationError|submitting|serverValidationError"
        current={state.kind}
      >
        <AppScrollView
          flex={1}
          keyboardAvoiding
          contentPaddingHorizontal={spacing[24]}
          contentPaddingTop={spacing[16]}
          contentPaddingBottom={spacing[32]}
        >
          <BookingSummaryCard
            eventTypeName={eventTypeName}
            startAtUtc={startAtUtc}
            endAtUtc={endAtUtc}
            timeZone={timeZone}
            onEdit={onChooseAnotherTime}
          />

          {serverMessage === null ? null : (
            <>
              <Spacer size={spacing[16]} />
              {/* Общий текст маппера над формой: по-полевых данных ErrorResponse не даёт (GAP-004). */}
              <InlineAlert
                variant="error"
                title="Не удалось создать встречу"
                body={serverMessage}
              />
            </>
          )}

          <Spacer size={spacing[20]} />
          <AppTextField
            label="Имя"
            value={draft.name}
            placeholder="Введите ваше имя"
            autoCapitalize="words"
            autoComplete="name"
            error={fieldError(state.fieldErrors, 'guest-name')}
            onChangeText={(value) => onChangeField('name', value)}
            testID="guest-name"
          />
          <Spacer size={spacing[16]} />
          <AppTextField
            label="Email"
            value={draft.email}
            placeholder="Введите ваш email"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            error={fieldError(state.fieldErrors, 'guest-email')}
            onChangeText={(value) => onChangeField('email', value)}
            testID="guest-email"
          />
          <Spacer size={spacing[16]} />
          <AppTextField
            label="Комментарий (необязательно)"
            value={draft.note}
            placeholder="Необязательное сообщение"
            multiline
            onChangeText={(value) => onChangeField('note', value)}
            testID="guest-note"
          />

          <Spacer size={spacing[24]} />
          {/* Подпись CTA различается по состоянию (`when=`), а не выражением в одной кнопке. */}
          {submitting ? (
            <AppButton
              variant="primary"
              width="fill"
              label="Создаём встречу..."
              loading
              disabled
              onPress={onSubmit}
              testID="submit-booking"
            />
          ) : (
            <AppButton
              variant="primary"
              width="fill"
              label="Подтвердить встречу"
              onPress={onSubmit}
              testID="submit-booking"
            />
          )}
        </AppScrollView>
      </StateView>

      <StateView state="networkError" current={state.kind}>
        <Center flex={1} padding={spacing[24]}>
          <NetworkErrorIllustration />
          <Spacer size={spacing[16]} />
          <AppText typography={typography.title.medium} align="center">
            Не удалось создать встречу
          </AppText>
          <Spacer size={spacing[8]} />
          <AppText typography={typography.body.medium} color={colors.text.secondary} align="center">
            Проверьте подключение. Ваши данные сохранены.
          </AppText>
          <Spacer size={spacing[24]} />
          <AppButton
            variant="primary"
            width="fill"
            label="Повторить"
            onPress={onRetry}
            testID="retry-booking"
          />
          <Spacer size={spacing[12]} />
          <AppButton
            variant="secondary"
            width="fill"
            label="Выбрать другое время"
            onPress={onChooseAnotherTime}
          />
        </Center>
      </StateView>
    </AppSafeArea>
  );
}

/**
 * TODO-ASSET: иллюстрации `$asset.network-error` в пакете UISpec нет (ASSETS.md), вырезать её
 * из PNG макета нельзя. До появления исходника — плейсхолдер тех же размеров с глифом кадра 9.
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

export default GuestBookingFormView;
