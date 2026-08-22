import { AddWorkingHoursSheet } from '@/features/availability/components/AddWorkingHoursSheet';
import { ScheduleCard } from '@/features/availability/components/ScheduleCard';
import { formatDaysOff, formatWeekdays, toDayOfWeek, type WorkingInterval } from '@/features/availability/lib';
import { AppButton } from '@/design-system/components/AppButton';
import { AppSelectField, type SelectOption } from '@/design-system/components/AppSelectField';
import { AppText } from '@/design-system/components/AppText';
import { InlineAlert } from '@/design-system/components/InlineAlert';
import { ProgressHeader } from '@/design-system/components/ProgressHeader';
import { TimezoneLabel } from '@/design-system/components/TimezoneLabel';
import { ValidationMessage } from '@/design-system/components/ValidationMessage';
import { AppSafeArea } from '@/design-system/layout/AppSafeArea';
import { AppScrollView } from '@/design-system/layout/AppScrollView';
import { Column } from '@/design-system/layout/Column';
import { Spacer } from '@/design-system/layout/Spacer';
import { useColors } from '@/design-system/theme';
import { spacing, typography } from '@/design-system/tokens';
import { formatUtcOffset } from '@/shared/datetime';
import { Repeat } from '@/shared/ui-state/Repeat';

import type { OnboardingWorkingHoursState } from './OnboardingWorkingHoursState';
import { validateWorkingHoursDraft } from './OnboardingWorkingHoursState';

export interface OnboardingWorkingHoursViewProps {
  state: OnboardingWorkingHoursState;
  onBack: () => void;
  onOpenAdd: () => void;
  onEditInterval: (interval: WorkingInterval) => void;
  onApplyInterval: (payload: { daysOfWeek: WorkingInterval['daysOfWeek']; startLocal: string; endLocal: string }) => void;
  onCloseSheet: () => void;
  onChangeSlotStep: (value: number) => void;
  onSubmit: () => void;
}

const SLOT_STEP_OPTIONS: SelectOption[] = [
  { value: '15', label: '15 минут' },
  { value: '30', label: '30 минут' },
  { value: '60', label: '60 минут' },
];

/**
 * View экрана `owner.onboarding-working-hours` (кадр 3). Sheet 04 (`AddWorkingHoursSheet`) — не
 * route: монтируется здесь же в состоянии `intervalSheet` (`MANUAL.md` §2.1), вне корневого
 * `AppSafeArea` — сам рисует полноэкранный `Modal`, вложенность на его позиционирование не влияет.
 *
 * Спека не даёт элемента для рендера `$state.message` состояния `error` (её `<Layout>` не несёт
 * ни одной ссылки на это свойство) — решение здесь: `InlineAlert`, тот же приём, что у серверной
 * ошибки формы гостя (`GuestBookingFormView`), иначе сообщение об ошибке `completeSetup` было бы
 * недостижимо для владельца.
 */
export function OnboardingWorkingHoursView({
  state,
  onBack,
  onOpenAdd,
  onEditInterval,
  onApplyInterval,
  onCloseSheet,
  onChangeSlotStep,
  onSubmit,
}: OnboardingWorkingHoursViewProps) {
  const colors = useColors();
  const { form } = state;
  const submitting = state.kind === 'submitting';
  const errorMessage = state.kind === 'error' ? state.message : null;
  const scheduleError = validateWorkingHoursDraft(form);
  const invalid = scheduleError !== null;

  return (
    <>
      <AppSafeArea background={colors.background.primary} edges={['top', 'left', 'right']}>
        <ProgressHeader current={2} total={2} backAction={onBack} />
        <AppScrollView flex={1} contentPaddingHorizontal={spacing[16]} contentPaddingBottom={spacing[24]}>
          <Spacer size={spacing[24]} />
          <AppText typography={typography.title.large}>Рабочее время</AppText>
          <Spacer size={spacing[20]} />
          <AppText typography={typography.label.large}>Текущий график</AppText>
          <Spacer size={spacing[8]} />

          {errorMessage === null ? null : (
            <>
              <InlineAlert variant="error" title="Не удалось завершить настройку" body={errorMessage} />
              <Spacer size={spacing[16]} />
            </>
          )}

          {form.availabilityRules.length === 0 ? (
            <AppText typography={typography.body.medium} color={colors.text.secondary}>
              Рабочее время ещё не настроено
            </AppText>
          ) : (
            <Column gap={spacing[8]}>
              <Repeat items={form.availabilityRules} keyExtractor={(interval) => interval.id}>
                {(interval) => (
                  <ScheduleCard
                    interval={interval}
                    daysLabel={formatWeekdays(interval.daysOfWeek.map(toDayOfWeek))}
                    timeLabel={`${interval.startLocal}–${interval.endLocal}`}
                    onPress={({ interval: pressed }) => onEditInterval(pressed)}
                    testID={`schedule-card-${interval.id}`}
                  />
                )}
              </Repeat>
            </Column>
          )}

          <Spacer size={spacing[12]} />
          <AppText typography={typography.body.medium} color={colors.text.secondary}>
            {formatDaysOff(form.availabilityRules)}
          </AppText>
          <Spacer size={spacing[16]} />
          {/* TODO-COMPONENT: спека несёт icon="plus" — AppButton иконку не поддерживает (design-system read-only в этой задаче). */}
          <AppButton
            variant="secondary"
            width="fill"
            label="Добавить рабочее время"
            onPress={onOpenAdd}
            testID="open-add-working-hours"
          />
          <Spacer size={spacing[24]} />
          <AppSelectField
            label="Начало слотов каждые"
            value={String(form.slotIntervalMinutes)}
            onChange={(value) => onChangeSlotStep(Number(value))}
            options={SLOT_STEP_OPTIONS}
            testID="slot-step"
          />
          <Spacer size={spacing[12]} />
          <TimezoneLabel timezone={form.timeZone} offset={formatUtcOffset(form.timeZone)} />
          <ValidationMessage message={scheduleError} testID="schedule-list-error" />
        </AppScrollView>
        <AppSafeArea edges={['bottom']} background={colors.background.primary}>
          <Column padding={spacing[16]}>
            <AppButton
              variant="primary"
              width="fill"
              label="Завершить настройку"
              onPress={onSubmit}
              disabled={invalid || submitting}
              loading={submitting}
              testID="complete-setup"
            />
          </Column>
        </AppSafeArea>
      </AppSafeArea>

      {state.kind === 'intervalSheet' ? (
        <AddWorkingHoursSheet
          interval={state.editedInterval}
          currentIntervals={form.availabilityRules}
          onApply={onApplyInterval}
          onClose={onCloseSheet}
        />
      ) : null}
    </>
  );
}

export default OnboardingWorkingHoursView;
