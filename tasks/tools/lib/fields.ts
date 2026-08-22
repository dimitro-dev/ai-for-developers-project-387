import { CliError, expectPositional, parseFlags, type CommandContext } from './cli.ts';
import type { TasksConfig } from './config.ts';
import { writeManifest, type TaskManifest } from './manifest.ts';
import { isTaskId, manifestPath, normalizeRef } from './resolve.ts';
import { view } from './view.ts';

/** Списковые поля: CSV заменяет список целиком, `+элем`/`-элем` правят его точечно. */
const LIST_PATHS = ['depends', 'queue.after', 'queue.parallel', 'uispec'];
const SCALAR_PATHS = ['title', 'queue.rationale', 'workspace.branch', 'workspace.worktree', 'workspace.mr', 'links.tracker'];
/** Блоки целиком: только для unset — «убрать рабочий контекст одной командой». */
const BLOCK_PATHS = ['queue', 'workspace', 'links'];
/** Поля-ссылки на задачи: значения приводятся к каноническому id. */
const ID_LIST_PATHS = ['depends', 'queue.after', 'queue.parallel'];

const FORBIDDEN: Array<{ path: string; via: string }> = [
  { path: 'id', via: 'new и migrate' },
  { path: 'slug', via: 'new и migrate' },
  { path: 'track', via: 'promote' },
  { path: 'gates', via: 'approve и draft' },
  { path: 'meta', via: 'repair' },
  { path: 'legacyId', via: 'migrate' },
];

function checkPath(path: string, allowed: string[]): void {
  const forbidden = FORBIDDEN.find((entry) => path === entry.path || path.startsWith(`${entry.path}.`));
  if (forbidden) {
    throw new CliError(`поле "${forbidden.path}" через set/unset не меняется — только через ${forbidden.via}`);
  }
  if (!allowed.includes(path)) {
    throw new CliError(`неизвестное поле "${path}" (допустимы: ${allowed.join(', ')})`);
  }
}

function normalizeIds(values: string[], path: string, config: TasksConfig): string[] {
  return values.map((value) => {
    const id = normalizeRef(value, config);
    if (!isTaskId(id, config)) {
      throw new CliError(`${path}: "${value}" не похоже на id задачи — ожидается <тип>/<номер> (типы: ${config.types.join(', ')})`);
    }
    return id;
  });
}

/** CSV — замена списка; `+a,-b` — точечные операции; смешивать формы нельзя. */
export function applyListValue(current: string[] | undefined, raw: string, path: string): string[] {
  const tokens = raw.split(',').map((token) => token.trim()).filter((token) => token !== '');
  if (tokens.length === 0) {
    throw new CliError(`${path}: пустое значение — чтобы убрать список целиком, используйте unset`);
  }
  const operations = tokens.filter((token) => token.startsWith('+') || token.startsWith('-'));
  if (operations.length > 0 && operations.length < tokens.length) {
    throw new CliError(`${path}: нельзя смешивать замену списка и операции +/- в одном значении`);
  }
  if (operations.length === 0) return tokens;

  let result = [...(current ?? [])];
  for (const operation of operations) {
    const item = operation.slice(1).trim();
    if (item === '') throw new CliError(`${path}: пустой элемент в операции "${operation}"`);
    if (operation.startsWith('+')) {
      if (!result.includes(item)) result.push(item);
    } else {
      result = result.filter((value) => value !== item);
    }
  }
  return result;
}

/** Копия манифеста с раскрытыми вложенными блоками — правится по месту, пишется целиком. */
function mutable(manifest: TaskManifest): TaskManifest {
  const copy: TaskManifest = { ...manifest };
  if (manifest.depends) copy.depends = [...manifest.depends];
  if (manifest.uispec) copy.uispec = [...manifest.uispec];
  if (manifest.queue) copy.queue = { ...manifest.queue };
  if (manifest.workspace) copy.workspace = { ...manifest.workspace };
  if (manifest.links) copy.links = { ...manifest.links };
  return copy;
}

function currentList(manifest: TaskManifest, path: string): string[] | undefined {
  if (path === 'depends') return manifest.depends;
  if (path === 'uispec') return manifest.uispec;
  if (path === 'queue.after') return manifest.queue?.after;
  return manifest.queue?.parallel;
}

