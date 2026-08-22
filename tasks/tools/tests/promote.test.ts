import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';
import { initCommand } from '../lib/create.ts';
import { promoteCommand } from '../lib/promote.ts';
import { parseItems, sectionLines } from '../lib/stage.ts';
import { statusCommand } from '../lib/status.ts';
import { cleanupTrees, context, createTree, manifestOf, type Tree } from './helpers.ts';

after(cleanupTrees);

const APPROVED = { status: 'согласовано', approvedAt: '2026-08-01', sha256: 'a'.repeat(64) };
const DRAFT = { status: 'черновик' };
const DIR = 'process/001-script-guard';

const TASK_MD = [
  '# process/001 — Guard в скрипте',
  '',
  '## Контекст и цель',
  '',
  'Скрипт падает на машинах без `docs/`.',
  'Цель — сделать запуск безусловным.',
  '',
  '## Решение',
  '',
  'Добавить guard `test ! -d tasks ||` в оба скрипта.',
  '',
  '## Чеклист',
  '',
  '| ID | Цель / проблема | Решение | Состояние |',
  '|---|---|---|---|',
  '| C1 | Скрипт падает | Guard в package.json | завершено |',
  '| C2 | Регресс не пойман | Тест на фикстуре | в плане |',
  '',
  '## Результат и проверки',
  '',
  'Прогнан `npm test` — зелёный.',
  '',
].join('\n');

function tree(gates: Record<string, { status: string; approvedAt?: string; sha256?: string }>, document = TASK_MD): Tree {
  const built = createTree([
    {
      dir: DIR,
      manifest: {
        id: 'process/001',
        slug: 'script-guard',
        title: 'Guard в скрипте',
        track: 'lite',
        depends: ['back/001'],
        workspace: { branch: 'fix/guard' },
        gates,
      },
      documents: { 'task.md': document },
    },
  ]);
  initCommand(built.root);
  return built;
}

const read = (built: Tree, name: string) => readFileSync(join(built.root, ...DIR.split('/'), name), 'utf8');
const section = (text: string, heading: string) => sectionLines(text.split('\n'), heading).join('\n').trim();

