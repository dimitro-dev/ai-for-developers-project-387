import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { CliError, expectPositional, parseFlags, repoRoot, type CommandContext, type CommandResult } from './cli.ts';
import { trackOf, type TasksConfig } from './config.ts';
import { gateHash } from './gates.ts';
import { parseManifestUnverified, verifySelfHash, writeManifest } from './manifest.ts';
import { registryDrift } from './registry.ts';
import { duplicateNumbers, listTasks, manifestPath } from './resolve.ts';
import { loadViews, locate, type TaskView } from './view.ts';

/** Проверки уровня дерева, а не отдельной задачи. */
const TREE = 'дерево задач';

const LITE_TRACK = 'lite';
const MAX_LITE_ITEMS = 7;
/** Признаки, по которым lite-задача переросла свой трек (design.md §2, критерии треков). */
const FULL_MARKERS: Array<{ label: string; pattern: RegExp }> = [
  { label: 'packages/contracts', pattern: /packages\/contracts/i },
  { label: '.tsp', pattern: /\.tsp\b/i },
  { label: 'миграция', pattern: /миграци/i },
];

export interface CheckIssue {
  /** Задача (`<тип>/<директория>`) или `дерево задач` у общих проверок. */
  scope: string;
  message: string;
}

export interface CheckReport {
  tasks: number;
  errors: CheckIssue[];
  warnings: CheckIssue[];
}

function plural(count: number, one: string, few: string, many: string): string {
  const tail = count % 100;
  if (tail >= 11 && tail <= 14) return `${count} ${many}`;
  const last = count % 10;
  if (last === 1) return `${count} ${one}`;
  if (last >= 2 && last <= 4) return `${count} ${few}`;
  return `${count} ${many}`;
}

function scopeOf(target: TaskView): string {
  return `${target.location.type}/${target.location.dirName}`;
}

function pathExists(repo: string, value: string): boolean {
  return existsSync(isAbsolute(value) ? value : resolve(repo, value));
}

/** Порядок гейтов: согласованный гейт после чернового — след ручного вмешательства или отката. */
function gateOrderProblem(target: TaskView, config: TasksConfig): string | null {
  const track = trackOf(config, target.manifest.track);
  const statuses = track.gates.map((gate) => target.manifest.gates[gate.name]?.status ?? config.statuses.draft);
  const firstDraft = statuses.indexOf(config.statuses.draft);
  if (firstDraft < 0) return null;

  const late = track.gates
    .filter((gate, index) => index > firstDraft && statuses[index] === config.statuses.approved)
    .map((gate) => gate.name);
  if (late.length === 0) return null;

  return `нарушен порядок гейтов: "${late.join('", "')}" согласован при черновом "${track.gates[firstDraft]!.name}" (порядок трека ${target.manifest.track}: ${track.gates.map((gate) => gate.name).join(' → ')})`;
}

/** Документы согласованных гейтов: файл на месте и его содержимое совпадает с записанным sha256. */
function documentProblems(target: TaskView, config: TasksConfig): string[] {
  const { manifest, documents, location } = target;
  const track = trackOf(config, manifest.track);
  const problems: string[] = [];

  for (const gate of track.gates) {
    const state = manifest.gates[gate.name];
    if (state?.status !== config.statuses.approved) continue;

    const text = documents[gate.file];
    if (text == null) {
      problems.push(`гейт "${gate.name}" согласован, а документ ${gate.file} отсутствует`);
      continue;
    }
    if (state.sha256 === undefined) continue;

    let actual: string;
    try {
      actual = gateHash(text, gate, track);
    } catch (error) {
      problems.push(`гейт "${gate.name}": ${error instanceof Error ? error.message : String(error)}`);
      continue;
    }
    if (actual !== state.sha256) {
      problems.push(`гейт "${gate.name}": ${gate.file} изменён после согласования — верните содержимое или откатите гейт: scripts/task draft ${location.id} ${gate.name}`);
    }
  }
  return problems;
}

/**
 * Межзадачная инвалидация: upstream-задача согласовала что-то уже после того, как была
 * согласована постановка downstream — постановка могла устареть.
 */
function invalidationWarnings(target: TaskView, byId: Map<string, TaskView>, config: TasksConfig): string[] {
  const track = trackOf(config, target.manifest.track);
  const first = track.gates[0]!;
  const since = target.manifest.gates[first.name]?.approvedAt;
  if (since === undefined) return [];

  const warnings: string[] = [];
  for (const dep of target.manifest.depends ?? []) {
    const upstream = byId.get(dep);
    if (upstream === undefined) continue;
    const later = trackOf(config, upstream.manifest.track).gates
      .map((gate) => ({ name: gate.name, at: upstream.manifest.gates[gate.name]?.approvedAt }))
      .filter((gate): gate is { name: string; at: string } => gate.at !== undefined && gate.at > since);
    if (later.length === 0) continue;

    const last = later.reduce((latest, gate) => (gate.at >= latest.at ? gate : latest));
    warnings.push(`зависимость ${dep} согласовала гейт "${last.name}" ${last.at} — позже постановки этой задачи (${first.name}, ${since}); проверьте, не устарела ли постановка`);
  }
  return warnings;
}

