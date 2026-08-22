import { useMemo, useState } from 'react';
import { Pressable, ScrollView, TextInput } from 'react-native';

import { AppBottomSheet } from '@/design-system/components/AppBottomSheet';
import { AppIcon } from '@/design-system/components/AppIcon';
import { AppText } from '@/design-system/components/AppText';
import { ValidationMessage } from '@/design-system/components/ValidationMessage';
import { Column } from '@/design-system/layout/Column';
import { Repeat } from '@/shared/ui-state/Repeat';
import { useColors } from '@/design-system/theme';
import { radii, sizes, spacing, typography } from '@/design-system/tokens';

export interface SelectOption {
  value: string;
  label: string;
}

/** Единственный системный источник опций спек 02/09 — компонент резолвит список сам. */
export type SelectOptionsSource = 'system.ianaTimezones';

export interface AppSelectFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Закрытый статический список (шаг слота 15/30/60, спеки 03/07). Взаимоисключим с `optionsSource`. */
  options?: SelectOption[];
  /** `optionsSource="$system.ianaTimezones"` спек 02/09. */
  optionsSource?: SelectOptionsSource;
  /**
   * UISpec-атрибут `pickerMode="bottom-sheet"`: единственная реализованная раскладка пикера —
   * bottom sheet поверх `AppBottomSheet` (RN не имеет нативного inline-select). Проп принимается
   * ради паритета со спекой 09, но на поведение не влияет.
   */
  pickerMode?: 'bottom-sheet';
  /** `searchable="true"` спек 02/09 — добавляет строку поиска над списком опций. */
  searchable?: boolean;
  searchPlaceholder?: string;
  error?: string | null;
  disabled?: boolean;
  testID?: string;
}

/** dp запаса под шапку и поле поиска sheet — список опций скроллится в оставшейся высоте. */
const OPTIONS_MAX_HEIGHT = sizes.sheet.maxHeight - sizes.input.height * 2;

/**
 * Фолбэк на случай, если рантайм заявляет `Intl.supportedValuesOf`, но не отдаёт полный список
 * (усечённый ICU на части Android/Hermes-сборок — см. отчёт задачи P08). Покрывает основные
 * регионы, этого достаточно для поиска зоны вручную; полный список остаётся приоритетным путём.
 */
const FALLBACK_IANA_TIMEZONES: readonly string[] = [
  'UTC',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Moscow',
  'Europe/Kyiv',
  'Europe/Istanbul',
  'Africa/Cairo',
  'Africa/Johannesburg',
  'Asia/Jerusalem',
  'Asia/Dubai',
  'Asia/Karachi',
  'Asia/Kolkata',
  'Asia/Dhaka',
  'Asia/Bangkok',
  'Asia/Jakarta',
  'Asia/Shanghai',
  'Asia/Hong_Kong',
  'Asia/Tokyo',
  'Asia/Seoul',
  'Australia/Perth',
  'Australia/Sydney',
  'Pacific/Auckland',
  'Pacific/Honolulu',
  'America/Anchorage',
  'America/Los_Angeles',
  'America/Denver',
  'America/Chicago',
  'America/New_York',
  'America/Sao_Paulo',
  'America/Mexico_City',
  'America/Bogota',
  'Atlantic/Reykjavik',
];

/** `Intl.supportedValuesOf` — часть ESNext, но не у каждого рантайма есть данные для 'timeZone'. */
type IntlWithTimezones = typeof Intl & { supportedValuesOf?: (key: 'timeZone') => string[] };

function resolveIanaTimezones(): readonly string[] {
  const intl = Intl as IntlWithTimezones;
  if (typeof intl.supportedValuesOf === 'function') {
    try {
      const zones = intl.supportedValuesOf('timeZone');
      if (Array.isArray(zones) && zones.length > 0) {
        return zones;
      }
    } catch {
      // Рантайм заявляет поддержку, но бросает (урезанный ICU) — используем фолбэк ниже.
    }
  }
  return FALLBACK_IANA_TIMEZONES;
}

function ianaTimezoneOptions(): SelectOption[] {
  return resolveIanaTimezones().map((zone) => ({ value: zone, label: zone }));
}

/**
 * UISpec-тег `SelectField`. Оба режима спеки — обычный закрытый список (шаг слота 03/07) и
 * `searchable` bottom sheet (timezone 02/09) — используют один и тот же `AppBottomSheet`: строка
 * поиска рендерится только при `searchable`, разницы в механизме открытия/закрытия нет.
 */
