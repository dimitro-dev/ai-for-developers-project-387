/**
 * Helpers `@/features/availability/lib` из `components.registry.xml`.
 *
 * Модуль владеет всей группой хелперов графика (`formatWeekdays`, `formatDaysOff`,
 * `formatAvailabilitySummary`, `toAvailabilityRules`, `overwriteMessage`, `applyDaysLabel`) —
 * `front/owner/001 P05` реализовал только `formatWeekdays` (внутренняя зависимость сводки) и
 * `formatAvailabilitySummary`. Остальные хелперы обслуживают bottom sheet рабочих часов
 * (экраны 03/04/07, пункты плана P16/P19) и добавлены здесь вместе с `AddWorkingHoursSheet` (P16).
 *
 * `Weekday`/`WorkingInterval` — канонический view-model этой группы хелперов, а не копия
 * generated-типа конкретного экрана: `generate_scaffold.py` создаёт структурно идентичную пару
 * в каждом `*.types.generated.ts` экранов 03/07 (тот же `Weekday`-union, тот же `LocalTime` из
 * общего `uispec-runtime.ts`), поэтому значения обоих генераторных типов присваиваются сюда без
 * приведения (структурная типизация TS). Экраны и `AddWorkingHoursSheet` (03/04/07) используют
 * именно эту пару, чтобы не тянуть зависимость на generated-файл чужого экрана.
 */

import type { AvailabilityRule, DayOfWeek } from '@minical/api-client';

/** UISpec Enum `Weekday` (спеки 03/04/07) — нижний регистр, в отличие от контрактного `DayOfWeek`. */
export type Weekday =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday';

/** View-model рабочего интервала (спеки 03/04/07): `id` — client-only ключ списка, в контракт не попадает. */
export interface WorkingInterval {
  id: string;
  daysOfWeek: Weekday[];
  startLocal: string;
  endLocal: string;
}

const WEEKDAY_ORDER: readonly DayOfWeek[] = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

const WEEKDAY_SHORT_LABEL: Record<DayOfWeek, string> = {
  Monday: 'Пн',
  Tuesday: 'Вт',
  Wednesday: 'Ср',
  Thursday: 'Чт',
  Friday: 'Пт',
  Saturday: 'Сб',
  Sunday: 'Вс',
};

const EMPTY_SCHEDULE_SUMMARY = 'Рабочее время не настроено';

const WEEKDAY_TO_DAY_OF_WEEK: Readonly<Record<Weekday, DayOfWeek>> = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
};

/**
 * Компактная подпись дней недели: смежные по календарному порядку (с понедельника) дни
 * сворачиваются в диапазон («Пн–Пт»), несмежные перечисляются через запятую («Пн, Ср, Пт»).
 * Порядок и повторы во входном массиве не влияют на результат.
 */
export function formatWeekdays(daysOfWeek: readonly DayOfWeek[]): string {
  const indices = [...new Set(daysOfWeek.map((day) => WEEKDAY_ORDER.indexOf(day)))].sort(
    (left, right) => left - right,
  );
  if (indices.length === 0) {
    return '';
  }

  const ranges: number[][] = [];
  let current: number[] = [indices[0]];
  for (const index of indices.slice(1)) {
    if (index === current[current.length - 1] + 1) {
      current.push(index);
    } else {
      ranges.push(current);
      current = [index];
    }
  }
  ranges.push(current);

  return ranges
    .map((range) => {
      const start = WEEKDAY_SHORT_LABEL[WEEKDAY_ORDER[range[0]]];
      const end = WEEKDAY_SHORT_LABEL[WEEKDAY_ORDER[range[range.length - 1]]];
      return range.length === 1 ? start : `${start}–${end}`;
    })
    .join(', ');
}

/**
 * Краткая сводка рабочего графика для settings row экрана 08 («Пн–Пт · 09:00–18:00»).
 * Несколько правил с разными интервалами перечисляются через «; ». Пустой список правил — состояние,
 * недостижимое после завершённого онбординга (экран 03 требует хотя бы один интервал), но
 * обрабатывается явно, а не падением.
 */
export function formatAvailabilitySummary(rules: readonly AvailabilityRule[]): string {
  if (rules.length === 0) {
    return EMPTY_SCHEDULE_SUMMARY;
  }

  return rules
    .map((rule) => `${formatWeekdays(rule.daysOfWeek)} · ${rule.startLocal}–${rule.endLocal}`)
    .join('; ');
}

/** Приведение одного дня UISpec-enum `Weekday` (нижний регистр) к контрактному `DayOfWeek`. */
export function toDayOfWeek(day: Weekday): DayOfWeek {
  return WEEKDAY_TO_DAY_OF_WEEK[day];
}

/**
 * Дни недели, не покрытые ни одним интервалом графика («Выходные: Сб, Вс», кадр 3 экрана 03).
 * Все семь дней рабочие — пустая строка (текст просто не рендерится экраном); список интервалов
 * пуст — все дни выходные, тот же результат, что и «график ещё не настроен».
 */
export function formatDaysOff(intervals: readonly WorkingInterval[]): string {
  const covered = new Set(
    intervals.flatMap((interval) => interval.daysOfWeek.map(toDayOfWeek)),
  );
  const daysOff = WEEKDAY_ORDER.filter((day) => !covered.has(day));
  if (daysOff.length === 0) {
    return '';
  }
  return `Выходные: ${formatWeekdays(daysOff)}`;
}

/**
 * Мапинг view-интервалов формы (`WorkingInterval[]`, экраны 03/04/07) в контрактные
 * `AvailabilityRule[]` для `SetupRequest`: client-only `id` отбрасывается, `Weekday` (нижний
 * регистр) приводится к контрактному `DayOfWeek`.
 */
export function toAvailabilityRules(intervals: readonly WorkingInterval[]): AvailabilityRule[] {
  return intervals.map((interval) => ({
    daysOfWeek: interval.daysOfWeek.map(toDayOfWeek),
    startLocal: interval.startLocal,
    endLocal: interval.endLocal,
  }));
}

/**
 * Текст подтверждения перезаписи (`ConfirmationDialog` спеки 04): какие дни уже заняты другим
 * интервалом и на какое время они переключатся при применении текущей формы sheet.
 */
export function overwriteMessage(
  intervals: readonly WorkingInterval[],
  startLocal: string,
  endLocal: string,
): string {
  const days = [...new Set(intervals.flatMap((interval) => interval.daysOfWeek))].map(toDayOfWeek);
  return `${formatWeekdays(days)}: рабочее время будет заменено на ${startLocal}–${endLocal}.`;
}

/**
 * Подпись CTA bottom sheet 04 по числу выбранных дней («Применить к 5 дням»). Дательный падеж
 * множественного числа в русском не различает 2–4 и 5+ (только форма единственного числа особая
 * — «дню»), поэтому область значений (1–7 дней недели) закрывается одной проверкой на единицу.
 */
export function applyDaysLabel(count: number): string {
  return `Применить к ${count} ${count === 1 ? 'дню' : 'дням'}`;
}