/** Признаки того, что lite-задача переросла трек: объём чеклиста и темы из критериев full. */
function trackWarnings(target: TaskView, config: TasksConfig): string[] {
  if (target.manifest.track !== LITE_TRACK) return [];
  const track = trackOf(config, target.manifest.track);
  const signs: string[] = [];

  if (target.info.items.length > MAX_LITE_ITEMS) {
    signs.push(`${target.info.items.length} пунктов чеклиста (больше ${MAX_LITE_ITEMS})`);
  }
  const text = target.documents[track.items.file];
  if (text != null) {
    const found = FULL_MARKERS.filter((marker) => marker.pattern.test(text)).map((marker) => marker.label);
    if (found.length > 0) signs.push(`упоминается ${found.join(', ')}`);
  }
  if (signs.length === 0) return [];

  return [`lite-задача с признаками full: ${signs.join('; ')} — рассмотрите scripts/task promote ${target.location.id}`];
}

export function checkTree(ctx: CommandContext): CheckReport {
  const { config, root } = ctx;
  const repo = repoRoot(root);
  const locations = listTasks(root, config);
  const { views, broken } = loadViews(root, config);
  const errors: CheckIssue[] = [];
  const warnings: CheckIssue[] = [];

  for (const item of broken) {
    errors.push({ scope: `${item.location.type}/${item.location.dirName}`, message: item.message });
  }
  for (const duplicate of duplicateNumbers(locations)) {
    errors.push({ scope: TREE, message: `id ${duplicate.id} занят несколькими директориями: ${duplicate.dirs.join(', ')}` });
  }

  const knownIds = new Set(locations.map((location) => location.id));
  const byId = new Map(views.map((target) => [target.manifest.id, target]));

  for (const target of views) {
    const scope = scopeOf(target);
    const { manifest, location } = target;
    const add = (message: string) => errors.push({ scope, message });

    if (manifest.id !== location.id) {
      add(`id "${manifest.id}" не совпадает с путём — по директории это ${location.id}`);
    }
    if (!verifySelfHash(manifest, config)) {
      add(`meta.selfHash не сходится — task.yaml правили в обход CLI. После ревью примите состояние: scripts/task repair ${location.id}`);
    }

    const order = gateOrderProblem(target, config);
    if (order !== null) add(order);
    for (const problem of documentProblems(target, config)) add(problem);

    for (const dep of manifest.depends ?? []) {
      if (!knownIds.has(dep)) add(`depends: задача "${dep}" не найдена в дереве`);
    }
    for (const path of manifest.uispec ?? []) {
      if (!pathExists(repo, path)) add(`uispec: путь "${path}" не существует от корня репозитория`);
    }

    for (const message of [...invalidationWarnings(target, byId, config), ...trackWarnings(target, config)]) {
      warnings.push({ scope, message });
    }
  }

  // Свежесть реестра требуется только там, где есть что реестрировать: после init дерево пустое.
  if (locations.length > 0) {
    const drift = registryDrift(root, config);
    if (drift !== null) errors.push({ scope: TREE, message: drift });
  }

  return { tasks: locations.length, errors, warnings };
}

export function renderReport(report: CheckReport): string {
  const issues = [
    ...report.errors.map((issue) => ({ ...issue, prefix: 'ошибка' })),
    ...report.warnings.map((issue) => ({ ...issue, prefix: 'warning' })),
  ];
  const scopes = [...new Set(issues.map((issue) => issue.scope))];
  const blocks = scopes.flatMap((scope) => [
    scope,
    ...issues
      .filter((issue) => issue.scope === scope)
      .flatMap((issue) => issue.message.split('\n').map((line, index) => (index === 0 ? `  ${issue.prefix}: ${line}` : `    ${line.trim()}`))),
    '',
  ]);

  return [
    ...blocks,
    `check: ${plural(report.tasks, 'задача', 'задачи', 'задач')}, ${plural(report.errors.length, 'ошибка', 'ошибки', 'ошибок')}, ${plural(report.warnings.length, 'предупреждение', 'предупреждения', 'предупреждений')}`,
  ].join('\n');
}

export function checkCommand(ctx: CommandContext, args: string[]): CommandResult {
  if (parseFlags(args).positional.length > 0) {
    throw new CliError('употребление: scripts/task check');
  }
  const report = checkTree(ctx);
  return { text: renderReport(report), code: report.errors.length > 0 ? 1 : 0 };
}

/**
 * Аварийный люк: манифест перечитывается без сверки selfHash, проверяется по схеме и
 * переписывается инструментом. Осознанное принятие ручной правки — после ревью, не вместо него.
 */
export function repairCommand(ctx: CommandContext, args: string[]): string {
  const [ref] = expectPositional(parseFlags(args), 1, 'repair <id>');
  const location = locate(ctx.root, ref!, ctx.config);
  const file = manifestPath(location);

  let text: string;
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    throw new CliError(`${file}: манифест задачи не найден — принимать нечего`);
  }

  const manifest = parseManifestUnverified(text, ctx.config, file);
  if (manifest.id !== location.id) {
    throw new CliError(`id "${manifest.id}" не совпадает с путём (${location.id}) — сначала приведите их в соответствие`);
  }
  const written = writeManifest(file, manifest, ctx.config);

  return [
    `Состояние задачи ${written.id} принято, rev ${written.meta.rev}.`,
    '  task.yaml перезаписан канонически, selfHash пересчитан',
    '  остальные инварианты: scripts/task check',
  ].join('\n');
}
