import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const CONFIG_FILE = 'tasks.config.json';

export interface GateSpec {
  name: string;
  file: string;
  hash?: string;
}

export interface ItemsSpec {
  file: string;
  section?: string;
}

export interface TrackSpec {
  gates: GateSpec[];
  items: ItemsSpec;
}

export interface StatusVocabulary {
  draft: string;
  approved: string;
}

/** Строка таблицы legacy-id для задачи, которой больше нет: id и что с ней стало. */
export interface LegacyNote {
  id: string;
  note: string;
}

export interface TasksConfig {
  types: string[];
  archiveDir: string;
  templateDir: string;
  registryFile: string;
  numberWidth: number;
  statuses: StatusVocabulary;
  itemStates: string[];
  tracks: Record<string, TrackSpec>;
  legacyNotes?: LegacyNote[];
}

export class ConfigError extends Error {
  readonly problems: string[];

  constructor(message: string, problems: string[] = []) {
    super(message);
    this.name = 'ConfigError';
    this.problems = problems;
  }
}

const TOP_KEYS = [
  'types',
  'archiveDir',
  'templateDir',
  'registryFile',
  'numberWidth',
  'statuses',
  'itemStates',
  'tracks',
  'legacyNotes',
] as const;

/** Ключи, которых в конфиге может не быть; остальные из TOP_KEYS обязательны. */
const OPTIONAL_KEYS: readonly string[] = ['legacyNotes'];

const TRACK_KEYS = ['gates', 'items'] as const;
const LEGACY_NOTE_KEYS = ['id', 'note'] as const;
const GATE_KEYS = ['name', 'file', 'hash'] as const;
const ITEMS_KEYS = ['file', 'section'] as const;
const STATUS_KEYS = ['draft', 'approved'] as const;

const SEGMENT = '[a-z0-9]+(?:-[a-z0-9]+)*';
const TYPE_RE = new RegExp(`^${SEGMENT}(?:/${SEGMENT})*$`);
const NAME_RE = new RegExp(`^${SEGMENT}$`);
const HASH_RE = /^(?:ignore-state-column|until:.+)$/;
const FILE_RE = /^[^/\\]+$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function reportUnknown(value: Record<string, unknown>, known: readonly string[], where: string, problems: string[]) {
  for (const key of Object.keys(value)) {
    if (!known.includes(key)) problems.push(`${where}: неизвестный ключ "${key}" (допустимы: ${known.join(', ')})`);
  }
}

function requireString(value: unknown, where: string, problems: string[], pattern?: RegExp): string | undefined {
  if (typeof value !== 'string') {
    problems.push(`${where}: ожидалась строка, получено ${describe(value)}`);
    return undefined;
  }
  if (value.trim() === '') {
    problems.push(`${where}: строка не может быть пустой`);
    return undefined;
  }
  if (pattern && !pattern.test(value)) {
    problems.push(`${where}: значение "${value}" не соответствует ${pattern.source}`);
    return undefined;
  }
  return value;
}

function requireStringArray(value: unknown, where: string, problems: string[], pattern?: RegExp): string[] | undefined {
  if (!Array.isArray(value)) {
    problems.push(`${where}: ожидался массив строк, получено ${describe(value)}`);
    return undefined;
  }
  if (value.length === 0) {
    problems.push(`${where}: массив не может быть пустым`);
    return undefined;
  }
  const result: string[] = [];
  value.forEach((item, index) => {
    const parsed = requireString(item, `${where}[${index}]`, problems, pattern);
    if (parsed !== undefined) result.push(parsed);
  });
  const duplicates = result.filter((item, index) => result.indexOf(item) !== index);
  if (duplicates.length > 0) problems.push(`${where}: повторяющиеся значения — ${[...new Set(duplicates)].join(', ')}`);
  return result;
}

function describe(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'массив';
  return typeof value;
}

