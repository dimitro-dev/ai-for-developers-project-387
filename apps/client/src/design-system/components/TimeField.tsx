import { useState } from 'react';
import { Modal, Pressable } from 'react-native';

import { AppButton } from '@/design-system/components/AppButton';
import { AppIcon } from '@/design-system/components/AppIcon';
import { AppText } from '@/design-system/components/AppText';
import { ValidationMessage } from '@/design-system/components/ValidationMessage';
import { Column } from '@/design-system/layout/Column';
import { Row } from '@/design-system/layout/Row';
import { useColors } from '@/design-system/theme';
import { radii, sizes, spacing, typography, type ColorTokens } from '@/design-system/tokens';

export interface TimeFieldProps {
  label: string;
  /** `HH:mm` — локальное время без timezone (UISpec-тип `localTime`), не UTC-момент. */
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
  testID?: string;
}

/** Шаг стрелки минут в модалке-степпере: приемлемая точность для рабочего расписания. */
const MINUTE_STEP = 5;
const HOURS_IN_DAY = 24;
const MINUTES_IN_HOUR = 60;

/**
 * UISpec-тег `TimeField`. Правило спеки — «Android открывает native time picker или согласованный
 * cross-platform picker». Пакета нативного пикера (`@react-native-community/datetimepicker`) в
 * зависимостях клиента нет, а самостоятельно новую зависимость этот процесс ставить не даёт —
 * поэтому выбран согласованный cross-platform picker: модалка с двумя степперами (часы, минуты)
 * поверх `Modal` из react-native. `Modal` — часть ядра RN и одинаково работает на Android и на
 * web через react-native-web (в проекте уже используется как зависимость клиента), поэтому
 * реализация не делится на платформенные ветки — платформенной границы у этого компонента просто
 * нет, обе платформы обслуживает один код.
 */
export function TimeField({ label, value, onChange, error, testID }: TimeFieldProps) {
  const colors = useColors();
  const [open, setOpen] = useState(false);
  const invalid = error !== undefined && error !== null && error.length > 0;
  const { hour, minute } = parseTime(value);
  const fieldTestID = testID ?? 'time-field';

  function commit(nextHour: number, nextMinute: number) {
    onChange(formatTime(nextHour, nextMinute));
  }

  return (
    <Column gap={spacing[8]}>
      <AppText typography={typography.label.large} color={colors.text.primary}>
        {label}
      </AppText>
      <Pressable
        testID={fieldTestID}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${value}`}
        // RN не знает aria-describedby: ошибка связывается с полем через hint, как у AppTextField.
        accessibilityHint={invalid ? (error ?? undefined) : undefined}
        style={{
          height: sizes.input.height,
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing[8],
          paddingHorizontal: spacing[12],
          borderWidth: 1,
          borderRadius: radii[12],
          borderColor: invalid ? colors.status.error : colors.border.default,
          backgroundColor: colors.surface.primary,
        }}
      >
        <AppIcon name="clock" size={sizes.icon.medium} />
        <AppText typography={typography.body.large} color={colors.text.primary}>
          {value}
        </AppText>
      </Pressable>
      <ValidationMessage message={error} testID={`${fieldTestID}-error`} />
      <Modal
        testID={`${fieldTestID}-modal`}
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable
          testID={`${fieldTestID}-backdrop`}
          onPress={() => setOpen(false)}
          accessibilityLabel={`Закрыть выбор времени, ${label}`}
          style={{
            flex: 1,
            backgroundColor: colors.background.scrim,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* Пустой onPress гасит всплытие нажатия к backdrop: тап внутри панели её не закрывает. */}
          <Pressable onPress={() => {}}>
            <Column
              gap={spacing[20]}
              padding={spacing[20]}
              radius={radii[16]}
              background={colors.surface.primary}
              width={280}
            >
              <AppText
                typography={typography.title.small}
                color={colors.text.primary}
                align="center"
              >
                {label}
              </AppText>
              <TimeSegment
                unitLabel="Часы"
                displayValue={pad2(hour)}
                colors={colors}
                onDecrement={() => commit(wrap(hour - 1, HOURS_IN_DAY), minute)}
                onIncrement={() => commit(wrap(hour + 1, HOURS_IN_DAY), minute)}
              />
              <TimeSegment
                unitLabel="Минуты"
                displayValue={pad2(minute)}
                colors={colors}
                onDecrement={() => commit(hour, wrap(minute - MINUTE_STEP, MINUTES_IN_HOUR))}
                onIncrement={() => commit(hour, wrap(minute + MINUTE_STEP, MINUTES_IN_HOUR))}
              />
              <AppButton variant="primary" width="fill" label="Готово" onPress={() => setOpen(false)} />
            </Column>
          </Pressable>
        </Pressable>
      </Modal>
    </Column>
  );
}

interface TimeSegmentProps {
  unitLabel: string;
  displayValue: string;
  colors: ColorTokens;
  onDecrement: () => void;
  onIncrement: () => void;
}

/** Один степпер модалки — часы или минуты, с подписью юнита и текущим значением между стрелками. */
function TimeSegment({ unitLabel, displayValue, colors, onDecrement, onIncrement }: TimeSegmentProps) {
  return (
    <Column gap={spacing[8]} align="center">
      <AppText typography={typography.label.medium} color={colors.text.secondary}>
        {unitLabel}
      </AppText>
      <Row gap={spacing[16]} align="center" justify="center">
        <StepButton
          symbol="–"
          colors={colors}
          accessibilityLabel={`${unitLabel} ${displayValue}, уменьшить`}
          onPress={onDecrement}
        />
        <AppText typography={typography.title.medium} color={colors.text.primary}>
          {displayValue}
        </AppText>
        <StepButton
          symbol="+"
          colors={colors}
          accessibilityLabel={`${unitLabel} ${displayValue}, увеличить`}
          onPress={onIncrement}
        />
      </Row>
    </Column>
  );
}

interface StepButtonProps {
  symbol: string;
  colors: ColorTokens;
  accessibilityLabel: string;
  onPress: () => void;
}

function StepButton({ symbol, colors, accessibilityLabel, onPress }: StepButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={{
        width: sizes.touch.android,
        height: sizes.touch.android,
        borderRadius: radii.pill,
        borderWidth: 1,
        borderColor: colors.border.default,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <AppText typography={typography.title.medium} color={colors.text.primary}>
        {symbol}
      </AppText>
    </Pressable>
  );
}

function parseTime(value: string): { hour: number; minute: number } {
  const [hourPart, minutePart] = value.split(':');
  const hour = Number(hourPart);
  const minute = Number(minutePart);
  return {
    hour: Number.isFinite(hour) ? hour : 0,
    minute: Number.isFinite(minute) ? minute : 0,
  };
}

function formatTime(hour: number, minute: number): string {
  return `${pad2(hour)}:${pad2(minute)}`;
}

function wrap(value: number, max: number): number {
  return ((value % max) + max) % max;
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

export default TimeField;
