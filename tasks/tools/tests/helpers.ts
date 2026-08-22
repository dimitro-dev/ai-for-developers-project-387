import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CommandContext } from '../lib/cli.ts';
import { loadConfig, type TasksConfig } from '../lib/config.ts';
import {
  MANIFEST_FILE,
  newManifest,
  readManifest,
  writeManifest,
  type NewManifestInput,
  type TaskManifest,
} from '../lib/manifest.ts';

export const TOOLS_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const FIXTURES_DIR = join(TOOLS_DIR, 'tests', 'fixtures');
export const REPO_TASKS_ROOT = resolve(TOOLS_DIR, '..');

/** Конфиг мини-дерева: уже другой набор типов, чем у проекта, — инструмент про MiniCal не знает. */
export const RAW_FIXTURE_CONFIG = {
  types: ['contract', 'back', 'front/ui', 'front/guest', 'process'],
  archiveDir: 'archive',
  templateDir: '_template',
  registryFile: 'REGISTRY.md',
  numberWidth: 3,
  statuses: { draft: 'черновик', approved: 'согласовано' },
  itemStates: ['в плане', 'выполняется', 'завершено'],
  tracks: {
    full: {
      gates: [
        { name: 'brief', file: 'brief.md' },
        { name: 'adr', file: 'adr.md' },
        { name: 'plan', file: 'plan.md', hash: 'ignore-state-column' },
        { name: 'result', file: 'result.md' },
      ],
      items: { file: 'plan.md' },
    },
    lite: {
      gates: [
        { name: 'setup', file: 'task.md', hash: 'until:## Чеклист' },
        { name: 'result', file: 'task.md' },
      ],
      items: { file: 'task.md', section: '## Чеклист' },
    },
  },
};

export interface TaskFixture {
  /** Путь директории задачи от корня дерева, например `front/ui/001-guest-uispec`. */
  dir: string;
  manifest?: NewManifestInput;
  documents?: Record<string, string>;
}

export interface Tree {
  root: string;
  config: TasksConfig;
}

const roots: string[] = [];

/** Временный корень дерева задач; убирается общим cleanupTrees в конце файла тестов. */
export function tempRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'minical-tasks-'));
  roots.push(root);
  return root;
}

export function createTree(tasks: TaskFixture[], rawConfig: unknown = RAW_FIXTURE_CONFIG): Tree {
  const root = tempRoot();
  writeFileSync(join(root, 'tasks.config.json'), `${JSON.stringify(rawConfig, null, 2)}\n`, 'utf8');
  const config = loadConfig(root);

  for (const task of tasks) {
    const dir = join(root, ...task.dir.split('/'));
    mkdirSync(dir, { recursive: true });
    if (task.manifest) writeManifest(join(dir, MANIFEST_FILE), newManifest(task.manifest, config), config);
    for (const [name, content] of Object.entries(task.documents ?? {})) {
      writeFileSync(join(dir, name), content, 'utf8');
    }
  }
  return { root, config };
}

export function scaffold(root: string, relativePath: string, content = ''): string {
  const file = join(root, ...relativePath.split('/'));
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content, 'utf8');
  return file;
}

export function cleanupTrees(): void {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
}

/** Дата в контексте фиксирована: вывод approve сравнивается посимвольно. */
export const TODAY = '2026-08-15';

export function context(tree: Tree, today: string = TODAY): CommandContext {
  return { root: tree.root, config: tree.config, today };
}

/** Манифест задачи фикстуры с диска — проверка того, что реально записано. */
export function manifestOf(tree: Tree, dir: string): TaskManifest {
  return readManifest(join(tree.root, ...dir.split('/'), MANIFEST_FILE), tree.config);
}

export function taskFile(tree: Tree, dir: string, name: string): string {
  return join(tree.root, ...dir.split('/'), name);
}