describe('promote — lite → full', () => {
  it('раскладывает секции task.md по четырём документам', () => {
    const built = tree({ setup: DRAFT, result: DRAFT });
    const out = promoteCommand(context(built), ['process/001']);

    assert.match(out, /Задача process\/001 переведена в трек full/);
    assert.match(out, /созданы: brief\.md, adr\.md, plan\.md, result\.md/);
    assert.match(out, /удалён: task\.md/);
    assert.ok(!existsSync(join(built.root, ...DIR.split('/'), 'task.md')));

    assert.equal(section(read(built, 'brief.md'), '## Контекст и проблема'), 'Скрипт падает на машинах без `docs/`.\nЦель — сделать запуск безусловным.');
    assert.equal(section(read(built, 'adr.md'), '## Решение'), 'Добавить guard `test ! -d tasks ||` в оба скрипта.');
    assert.equal(section(read(built, 'result.md'), '## Итог'), 'Прогнан `npm test` — зелёный.');
  });

  it('чеклист становится декомпозицией плана и продолжает читаться как пункты', () => {
    const built = tree({ setup: DRAFT, result: DRAFT });
    promoteCommand(context(built), ['process/001']);

    const plan = read(built, 'plan.md');
    const items = parseItems(plan, { states: built.config.itemStates });
    assert.deepEqual(items.map((item) => item.id), ['C1', 'C2']);
    assert.deepEqual(items.map((item) => item.state), ['завершено', 'в плане']);
    assert.match(plan, /Допустимые состояния:/);
    assert.match(plan, /^в плане$/m);
    assert.match(statusCommand(context(built), ['process/001']), /пункты: 1 из 2/);
  });

  it('остальные разделы скелета остаются пустыми заголовками', () => {
    const built = tree({ setup: DRAFT, result: DRAFT });
    promoteCommand(context(built), ['process/001']);

    const brief = read(built, 'brief.md');
    assert.match(brief, /^## Цель$/m);
    assert.equal(section(brief, '## Цель'), '');
    assert.equal(section(read(built, 'adr.md'), '## Контекст'), '');
    assert.equal(section(read(built, 'result.md'), '## Выполненные проверки'), '');
    assert.match(brief, /^# process\/001 — Guard в скрипте$/m);
  });

  it('манифест переключает трек и заводит гейты full в черновике, сохраняя данные задачи', () => {
    const built = tree({ setup: DRAFT, result: DRAFT });
    promoteCommand(context(built), ['process/001']);

    const manifest = manifestOf(built, DIR);
    assert.equal(manifest.track, 'full');
    assert.deepEqual(Object.keys(manifest.gates), ['brief', 'adr', 'plan', 'result']);
    assert.ok(Object.values(manifest.gates).every((gate) => gate.status === 'черновик'));
    assert.deepEqual(manifest.depends, ['back/001']);
    assert.deepEqual(manifest.workspace, { branch: 'fix/guard' });
    assert.equal(manifest.id, 'process/001');
  });

  it('согласованный setup требует пересогласования постановки', () => {
    const built = tree({ setup: APPROVED, result: DRAFT });
    const out = promoteCommand(context(built), ['process/001']);

    assert.match(out, /Предупреждение: постановка сменила форму — все гейты трека full заведены в черновике/);
    assert.ok(Object.values(manifestOf(built, DIR).gates).every((gate) => gate.status === 'черновик'));
  });

  it('без согласованного setup предупреждения нет', () => {
    assert.ok(!promoteCommand(context(tree({ setup: DRAFT, result: DRAFT })), ['process/001']).includes('постановка сменила форму'));
  });

  it('пропущенная секция не роняет перенос, а попадает в предупреждение', () => {
    const built = tree({ setup: DRAFT, result: DRAFT }, TASK_MD.replace('## Результат и проверки', '## Проверки'));
    const out = promoteCommand(context(built), ['process/001']);

    assert.match(out, /не найдены секции: ## Результат и проверки/);
    assert.equal(section(read(built, 'result.md'), '## Итог'), '');
  });
});

describe('promote — отказы', () => {
  it('full не эскалируется и не понижается', () => {
    const built = createTree([
      { dir: 'back/001-api-skeleton', manifest: { id: 'back/001', slug: 'api-skeleton', title: 'REST-каркас', track: 'full' } },
    ]);
    assert.throws(() => promoteCommand(context(built), ['back/001']), /переводит только lite → full, а у задачи back\/001 трек "full"/);
  });

  it('закрытая lite-задача не эскалируется', () => {
    const built = tree({ setup: APPROVED, result: APPROVED });
    assert.throws(() => promoteCommand(context(built), ['process/001']), /закрыта: гейт "result" согласован/);
    assert.ok(existsSync(join(built.root, ...DIR.split('/'), 'task.md')), 'документ задачи остался на месте');
  });

  it('без task.md раскладывать нечего', () => {
    const built = createTree([
      { dir: DIR, manifest: { id: 'process/001', slug: 'script-guard', title: 'Guard', track: 'lite' } },
    ]);
    initCommand(built.root);
    assert.throws(() => promoteCommand(context(built), ['process/001']), /документ "task\.md" задачи process\/001 не найден/);
  });

  it('без шаблонов трека full команда отсылает к init', () => {
    const built = createTree([
      {
        dir: DIR,
        manifest: { id: 'process/001', slug: 'script-guard', title: 'Guard', track: 'lite' },
        documents: { 'task.md': TASK_MD },
      },
    ]);
    assert.throws(() => promoteCommand(context(built), ['process/001']), /шаблоны трека "full" не найдены/);
    assert.ok(existsSync(join(built.root, ...DIR.split('/'), 'task.md')));
  });
});
