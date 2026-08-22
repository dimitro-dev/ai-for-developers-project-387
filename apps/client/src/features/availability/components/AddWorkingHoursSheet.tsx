import { useState } from 'react';

import { AppBottomSheet } from '@/design-system/components/AppBottomSheet';
import { AppButton } from '@/design-system/components/AppButton';
import { AppText } from '@/design-system/components/AppText';
import { ConfirmationDialog } from '@/design-system/components/ConfirmationDialog';
import { TimeField } from '@/design-system/components/TimeField';
import { ValidationMessage } from '@/design-system/components/ValidationMessage';
import { WeekdaySelector } from '@/design-system/components/WeekdaySelector';
import { Column } from '@/design-system/layout/Column';
import { Spacer } from '@/design-system/layout/Spacer';
import { useColors } from '@/design-system/theme';
import { spacing, typography } from '@/design-system/tokens';

import { applyDaysLabel, overwriteMessage, type Weekday, type WorkingInterval } from '../lib';

export interface AddWorkingHoursSheetApplyPayload {
  daysOfWeek: Weekday[];
  startLocal: string;
  endLocal: string;
}

export interface AddWorkingHoursSheetProps {
  /** Интервал на редактирование (`$props.interval`); `null` — создание нового. */
  interval: WorkingInterval | null;
  /** Текущий график родителя — источник для поиска пересечений (`detectOverwrites`). */
  currentIntervals: readonly WorkingInterval[];
  /**
   * И обычное применение, и применение после подтверждения перезаписи несут один и тот же
   * Payload (`MANUAL.md` §2.1: `applyWorkingHours`/`confirmOverwriteApply` спеки 04 отдают
   * одинаковые поля) — родитель сам решает, заменить ли им `interval` (сохраняя client-only
   * `id`) или добавить новый.
   */
  onApply: (payload: AddWorkingHoursSheetApplyPayload) => void;
  /** Закрытие без применения — backdrop, swipe-down, системная «назад» (родительский `closeAddWorkingHours`). */
  onClose: () => void;
  testID?: string;
}

const DEFAULT_DAYS: readonly Weekday[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
];
const DEFAULT_START_LOCAL = '09:00';
const DEFAULT_END_LOCAL = '18:00';

/**
 * Sheet-компонент `owner.add-working-hours` (спека 04, `MANUAL.md` §2.1): не route, монтируется
 * родителями `03-onboarding-working-hours` (P16) и `07-working-hours-settings` (P19) в их
 * состоянии `intervalSheet`. Самодостаточен: не знает, добавляет ли родитель новый интервал или
 * заменяет `interval` — решение и client-only `id` целиком на стороне родителя, сюда уходит
 * только Payload (`daysOfWeek`/`startLocal`/`endLocal`).
 *
 * При `interval == null` форма стартует с дефолтов `editing` спеки (будни, 09:00–18:00); при
 * непустом `interval` — префиллится его днями и временем. Пересечение выбранных дней с чужими
 * интервалами `currentIntervals` (сам редактируемый `interval` из проверки исключён) уводит в
 * подтверждение перезаписи вместо немедленного применения.
 */
export function AddWorkingHoursSheet({
  interval,
  currentIntervals,
  onApply,
  onClose,
  testID,
}: AddWorkingHoursSheetProps) {
  const colors = useColors();
  const [selectedDays, setSelectedDays] = useState<Weekday[]>(
    () => interval?.daysOfWeek ?? [...DEFAULT_DAYS],
  );
  const [startLocal, setStartLocal] = useState(() => interval?.startLocal ?? DEFAULT_START_LOCAL);
  const [endLocal, setEndLocal] = useState(() => interval?.endLocal ?? DEFAULT_END_LOCAL);
  const [overwrittenIntervals, setOverwrittenIntervals] = useState<WorkingInterval[] | null>(null);

  const daysError = selectedDays.length === 0 ? 'Выберите хотя бы один день' : null;
  const timeError = endLocal <= startLocal ? 'Время окончания должно быть позже времени начала' : null;
  const invalid = daysError !== null || timeError !== null;

  const sheetName = testID ?? 'add-working-hours-sheet';
  const title = interval === null ? 'Добавить рабочее время' : 'Изменить рабочее время';

  /** `before="detectOverwrites"`: чужие интервалы, делящие хотя бы один из выбранных дней. */
  function detectOverwrites(): WorkingInterval[] {
    return currentIntervals.filter(
      (other) => other.id !== interval?.id && other.daysOfWeek.some((day) => selectedDays.includes(day)),
    );
  }

  function apply() {
    if (invalid) {
      return;
    }
    const overwrites = detectOverwrites();
    if (overwrites.length > 0) {
      setOverwrittenIntervals(overwrites);
      return;
    }
    onApply({ daysOfWeek: selectedDays, startLocal, endLocal });
  }

  function confirmOverwriteApply() {
    onApply({ daysOfWeek: selectedDays, startLocal, endLocal });
  }

  function cancelOverwrite() {
    setOverwrittenIntervals(null);
  }

  return (
    <>
      <AppBottomSheet title={title} onClose={onClose} keyboardAvoiding testID={sheetName}>
        <Column paddingHorizontal={spacing[16]} paddingBottom={spacing[16]}>
          <Spacer size={spacing[24]} />
          <AppText typography={typography.label.large} color={colors.text.primary}>
            Выберите дни
          </AppText>
          <Spacer size={spacing[8]} />
          <WeekdaySelector selectedDays={selectedDays} onChange={setSelectedDays} testID="weekday-selector" />
          <ValidationMessage message={daysError} testID="weekday-selector-error" />
          <Spacer size={spacing[24]} />
          <TimeField label="Время начала" value={startLocal} onChange={setStartLocal} testID="start-time" />
          <Spacer size={spacing[12]} />
          <TimeField label="Время окончания" value={endLocal} onChange={setEndLocal} testID="end-time" />
          <ValidationMessage message={timeError} testID="time-fields-error" />
          <Spacer size={spacing[24]} />
          <AppButton
            variant="primary"
            width="fill"
            label={applyDaysLabel(selectedDays.length)}
            onPress={apply}
            disabled={invalid}
            testID="apply-working-hours"
          />
        </Column>
      </AppBottomSheet>
      {overwrittenIntervals === null ? null : (
        <ConfirmationDialog
          title="Заменить индивидуальные часы?"
          body={overwriteMessage(overwrittenIntervals, startLocal, endLocal)}
          cancelLabel="Отмена"
          confirmLabel="Заменить"
          onCancel={cancelOverwrite}
          onConfirm={confirmOverwriteApply}
          testID={`${sheetName}-overwrite-dialog`}
        />
      )}
    </>
  );
}

export default AddWorkingHoursSheet;
