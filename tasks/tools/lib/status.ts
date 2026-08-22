import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { CliError, columns, flagValue, parseFlags, repoRoot, type CommandContext } from './cli.ts';
import { trackOf } from './config.ts';
import { legacyIds } from './manifest.ts';
import { stageText } from './stage.ts';
import { loadView, loadViews, locate, type BrokenTask, type TaskView } from './view.ts';

const MISSING = '(отсутствует)';
const PRESENT = '(есть)';
const NO_GIT = '(git недоступен)';

/** Живая проверка пути рабочего контекста: относительные пути — от корня репозитория. */
function pathMark(repo: string, value: string): string {
  return existsSync(isAbsolute(value) ? value : resolve(repo, value)) ? PRESENT : MISSING;
}

/** Живая проверка ветки. Без git (или вне репозитория) вывод деградирует, а не падает. */
function branchMark(repo: string, branch: string): string {
  try {
    const listed = execFileSync('git', ['branch', '--list', branch], {
      cwd: repo,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return listed.trim() === '' ? MISSING : PRESENT;
  } catch {
    return NO_GIT;
  }
}

function progressText(target: TaskView): string {
  const { progress } = target.info;
  return progress ? `${progress.done} из ${progress.total}` : '—';
}

function brokenLines(broken: BrokenTask[]): string[] {
  if (broken.length === 0) return [];
  return [
    '',
    `Манифест не читается (${broken.length}):`,
    ...broken.flatMap((item) => [`  ${item.location.type}/${item.location.dirName}`, ...item.message.split('\n').map((line) => `    ${line}`)]),
  ];
}

export function renderDetail(ctx: CommandContext, target: TaskView, stages: Map<string, string>): string {
  const { manifest, location, info } = target;
  const track = trackOf(ctx.config, manifest.track);
  const repo = repoRoot(ctx.root);
  const legacy = legacyIds(manifest);

  const head = [
    `${manifest.id} — ${manifest.title}`,
    `  директория: ${location.type}/${location.dirName}   трек: ${manifest.track}${legacy.length > 0 ? `   legacyId: ${legacy.join(', ')}` : ''}`,
    `  стадия: ${info.stage}${info.activeGate ? `   активный гейт: ${info.activeGate} (${track.gates.find((gate) => gate.name === info.activeGate)?.file})` : ''}`,
    `  пункты: ${progressText(target)}`,
  ];

  const gates = [
    '',
    'Гейты:',
    ...columns(
      track.gates.map((gate) => {
        const state = manifest.gates[gate.name];
        return [
          `  ${gate.name}`,
          state?.status ?? ctx.config.statuses.draft,
          state?.approvedAt ?? '',
          gate.name === info.activeGate ? '← активный' : '',
        ];
      }),
    ),
  ];

  const depends = manifest.depends ?? [];
  const dependsBlock = depends.length === 0
    ? []
    : ['', 'Зависимости:', ...columns(depends.map((id) => [`  ${id}`, stages.get(id) ?? '(задача не найдена)']))];

  const queue = manifest.queue;
  const queueBlock = queue === undefined
    ? []
    : [
      '',
      'Очередь:',
      ...(queue.after && queue.after.length > 0 ? [`  после: ${queue.after.join(', ')}`] : []),
      ...(queue.parallel && queue.parallel.length > 0 ? [`  параллельно: ${queue.parallel.join(', ')}`] : []),
      ...(queue.rationale ? [`  обоснование: ${queue.rationale}`] : []),
    ];

  const workspace = manifest.workspace;
  const contextLines = [
    ...(workspace?.branch ? [`  ветка: ${workspace.branch} ${branchMark(repo, workspace.branch)}`] : []),
    ...(workspace?.worktree ? [`  worktree: ${workspace.worktree} ${pathMark(repo, workspace.worktree)}`] : []),
    ...(workspace?.mr ? [`  mr: ${workspace.mr}`] : []),
    ...(manifest.links?.tracker ? [`  трекер: ${manifest.links.tracker}`] : []),
    ...(manifest.uispec ?? []).map((path) => `  uispec: ${path} ${pathMark(repo, path)}`),
  ];
  const contextBlock = contextLines.length === 0 ? [] : ['', 'Рабочий контекст:', ...contextLines];

  return [...head, ...gates, ...dependsBlock, ...queueBlock, ...contextBlock].join('\n');
}

export function statusCommand(ctx: CommandContext, args: string[]): string {
  const parsed = parseFlags(args);
  if (parsed.positional.length > 1) {
    throw new CliError('употребление: scripts/task status [id]');
  }
  const { views, broken } = loadViews(ctx.root, ctx.config);
  const stages = new Map(views.map((item) => [item.manifest.id, item.info.stage]));
  const ref = parsed.positional[0];

  if (ref !== undefined) {
    const location = locate(ctx.root, ref, ctx.config);
    const target = views.find((item) => item.location.dir === location.dir) ?? loadView(location, ctx.config);
    return renderDetail(ctx, target, stages);
  }

  const unfinished = views.filter((item) => item.info.stage !== 'завершена');
  if (unfinished.length === 1) {
    return [renderDetail(ctx, unfinished[0]!, stages), ...brokenLines(broken)].join('\n');
  }
  if (unfinished.length === 0) {
    return [
      views.length === 0 ? 'Задач нет — заведите первую: scripts/task new <тип> <слаг>' : 'Незавершённых задач нет.',
      ...(views.length === 0 ? [] : ['Все задачи: scripts/task list']),
      ...brokenLines(broken),
    ].join('\n');
  }

  return [
    `Незавершённые задачи: ${unfinished.length}`,
    ...columns(
      unfinished.map((item) => [
        `  ${item.manifest.id}`,
        stageText(item.info),
        item.info.activeGate ? `гейт: ${item.info.activeGate}` : '',
        item.manifest.title,
      ]),
    ),
    '',
    'Подробно: scripts/task status <id>',
    ...brokenLines(broken),
  ].join('\n');
}

export function listCommand(ctx: CommandContext, args: string[]): string {
  const parsed = parseFlags(args, { value: ['type'] });
  if (parsed.positional.length > 0) {
    throw new CliError('употребление: scripts/task list [--type <тип>]');
  }
  const filter = flagValue(parsed, 'type');
  if (filter !== undefined && !ctx.config.types.some((type) => type === filter || type.startsWith(`${filter}/`))) {
    throw new CliError(`неизвестный тип "${filter}" (в конфиге: ${ctx.config.types.join(', ')})`);
  }

  const { views, broken } = loadViews(ctx.root, ctx.config);
  const selected = filter === undefined
    ? views
    : views.filter((item) => item.location.type === filter || item.location.type.startsWith(`${filter}/`));

  if (selected.length === 0) {
    return [
      filter === undefined ? 'Задач нет.' : `Задач типа "${filter}" нет.`,
      ...brokenLines(broken),
    ].join('\n');
  }

  return [
    ...columns([
      ['id', 'трек', 'стадия', 'заголовок'],
      ...selected.map((item) => [item.manifest.id, item.manifest.track, stageText(item.info), item.manifest.title]),
    ]),
    '',
    `Всего: ${selected.length}`,
    ...brokenLines(broken),
  ].join('\n');
}
