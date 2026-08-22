import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { parse, stringify } from 'yaml';
import { trackOf, type TasksConfig } from './config.ts';

export const MANIFEST_FILE = 'task.yaml';

export interface Gate {
  status: string;
  approvedAt?: string;
  sha256?: string;
}

export interface Queue {
  after?: string[];
  parallel?: string[];
  rationale?: string;
}

export interface Workspace {
  branch?: string;
  worktree?: string;
  mr?: string;
}

export interface Links {
  tracker?: string;
}

export interface Meta {
  rev: number;
  selfHash: string;
}

export interface TaskManifest {
  id: string;
  slug: string;
  title: string;
  track: string;
  /** Исторические id задачи: одно значение или список — задачу могли переименовывать не раз. */
  legacyId?: string | string[];
  depends?: string[];
  queue?: Queue;
  gates: Record<string, Gate>;
  workspace?: Workspace;
  links?: Links;
  uispec?: string[];
  meta: Meta;
}

export class ManifestError extends Error {
  readonly problems: string[];

  constructor(message: string, problems: string[] = []) {
    super(message);
    this.name = 'ManifestError';
    this.problems = problems;
  }
}

const TOP_KEYS = [
  'id',
  'slug',
  'title',
  'track',
  'legacyId',
  'depends',
  'queue',
  'gates',
  'workspace',
  'links',
  'uispec',
  'meta',
] as const;

const QUEUE_KEYS = ['after', 'parallel', 'rationale'] as const;
const WORKSPACE_KEYS = ['branch', 'worktree', 'mr'] as const;
const LINKS_KEYS = ['tracker'] as const;
const GATE_KEYS = ['status', 'approvedAt', 'sha256'] as const;
const META_KEYS = ['rev', 'selfHash'] as const;

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const SHA256_RE = /^[0-9a-f]{64}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function describe(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'массив';
  return typeof value;
}

function unknownKeys(value: Record<string, unknown>, known: readonly string[], where: string, problems: string[]) {
  for (const key of Object.keys(value)) {
    if (!known.includes(key)) problems.push(`${where}: неизвестное поле "${key}" (схема закрыта, допустимы: ${known.join(', ')})`);
  }
}