export function parseConfig(data: unknown, source: string = CONFIG_FILE): TasksConfig {
  const problems: string[] = [];

  if (!isRecord(data)) throw new ConfigError(`${source}: ожидался объект верхнего уровня, получено ${describe(data)}`);

  reportUnknown(data, TOP_KEYS, source, problems);
  for (const key of TOP_KEYS) {
    if (!OPTIONAL_KEYS.includes(key) && !(key in data)) problems.push(`${source}: отсутствует обязательный ключ "${key}"`);
  }

  const types = 'types' in data ? requireStringArray(data.types, 'types', problems, TYPE_RE) ?? [] : [];
  for (const type of types) {
    const parent = types.find((other) => type !== other && type.startsWith(`${other}/`));
    if (parent) problems.push(`types: "${parent}" является родителем "${type}" — типы должны быть непересекающимися`);
  }

  const archiveDir = 'archiveDir' in data ? requireString(data.archiveDir, 'archiveDir', problems, FILE_RE) : undefined;
  const templateDir = 'templateDir' in data ? requireString(data.templateDir, 'templateDir', problems, FILE_RE) : undefined;
  const registryFile = 'registryFile' in data ? requireString(data.registryFile, 'registryFile', problems, FILE_RE) : undefined;

  for (const [key, value] of [['archiveDir', archiveDir], ['templateDir', templateDir]] as const) {
    if (value && types.includes(value)) problems.push(`${key}: "${value}" совпадает с типом задач`);
  }

  let numberWidth = 0;
  if ('numberWidth' in data) {
    const raw = data.numberWidth;
    if (typeof raw !== 'number' || !Number.isInteger(raw) || raw < 1 || raw > 6) {
      problems.push(`numberWidth: ожидалось целое от 1 до 6, получено ${JSON.stringify(raw)}`);
    } else {
      numberWidth = raw;
    }
  }

  let statuses: StatusVocabulary = { draft: '', approved: '' };
  if ('statuses' in data) {
    if (!isRecord(data.statuses)) {
      problems.push(`statuses: ожидался объект, получено ${describe(data.statuses)}`);
    } else {
      reportUnknown(data.statuses, STATUS_KEYS, 'statuses', problems);
      const draft = requireString(data.statuses.draft, 'statuses.draft', problems);
      const approved = requireString(data.statuses.approved, 'statuses.approved', problems);
      if (draft && approved && draft === approved) problems.push('statuses: draft и approved должны различаться');
      statuses = { draft: draft ?? '', approved: approved ?? '' };
    }
  }

  const itemStates = 'itemStates' in data ? requireStringArray(data.itemStates, 'itemStates', problems) ?? [] : [];

  const tracks: Record<string, TrackSpec> = {};
  if ('tracks' in data) {
    if (!isRecord(data.tracks)) {
      problems.push(`tracks: ожидался объект, получено ${describe(data.tracks)}`);
    } else if (Object.keys(data.tracks).length === 0) {
      problems.push('tracks: должен быть описан хотя бы один трек');
    } else {
      for (const [name, rawTrack] of Object.entries(data.tracks)) {
        const where = `tracks.${name}`;
        if (!NAME_RE.test(name)) problems.push(`tracks: имя трека "${name}" не соответствует ${NAME_RE.source}`);
        if (!isRecord(rawTrack)) {
          problems.push(`${where}: ожидался объект, получено ${describe(rawTrack)}`);
          continue;
        }
        reportUnknown(rawTrack, TRACK_KEYS, where, problems);
        const gates = parseGates(rawTrack.gates, `${where}.gates`, problems);
        const items = parseItemsSpec(rawTrack.items, `${where}.items`, problems);
        if (gates && items) tracks[name] = { gates, items };
      }
    }
  }

  const legacyNotes = 'legacyNotes' in data ? parseLegacyNotes(data.legacyNotes, 'legacyNotes', problems) : undefined;

  if (problems.length > 0) {
    throw new ConfigError(
      `${source} — конфиг не прошёл проверку:\n${problems.map((p) => `  - ${p}`).join('\n')}`,
      problems,
    );
  }

  const config: TasksConfig = {
    types,
    archiveDir: archiveDir!,
    templateDir: templateDir!,
    registryFile: registryFile!,
    numberWidth,
    statuses,
    itemStates,
    tracks,
  };
  if (legacyNotes !== undefined) config.legacyNotes = legacyNotes;
  return config;
}

