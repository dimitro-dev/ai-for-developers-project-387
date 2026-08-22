import { doneState, trackOf, type TasksConfig } from './config.ts';
import type { TaskManifest } from './manifest.ts';

export const STAGES = ['заявлена', 'постановка', 'проектирование', 'реализация', 'результат', 'завершена'] as const;

export type StageName = (typeof STAGES)[number];

export interface PlanItem {
  id: string;
  /** Состояние, приведённое к словарю конфига; пустая строка — состояние вне словаря. */
  state: string;
  /** Ячейка состояния как написана: живые планы дописывают к состоянию обоснование. */
  stateRaw: string;
  /** Все ячейки строки, включая id и состояние — для вывода в status/registry. */
  cells: string[];
}

export interface ParseItemsOptions {
  section?: string;
  /** Словарь состояний; без него состояние берётся как есть. */
  states?: string[];
}

export interface Progress {
  done: number;
  total: number;
}

export interface StageInfo {
  stage: StageName;
  /** Первый несогласованный гейт; у завершённой задачи отсутствует. */
  activeGate?: string;
  progress?: Progress;
  items: PlanItem[];
}

/** Содержимое документов трека: имя файла → текст, `null` — файла нет. */
export type TaskDocuments = Record<string, string | null>;

/** Стадия одной строкой: с прогрессом пунктов, когда он есть. */
export function stageText(info: StageInfo): string {
  return info.progress ? `${info.stage} (${info.progress.done}/${info.progress.total})` : info.stage;
}

const FENCE_RE = /^\s*(```|~~~)/;
const DELIMITER_RE = /^:?-{3,}:?$/;

/** Разбор строки таблицы: экранированные `\|` не считаются разделителями ячеек. */
export function splitRow(line: string): string[] {
  const body = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  const cells: string[] = [];
  let current = '';
  for (let i = 0; i < body.length; i += 1) {
    const char = body[i]!;
    if (char === '\\' && body[i + 1] === '|') {
      current += '|';
      i += 1;
      continue;
    }
    if (char === '|') {
      cells.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }
  cells.push(current.trim());
  return cells;
}

function isTableRow(line: string): boolean {
  return line.trim().startsWith('|');
}

function isDelimiterRow(line: string): boolean {
  if (!isTableRow(line)) return false;
  const cells = splitRow(line);
  return cells.length > 1 && cells.every((cell) => DELIMITER_RE.test(cell));
}

/** Полуинтервал строк секции `[start, end)`; `null` — секции в документе нет. */
export interface SectionRange {
  start: number;
  end: number;
}

/** Границы секции `## Заголовок` — до следующего заголовка того же или более высокого уровня. */
export function sectionRange(lines: string[], section: string): SectionRange | null {
  const marker = section.trim();
  const level = /^#+/.exec(marker)?.[0].length ?? 0;
  const heading = lines.findIndex((line) => line.trim() === marker);
  if (heading < 0) return null;
  const start = heading + 1;
  const offset = lines.slice(start).findIndex((line) => {
    const next = /^(#+)\s/.exec(line);
    return next !== null && next[1]!.length <= level;
  });
  return { start, end: offset < 0 ? lines.length : start + offset };
}

/** Строки секции `## Заголовок` — до следующего заголовка того же или более высокого уровня. */
export function sectionLines(lines: string[], section: string): string[] {
  const range = sectionRange(lines, section);
  return range ? lines.slice(range.start, range.end) : [];
}

/**
 * Живые планы дописывают к состоянию обоснование («завершено — подтверждено прогоном»),
 * поэтому словарное значение узнаётся по началу ячейки, а не по точному совпадению.
 */
export function normalizeState(raw: string, states?: string[]): string {
  if (!states) return raw;
  const matches = states
    .filter((state) => new RegExp(`^${state.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=$|[\\s—–,;:.(-])`).test(raw))
    .sort((a, b) => b.length - a.length);
  return matches[0] ?? '';
}

/**
 * Первая таблица пунктов: заголовок начинается с колонки `ID`, за ним строка-разделитель.
 * Состояние пункта — последняя колонка.
 */
export function parseItems(markdown: string, options: ParseItemsOptions = {}): PlanItem[] {
  const { section, states } = options;
  const lines = markdown.split(/\r?\n/);

  return findItemRows(lines, section).map((index) => {
    const cells = splitRow(lines[index]!);
    const stateRaw = cells[cells.length - 1] ?? '';
    return { id: cells[0] ?? '', state: normalizeState(stateRaw, states), stateRaw, cells };
  });
}

/**
 * Индексы строк-пунктов первой таблицы: заголовок начинается с колонки `ID`, за ним
 * строка-разделитель. Индексы абсолютные — по ним хэш-стратегия правит исходный текст.
 */
export function findItemRows(lines: string[], section?: string): number[] {
  const range = section ? sectionRange(lines, section) : { start: 0, end: lines.length };
  if (!range) return [];

  let inFence = false;
  for (let i = range.start; i < range.end; i += 1) {
    const line = lines[i]!;
    if (FENCE_RE.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence || !isTableRow(line)) continue;

    const header = splitRow(line);
    if (header.length < 2 || header[0]!.toLowerCase() !== 'id') continue;
    if (i + 1 >= range.end || !isDelimiterRow(lines[i + 1]!)) continue;

    const rows: number[] = [];
    for (let j = i + 2; j < range.end; j += 1) {
      if (!isTableRow(lines[j]!)) break;
      if ((splitRow(lines[j]!)[0] ?? '') === '') continue;
      rows.push(j);
    }
    return rows;
  }
  return [];
}

export function computeStage(manifest: TaskManifest, documents: TaskDocuments, config: TasksConfig): StageInfo {
  const track = trackOf(config, manifest.track);
  const { draft, approved } = config.statuses;
  const gates = track.gates;
  const statuses = gates.map((gate) => manifest.gates[gate.name]?.status ?? draft);

  const itemsText = documents[track.items.file];
  const items = itemsText == null
    ? []
    : parseItems(itemsText, { section: track.items.section, states: config.itemStates });
  const done = items.filter((item) => item.state === doneState(config)).length;
  const progress: Progress | undefined = items.length > 0 ? { done, total: items.length } : undefined;

  const anyDocument = gates.some((gate) => documents[gate.file] != null);
  const anyApproved = statuses.some((status) => status === approved);
  const lastGate = gates[gates.length - 1]!.name;
  const firstDraft = gates.find((gate, index) => statuses[index] === draft)?.name;

  const info = (stage: StageName, activeGate?: string): StageInfo => {
    const result: StageInfo = { stage, items };
    if (activeGate !== undefined) result.activeGate = activeGate;
    if (progress) result.progress = progress;
    return result;
  };

  if (!anyDocument && !anyApproved) return { stage: 'заявлена', activeGate: gates[0]!.name, items: [] };
  if (firstDraft === undefined) return info('завершена');
  if (statuses[0] === draft) return info('постановка', gates[0]!.name);

  const designIndex = statuses.slice(1, -1).findIndex((status) => status === draft);
  if (designIndex >= 0) return info('проектирование', gates[designIndex + 1]!.name);

  if (items.length > 0 && done < items.length) return info('реализация', lastGate);
  return info('результат', lastGate);
}
