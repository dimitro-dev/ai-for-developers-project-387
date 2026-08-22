import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CliError, parseFlags, type CommandContext, type CommandResult } from './cli.ts';
import type { TasksConfig } from './config.ts';
import { legacyIds } from './manifest.ts';
import { stageText } from './stage.ts';
import { loadViews, type TaskView } from './view.ts';

const HEADER = 'Генерируется `scripts/task registry`; руками не правится.';
const EMPTY = '—';

export function registryPath(root: string, config: TasksConfig): string {
  return join(root, config.registryFile);
}

/** Ячейка таблицы: разделитель колонок внутри текста экранируется. */
function cell(value: string): string {
  return value.replace(/\|/g, '\\|');
}

function table(header: string[], rows: string[][]): string[] {
  return [
    `| ${header.join(' | ')} |`,
    `|${header.map(() => '---|').join('')}`,
    ...rows.map((row) => `| ${row.join(' | ')} |`),
  ];
}

function taskLink(target: TaskView): string {
  return `[${target.manifest.id}](${target.location.type}/${target.location.dirName}/)`;
}

/** Ссылка по каноническому id; на задачу вне дерева ссылки нет — о ней сообщает `check`. */
function idLink(id: string, byId: Map<string, TaskView>): string {
  const target = byId.get(id);
  return target ? taskLink(target) : cell(id);
}

/**
 * Очередь в топологическом порядке `queue.after`. Порядок стабилен: кандидаты перебираются
 * по возрастанию id, поэтому равноправные задачи всегда выстраиваются одинаково. Цикл (или
 * ссылка на задачу вне очереди) порядок не рвёт — берётся наименьший id из оставшихся.
 */
function orderQueue(views: TaskView[]): TaskView[] {
  const remaining = views
    .filter((target) => target.manifest.queue !== undefined)
    .sort((a, b) => a.manifest.id.localeCompare(b.manifest.id));
  const members = new Set(remaining.map((target) => target.manifest.id));
  const emitted = new Set<string>();
  const ordered: TaskView[] = [];

  while (remaining.length > 0) {
    const ready = remaining.findIndex((target) =>
      (target.manifest.queue?.after ?? []).every((dep) => !members.has(dep) || emitted.has(dep)));
    const next = remaining.splice(ready < 0 ? 0 : ready, 1)[0]!;
    ordered.push(next);
    emitted.add(next.manifest.id);
  }
  return ordered;
}

