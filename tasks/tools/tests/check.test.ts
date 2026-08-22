import assert from 'node:assert/strict';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';
import { checkCommand, checkTree, repairCommand } from '../lib/check.ts';
import { loadConfig } from '../lib/config.ts';
import { approveCommand } from '../lib/gates.ts';
import { MANIFEST_FILE } from '../lib/manifest.ts';
import { registryCommand } from '../lib/registry.ts';
import {
  cleanupTrees,
  context,
  createTree,
  manifestOf,
  RAW_FIXTURE_CONFIG,
  REPO_TASKS_ROOT,
  scaffold,
  taskFile,
  TODAY,
  type TaskFixture,
  type Tree,
} from './helpers.ts';

after(cleanupTrees);

const DRAFT = { status: 'черновик' };
/** Гейт без sha256 — согласование из миграции: checksum-дрифт на таких фикстурах не проверяется. */
const APPROVED = { status: 'согласовано', approvedAt: '2026-08-01' };
const DIR = 'back/001-api-skeleton';

const BRIEF = '# back/001 — REST-каркас\n\n## Контекст и проблема\n\nAPI нет.\n';
const PLAN = [
  '# План back/001',
  '',
  '## Декомпозиция',
  '',
  '| ID | Цель | Решение | Состояние |',
  '|---|---|---|---|',
  '| P01 | Роутов нет | Express | завершено |',
  '',
].join('\n');

const BASE: TaskFixture = {
  dir: DIR,
  manifest: { id: 'back/001', slug: 'api-skeleton', title: 'REST-каркас', track: 'full' },
  documents: { 'brief.md': BRIEF, 'adr.md': '# ADR\n', 'plan.md': PLAN, 'result.md': '# Итог\n' },
};

/** Дерево со свежим реестром: иначе каждая фикстура ловила бы ещё и дрейф REGISTRY.md. */
function tree(tasks: TaskFixture[] = [BASE], rawConfig: unknown = RAW_FIXTURE_CONFIG): Tree {
  const built = createTree(tasks, rawConfig);
  registryCommand(context(built), []);
  return built;
}

function withGates(gates: Record<string, { status: string; approvedAt?: string; sha256?: string }>, extra: Partial<TaskFixture['manifest']> = {}): TaskFixture {
  return { ...BASE, manifest: { ...BASE.manifest!, ...extra, gates } };
}

const errors = (built: Tree) => checkTree(context(built)).errors.map((issue) => issue.message);
const warnings = (built: Tree) => checkTree(context(built)).warnings.map((issue) => issue.message);
const matches = (list: string[], pattern: RegExp) => list.filter((message) => pattern.test(message));

/**
 * Ровно одна ошибка про саму задачу. Дрейф реестра отфильтрован: реестр собран из манифестов,
 * поэтому любая поломка задачи закономерно тянет за собой и его — на это есть отдельный тест.
 */
function assertOnly(built: Tree, pattern: RegExp): void {
  const found = errors(built).filter((message) => !message.startsWith('REGISTRY.md'));
  assert.equal(found.length, 1, `ожидалась ровно одна ошибка, получено:\n${found.join('\n')}`);
  assert.match(found[0]!, pattern);
}

describe('check — зелёное дерево', () => {
  it('корректная задача не даёт ни ошибок, ни предупреждений', () => {
    const report = checkTree(context(tree()));
    assert.deepEqual(report.errors, []);
    assert.deepEqual(report.warnings, []);
    assert.equal(report.tasks, 1);
  });

  it('пустое дерево валидно, и REGISTRY.md для него не требуется', () => {
    const built = createTree([]);
    const report = checkTree(context(built));
    assert.equal(report.tasks, 0);
    assert.deepEqual(report.errors, []);
    assert.ok(!existsSync(join(built.root, 'REGISTRY.md')), 'свежий init остаётся зелёным без реестра');
    assert.match(checkCommand(context(built), []).text, /check: 0 задач, 0 ошибок, 0 предупреждений/);
  });

  it('код возврата ненулевой только при ошибках', () => {
    assert.equal(checkCommand(context(tree()), []).code, 0);
    const broken = tree([withGates({ brief: DRAFT, adr: APPROVED, plan: DRAFT, result: DRAFT })]);
    assert.equal(checkCommand(context(broken), []).code, 1);
  });

  it('итоговая строка считает задачи, ошибки и предупреждения', () => {
    const built = tree([BASE, { dir: 'back/002-database', manifest: { id: 'back/002', slug: 'database', title: 'БД', track: 'lite' } }]);
    assert.match(checkCommand(context(built), []).text, /check: 2 задачи, 0 ошибок, 0 предупреждений/);
  });
});

