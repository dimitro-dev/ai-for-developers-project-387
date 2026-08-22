import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkCommand, repairCommand } from './lib/check.ts';
import { CliError, todayISO, type CommandContext, type CommandResult } from './lib/cli.ts';
import { ConfigError, loadConfig } from './lib/config.ts';
import { initCommand, newCommand } from './lib/create.ts';
import { approveCommand, draftCommand } from './lib/gates.ts';
import { setCommand, unsetCommand } from './lib/fields.ts';
import { ManifestError } from './lib/manifest.ts';
import { migrateCommand } from './lib/migrate.ts';
import { promoteCommand } from './lib/promote.ts';
import { registryCommand } from './lib/registry.ts';
import { ResolveError } from './lib/resolve.ts';
import { listCommand, statusCommand } from './lib/status.ts';

/** Корень дерева задач; TASKS_ROOT подменяет его в тестах и при работе с чужим деревом. */
export const TASKS_ROOT = process.env.TASKS_ROOT
  ? resolve(process.env.TASKS_ROOT)
  : resolve(dirname(fileURLToPath(import.meta.url)), '..');

type Handler = (ctx: CommandContext, args: string[]) => string | CommandResult;

interface CommandSpec {
  name: string;
  usage: string;
  summary: string;
  handler?: Handler;
  /** Пункт плана task-process-001, который команду реализует (у нереализованных). */
  plan?: string;
}

const COMMANDS: CommandSpec[] = [
  { name: 'status', usage: 'status [id]', summary: 'стадия, активный гейт, прогресс, зависимости', handler: statusCommand },
  { name: 'list', usage: 'list [--type <тип>]', summary: 'сводка задач', handler: listCommand },
  { name: 'approve', usage: 'approve <id> <гейт>', summary: 'согласовать гейт (статус, дата, checksum)', handler: approveCommand },
  { name: 'draft', usage: 'draft <id> <гейт>', summary: 'вернуть гейт в черновик с каскадом', handler: draftCommand },
  { name: 'set', usage: 'set <id> <путь> <значение>', summary: 'изменить поле манифеста', handler: setCommand },
  { name: 'unset', usage: 'unset <id> <путь>', summary: 'удалить поле манифеста', handler: unsetCommand },
  { name: 'new', usage: 'new <тип> <слаг> [--lite] [--stub]', summary: 'завести задачу или стаб', handler: newCommand },
  { name: 'init', usage: 'init', summary: 'конфиг и скелеты шаблонов для нового проекта' },
  { name: 'promote', usage: 'promote <id>', summary: 'эскалировать трек lite → full', handler: promoteCommand },
  { name: 'registry', usage: 'registry [--check]', summary: 'сгенерировать REGISTRY.md', handler: registryCommand },
  { name: 'check', usage: 'check', summary: 'инварианты всего дерева задач', handler: checkCommand },
  { name: 'repair', usage: 'repair <id>', summary: 'пересчитать selfHash после ручного ревью', handler: repairCommand },
  { name: 'migrate', usage: 'migrate', summary: 'разовый перенос дотиповых задач', handler: migrateCommand },
];

function help(): string {
  const width = Math.max(...COMMANDS.map((command) => command.usage.length));
  const lines = COMMANDS.map((command) => `  ${command.usage.padEnd(width)}  ${command.summary}`);
  return [
    'Использование: scripts/task <команда> [аргументы]',
    '',
    'Команды:',
    ...lines,
    '',
    `Корень задач: ${TASKS_ROOT}`,
  ].join('\n');
}

/** Ошибки употребления печатаются сообщением; остальное — баг инструмента и летит со стеком. */
function isUserError(error: unknown): error is Error {
  return error instanceof CliError
    || error instanceof ConfigError
    || error instanceof ManifestError
    || error instanceof ResolveError;
}

function print(text: string): void {
  if (text.trim() !== '') console.log(text);
}

export function run(argv: string[]): number {
  const command = argv[0];

  if (command === undefined || command === 'help' || command === '--help' || command === '-h') {
    console.log(help());
    return 0;
  }

  const spec = COMMANDS.find((candidate) => candidate.name === command);
  if (!spec) {
    console.error(`Неизвестная команда «${command}». Список команд: scripts/task --help`);
    return 1;
  }

  try {
    // init заводит сам конфиг, поэтому выполняется до его загрузки.
    if (spec.name === 'init') {
      print(initCommand(TASKS_ROOT));
      return 0;
    }
    const ctx: CommandContext = { root: TASKS_ROOT, config: loadConfig(TASKS_ROOT), today: todayISO() };
    if (!spec.handler) {
      console.error(`Команда «${spec.usage}» ещё не реализована (${spec.plan}).`);
      return 1;
    }
    const result = spec.handler(ctx, argv.slice(1));
    if (typeof result === 'string') {
      print(result);
      return 0;
    }
    print(result.text);
    return result.code;
  } catch (error) {
    if (!isUserError(error)) throw error;
    console.error(error.message);
    return 1;
  }
}

process.exitCode = run(process.argv.slice(2));