/** Поддиректории `archive/` — дотиповая эпоха; порядок фиксируется сортировкой, не файловой системой. */
function archiveEntries(root: string, config: TasksConfig): string[] {
  const dir = join(root, config.archiveDir);
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

function byTypeSection(views: TaskView[], config: TasksConfig, byId: Map<string, TaskView>): string[] {
  const lines: string[] = ['## Реестр по типам'];
  if (views.length === 0) return [...lines, '', 'Задач нет.'];

  for (const type of config.types) {
    const ofType = views.filter((target) => target.location.type === type);
    if (ofType.length === 0) continue;
    lines.push(
      '',
      `### ${type}`,
      '',
      ...table(
        ['id', 'Задача', 'Зависимости', 'Стадия'],
        ofType.map((target) => [
          taskLink(target),
          cell(target.manifest.title),
          (target.manifest.depends ?? []).map((id) => idLink(id, byId)).join(', ') || EMPTY,
          stageText(target.info),
        ]),
      ),
    );
  }
  return lines;
}

const QUEUE_HEADER = ['id', 'Стадия', 'Обоснование', 'Параллельно с'];

function queueTable(views: TaskView[], byId: Map<string, TaskView>): string[] {
  return table(
    QUEUE_HEADER,
    views.map((target) => {
      const queue = target.manifest.queue ?? {};
      return [
        taskLink(target),
        stageText(target.info),
        queue.rationale ? cell(queue.rationale) : EMPTY,
        (queue.parallel ?? []).map((id) => idLink(id, byId)).join(', ') || EMPTY,
      ];
    }),
  );
}

/**
 * Очередь отвечает на вопрос «что дальше», поэтому завершённые задачи уходят в подсекцию
 * «История выполнения». Фильтр применяется после сортировки — порядок оставшихся тот же,
 * что и в общем топологическом порядке.
 */
function queueSection(views: TaskView[], byId: Map<string, TaskView>): { lines: string[]; count: number } {
  const ordered = orderQueue(views);
  const lines: string[] = ['## Очередь работ'];
  if (ordered.length === 0) return { lines: [...lines, '', 'Очередь пуста.'], count: 0 };

  const pending = ordered.filter((target) => target.info.stage !== 'завершена');
  const history = ordered.filter((target) => target.info.stage === 'завершена');

  lines.push(
    '',
    'Порядок — по `queue.after`; завершённые — в «Истории выполнения».',
    '',
    ...(pending.length > 0 ? queueTable(pending, byId) : ['Очередь пуста.']),
  );
  if (history.length > 0) lines.push('', '### История выполнения', '', ...queueTable(history, byId));

  return { lines, count: pending.length };
}

function legacySection(root: string, views: TaskView[], config: TasksConfig): { lines: string[]; count: number } {
  const rows: string[][] = [];
  for (const target of views) {
    for (const legacy of legacyIds(target.manifest)) rows.push([cell(legacy), taskLink(target)]);
  }
  for (const name of archiveEntries(root, config)) {
    rows.push([cell(name), `[${config.archiveDir}/${name}](${config.archiveDir}/${name}/) — дотиповая эпоха, как есть`]);
  }
  for (const note of config.legacyNotes ?? []) {
    rows.push([cell(note.id), `${EMPTY} ${cell(note.note)}`]);
  }

  const lines: string[] = ['## Таблица legacy-id'];
  if (rows.length === 0) return { lines: [...lines, '', 'Записей нет.'], count: 0 };
  return { lines: [...lines, '', ...table(['Старый id', 'Где сейчас'], rows)], count: rows.length };
}

export interface RegistryBuild {
  text: string;
  tasks: number;
  /** Незавершённые задачи очереди: строки таблицы «Очередь работ», без истории выполнения. */
  queued: number;
  legacy: number;
}

/**
 * REGISTRY.md целиком. Результат зависит только от дерева задач и конфига: ни дат генерации,
 * ни порядка файловой системы — одинаковое дерево даёт байт-в-байт одинаковый файл.
 */
export function buildRegistry(root: string, config: TasksConfig): RegistryBuild {
  const { views } = loadViews(root, config);
  const byId = new Map(views.map((target) => [target.manifest.id, target]));
  const queue = queueSection(views, byId);
  const legacy = legacySection(root, views, config);

  const lines = [
    '# Реестр задач',
    '',
    HEADER,
    '',
    ...byTypeSection(views, config, byId),
    '',
    ...queue.lines,
    '',
    ...legacy.lines,
  ];
  return { text: `${lines.join('\n')}\n`, tasks: views.length, queued: queue.count, legacy: legacy.count };
}

export function renderRegistry(root: string, config: TasksConfig): string {
  return buildRegistry(root, config).text;
}

/** Расхождение файла на диске со сгенерированным реестром; `null` — реестр актуален. */
export function registryDrift(root: string, config: TasksConfig): string | null {
  const file = registryPath(root, config);
  if (!existsSync(file)) {
    return `${config.registryFile} отсутствует — сгенерируйте: scripts/task registry`;
  }
  return readFileSync(file, 'utf8') === renderRegistry(root, config)
    ? null
    : `${config.registryFile} устарел: данные задач изменились — перегенерируйте: scripts/task registry`;
}

export function registryCommand(ctx: CommandContext, args: string[]): string | CommandResult {
  const parsed = parseFlags(args, { boolean: ['check'] });
  if (parsed.positional.length > 0) {
    throw new CliError('употребление: scripts/task registry [--check]');
  }

  if (parsed.flags.check === true) {
    const drift = registryDrift(ctx.root, ctx.config);
    return drift === null ? `${ctx.config.registryFile} актуален.` : { text: drift, code: 1 };
  }

  const file = registryPath(ctx.root, ctx.config);
  const built = buildRegistry(ctx.root, ctx.config);
  const unchanged = existsSync(file) && readFileSync(file, 'utf8') === built.text;
  if (!unchanged) writeFileSync(file, built.text, 'utf8');
  return [
    unchanged
      ? `${ctx.config.registryFile} актуален — перезаписывать нечего.`
      : `${ctx.config.registryFile} перегенерирован.`,
    `  задач: ${built.tasks}, в очереди: ${built.queued}, legacy-записей: ${built.legacy}`,
  ].join('\n');
}
