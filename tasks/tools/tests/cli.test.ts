import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';
import { cleanupTrees, tempRoot, TOOLS_DIR } from './helpers.ts';

after(cleanupTrees);

const ENTRY = join(TOOLS_DIR, 'task.ts');

function run(args: string[], root?: string) {
  const result = spawnSync(process.execPath, ['--experimental-strip-types', ENTRY, ...args], {
    encoding: 'utf8',
    env: root === undefined ? process.env : { ...process.env, TASKS_ROOT: root },
  });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

const task = (...args: string[]) => run(args);

describe('CLI-каркас', () => {
  it('--help печатает список команд и завершается нулём', () => {
    const help = task('--help');
    assert.equal(help.status, 0);
    for (const command of ['status', 'list', 'approve', 'draft', 'set', 'unset', 'new', 'init', 'promote', 'registry', 'check', 'repair', 'migrate']) {
      assert.match(help.stdout, new RegExp(`\\b${command}\\b`), `в справке нет команды ${command}`);
    }
  });

  it('без аргументов ведёт себя как --help', () => {
    assert.deepEqual(task().stdout, task('--help').stdout);
    assert.equal(task().status, 0);
  });

  it('неизвестная команда отсылает к справке', () => {
    const unknown = task('approvve');
    assert.equal(unknown.status, 1);
    assert.match(unknown.stderr, /Неизвестная команда «approvve»/);
    assert.match(unknown.stderr, /--help/);
  });

  it('перед выполнением команды конфиг проекта проверяется', () => {
    // Живой tasks.config.json валиден, поэтому команда доходит до вывода.
    const list = task('list');
    assert.equal(list.status, 0);
    assert.doesNotMatch(list.stderr, /конфиг не прошёл проверку/);
  });
});

describe('CLI — сквозной прогон на своём дереве', () => {
  it('init → new → status → approve → list работают из командной строки', () => {
    const root = tempRoot();

    const init = run(['init'], root);
    assert.equal(init.status, 0);
    assert.match(init.stdout, /tasks\.config\.json/);

    const created = run(['new', 'back', 'api-skeleton', '--title', 'REST-каркас'], root);
    assert.equal(created.status, 0);
    assert.match(created.stdout, /Создана задача back\/001 — REST-каркас/);

    const status = run(['status'], root);
    assert.equal(status.status, 0);
    assert.match(status.stdout, /стадия: постановка/);

    const approve = run(['approve', 'back/001', 'brief'], root);
    assert.equal(approve.status, 0);
    assert.match(approve.stdout, /Гейт «brief» задачи back\/001 согласован/);

    const list = run(['list', '--type', 'back'], root);
    assert.equal(list.status, 0);
    assert.match(list.stdout, /back\/001\s+full\s+проектирование \(0\/1\)\s+REST-каркас/);
  });

  it('registry и check сообщают расхождение кодом возврата', () => {
    const root = tempRoot();
    run(['init'], root);
    run(['new', 'back', 'api-skeleton', '--title', 'REST-каркас'], root);

    const registry = run(['registry'], root);
    assert.equal(registry.status, 0);
    assert.match(registry.stdout, /REGISTRY\.md перегенерирован/);

    const check = run(['check'], root);
    assert.equal(check.status, 0);
    assert.match(check.stdout, /check: 1 задача, 0 ошибок, 0 предупреждений/);

    writeFileSync(join(root, 'REGISTRY.md'), '# Реестр задач\n', 'utf8');
    assert.equal(run(['registry', '--check'], root).status, 1);
    const stale = run(['check'], root);
    assert.equal(stale.status, 1);
    assert.match(stale.stdout, /REGISTRY\.md устарел/);
  });

  it('migrate — разовая команда: без дотипового дерева отказывает до первого действия', () => {
    const root = tempRoot();
    run(['init'], root);

    const migrate = run(['migrate'], root);
    assert.equal(migrate.status, 1);
    assert.match(migrate.stderr, /пре-флайт не пройден, ничего не перенесено/);
    assert.match(migrate.stderr, /исходная директория task-000\/ отсутствует/);
  });

  it('ошибка употребления уходит в stderr с ненулевым кодом', () => {
    const root = tempRoot();
    run(['init'], root);

    const missing = run(['status', 'back/999'], root);
    assert.equal(missing.status, 1);
    assert.equal(missing.stdout, '');
    assert.match(missing.stderr, /задача "back\/999" не найдена/);

    const badGate = run(['approve', 'back/999', 'brief'], root);
    assert.equal(badGate.status, 1);
    assert.match(badGate.stderr, /не найдена/);
  });

  it('сломанный конфиг останавливает любую команду — включая init', () => {
    const root = tempRoot();
    run(['init'], root);
    writeFileSync(join(root, 'tasks.config.json'), '{"types": []}', 'utf8');

    const list = run(['list'], root);
    assert.equal(list.status, 1);
    assert.match(list.stderr, /конфиг не прошёл проверку/);

    const init = run(['init'], root);
    assert.equal(init.status, 1, 'init не чинит и не перезаписывает сломанный конфиг молча');
    assert.match(init.stderr, /конфиг не прошёл проверку/);
  });
});
