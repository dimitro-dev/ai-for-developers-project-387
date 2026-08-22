import { fireEvent, render, screen } from '@testing-library/react-native';

import { AppSelectField, type SelectOption } from '@/design-system/components/AppSelectField';

// В @testing-library/react-native 14 `render` и `fireEvent` асинхронные — их обязательно await.
// Backdrop декоративен для screen reader (см. AppBottomSheet.test.tsx) — запрос по testID нуждается
// в includeHiddenElements, иначе RNTL не найдёт скрытый узел.
const HIDDEN = { includeHiddenElements: true } as const;

const SLOT_STEP_OPTIONS: SelectOption[] = [
  { value: '15', label: '15 минут' },
  { value: '30', label: '30 минут' },
  { value: '60', label: '60 минут' },
];

const TIMEZONE_OPTIONS: SelectOption[] = [
  { value: 'Europe/Moscow', label: 'Europe/Moscow' },
  { value: 'Europe/Paris', label: 'Europe/Paris' },
  { value: 'America/New_York', label: 'America/New_York' },
];

describe('AppSelectField', () => {
  it('обычный режим: тап на поле открывает bottom sheet со списком опций', async () => {
    await render(
      <AppSelectField
        label="Начало слотов каждые"
        value="30"
        options={SLOT_STEP_OPTIONS}
        onChange={jest.fn()}
        testID="slot-step"
      />,
    );

    expect(screen.queryByTestId('slot-step-sheet')).toBeNull();

    await fireEvent.press(screen.getByTestId('slot-step'));

    expect(screen.getByTestId('slot-step-sheet')).toBeTruthy();
    expect(screen.getByTestId('slot-step-option-15')).toBeTruthy();
    // Текущее значение (30) видно и в закрытом поле, и строкой в sheet — два узла с тем же текстом.
    expect(screen.getAllByText('30 минут')).toHaveLength(2);
    expect(screen.getByTestId('slot-step-option-60')).toBeTruthy();
    // Без searchable строки поиска в sheet нет.
    expect(screen.queryByTestId('slot-step-search')).toBeNull();
  });

  it('searchable bottom sheet: поиск фильтрует список опций', async () => {
    await render(
      <AppSelectField
        label="Timezone"
        value="Europe/Moscow"
        options={TIMEZONE_OPTIONS}
        searchable
        searchPlaceholder="Поиск timezone"
        onChange={jest.fn()}
        testID="timezone"
      />,
    );

    await fireEvent.press(screen.getByTestId('timezone'));
    expect(screen.getByTestId('timezone-search').props.placeholder).toBe('Поиск timezone');

    await fireEvent.changeText(screen.getByTestId('timezone-search'), 'par');

    expect(screen.getByTestId('timezone-option-Europe/Paris')).toBeTruthy();
    expect(screen.queryByTestId('timezone-option-Europe/Moscow')).toBeNull();
    expect(screen.queryByTestId('timezone-option-America/New_York')).toBeNull();
  });

  it('выбор строки диспатчит onChange значением и закрывает sheet', async () => {
    const onChange = jest.fn();
    await render(
      <AppSelectField
        label="Timezone"
        value="Europe/Moscow"
        options={TIMEZONE_OPTIONS}
        searchable
        onChange={onChange}
        testID="timezone"
      />,
    );

    await fireEvent.press(screen.getByTestId('timezone'));
    await fireEvent.press(screen.getByTestId('timezone-option-Europe/Paris'));

    expect(onChange).toHaveBeenCalledWith('Europe/Paris');
    expect(screen.queryByTestId('timezone-sheet')).toBeNull();
  });

  it('backdrop закрывает sheet без изменения значения', async () => {
    const onChange = jest.fn();
    await render(
      <AppSelectField
        label="Timezone"
        value="Europe/Moscow"
        options={TIMEZONE_OPTIONS}
        searchable
        onChange={onChange}
        testID="timezone"
      />,
    );

    await fireEvent.press(screen.getByTestId('timezone'));
    await fireEvent.press(screen.getByTestId('timezone-sheet-backdrop', HIDDEN));

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByTestId('timezone-sheet')).toBeNull();
    expect(screen.getByText('Europe/Moscow')).toBeTruthy();
  });

  it('текущее значение отмечено галочкой и accessibilityState.selected', async () => {
    await render(
      <AppSelectField
        label="Timezone"
        value="Europe/Paris"
        options={TIMEZONE_OPTIONS}
        searchable
        onChange={jest.fn()}
        testID="timezone"
      />,
    );

    await fireEvent.press(screen.getByTestId('timezone'));

    expect(screen.getByTestId('timezone-option-Europe/Paris').props.accessibilityState.selected).toBe(
      true,
    );
    expect(screen.getByTestId('timezone-option-Europe/Moscow').props.accessibilityState.selected).toBe(
      false,
    );
    // Ровно одна галочка — у выбранной опции, не только цветом (MANUAL §10).
    expect(screen.getAllByTestId('icon-check-circle', HIDDEN)).toHaveLength(1);
  });

  it('disabled не открывает sheet по тапу', async () => {
    const onChange = jest.fn();
    await render(
      <AppSelectField
        label="Timezone"
        value="Europe/Moscow"
        options={TIMEZONE_OPTIONS}
        onChange={onChange}
        disabled
        testID="timezone"
      />,
    );

    await fireEvent.press(screen.getByTestId('timezone'));

    expect(screen.queryByTestId('timezone-sheet')).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByTestId('timezone').props.accessibilityState.disabled).toBe(true);
  });

  it('показывает и озвучивает ошибку поля', async () => {
    await render(
      <AppSelectField
        label="Timezone"
        value=""
        options={TIMEZONE_OPTIONS}
        onChange={jest.fn()}
        error="Выберите timezone"
        testID="timezone"
      />,
    );

    const message = screen.getByTestId('timezone-error');
    expect(message).toHaveTextContent('Выберите timezone');
    expect(screen.getByTestId('timezone').props.accessibilityHint).toBe('Выберите timezone');
  });

  // Часть Android/Hermes-сборок заявляет `Intl.supportedValuesOf`, но не отдаёт данные — компонент
  // должен резолвить системный список без падения и без пустого экрана (см. AppSelectField.tsx).
  it('optionsSource="system.ianaTimezones" резолвит список из Intl.supportedValuesOf', async () => {
    await render(
      <AppSelectField
        label="Timezone"
        value="UTC"
        optionsSource="system.ianaTimezones"
        searchable
        onChange={jest.fn()}
        testID="timezone"
      />,
    );

    await fireEvent.press(screen.getByTestId('timezone'));
    await fireEvent.changeText(screen.getByTestId('timezone-search'), 'Moscow');

    expect(screen.getByTestId('timezone-option-Europe/Moscow')).toBeTruthy();
  });

  it('optionsSource="system.ianaTimezones" переходит на фолбэк без Intl.supportedValuesOf', async () => {
    const intl = Intl as unknown as { supportedValuesOf?: (key: string) => string[] };
    const original = intl.supportedValuesOf;
    delete intl.supportedValuesOf;

    try {
      await render(
        <AppSelectField
          label="Timezone"
          value="UTC"
          optionsSource="system.ianaTimezones"
          searchable
          onChange={jest.fn()}
          testID="timezone"
        />,
      );

      await fireEvent.press(screen.getByTestId('timezone'));
      expect(screen.getByTestId('timezone-option-UTC')).toBeTruthy();

      await fireEvent.changeText(screen.getByTestId('timezone-search'), 'Moscow');
      expect(screen.getByTestId('timezone-option-Europe/Moscow')).toBeTruthy();
    } finally {
      intl.supportedValuesOf = original;
    }
  });
});