function str(value: unknown, where: string, problems: string[], pattern?: RegExp): string | undefined {
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

function strList(value: unknown, where: string, problems: string[]): string[] | undefined {
  if (!Array.isArray(value)) {
    problems.push(`${where}: ожидался массив строк, получено ${describe(value)}`);
    return undefined;
  }
  const result: string[] = [];
  value.forEach((item, index) => {
    const parsed = str(item, `${where}[${index}]`, problems);
    if (parsed !== undefined) result.push(parsed);
  });
  const duplicates = result.filter((item, index) => result.indexOf(item) !== index);
  if (duplicates.length > 0) problems.push(`${where}: повторяющиеся значения — ${[...new Set(duplicates)].join(', ')}`);
  return result;
}

function idPattern(config: TasksConfig): RegExp {
  const types = config.types.map((type) => type.replace(/[/]/g, '\\/')).join('|');
  return new RegExp(`^(?:${types})\\/\\d{${config.numberWidth}}$`);
}

/**
 * Полная проверка схемы. `meta.selfHash` допускается пустым — незаписанный черновик манифеста;
 * файл на диске такого состояния не содержит (см. parseManifest).
 */
export function validateManifest(value: unknown, config: TasksConfig, source: string = MANIFEST_FILE): TaskManifest {
  const problems: string[] = [];

  if (!isRecord(value)) throw new ManifestError(`${source}: ожидался объект верхнего уровня, получено ${describe(value)}`);

  unknownKeys(value, TOP_KEYS, source, problems);

  const id = str(value.id, 'id', problems, idPattern(config));
  const slug = str(value.slug, 'slug', problems, SLUG_RE);
  const title = str(value.title, 'title', problems);
  const track = str(value.track, 'track', problems);
  if (track !== undefined && !(track in config.tracks)) {
    problems.push(`track: неизвестный трек "${track}" (в конфиге: ${Object.keys(config.tracks).join(', ')})`);
  }

  let legacyId: string | string[] | undefined;
  if (Array.isArray(value.legacyId)) {
    legacyId = strList(value.legacyId, 'legacyId', problems);
    if (legacyId?.length === 0) problems.push('legacyId: пустой список — уберите поле, если исторических id нет');
  } else if (value.legacyId !== undefined) {
    legacyId = str(value.legacyId, 'legacyId', problems);
  }
  const depends = value.depends === undefined ? undefined : strList(value.depends, 'depends', problems);
  const uispec = value.uispec === undefined ? undefined : strList(value.uispec, 'uispec', problems);

  let queue: Queue | undefined;
  if (value.queue !== undefined) {
    if (!isRecord(value.queue)) {
      problems.push(`queue: ожидался объект, получено ${describe(value.queue)}`);
    } else {
      unknownKeys(value.queue, QUEUE_KEYS, 'queue', problems);
      queue = {};
      if (value.queue.after !== undefined) queue.after = strList(value.queue.after, 'queue.after', problems);
      if (value.queue.parallel !== undefined) queue.parallel = strList(value.queue.parallel, 'queue.parallel', problems);
      if (value.queue.rationale !== undefined) queue.rationale = str(value.queue.rationale, 'queue.rationale', problems);
    }
  }

  let workspace: Workspace | undefined;
  if (value.workspace !== undefined) {
    if (!isRecord(value.workspace)) {
      problems.push(`workspace: ожидался объект, получено ${describe(value.workspace)}`);
    } else {
      unknownKeys(value.workspace, WORKSPACE_KEYS, 'workspace', problems);
      workspace = {};
      for (const key of WORKSPACE_KEYS) {
        if (value.workspace[key] !== undefined) workspace[key] = str(value.workspace[key], `workspace.${key}`, problems);
      }
    }
  }

  let links: Links | undefined;
  if (value.links !== undefined) {
    if (!isRecord(value.links)) {
      problems.push(`links: ожидался объект, получено ${describe(value.links)}`);
    } else {
      unknownKeys(value.links, LINKS_KEYS, 'links', problems);
      links = {};
      if (value.links.tracker !== undefined) links.tracker = str(value.links.tracker, 'links.tracker', problems);
    }
  }

  const gates: Record<string, Gate> = {};
  if (!isRecord(value.gates)) {
    problems.push(`gates: ожидался объект гейтов, получено ${describe(value.gates)}`);
  } else if (track !== undefined && track in config.tracks) {
    const expected = trackOf(config, track).gates.map((gate) => gate.name);
    const actual = Object.keys(value.gates);
    for (const name of expected) {
      if (!actual.includes(name)) problems.push(`gates: у трека "${track}" отсутствует гейт "${name}"`);
    }
    for (const name of actual) {
      if (!expected.includes(name)) problems.push(`gates: гейт "${name}" не входит в трек "${track}" (ожидались: ${expected.join(', ')})`);
    }
    for (const name of expected) {
      const rawGate = value.gates[name];
      if (rawGate === undefined) continue;
      const gate = parseGate(rawGate, `gates.${name}`, config, problems);
      if (gate) gates[name] = gate;
    }
  }

  let meta: Meta = { rev: 0, selfHash: '' };
  if (!isRecord(value.meta)) {
    problems.push(`meta: ожидался объект {rev, selfHash}, получено ${describe(value.meta)}`);
  } else {
    unknownKeys(value.meta, META_KEYS, 'meta', problems);
    const rev = value.meta.rev;
    if (typeof rev !== 'number' || !Number.isInteger(rev) || rev < 0) {
      problems.push(`meta.rev: ожидалось неотрицательное целое, получено ${JSON.stringify(rev)}`);
    }
    const selfHash = value.meta.selfHash;
    if (typeof selfHash !== 'string' || (selfHash !== '' && !SHA256_RE.test(selfHash))) {
      problems.push(`meta.selfHash: ожидался sha256 в hex, получено ${JSON.stringify(selfHash)}`);
    }
    if (typeof rev === 'number' && typeof selfHash === 'string') meta = { rev, selfHash };
  }

  if (problems.length > 0) {
    throw new ManifestError(
      `${source} — манифест не прошёл проверку:\n${problems.map((p) => `  - ${p}`).join('\n')}`,
      problems,
    );
  }

  const manifest: TaskManifest = { id: id!, slug: slug!, title: title!, track: track!, gates, meta };
  if (legacyId !== undefined) manifest.legacyId = legacyId;
  if (depends !== undefined && depends.length > 0) manifest.depends = depends;
  if (queue !== undefined && Object.keys(queue).length > 0) manifest.queue = queue;
  if (workspace !== undefined && Object.keys(workspace).length > 0) manifest.workspace = workspace;
  if (links !== undefined && Object.keys(links).length > 0) manifest.links = links;
  if (uispec !== undefined && uispec.length > 0) manifest.uispec = uispec;
  return manifest;
}

function parseGate(value: unknown, where: string, config: TasksConfig, problems: string[]): Gate | undefined {
  if (!isRecord(value)) {
    problems.push(`${where}: ожидался объект {status, approvedAt?, sha256?}, получено ${describe(value)}`);
    return undefined;
  }
  unknownKeys(value, GATE_KEYS, where, problems);
  const known = [config.statuses.draft, config.statuses.approved];
  const status = str(value.status, `${where}.status`, problems);
  if (status !== undefined && !known.includes(status)) {
    problems.push(`${where}.status: "${status}" вне словаря статусов (${known.join(', ')})`);
    return undefined;
  }
  const gate: Gate = { status: status ?? '' };
  if (value.approvedAt !== undefined) {
    const approvedAt = str(value.approvedAt, `${where}.approvedAt`, problems, DATE_RE);
    if (approvedAt !== undefined) gate.approvedAt = approvedAt;
  }
  if (value.sha256 !== undefined) {
    const sha256 = str(value.sha256, `${where}.sha256`, problems, SHA256_RE);
    if (sha256 !== undefined) gate.sha256 = sha256;
  }
  if (status === config.statuses.draft && (gate.approvedAt !== undefined || gate.sha256 !== undefined)) {
    problems.push(`${where}: у гейта в статусе "${config.statuses.draft}" не может быть approvedAt/sha256`);
  }
  return status === undefined ? undefined : gate;
}

/** Исторические id списком — форма хранения (строка или массив) потребителей не касается. */
export function legacyIds(manifest: TaskManifest): string[] {
  if (manifest.legacyId === undefined) return [];
  return Array.isArray(manifest.legacyId) ? [...manifest.legacyId] : [manifest.legacyId];
}

/** Каноническое представление: стабильный порядок ключей, отсутствующие поля опускаются. */
function canonical(manifest: TaskManifest, config: TasksConfig, withMeta: boolean): Record<string, unknown> {
  const out: Record<string, unknown> = {
    id: manifest.id,
    slug: manifest.slug,
    title: manifest.title,
    track: manifest.track,
  };
  if (manifest.legacyId !== undefined) {
    out.legacyId = Array.isArray(manifest.legacyId) ? [...manifest.legacyId] : manifest.legacyId;
  }
  if (manifest.depends && manifest.depends.length > 0) out.depends = [...manifest.depends];

  if (manifest.queue) {
    const queue: Record<string, unknown> = {};
    if (manifest.queue.after && manifest.queue.after.length > 0) queue.after = [...manifest.queue.after];
    if (manifest.queue.parallel && manifest.queue.parallel.length > 0) queue.parallel = [...manifest.queue.parallel];
    if (manifest.queue.rationale !== undefined) queue.rationale = manifest.queue.rationale;
    if (Object.keys(queue).length > 0) out.queue = queue;
  }

  const gates: Record<string, unknown> = {};
  for (const spec of trackOf(config, manifest.track).gates) {
    const gate = manifest.gates[spec.name];
    if (!gate) continue;
    const entry: Record<string, unknown> = { status: gate.status };
    if (gate.approvedAt !== undefined) entry.approvedAt = gate.approvedAt;
    if (gate.sha256 !== undefined) entry.sha256 = gate.sha256;
    gates[spec.name] = entry;
  }
  out.gates = gates;

  if (manifest.workspace) {
    const workspace: Record<string, unknown> = {};
    for (const key of WORKSPACE_KEYS) {
      if (manifest.workspace[key] !== undefined) workspace[key] = manifest.workspace[key];
    }
    if (Object.keys(workspace).length > 0) out.workspace = workspace;
  }

  if (manifest.links?.tracker !== undefined) out.links = { tracker: manifest.links.tracker };
  if (manifest.uispec && manifest.uispec.length > 0) out.uispec = [...manifest.uispec];
  if (withMeta) out.meta = { rev: manifest.meta.rev, selfHash: manifest.meta.selfHash };
  return out;
}

export function serializeManifest(manifest: TaskManifest, config: TasksConfig): string {
  return stringify(canonical(manifest, config, true), { lineWidth: 0 });
}

export function computeSelfHash(manifest: TaskManifest, config: TasksConfig): string {
  const body = stringify(canonical(manifest, config, false), { lineWidth: 0 });
  return createHash('sha256').update(body, 'utf8').digest('hex');
}

export function verifySelfHash(manifest: TaskManifest, config: TasksConfig): boolean {
  return manifest.meta.selfHash === computeSelfHash(manifest, config);
}

/** Разбор и проверка схемы без сверки selfHash — путь `repair`, принимающий правку после ревью. */
export function parseManifestUnverified(text: string, config: TasksConfig, source: string = MANIFEST_FILE): TaskManifest {
  let data: unknown;
  try {
    data = parse(text);
  } catch (error) {
    throw new ManifestError(`${source}: не разбирается как YAML — ${(error as Error).message}`);
  }
  return validateManifest(data, config, source);
}

export function parseManifest(text: string, config: TasksConfig, source: string = MANIFEST_FILE): TaskManifest {
  const manifest = parseManifestUnverified(text, config, source);
  if (manifest.meta.selfHash === '') {
    throw new ManifestError(`${source}: meta.selfHash пуст — манифест записан не инструментом`);
  }
  return manifest;
}

export function readManifest(file: string, config: TasksConfig): TaskManifest {
  let text: string;
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    throw new ManifestError(`${file}: манифест задачи не найден`);
  }
  return parseManifest(text, config, file);
}