describe('check — ошибки', () => {
  it('манифест не разбирается', () => {
    const built = tree();
    writeFileSync(taskFile(built, DIR, MANIFEST_FILE), 'id: [back/001\n', 'utf8');
    assertOnly(built, /не разбирается как YAML/);
  });

  it('манифест не проходит схему', () => {
    const built = tree();
    const file = taskFile(built, DIR, MANIFEST_FILE);
    writeFileSync(file, `${readFileSync(file, 'utf8')}priority: высокий\n`, 'utf8');
    assertOnly(built, /неизвестное поле "priority"/);
  });

  it('id не совпадает с путём', () => {
    const built = tree([{ ...BASE, manifest: { ...BASE.manifest!, id: 'back/002' } }]);
    assert.ok(matches(errors(built), /id "back\/002" не совпадает с путём — по директории это back\/001/).length === 1);
  });

  it('дубль номера внутри типа', () => {
    const built = tree([
      BASE,
      { dir: 'back/001-api-rewrite', manifest: { id: 'back/001', slug: 'api-rewrite', title: 'Дубль', track: 'lite' } },
    ]);
    assert.equal(matches(errors(built), /id back\/001 занят несколькими директориями: 001-api-rewrite, 001-api-skeleton/).length, 1);
  });

  it('selfHash не сходится после ручной правки', () => {
    const built = tree();
    const file = taskFile(built, DIR, MANIFEST_FILE);
    writeFileSync(file, readFileSync(file, 'utf8').replace('REST-каркас', 'REST-каркас (правка руками)'), 'utf8');
    assertOnly(built, /meta\.selfHash не сходится.*scripts\/task repair back\/001/s);
  });

  it('нарушен порядок статусов гейтов', () => {
    const built = tree([withGates({ brief: DRAFT, adr: APPROVED, plan: DRAFT, result: DRAFT })]);
    assertOnly(built, /нарушен порядок гейтов: "adr" согласован при черновом "brief" \(порядок трека full: brief → adr → plan → result\)/);
  });

  it('checksum-дрифт согласованного документа', () => {
    const built = tree();
    approveCommand(context(built), ['back/001', 'brief']);
    registryCommand(context(built), []);
    assert.deepEqual(errors(built), []);

    writeFileSync(taskFile(built, DIR, 'brief.md'), `${BRIEF}\nДописано после согласования.\n`, 'utf8');
    assertOnly(built, /гейт "brief": brief\.md изменён после согласования — верните содержимое или откатите гейт: scripts\/task draft back\/001 brief/);
  });

  it('перевод пункта плана дрейфом не считается', () => {
    const built = tree();
    for (const gate of ['brief', 'adr', 'plan']) approveCommand(context(built), ['back/001', gate]);
    registryCommand(context(built), []);

    writeFileSync(taskFile(built, DIR, 'plan.md'), PLAN.replace('завершено', 'выполняется'), 'utf8');
    registryCommand(context(built), []);
    assert.deepEqual(errors(built), []);
  });

  it('документа согласованного гейта нет', () => {
    const built = tree([withGates({ brief: APPROVED, adr: DRAFT, plan: DRAFT, result: DRAFT })]);
    rmSync(taskFile(built, DIR, 'brief.md'));
    assertOnly(built, /гейт "brief" согласован, а документ brief\.md отсутствует/);
  });

  it('depends указывает на несуществующую задачу', () => {
    const built = tree([{ ...BASE, manifest: { ...BASE.manifest!, depends: ['contract/009'] } }]);
    assertOnly(built, /depends: задача "contract\/009" не найдена в дереве/);
  });

  it('uispec-путь не существует от корня репозитория', () => {
    const built = tree([{ ...BASE, manifest: { ...BASE.manifest!, uispec: ['docs/ui-spec-kit/specs/ui/screens/нет.screen.md'] } }]);
    assertOnly(built, /uispec: путь "docs\/ui-spec-kit\/specs\/ui\/screens\/нет\.screen\.md" не существует/);
  });

  it('REGISTRY.md устарел или отсутствует', () => {
    const stale = tree();
    writeFileSync(join(stale.root, 'REGISTRY.md'), '# Реестр задач\n', 'utf8');
    assert.deepEqual(errors(stale).map((message) => message.split(':')[0]), ['REGISTRY.md устарел']);

    const missing = tree();
    rmSync(join(missing.root, 'REGISTRY.md'));
    assert.equal(matches(errors(missing), /^REGISTRY\.md отсутствует/).length, 1);
  });

  it('отчёт группирует замечания по задачам', () => {
    const built = tree([{ ...BASE, manifest: { ...BASE.manifest!, depends: ['contract/009'], uispec: ['нет.md'] } }]);
    const text = checkCommand(context(built), []).text;
    assert.match(text, /^back\/001-api-skeleton$/m);
    assert.match(text, /^ {2}ошибка: depends: задача "contract\/009" не найдена/m);
    assert.match(text, /check: 1 задача, 2 ошибки, 0 предупреждений/);
  });
});

