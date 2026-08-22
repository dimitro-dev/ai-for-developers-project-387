import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CliError, expectPositional, flagValue, parseFlags, type CommandContext } from './cli.ts';
import { CONFIG_FILE, loadConfig, type TasksConfig } from './config.ts';
import { MANIFEST_FILE, newManifest, writeManifest } from './manifest.ts';
import { listTasks, nextNumber, taskId } from './resolve.ts';
import { DEFAULT_CONFIG, renderTemplate, trackTemplates } from './templates.ts';

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function titleFromSlug(slug: string): string {
  const words = slug.split('-').join(' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function templateDirOf(root: string, config: TasksConfig, track: string): string {
  return join(root, config.templateDir, track);
}

/** Шаблоны трека с диска: канон — файлы владельца в `_template/<трек>/`, не константы в коде. */
export function readTrackTemplates(root: string, config: TasksConfig, track: string): Record<string, string> {
  const dir = templateDirOf(root, config, track);
  if (!existsSync(dir)) {
    throw new CliError(`шаблоны трека "${track}" не найдены в ${config.templateDir}/${track}/ — создайте их командой: scripts/task init`);
  }
  const templates: Record<string, string> = {};
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isFile()) templates[entry.name] = readFileSync(join(dir, entry.name), 'utf8');
  }
  if (Object.keys(templates).length === 0) {
    throw new CliError(`в ${config.templateDir}/${track}/ нет ни одного шаблона документа`);
  }
  return templates;
}

export function newCommand(ctx: CommandContext, args: string[]): string {
  const parsed = parseFlags(args, { boolean: ['lite', 'stub'], value: ['title'] });
  const [type, slug] = expectPositional(parsed, 2, 'new <тип> <слаг> [--lite] [--stub] [--title "…"]');

  if (!ctx.config.types.includes(type!)) {
    throw new CliError(`неизвестный тип задачи "${type}" (в конфиге: ${ctx.config.types.join(', ')})`);
  }
  if (!SLUG_RE.test(slug!)) {
    throw new CliError(`слаг "${slug}" не в kebab-case — ожидается ${SLUG_RE.source}`);
  }
  const track = parsed.flags.lite === true ? 'lite' : 'full';
  if (!(track in ctx.config.tracks)) {
    throw new CliError(`трек "${track}" не описан в конфиге (есть: ${Object.keys(ctx.config.tracks).join(', ')})`);
  }

  const stub = parsed.flags.stub === true;
  const number = nextNumber(listTasks(ctx.root, ctx.config), type!, ctx.config);
  const id = taskId(type!, number);
  const dirName = `${number}-${slug}`;
  const dir = join(ctx.root, ...type!.split('/'), dirName);
  if (existsSync(dir)) throw new CliError(`директория ${type}/${dirName} уже существует`);

  const title = flagValue(parsed, 'title') ?? titleFromSlug(slug!);
  const templates = stub ? {} : readTrackTemplates(ctx.root, ctx.config, track);

  mkdirSync(dir, { recursive: true });
  const written: string[] = [];
  for (const [name, text] of Object.entries(templates)) {
    writeFileSync(join(dir, name), renderTemplate(text, id, title), 'utf8');
    written.push(name);
  }
  writeManifest(join(dir, MANIFEST_FILE), newManifest({ id, slug: slug!, title, track }, ctx.config), ctx.config);

  const firstGate = ctx.config.tracks[track]!.gates[0]!;
  const flow = join(ctx.root, 'flows', `${track}.md`);
  const flowLine = existsSync(flow) ? `  правила трека: tasks/flows/${track}.md` : '';

  return [
    `Создан${stub ? ' стаб' : 'а задача'} ${id} — ${title} (трек ${track}).`,
    ...[MANIFEST_FILE, ...written.sort()].map((name) => `  tasks/${type}/${dirName}/${name}`),
    '',
    'Дальше:',
    ...(stub
      ? [
        '  1. стадия «заявлена»: документов нет, работа не начата',
        `  2. когда дойдёт очередь — создать документы трека из tasks/${ctx.config.templateDir}/${track}/`,
      ]
      : [
        `  1. заполнить ${firstGate.file}`,
        `  2. после явного «согласовано» владельца → scripts/task approve ${id} ${firstGate.name}`,
      ]),
    ...(flowLine ? [flowLine] : []),
  ].join('\n');
}

export function initCommand(root: string): string {
  const created: string[] = [];
  const existed: string[] = [];

  mkdirSync(root, { recursive: true });
  const configFile = join(root, CONFIG_FILE);
  if (existsSync(configFile)) {
    existed.push(CONFIG_FILE);
  } else {
    writeFileSync(configFile, `${JSON.stringify(DEFAULT_CONFIG, null, 2)}\n`, 'utf8');
    created.push(CONFIG_FILE);
  }

  const config = loadConfig(root);
  for (const track of Object.keys(config.tracks)) {
    const dir = templateDirOf(root, config, track);
    if (existsSync(dir)) {
      existed.push(`${config.templateDir}/${track}/`);
      continue;
    }
    mkdirSync(dir, { recursive: true });
    for (const [name, text] of Object.entries(trackTemplates(track, config))) {
      writeFileSync(join(dir, name), text, 'utf8');
      created.push(`${config.templateDir}/${track}/${name}`);
    }
  }

  return [
    created.length === 0 ? 'Создавать нечего — каталог задач уже размечен.' : `Создано (${created.length}):`,
    ...created.map((name) => `  ${name}`),
    ...(existed.length > 0 ? [`Уже было (${existed.length}):`, ...existed.map((name) => `  ${name}`)] : []),
    ...(created.includes(CONFIG_FILE) ? ['', `Проверьте ${CONFIG_FILE}: типы задач и треки правит владелец под свой проект.`] : []),
  ].join('\n');
}
