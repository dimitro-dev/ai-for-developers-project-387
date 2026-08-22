/**
 * Дизайн-токены MiniCal — ручной перенос `docs/ui-spec-kit/specs/ui/tokens/*.xml` (UISpec 0.1).
 * XML остаётся источником правды: правки здесь допустимы только вслед за спекой.
 *
 * Соответствие имён:
 *   color.action.primary  → colors.light.action.primary / colors.dark.action.primary
 *   space.16              → spacing[16]
 *   type.title.large      → typography.title.large
 *   size.button.height    → sizes.button.height
 *   radius.pill           → radii.pill
 *   motion.fast           → motion.fast
 *
 * Единицы (MANUAL §4): layout — dp (число), fontSize/lineHeight — sp (число), duration — ms.
 * Модуль содержит только данные: импортов react/react-native здесь нет. Выбор светлой или
 * тёмной палитры — единственная точка `useColors()` в `@/design-system/theme`.
 */

export interface ColorTokens {
  readonly background: {
    readonly primary: string;
    readonly secondary: string;
    readonly scrim: string;
  };
  readonly surface: {
    readonly primary: string;
    readonly selected: string;
  };
  readonly text: {
    readonly primary: string;
    readonly secondary: string;
    readonly onPrimary: string;
  };
  readonly action: {
    readonly primary: string;
    readonly primaryPressed: string;
  };
  readonly border: {
    readonly default: string;
    readonly focus: string;
  };
  readonly icon: {
    readonly primary: string;
    readonly secondary: string;
  };
  readonly status: {
    readonly error: string;
    readonly success: string;
    readonly warning: string;
    readonly warningSurface: string;
    readonly errorSurface: string;
  };
  readonly skeleton: string;
  /** Guest-флоу: заливка выбранного состояния (DateChip, SlotItem) — контраст к $color.text.onPrimary. */
  readonly guest: {
    readonly selectedSurface: string;
  };
  /**
   * Палитра акцентов карточек типов встреч. Ключи 1..6 повторяют id токенов `color.accent.N`.
   * Helper `eventTypeAccentIndex(id)` возвращает 0..5, поэтому вызывающий код обращается к
   * `accent[index + 1]`.
   */
  readonly accent: {
    readonly 1: string;
    readonly 2: string;
    readonly 3: string;
    readonly 4: string;
    readonly 5: string;
    readonly 6: string;
  };
}

const light: ColorTokens = {
  background: { primary: '#FFFFFF', secondary: '#F5F7FB', scrim: '#00000066' },
  surface: { primary: '#FFFFFF', selected: '#EAF1FF' },
  text: { primary: '#131722', secondary: '#687083', onPrimary: '#FFFFFF' },
  action: { primary: '#246BFD', primaryPressed: '#1554D6' },
  border: { default: '#DCE1EA', focus: '#246BFD' },
  icon: { primary: '#273043', secondary: '#778095' },
  status: {
    error: '#C83737',
    success: '#23835A',
    warning: '#B25E00',
    warningSurface: '#FFF4E5',
    errorSurface: '#FEF4F4',
  },
  skeleton: '#E9EDF4',
  guest: { selectedSurface: '#1F5FE0' },
  accent: {
    1: '#246BFD',
    2: '#6C3CE0',
    3: '#0E7C86',
    4: '#B25E00',
    5: '#C2306B',
    6: '#1F7A45',
  },
};

const dark: ColorTokens = {
  background: { primary: '#111318', secondary: '#1A1E26', scrim: '#00000099' },
  surface: { primary: '#191D24', selected: '#20345F' },
  text: { primary: '#F7F8FA', secondary: '#AEB5C3', onPrimary: '#FFFFFF' },
  action: { primary: '#246BFD', primaryPressed: '#1554D6' },
  border: { default: '#343945', focus: '#6A99FF' },
  icon: { primary: '#EEF1F7', secondary: '#AAB2C2' },
  status: {
    error: '#FF7373',
    success: '#55C18D',
    warning: '#FFB861',
    warningSurface: '#3A2A12',
    errorSurface: '#3A1D1D',
  },
  skeleton: '#272C35',
  guest: { selectedSurface: '#2F63E0' },
  accent: {
    1: '#4D86FF',
    2: '#8F6BF0',
    3: '#28A0AC',
    4: '#D07E1F',
    5: '#DB5B8B',
    6: '#2E9B5C',
  },
};

export const colors = { light, dark } as const;

export type ColorScheme = keyof typeof colors;

export const spacing = {
  0: 0,
  4: 4,
  8: 8,
  12: 12,
  16: 16,
  20: 20,
  24: 24,
  32: 32,
  40: 40,
  48: 48,
  64: 64,
} as const;

export const radii = {
  8: 8,
  12: 12,
  16: 16,
  20: 20,
  24: 24,
  pill: 999,
} as const;

export interface TypographyToken {
  /** `System` означает шрифт платформы по умолчанию: явный fontFamily в стиль не пишется. */
  readonly fontFamily: string;
  readonly fontSize: number;
  readonly lineHeight: number;
  readonly fontWeight: '400' | '500' | '600' | '700';
}

export const typography = {
  display: {
    small: { fontFamily: 'System', fontSize: 28, lineHeight: 36, fontWeight: '700' },
  },
  title: {
    large: { fontFamily: 'System', fontSize: 24, lineHeight: 32, fontWeight: '700' },
    medium: { fontFamily: 'System', fontSize: 20, lineHeight: 28, fontWeight: '600' },
    small: { fontFamily: 'System', fontSize: 16, lineHeight: 24, fontWeight: '600' },
  },
  body: {
    large: { fontFamily: 'System', fontSize: 16, lineHeight: 24, fontWeight: '400' },
    medium: { fontFamily: 'System', fontSize: 14, lineHeight: 20, fontWeight: '400' },
    small: { fontFamily: 'System', fontSize: 12, lineHeight: 18, fontWeight: '400' },
  },
  label: {
    large: { fontFamily: 'System', fontSize: 14, lineHeight: 20, fontWeight: '600' },
    medium: { fontFamily: 'System', fontSize: 12, lineHeight: 16, fontWeight: '500' },
  },
  button: { fontFamily: 'System', fontSize: 16, lineHeight: 20, fontWeight: '600' },
} as const satisfies Record<string, TypographyToken | Record<string, TypographyToken>>;

export const sizes = {
  touch: { android: 48 },
  button: { height: 48 },
  input: { height: 48 },
  header: { height: 56 },
  bottomNav: { height: 64 },
  icon: { small: 18, medium: 22, large: 32, hero: 72 },
  dragHandle: { width: 36, height: 4 },
  sheet: { maxHeight: 720 },
  card: {
    meeting: { height: 88 },
    eventType: { height: 112 },
    schedule: { height: 72 },
    summary: { height: 88 },
  },
  row: { settings: { height: 64 } },
  slot: { height: 64 },
  dateChip: { width: 64, height: 72 },
  textarea: { minHeight: 96 },
} as const;

export interface MotionToken {
  /** ms */
  readonly duration: number;
  readonly easing: string;
  readonly repeat?: 'infinite';
  readonly reduceMotion?: 'static-progress';
}

export const motion = {
  fast: { duration: 120, easing: 'ease-out' },
  standard: { duration: 220, easing: 'ease-in-out' },
  sheet: {
    enter: { duration: 280, easing: 'spring-soft' },
  },
  setupCheck: {
    duration: 1600,
    easing: 'linear',
    repeat: 'infinite',
    reduceMotion: 'static-progress',
  },
} as const satisfies Record<string, MotionToken | Record<string, MotionToken>>;