describe('check — предупреждения', () => {
  const lite = (documents: Record<string, string>, extra: Partial<TaskFixture['manifest']> = {}): Tree =>
    tree([{
      dir: 'process/001-script-guard',
      manifest: { id: 'process/001', slug: 'script-guard', title: 'Guard', track: 'lite', ...extra },
      documents,
    }]);

  const checklist = (rows: number) => [
    '# process/001 — Guard',
    '',
    '## Чеклист',
    '',
    '| ID | Шаг | Состояние |',
    '|---|---|---|',
    ...Array.from({ length: rows }, (unused, index) => `| C${index + 1} | Шаг ${index + 1} | в плане |`),
    '',
  ].join('\n');

  it('чеклист длиннее семи пунктов — признак full', () => {
    const built = lite({ 'task.md': checklist(8) });
    assert.match(warnings(built)[0]!, /lite-задача с признаками full: 8 пунктов чеклиста \(больше 7\) — рассмотрите scripts\/task promote process\/001/);
    assert.deepEqual(errors(built), []);
  });

  it('семь пунктов — ещё lite', () => {
    assert.deepEqual(warnings(lite({ 'task.md': checklist(7) })), []);
  });

  it('темы контракта и миграций — признак full', () => {
    const built = lite({ 'task.md': `${checklist(2)}\nПравим packages/contracts/src/main.tsp и пишем Миграцию.\n` });
    assert.match(warnings(built)[0]!, /упоминается packages\/contracts, \.tsp, миграция/);
  });

  it('предупреждения не влияют на код возврата', () => {
    const result = checkCommand(context(lite({ 'task.md': checklist(9) })), []);
    assert.equal(result.code, 0);
    assert.match(result.text, /warning: lite-задача с признаками full/);
    assert.match(result.text, /check: 1 задача, 0 ошибок, 1 предупреждение/);
  });

  it('upstream согласовал гейт позже постановки downstream', () => {
    const built = tree([
      {
        dir: 'contract/001-guest-flow',
        manifest: {
          id: 'contract/001',
          slug: 'guest-flow',
          title: 'Контракт',
          track: 'full',
          gates: {
            brief: APPROVED,
            adr: { status: 'согласовано', approvedAt: '2026-08-20', sha256: 'b'.repeat(64) },
            plan: DRAFT,
            result: DRAFT,
          },
        },
        documents: { 'brief.md': BRIEF, 'adr.md': '# ADR\n' },
      },
      withGates({ brief: { status: 'согласовано', approvedAt: '2026-08-10', sha256: 'c'.repeat(64) }, adr: DRAFT, plan: DRAFT, result: DRAFT }, { depends: ['contract/001'] }),
    ]);

    assert.equal(matches(warnings(built), /зависимость contract\/001 согласовала гейт "adr" 2026-08-20 — позже постановки этой задачи \(brief, 2026-08-10\)/).length, 1);
  });

  it('согласование upstream до постановки downstream предупреждения не даёт', () => {
    const built = tree([
      {
        dir: 'contract/001-guest-flow',
        manifest: { id: 'contract/001', slug: 'guest-flow', title: 'Контракт', track: 'full', gates: { brief: APPROVED, adr: DRAFT, plan: DRAFT, result: DRAFT } },
        documents: { 'brief.md': BRIEF },
      },
      withGates({ brief: { status: 'согласовано', approvedAt: '2026-08-10', sha256: 'c'.repeat(64) }, adr: DRAFT, plan: DRAFT, result: DRAFT }, { depends: ['contract/001'] }),
    ]);
    assert.deepEqual(warnings(built), []);
  });
});