export function AppSelectField({
  label,
  value,
  onChange,
  options,
  optionsSource,
  searchable = false,
  searchPlaceholder,
  error,
  disabled = false,
  testID,
}: AppSelectFieldProps) {
  const colors = useColors();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const fieldTestID = testID ?? 'select-field';
  const invalid = error !== undefined && error !== null && error.length > 0;

  const allOptions = useMemo<SelectOption[]>(
    () => (optionsSource === 'system.ianaTimezones' ? ianaTimezoneOptions() : (options ?? [])),
    [optionsSource, options],
  );

  const filteredOptions = useMemo(() => {
    if (!searchable || query.trim().length === 0) {
      return allOptions;
    }
    const needle = query.trim().toLowerCase();
    return allOptions.filter((option) => option.label.toLowerCase().includes(needle));
  }, [allOptions, query, searchable]);

  const currentLabel = allOptions.find((option) => option.value === value)?.label ?? value;

  function openSheet() {
    if (disabled) {
      return;
    }
    setQuery('');
    setOpen(true);
  }

  // Общая точка закрытия для выбора, backdrop, swipe-down и системной «назад» (через AppBottomSheet).
  function closeSheet() {
    setOpen(false);
    setQuery('');
  }

  function selectOption(optionValue: string) {
    onChange(optionValue);
    closeSheet();
  }

  return (
    <Column gap={spacing[8]}>
      <AppText typography={typography.label.large} color={colors.text.primary}>
        {label}
      </AppText>
      <Pressable
        testID={fieldTestID}
        onPress={openSheet}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${currentLabel}`}
        accessibilityState={{ disabled }}
        // RN не знает aria-describedby: ошибка связывается с полем через hint, как у AppTextField.
        accessibilityHint={invalid ? (error ?? undefined) : undefined}
        style={{
          height: sizes.input.height,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: spacing[12],
          borderWidth: 1,
          borderRadius: radii[12],
          borderColor: invalid ? colors.status.error : colors.border.default,
          backgroundColor: disabled ? colors.background.secondary : colors.surface.primary,
          opacity: disabled ? 0.6 : 1,
        }}
      >
        <AppText typography={typography.body.large} color={colors.text.primary}>
          {currentLabel}
        </AppText>
        <AppIcon name="chevron-down" size={sizes.icon.medium} />
      </Pressable>
      <ValidationMessage message={error} testID={`${fieldTestID}-error`} />
      {open ? (
        <AppBottomSheet
          title={label}
          onClose={closeSheet}
          keyboardAvoiding={searchable}
          testID={`${fieldTestID}-sheet`}
        >
          <Column gap={spacing[12]} paddingHorizontal={spacing[16]} paddingBottom={spacing[16]}>
            {searchable ? (
              <TextInput
                testID={`${fieldTestID}-search`}
                value={query}
                onChangeText={setQuery}
                placeholder={searchPlaceholder}
                placeholderTextColor={colors.text.secondary}
                accessibilityLabel={searchPlaceholder ?? 'Поиск'}
                autoFocus
                style={{
                  height: sizes.input.height,
                  paddingHorizontal: spacing[12],
                  borderWidth: 1,
                  borderRadius: radii[12],
                  borderColor: colors.border.default,
                  backgroundColor: colors.surface.primary,
                  color: colors.text.primary,
                  fontSize: typography.body.large.fontSize,
                  lineHeight: typography.body.large.lineHeight,
                }}
              />
            ) : null}
            {/*
              Внутренний скролл списка опций — деталь реализации `AppSelectField`, а не UISpec-тег
              `ScrollView` разметки экрана, поэтому берётся сырой RN-примитив (тот же подход, что у
              модалки-степпера `TimeField`), а не `AppScrollView`, который резолвит именно тег экрана.
            */}
            <ScrollView
              testID={`${fieldTestID}-options`}
              style={{ maxHeight: OPTIONS_MAX_HEIGHT }}
              keyboardShouldPersistTaps="handled"
            >
              {filteredOptions.length === 0 ? (
                <AppText typography={typography.body.medium} color={colors.text.secondary}>
                  Совпадений не найдено
                </AppText>
              ) : (
                <Repeat items={filteredOptions} keyExtractor={(option) => option.value}>
                  {(option) => {
                    const selected = option.value === value;
                    return (
                      <Pressable
                        testID={`${fieldTestID}-option-${option.value}`}
                        onPress={() => selectOption(option.value)}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                        accessibilityLabel={option.label}
                        style={{
                          minHeight: sizes.touch.android,
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                      >
                        <AppText typography={typography.body.large} color={colors.text.primary}>
                          {option.label}
                        </AppText>
                        {/* Текущее значение — галочка И accessibilityState.selected, не только цвет (MANUAL §10). */}
                        {selected ? (
                          <AppIcon name="check-circle" size={sizes.icon.medium} color={colors.action.primary} />
                        ) : null}
                      </Pressable>
                    );
                  }}
                </Repeat>
              )}
            </ScrollView>
          </Column>
        </AppBottomSheet>
      ) : null}
    </Column>
  );
}

export default AppSelectField;
