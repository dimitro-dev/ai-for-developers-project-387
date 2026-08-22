import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { TasksConfig } from './config.ts';
import { legacyIds, MANIFEST_FILE, readManifest, type TaskManifest } from './manifest.ts';

export interface TaskLocation {
  /** Канонический id: `<тип>/<номер>`, без слага. */
  id: string;
  type: string;
  number: string;
  slug: string;
  /** Имя директории задачи: `<номер>-<слаг>`. */
  dirName: string;
  /** Абсолютный путь к директории задачи. */
  dir: string;
}

export class ResolveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ResolveError';
  }
}

export function taskId(type: string, num: string): string {
  return `${type}/${num}`;
}

export function formatNumber(value: number, config: TasksConfig): string {
  return String(value).padStart(config.numberWidth, '0');
}

export function parseTaskDirName(name: string, config: TasksConfig): { number: string; slug: string } | null {
  const match = new RegExp(`^(\\d{${config.numberWidth}})-([a-z0-9]+(?:-[a-z0-9]+)*)$`).exec(name);
  if (!match) return null;
  return { number: match[1]!, slug: match[2]! };
}

/** Задачи всех типов конфига. Всё остальное в tasks/ (archive, _template, tools, файлы) не обходится. */
export function listTasks(tasksRoot: string, config: TasksConfig): TaskLocation[] {
  const tasks: TaskLocation[] = [];
  for (const type of config.types) {
    const typeDir = join(tasksRoot, ...type.split('/'));
    if (!existsSync(typeDir)) continue;
    for (const entry of readdirSync(typeDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const parsed = parseTaskDirName(entry.name, config);
      if (!parsed) continue;
      tasks.push({
        id: taskId(type, parsed.number),
        type,
        number: parsed.number,
        slug: parsed.slug,
        dirName: entry.name,
        dir: join(typeDir, entry.name),
      });
    }
  }
  return tasks.sort((a, b) => {
    const byType = config.types.indexOf(a.type) - config.types.indexOf(b.type);
    return byType !== 0 ? byType : a.dirName.localeCompare(b.dirName);
  });
}

export function manifestPath(task: TaskLocation): string {
  return join(task.dir, MANIFEST_FILE);
}

export function duplicateNumbers(tasks: TaskLocation[]): Array<{ id: string; dirs: string[] }> {
  const byId = new Map<string, string[]>();
  for (const task of tasks) {
    const dirs = byId.get(task.id) ?? [];
    dirs.push(task.dirName);
    byId.set(task.id, dirs);
  }
  return [...byId.entries()]
    .filter(([, dirs]) => dirs.length > 1)
    .map(([id, dirs]) => ({ id, dirs: [...dirs].sort() }));
}

export function nextNumber(tasks: TaskLocation[], type: string, config: TasksConfig): string {
  if (!config.types.includes(type)) {
    throw new ResolveError(`неизвестный тип задачи "${type}" (в конфиге: ${config.types.join(', ')})`);
  }
  const used = tasks.filter((task) => task.type === type).map((task) => Number(task.number));
  const next = used.length === 0 ? 1 : Math.max(...used) + 1;
  const limit = 10 ** config.numberWidth;
  if (next >= limit) throw new ResolveError(`номера типа "${type}" исчерпаны: ${config.numberWidth} знак(ов)`);
  return formatNumber(next, config);
}

/** `tasks/back/001-api-skeleton/` → `back/001`; принимает id со слагом и без. */
export function normalizeRef(ref: string, config: TasksConfig): string {
  let value = ref.trim().replace(/^\.\//, '').replace(/\/+$/, '');
  if (value.startsWith('tasks/')) value = value.slice('tasks/'.length);
  const slash = value.lastIndexOf('/');
  if (slash < 0) return value;
  const type = value.slice(0, slash);
  const tail = value.slice(slash + 1);
  const parsed = parseTaskDirName(tail, config);
  return parsed ? taskId(type, parsed.number) : value;
}

/** Форма канонического id: известный тип конфига и номер нужной ширины. */
export function isTaskId(value: string, config: TasksConfig): boolean {
  const slash = value.lastIndexOf('/');
  if (slash < 0) return false;
  const type = value.slice(0, slash);
  return config.types.includes(type) && new RegExp(`^\\d{${config.numberWidth}}$`).test(value.slice(slash + 1));
}

export function findById(tasks: TaskLocation[], id: string): TaskLocation[] {
  return tasks.filter((task) => task.id === id);
}

export function findByLegacyId(tasks: TaskLocation[], legacyId: string, config: TasksConfig): TaskLocation[] {
  return tasks.filter((task) => {
    let manifest: TaskManifest;
    try {
      manifest = readManifest(manifestPath(task), config);
    } catch {
      return false;
    }
    return legacyIds(manifest).includes(legacyId);
  });
}

/** id (`back/001`), путь со слагом (`back/001-api-skeleton`) или legacyId (`task-back-001`). */
export function resolveTask(tasks: TaskLocation[], ref: string, config: TasksConfig): TaskLocation {
  const normalized = normalizeRef(ref, config);
  const direct = findById(tasks, normalized);
  if (direct.length > 1) {
    throw new ResolveError(`id "${normalized}" занят несколькими директориями: ${direct.map((t) => t.dirName).join(', ')}`);
  }
  if (direct.length === 1) return direct[0]!;

  const legacy = findByLegacyId(tasks, ref.trim(), config);
  if (legacy.length > 1) {
    throw new ResolveError(`legacyId "${ref.trim()}" указан у нескольких задач: ${legacy.map((t) => t.id).join(', ')}`);
  }
  if (legacy.length === 1) return legacy[0]!;

  throw new ResolveError(`задача "${ref}" не найдена — ни по id, ни по legacyId`);
}