describe('repair', () => {
  it('принимает ручную правку: schema, канонический формат, rev + 1, свежий selfHash', () => {
    const built = tree();
    const file = taskFile(built, DIR, MANIFEST_FILE);
    const before = manifestOf(built, DIR).meta.rev;
    writeFileSync(file, readFileSync(file, 'utf8').replace('title: REST-каркас', 'title: REST-каркас и роуты'), 'utf8');
    assert.equal(matches(errors(built), /selfHash/).length, 1);

    const out = repairCommand(context(built), ['back/001']);
    assert.match(out, /Состояние задачи back\/001 принято, rev \d+/);
    const after = manifestOf(built, DIR);
    assert.equal(after.meta.rev, before + 1);
    assert.equal(after.title, 'REST-каркас и роуты');

    registryCommand(context(built), []);
    assert.deepEqual(errors(built), []);
  });

  it('правку, не проходящую схему, не принимает', () => {
    const built = tree();
    const file = taskFile(built, DIR, MANIFEST_FILE);
    writeFileSync(file, readFileSync(file, 'utf8').replace('track: full', 'track: express'), 'utf8');
    assert.throws(() => repairCommand(context(built), ['back/001']), /неизвестный трек "express"/);
    assert.match(readFileSync(file, 'utf8'), /track: express/, 'файл остался как был');
  });

  it('расхождение id и пути чинится руками, а не repair', () => {
    const built = tree();
    const file = taskFile(built, DIR, MANIFEST_FILE);
    writeFileSync(file, readFileSync(file, 'utf8').replace('id: back/001', 'id: back/002'), 'utf8');
    assert.throws(() => repairCommand(context(built), ['back/001']), /id "back\/002" не совпадает с путём \(back\/001\)/);
  });

  it('без манифеста принимать нечего', () => {
    const built = tree();
    rmSync(taskFile(built, DIR, MANIFEST_FILE));
    assert.throws(() => repairCommand(context(built), ['back/001']), /манифест задачи не найден/);
  });
});

describe('check — живое дерево', () => {
  it('прогон по реальному tasks/ не падает необработанным исключением', (t) => {
    const config = loadConfig(REPO_TASKS_ROOT);
    const typed = config.types.some((type) => existsSync(join(REPO_TASKS_ROOT, ...type.split('/'))));
    if (!typed) {
      t.skip('в живом дереве ещё нет директорий типов — миграция не выполнена');
      return;
    }
    // Зелёность не требуется: живое дерево может быть в любом состоянии, проверяется устойчивость.
    assert.doesNotThrow(() => checkTree({ root: REPO_TASKS_ROOT, config, today: TODAY }));
  });
});

describe('check — употребление', () => {
  it('лишний аргумент отсекается подсказкой', () => {
    assert.throws(() => checkCommand(context(tree()), ['back/001']), /употребление: scripts\/task check/);
  });

  it('repair требует ровно один id', () => {
    assert.throws(() => repairCommand(context(tree()), []), /Употребление: scripts\/task repair <id>/);
  });
});
