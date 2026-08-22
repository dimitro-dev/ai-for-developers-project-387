import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CliError, expectPositional, parseFlags, type CommandContext } from './cli.ts';
import { trackOf } from './config.ts';
import { readTrackTemplates } from './create.ts';
import { writeManifest, type Gate, type TaskManifest } from './manifest.ts';
import { manifestPath } from './resolve.ts';
import { sectionRange } from './stage.ts';
import { renderTemplate } from './templates.ts';
import { view } from './view.ts';

const FROM_TRACK = 'lite';
const TO_TRACK = 'full';

/** Перенос секций lite → full: консервативно, целыми секциями, без разбора содержимого. */
const SECTION_MAP: Array<{ from: string; file: string; to: string }> = [
  { from: '## Контекст и цель', file: 'brief.md', to: '## Контекст и проблема' },
  { from: '## Решение', file: 'adr.md', to: '## Решение' },
  { from: '## Чеклист', file: 'plan.md', to: '## Декомпозиция' },
  { from: '## Результат и проверки', file: 'result.md', to: '## Итог' },
];

function sectionBody(lines: string[], heading: string): string | null {
  const range = sectionRange(lines, heading);
  return range ? lines.slice(range.start, range.end).join('\n').trim() : null;
}

/** Тело секции заменяется целиком; отсутствующий заголовок дописывается в конец документа. */
function replaceSection(text: string, heading: string, body: string): string {
  const lines = text.split('\n');
  const block = body === '' ? [''] : ['', ...body.split('\n'), ''];
  const range = sectionRange(lines, heading);
  if (!range) return [...lines, heading, ...block].join('\n');
  return [...lines.slice(0, range.start), ...block, ...lines.slice(range.end)].join('\n');
}

export function promoteCommand(ctx: CommandContext, args: string[]): string {
  const [ref] = expectPositional(parseFlags(args), 1, 'promote <id>');
  const { manifest, location } = view(ctx.root, ref!, ctx.config);
  const { draft, approved } = ctx.config.statuses;

  if (manifest.track !== FROM_TRACK) {
    throw new CliError(`promote переводит только ${FROM_TRACK} → ${TO_TRACK}, а у задачи ${manifest.id} трек "${manifest.track}"; обратного пути нет`);
  }
  if (!(TO_TRACK in ctx.config.tracks)) {
    throw new CliError(`трек "${TO_TRACK}" не описан в конфиге (есть: ${Object.keys(ctx.config.tracks).join(', ')})`);
  }

  const fromTrack = trackOf(ctx.config, FROM_TRACK);
  const toTrack = trackOf(ctx.config, TO_TRACK);
  const lastGate = fromTrack.gates[fromTrack.gates.length - 1]!;
  if (manifest.gates[lastGate.name]?.status === approved) {
    throw new CliError(`задача ${manifest.id} закрыта: гейт "${lastGate.name}" согласован — эскалировать трек нечего`);
  }

  const source = fromTrack.gates[0]!.file;
  const sourceFile = join(location.dir, source);
  let text: string;
  try {
    text = readFileSync(sourceFile, 'utf8');
  } catch {
    throw new CliError(`документ "${source}" задачи ${manifest.id} не найден — раскладывать по документам full нечего`);
  }

  const templates = readTrackTemplates(ctx.root, ctx.config, TO_TRACK);
  for (const gate of toTrack.gates) {
    if (!(gate.file in templates)) {
      throw new CliError(`в шаблонах трека ${TO_TRACK} нет документа "${gate.file}" гейта "${gate.name}"`);
    }
  }

  const lines = text.split(/\r?\n/);
  const itemsSection = fromTrack.items.section ?? '## Чеклист';
  const missing: string[] = [];
  const documents = new Map<string, string>();
  for (const gate of toTrack.gates) {
    documents.set(gate.file, renderTemplate(templates[gate.file]!, manifest.id, manifest.title));
  }

  for (const rule of SECTION_MAP) {
    const heading = rule.to === '## Декомпозиция' ? itemsSection : rule.from;
    const body = sectionBody(lines, heading);
    if (body === null) {
      missing.push(heading);
      continue;
    }
    const current = documents.get(rule.file);
    if (current === undefined) continue;
    const tail = rule.to === '## Декомпозиция'
      ? `${body}\n\nДопустимые состояния:\n\n\`\`\`text\n${ctx.config.itemStates.join('\n')}\n\`\`\``
      : body;
    documents.set(rule.file, replaceSection(current, rule.to, tail));
  }

  for (const [name, content] of documents) {
    writeFileSync(join(location.dir, name), content.endsWith('\n') ? content : `${content}\n`, 'utf8');
  }
  rmSync(sourceFile);

  const gates: Record<string, Gate> = {};
  for (const gate of toTrack.gates) gates[gate.name] = { status: draft };
  const next: TaskManifest = { ...manifest, track: TO_TRACK, gates };
  const written = writeManifest(manifestPath(location), next, ctx.config);

  const wasApproved = fromTrack.gates.some((gate) => manifest.gates[gate.name]?.status === approved);
  return [
    ...(wasApproved
      ? [`Предупреждение: постановка сменила форму — все гейты трека ${TO_TRACK} заведены в черновике, brief требует повторного согласования.`]
      : []),
    ...(missing.length > 0 ? [`Предупреждение: в ${source} не найдены секции: ${missing.join(', ')} — соответствующие разделы остались пустыми.`] : []),
    `Задача ${manifest.id} переведена в трек ${TO_TRACK} (rev ${written.meta.rev}).`,
    `  созданы: ${[...documents.keys()].join(', ')}`,
    `  удалён: ${source}`,
    `  гейты: ${toTrack.gates.map((gate) => gate.name).join(' → ')} — все в статусе "${draft}"`,
  ].join('\n');
}
