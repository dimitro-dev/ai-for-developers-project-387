import { resolve } from 'node:path';
import type { TasksConfig } from './config.ts';

/** Ошибка употребления команды: сообщение показывается пользователю без стека. */
export class CliError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CliError';
  }
}

export interface CommandContext {
  /** Корень дерева задач — директория `tasks/`. */
  root: string;
  config: TasksConfig;
  /** Сегодняшняя дата в формате YYYY-MM-DD; параметр контекста — ради детерминизма тестов. */
  today: string;
}

export function todayISO(date: Date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Корень репозитория: рабочий контекст (worktree, uispec) адресуется относительно него. */
export function repoRoot(tasksRoot: string): string {
  return resolve(tasksRoot, '..');
}

/** Результат команды с кодом возврата: проверочные команды сообщают о расхождении ненулевым кодом. */
export interface CommandResult {
  text: string;
  code: number;
}

export interface FlagSpec {
  /** Флаги без значения: `--lite`. */
  boolean?: string[];
  /** Флаги со значением: `--title "…"` или `--title=…`. */
  value?: string[];
}

export interface ParsedArgs {
  positional: string[];
  flags: Record<string, string | true>;
}

export function parseFlags(args: string[], spec: FlagSpec = {}): ParsedArgs {
  const booleans = spec.boolean ?? [];
  const values = spec.value ?? [];
  const known = [...booleans, ...values];
  const positional: string[] = [];
  const flags: Record<string, string | true> = {};

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i]!;
    if (!arg.startsWith('--')) {
      positional.push(arg);
      continue;
    }
    const eq = arg.indexOf('=');
    const name = (eq < 0 ? arg.slice(2) : arg.slice(2, eq)).trim();
    if (!known.includes(name)) {
      throw new CliError(`неизвестный флаг "--${name}"${known.length > 0 ? ` (допустимы: ${known.map((f) => `--${f}`).join(', ')})` : ''}`);
    }
    if (booleans.includes(name)) {
      if (eq >= 0) throw new CliError(`флаг "--${name}" не принимает значение`);
      flags[name] = true;
      continue;
    }
    const inline = eq < 0 ? undefined : arg.slice(eq + 1);
    const next = inline ?? args[i + 1];
    if (next === undefined || (inline === undefined && next.startsWith('--'))) {
      throw new CliError(`флаг "--${name}" требует значение`);
    }
    if (inline === undefined) i += 1;
    flags[name] = next;
  }

  return { positional, flags };
}

/** Значение флага со значением — всегда строка (parseFlags не пускает сюда `true`). */
export function flagValue(parsed: ParsedArgs, name: string): string | undefined {
  const value = parsed.flags[name];
  return typeof value === 'string' ? value : undefined;
}

/** Ровно `count` позиционных аргументов, иначе — подсказка по употреблению. */
export function expectPositional(parsed: ParsedArgs, count: number, usage: string): string[] {
  if (parsed.positional.length !== count) {
    throw new CliError(`ожидалось аргументов: ${count}, получено ${parsed.positional.length}. Употребление: scripts/task ${usage}`);
  }
  return parsed.positional;
}

/** Колонки, выровненные пробелами: плоский вывод читают и человек, и агент. */
export function columns(rows: string[][], gap = 2): string[] {
  const widths: number[] = [];
  for (const row of rows) {
    row.forEach((cell, index) => {
      widths[index] = Math.max(widths[index] ?? 0, cell.length);
    });
  }
  return rows.map((row) =>
    row
      .map((cell, index) => (index === row.length - 1 ? cell : cell.padEnd(widths[index] ?? 0)))
      .join(' '.repeat(gap))
      .trimEnd(),
  );
}