function assignList(manifest: TaskManifest, path: string, value: string[]): void {
  if (path === 'depends') manifest.depends = value;
  else if (path === 'uispec') manifest.uispec = value;
  else {
    manifest.queue = { ...manifest.queue };
    if (path === 'queue.after') manifest.queue.after = value;
    else manifest.queue.parallel = value;
  }
}

function assignScalar(manifest: TaskManifest, path: string, value: string): void {
  if (path === 'title') {
    manifest.title = value;
    return;
  }
  const [block, key] = path.split('.') as [string, string];
  if (block === 'queue') manifest.queue = { ...manifest.queue, rationale: value };
  else if (block === 'workspace') manifest.workspace = { ...manifest.workspace, [key]: value };
  else manifest.links = { ...manifest.links, tracker: value };
}

/** Пустой блок в манифесте не хранится: `queue: {}` — это отсутствие queue. */
function prune(manifest: TaskManifest): void {
  if (manifest.queue && Object.keys(manifest.queue).length === 0) delete manifest.queue;
  if (manifest.workspace && Object.keys(manifest.workspace).length === 0) delete manifest.workspace;
  if (manifest.links && Object.keys(manifest.links).length === 0) delete manifest.links;
  if (manifest.depends && manifest.depends.length === 0) delete manifest.depends;
  if (manifest.uispec && manifest.uispec.length === 0) delete manifest.uispec;
}

function describeValue(manifest: TaskManifest, path: string): string {
  const list = LIST_PATHS.includes(path) ? currentList(manifest, path) : undefined;
  if (list) return list.length === 0 ? '(пусто)' : list.join(', ');
  if (path === 'title') return manifest.title;
  const [block, key] = path.split('.') as [string, string | undefined];
  if (key === undefined) return '(снято)';
  const holder = block === 'queue' ? manifest.queue : block === 'workspace' ? manifest.workspace : manifest.links;
  return (holder as Record<string, string> | undefined)?.[key] ?? '(снято)';
}

export function setCommand(ctx: CommandContext, args: string[]): string {
  const [ref, path, raw] = expectPositional(parseFlags(args), 3, 'set <id> <путь> <значение>');
  checkPath(path!, [...LIST_PATHS, ...SCALAR_PATHS]);

  const { manifest, location } = view(ctx.root, ref!, ctx.config);
  const next = mutable(manifest);

  if (LIST_PATHS.includes(path!)) {
    const value = applyListValue(currentList(next, path!), raw!, path!);
    assignList(next, path!, ID_LIST_PATHS.includes(path!) ? normalizeIds(value, path!, ctx.config) : value);
  } else {
    const value = raw!.trim();
    if (value === '') throw new CliError(`${path}: пустое значение — используйте unset`);
    assignScalar(next, path!, value);
  }
  prune(next);

  const written = writeManifest(manifestPath(location), next, ctx.config);
  return `${manifest.id}: ${path} = ${describeValue(written, path!)} (rev ${written.meta.rev})`;
}

export function unsetCommand(ctx: CommandContext, args: string[]): string {
  const [ref, path] = expectPositional(parseFlags(args), 2, 'unset <id> <путь>');
  checkPath(path!, [...LIST_PATHS, ...SCALAR_PATHS, ...BLOCK_PATHS]);

  const { manifest, location } = view(ctx.root, ref!, ctx.config);
  const next = mutable(manifest);

  if (BLOCK_PATHS.includes(path!)) {
    delete next[path as 'queue' | 'workspace' | 'links'];
  } else if (path === 'depends' || path === 'uispec') {
    delete next[path];
  } else if (path === 'title') {
    throw new CliError('поле "title" обязательно — его можно только изменить через set');
  } else {
    const [block, key] = path!.split('.') as ['queue' | 'workspace' | 'links', string];
    const holder = next[block] as Record<string, unknown> | undefined;
    if (holder) delete holder[key];
  }
  prune(next);

  // Порядок ключей копия сохраняет, поэтому равенство сериализаций значит «удалять было нечего».
  if (JSON.stringify(manifest) === JSON.stringify(next)) {
    return `${manifest.id}: поле "${path}" и так не задано — манифест не изменён`;
  }

  const written = writeManifest(manifestPath(location), next, ctx.config);
  return `${manifest.id}: поле "${path}" убрано (rev ${written.meta.rev})`;
}
