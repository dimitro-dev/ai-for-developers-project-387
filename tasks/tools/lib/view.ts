import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { trackOf, type TasksConfig } from './config.ts';
import { readManifest, type TaskManifest } from './manifest.ts';
import { listTasks, manifestPath, resolveTask, type TaskLocation } from './resolve.ts';
import { computeStage, type StageInfo, type TaskDocuments } from './stage.ts';

export interface TaskView {
  location: TaskLocation;
  manifest: TaskManifest;
  info: StageInfo;
  /** Документы трека: имя файла → текст, `null` — файла нет. */
  documents: TaskDocuments;
}

export interface BrokenTask {
  location: TaskLocation;
  message: string;
}

/** Документы трека задачи; отсутствующий файл — `null`, а не ошибка (стадия «заявлена»). */
export function readDocuments(dir: string, track: string, config: TasksConfig): TaskDocuments {
  const documents: TaskDocuments = {};
  for (const gate of trackOf(config, track).gates) {
    if (gate.file in documents) continue;
    try {
      documents[gate.file] = readFileSync(join(dir, gate.file), 'utf8');
    } catch {
      documents[gate.file] = null;
    }
  }
  return documents;
}

export function loadView(location: TaskLocation, config: TasksConfig): TaskView {
  const manifest = readManifest(manifestPath(location), config);
  const documents = readDocuments(location.dir, manifest.track, config);
  return { location, manifest, info: computeStage(manifest, documents, config), documents };
}

/** Всё дерево: нечитаемый манифест не роняет обзор, а попадает в `broken`. */
export function loadViews(root: string, config: TasksConfig): { views: TaskView[]; broken: BrokenTask[] } {
  const views: TaskView[] = [];
  const broken: BrokenTask[] = [];
  for (const location of listTasks(root, config)) {
    try {
      views.push(loadView(location, config));
    } catch (error) {
      broken.push({ location, message: error instanceof Error ? error.message : String(error) });
    }
  }
  return { views, broken };
}

export function locate(root: string, ref: string, config: TasksConfig): TaskLocation {
  return resolveTask(listTasks(root, config), ref, config);
}

/** Задача по ссылке вместе с документами и вычисленной стадией. */
export function view(root: string, ref: string, config: TasksConfig): TaskView {
  return loadView(locate(root, ref, config), config);
}