/** Единственный писатель task.yaml: валидирует, поднимает rev и пересчитывает selfHash. */
export function writeManifest(file: string, manifest: TaskManifest, config: TasksConfig): TaskManifest {
  const validated = validateManifest({ ...manifest }, config, file);
  const next: TaskManifest = { ...validated, meta: { rev: manifest.meta.rev + 1, selfHash: '' } };
  next.meta.selfHash = computeSelfHash(next, config);
  writeFileSync(file, serializeManifest(next, config), 'utf8');
  return next;
}

export interface NewManifestInput {
  id: string;
  slug: string;
  title: string;
  track: string;
  legacyId?: string | string[];
  depends?: string[];
  queue?: Queue;
  workspace?: Workspace;
  links?: Links;
  uispec?: string[];
  gates?: Record<string, Gate>;
}

/** Манифест в памяти: все гейты трека в черновике, meta ещё не посчитана. */
export function newManifest(input: NewManifestInput, config: TasksConfig): TaskManifest {
  const gates: Record<string, Gate> = {};
  for (const spec of trackOf(config, input.track).gates) {
    gates[spec.name] = input.gates?.[spec.name] ?? { status: config.statuses.draft };
  }
  const manifest: TaskManifest = {
    id: input.id,
    slug: input.slug,
    title: input.title,
    track: input.track,
    gates,
    meta: { rev: 0, selfHash: '' },
  };
  if (input.legacyId !== undefined) manifest.legacyId = input.legacyId;
  if (input.depends !== undefined) manifest.depends = input.depends;
  if (input.queue !== undefined) manifest.queue = input.queue;
  if (input.workspace !== undefined) manifest.workspace = input.workspace;
  if (input.links !== undefined) manifest.links = input.links;
  if (input.uispec !== undefined) manifest.uispec = input.uispec;
  return manifest;
}
