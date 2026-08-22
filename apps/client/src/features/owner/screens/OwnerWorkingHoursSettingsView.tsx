import { AddWorkingHoursSheet } from '@/features/availability/components/AddWorkingHoursSheet';
import { ScheduleCard } from '@/features/availability/components/ScheduleCard';
import { formatDaysOff, formatWeekdays, toDayOfWeek, type WorkingInterval } from '@/features/availability/lib';
import { AppButton } from '@/design-system/components/AppButton';
import { AppHeader } from '@/design-system/components/AppHeader';
import { AppSelectField, type SelectOption } from '@/design-system/components/AppSelectField';
import { AppText } from '@/design-system/components/AppText';
import { Skeleton } from '@/design-system/components/Skeleton';
import { ValidationMessage } from '@/design-system/components/ValidationMessage';
import { AppSafeArea } from '@/design-system/layout/AppSafeArea';
import { AppScrollView } from '@/design-system/layout/AppScrollView';
import { Column } from '@/design-system/layout/Column';
import { Spacer } from '@/design-system/layout/Spacer';
import { useColors } from '@/design-system/theme';
import { sizes, spacing, typography } from '@/design-system/tokens';
import { SettingsRow } from '@/features/settings/components/SettingsRow';
import { Repeat } from '@/shared/ui-state/Repeat';
import { StateView } from '@/shared/ui-state/StateView';

import { validateOwnerWorkingHoursDraft, type OwnerWorkingHoursSettingsState } from './OwnerWorkingHoursSettingsState';

export interface OwnerWorkingHoursSettingsViewProps {
  state: OwnerWorkingHoursSettingsState;
  onOpenAdd: () => void;
  onEditInterval: (interval: WorkingInterval) => void;
  onApplyInterval: (payload: { daysOfWeek: WorkingInterval['daysOfWeek']; startLocal: string; endLocal: string }) => void;
  onCloseSheet: () => void;
  onChangeSlotStep: (value: number) => void;
  onOpenEventTypes: () => void;
  onSubmit: () => void;
}

const SLOT_STEP_OPTIONS: SelectOption[] = [
  { value: '15', label: '15 минут' },
  { value: '30', label: '30 минут' },
  { value: '60', label: '60 минут' },
];

/**
 * View экрана `owner.working-hours-settings` (спека 07). Sheet 04 (`AddWorkingHoursSheet`, P16)
 * монтируется здесь же в состоянии `intervalSheet` (`MANUAL.md` §2.1), тот же приём, что у
 * онбординга (экран 03). Спека не даёт `Header` этого экрана `backAction` (в отличие от соседнего
 * экрана 09) — назад ведёт только системная навигация native-stack (жест/аппаратная кнопка);
 * добавлять недостающую в UISpec кнопку самовольно нельзя (`apps/client/AGENTS.md`, «Запрещено»).
 * `BottomNavigation` не рендерится: кастомный `tabBar` `OwnerTabs` (P10) виден автоматически.
 */
export function OwnerWorkingHoursSettingsView({
  state,
  onOpenAdd,
  onEditInterval,
  onApplyInterval,
  onCloseSheet,
  onChangeSlotStep,
  onOpenEventTypes,
  onSubmit,
}: OwnerWorkingHoursSettingsViewProps) {
  const colors = useColors();
  const saving = state.kind === 'saving';

  return (
    <>
      <AppSafeArea background={colors.background.primary} edges={['top', 'left', 'right']}>
        <AppHeader title="Рабочее время" />

        <StateView state="loading" current={state.kind}>
          <Column padding={spacing[16]} gap={spacing[12]}>
            <Skeleton variant="schedule-card" height={sizes.card.schedule.height} />
            <Skeleton variant="schedule-card" height={sizes.card.schedule.height} />
            <Skeleton variant="field" height={sizes.input.height} />
          </Column>
        </StateView>

        <StateView state="editing|intervalSheet|saving|error|saved" current={state.kind}>
          {state.kind === 'loading' ? null : (
            <>
              <AppScrollView flex={1} contentPaddingHorizontal={spacing[16]} contentPaddingBottom={spacing[24]}>
                <AppText typography={typography.label.large}>Текущий график</AppText>
                <Spacer size={spacing[8]} />

                {state.form.availabilityRules.length === 0 ? null : (
                  <Column gap={spacing[8]}>
                    <Repeat items={state.form.availabilityRules} keyExtractor={(interval) => interval.id}>
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
                  {formatDaysOff(state.form.availabilityRules)}
                </AppText>
                <Spacer size={spacing[16]} />
                {/* TODO-COMPONENT: спека несёт icon="plus" — AppButton иконку не поддерживает (design-system read-only). */}
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
                  value={String(state.form.slotIntervalMinutes)}
                  onChange={(value) => onChangeSlotStep(Number(value))}
                  options={SLOT_STEP_OPTIONS}
                  testID="slot-step"
                />
                <Spacer size={spacing[12]} />
                <AppText typography={typography.body.small} color={colors.text.secondary}>
                  Изменения не затронут существующие встречи.
                </AppText>
                <Spacer size={spacing[20]} />
                <SettingsRow
                  title="Типы событий"
                  subtitle="Управление типами встреч"
                  onPress={onOpenEventTypes}
                  testID="settings-row-event-types"
                />
                <ValidationMessage message={validateOwnerWorkingHoursDraft(state.form)} testID="schedule-list-error" />
                {state.kind === 'error' ? (
                  <ValidationMessage message={state.message} testID="working-hours-settings-error" />
                ) : null}
              </AppScrollView>
              <AppSafeArea edges={['bottom']} background={colors.background.primary}>
                <Column padding={spacing[16]}>
                  <AppButton
                    variant="primary"
                    width="fill"
                    label="Сохранить изменения"
                    onPress={onSubmit}
                    disabled={validateOwnerWorkingHoursDraft(state.form) !== null || !state.dirty || saving}
                    loading={saving}
                    testID="save-working-hours"
                  />
                </Column>
              </AppSafeArea>
            </>
          )}
        </StateView>
      </AppSafeArea>

      {state.kind === 'intervalSheet' ? (
        <AddWorkingHoursSheet
          interval={state.editedInterval}
          currentIntervals={state.form.availabilityRules}
          onApply={onApplyInterval}
          onClose={onCloseSheet}
        />
      ) : null}
    </>
  );
}

export default OwnerWorkingHoursSettingsView;
