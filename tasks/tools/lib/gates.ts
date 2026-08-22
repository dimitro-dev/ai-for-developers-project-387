import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CliError, expectPositional, parseFlags, type CommandContext } from './cli.ts';
import { trackOf, type GateSpec, type TasksConfig, type TrackSpec } from './config.ts';
import { writeManifest, type Gate, type TaskManifest } from './manifest.ts';
import { manifestPath } from './resolve.ts';
import { computeStage, findItemRows, splitRow, type StageInfo } from './stage.ts';
import { readDocuments, view, type TaskView } from './view.ts';

export function gateSpec(track: TrackSpec, name: string): GateSpec {
  const spec = track.gates.find((gate) => gate.name === name);
  if (!spec) {
    throw new CliError(`неизвестный гейт "${name}" (у трека описаны: ${track.gates.map((gate) => gate.name).join(', ')})`);
  }
  return spec;
}

/**
 * Строки пунктов с очищенной колонкой «Состояние». Строка пересобирается канонически:
 * перевод пункта и изменение ширины колонок таблицы пунктов не считаются правкой документа.
 */
function blankStateColumn(text: string, section?: string): string {
  const lines = text.split(/\r?\n/);
  for (const index of findItemRows(lines, section)) {
    const cells = splitRow(lines[index]!);
    const head = cells.slice(0, -1).map((cell) => cell.replace(/\|/g, '\\|'));
    lines[index] = `| ${head.join(' | ')} | |`;
  }
  return lines.join('\n');
}

/** Часть документа строго до строки-маркера; сам маркер и всё ниже — вне согласования. */
function untilMarker(text: string, marker: string, file: string): string {
  const lines = text.split(/\r?\n/);
  const index = lines.findIndex((line) => line.trim() === marker.trim());
  if (index < 0) {
    throw new CliError(`${file}: не найдена строка-маркер "${marker}" — по ней проходит граница согласуемой части документа`);
  }
  return lines.slice(0, index).join('\n');
}

/** Согласуемая часть документа по hash-стратегии гейта. */
export function gateDocumentText(text: string, gate: GateSpec, track: TrackSpec): string {
  if (gate.hash === undefined) return text;
  if (gate.hash === 'ignore-state-column') {
    const section = track.items.file === gate.file ? track.items.section : undefined;
    return blankStateColumn(text, section);
  }
  if (gate.hash.startsWith('until:')) return untilMarker(text, gate.hash.slice('until:'.length), gate.file);
  throw new CliError(`неизвестная hash-стратегия "${gate.hash}" у гейта "${gate.name}"`);
}

export function gateHash(text: string, gate: GateSpec, track: TrackSpec): string {
  return createHash('sha256').update(gateDocumentText(text, gate, track), 'utf8').digest('hex');
}

/** Текст документа гейта; отсутствие файла — ошибка употребления, а не исключение fs. */
export function readGateDocument(dir: string, gate: GateSpec): string {
  try {
    return readFileSync(join(dir, gate.file), 'utf8');
  } catch {
    throw new CliError(`документ "${gate.file}" гейта "${gate.name}" не найден в ${dir}`);
  }
}

function stageLine(manifest: TaskManifest, dir: string, config: TasksConfig): string {
  const info: StageInfo = computeStage(manifest, readDocuments(dir, manifest.track, config), config);
  const progress = info.progress ? ` — ${info.progress.done} из ${info.progress.total} пунктов` : '';
  const active = info.activeGate ? `, активный гейт: ${info.activeGate}` : '';
  return `  стадия: ${info.stage}${progress}${active}`;
}

export function approveCommand(ctx: CommandContext, args: string[]): string {
  const [ref, name] = expectPositional(parseFlags(args), 2, 'approve <id> <гейт>');
  const target: TaskView = view(ctx.root, ref!, ctx.config);
  const { manifest, location } = target;
  const track = trackOf(ctx.config, manifest.track);
  const spec = gateSpec(track, name!);
  const { draft, approved } = ctx.config.statuses;

  if (manifest.gates[spec.name]?.status === approved) {
    throw new CliError(`гейт "${spec.name}" задачи ${manifest.id} уже в статусе "${approved}" — откатить можно командой draft`);
  }
  const index = track.gates.findIndex((gate) => gate.name === spec.name);
  const blocking = track.gates.slice(0, index).find((gate) => manifest.gates[gate.name]?.status !== approved);
  if (blocking) {
    throw new CliError(
      `гейт "${spec.name}" нельзя согласовать: предыдущий гейт "${blocking.name}" в статусе "${draft}". Порядок трека ${manifest.track}: ${track.gates.map((gate) => gate.name).join(' → ')}`,
    );
  }

  const text = readGateDocument(location.dir, spec);
  const sha256 = gateHash(text, spec, track);
  const next: TaskManifest = {
    ...manifest,
    gates: { ...manifest.gates, [spec.name]: { status: approved, approvedAt: ctx.today, sha256 } },
  };

  const lines: string[] = [];
  const last = track.gates[track.gates.length - 1]!.name === spec.name;
  const { branch, worktree, mr } = manifest.workspace ?? {};
  const leftovers = last && (branch !== undefined || worktree !== undefined);
  if (last) {
    if (leftovers) {
      lines.push(
        'Предупреждение: рабочий контекст не убран по протоколу —',
        ...(branch === undefined ? [] : [`  ветка ${branch} не удалена`]),
        ...(worktree === undefined ? [] : [`  worktree ${worktree} не удалён`]),
      );
    }
    if (mr === undefined) delete next.workspace;
    else next.workspace = { mr };
  }

  const written = writeManifest(manifestPath(location), next, ctx.config);
  const strategy = spec.hash === undefined ? 'весь файл' : spec.hash;
  return [
    ...lines,
    `Гейт «${spec.name}» задачи ${manifest.id} согласован (${ctx.today}).`,
    `  документ: ${spec.file} — sha256 ${sha256.slice(0, 12)}…, стратегия хэширования: ${strategy}`,
    ...(leftovers ? [`  блок workspace вычищен${mr === undefined ? '' : ' (mr сохранён как история)'}`] : []),
    stageLine(written, location.dir, ctx.config),
  ].join('\n');
}

export function draftCommand(ctx: CommandContext, args: string[]): string {
  const [ref, name] = expectPositional(parseFlags(args), 2, 'draft <id> <гейт>');
  const target = view(ctx.root, ref!, ctx.config);
  const { manifest, location } = target;
  const track = trackOf(ctx.config, manifest.track);
  const spec = gateSpec(track, name!);
  const { draft } = ctx.config.statuses;

  const index = track.gates.findIndex((gate) => gate.name === spec.name);
  const cascade = track.gates.slice(index).map((gate) => gate.name);
  const reset = cascade.filter((gate) => manifest.gates[gate]?.status !== draft);
  if (reset.length === 0) {
    throw new CliError(`гейт "${spec.name}" задачи ${manifest.id} и последующие уже в статусе "${draft}" — сбрасывать нечего`);
  }

  const gates: Record<string, Gate> = { ...manifest.gates };
  for (const gate of reset) gates[gate] = { status: draft };
  const written = writeManifest(manifestPath(location), { ...manifest, gates }, ctx.config);

  const also = reset.filter((gate) => gate !== spec.name);
  return [
    `Гейт «${spec.name}» задачи ${manifest.id} возвращён в черновик.`,
    ...(also.length > 0 ? [`  каскадом сброшены: ${also.join(', ')} (даты и checksum стёрты)`] : []),
    stageLine(written, location.dir, ctx.config),
  ].join('\n');
}