function parseLegacyNotes(value: unknown, where: string, problems: string[]): LegacyNote[] | undefined {
  if (!Array.isArray(value)) {
    problems.push(`${where}: ожидался массив записей {id, note}, получено ${describe(value)}`);
    return undefined;
  }
  if (value.length === 0) {
    problems.push(`${where}: пустой список — уберите ключ, если исторических записей нет`);
    return undefined;
  }
  const notes: LegacyNote[] = [];
  value.forEach((raw, index) => {
    const at = `${where}[${index}]`;
    if (!isRecord(raw)) {
      problems.push(`${at}: ожидался объект {id, note}, получено ${describe(raw)}`);
      return;
    }
    reportUnknown(raw, LEGACY_NOTE_KEYS, at, problems);
    const id = requireString(raw.id, `${at}.id`, problems);
    const note = requireString(raw.note, `${at}.note`, problems);
    if (id && note) notes.push({ id, note });
  });
  const ids = notes.map((note) => note.id);
  const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
  if (duplicates.length > 0) problems.push(`${where}: повторяющиеся id — ${[...new Set(duplicates)].join(', ')}`);
  return notes;
}

function parseGates(value: unknown, where: string, problems: string[]): GateSpec[] | undefined {
  if (!Array.isArray(value)) {
    problems.push(`${where}: ожидался массив гейтов, получено ${describe(value)}`);
    return undefined;
  }
  if (value.length === 0) {
    problems.push(`${where}: у трека должен быть хотя бы один гейт`);
    return undefined;
  }
  const gates: GateSpec[] = [];
  value.forEach((rawGate, index) => {
    const at = `${where}[${index}]`;
    if (!isRecord(rawGate)) {
      problems.push(`${at}: ожидался объект, получено ${describe(rawGate)}`);
      return;
    }
    reportUnknown(rawGate, GATE_KEYS, at, problems);
    const name = requireString(rawGate.name, `${at}.name`, problems, NAME_RE);
    const file = requireString(rawGate.file, `${at}.file`, problems, FILE_RE);
    let hash: string | undefined;
    if (rawGate.hash !== undefined) hash = requireString(rawGate.hash, `${at}.hash`, problems, HASH_RE);
    if (name && file) gates.push(hash === undefined ? { name, file } : { name, file, hash });
  });
  const names = gates.map((gate) => gate.name);
  const duplicates = names.filter((name, index) => names.indexOf(name) !== index);
  if (duplicates.length > 0) problems.push(`${where}: повторяющиеся имена гейтов — ${[...new Set(duplicates)].join(', ')}`);
  return gates;
}

function parseItemsSpec(value: unknown, where: string, problems: string[]): ItemsSpec | undefined {
  if (!isRecord(value)) {
    problems.push(`${where}: ожидался объект {file, section?}, получено ${describe(value)}`);
    return undefined;
  }
  reportUnknown(value, ITEMS_KEYS, where, problems);
  const file = requireString(value.file, `${where}.file`, problems, FILE_RE);
  let section: string | undefined;
  if (value.section !== undefined) section = requireString(value.section, `${where}.section`, problems);
  if (!file) return undefined;
  return section === undefined ? { file } : { file, section };
}

export function loadConfig(tasksRoot: string): TasksConfig {
  const file = resolve(tasksRoot, CONFIG_FILE);
  let raw: string;
  try {
    raw = readFileSync(file, 'utf8');
  } catch {
    throw new ConfigError(`${file}: конфиг не найден — создайте его командой "task init"`);
  }
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch (error) {
    throw new ConfigError(`${file}: не разбирается как JSON — ${(error as Error).message}`);
  }
  return parseConfig(data, file);
}

export function trackOf(config: TasksConfig, track: string): TrackSpec {
  const spec = config.tracks[track];
  if (!spec) {
    throw new ConfigError(`неизвестный трек "${track}" (в конфиге описаны: ${Object.keys(config.tracks).join(', ')})`);
  }
  return spec;
}

/** Терминальное состояние пункта — последнее в itemStates. */
export function doneState(config: TasksConfig): string {
  return config.itemStates[config.itemStates.length - 1]!;
}
