import assert from 'node:assert/strict';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';
import type { CommandResult } from '../lib/cli.ts';
import { buildRegistry, registryCommand, registryDrift, registryPath, renderRegistry } from '../lib/registry.ts';
import { cleanupTrees, context, createTree, FIXTURES_DIR, RAW_FIXTURE_CONFIG, scaffold, type TaskFixture, type Tree } from './helpers.ts';

after(cleanupTrees);

const APPROVED = { status: 'согласовано', approvedAt: '2026-08-01', sha256: 'a'.repeat(64) };
const DRAFT = { status: 'черновик' };
const PLAN = readFileSync(join(FIXTURES_DIR, 'docs', 'plan-full.md'), 'utf8');

/**
 * Очередь заведомо не совпадает с алфавитом id: `back/001` идёт после `front/ui/001`,
 * иначе топологический порядок было бы не отличить от сортировки по id.
 */
const TASKS: TaskFixture[] = [
  {
    dir: 'contract/001-guest-flow',
    manifest: {
      id: 'contract/001',
      slug: 'guest-flow',
      title: 'Контракт гостевого потока',
      track: 'full',
      legacyId: 'task-contract-001',
      gates: { brief: APPROVED, adr: APPROVED, plan: APPROVED, result: APPROVED },
    },
  },
  {
    dir: 'back/001-api-skeleton',
    manifest: {
      id: 'back/001',
      slug: 'api-skeleton',
      title: 'REST-каркас',
      track: 'full',
      legacyId: ['task-back-001', 'BACK-1'],
      depends: ['contract/001'],
      queue: { after: ['front/ui/001'], parallel: ['contract/001'], rationale: 'Вертикальный срез API' },
      gates: { brief: APPROVED, adr: APPROVED, plan: APPROVED, result: DRAFT },
    },
    documents: { 'plan.md': PLAN },
  },
  {
    dir: 'back/002-database',
    manifest: {
      id: 'back/002',
      slug: 'database',
      title: 'Хранилище | Postgres',
      track: 'lite',
      queue: { after: ['back/001'], rationale: 'После каркаса' },
    },
  },
  {
    dir: 'front/ui/001-guest-uispec',
    manifest: {
      id: 'front/ui/001',
      slug: 'guest-uispec',
      title: 'UISpec гостя',
      track: 'lite',
      queue: { rationale: 'Спеки нужны до экранов' },
    },
  },
];

const LEGACY_NOTES = [{ id: 'front-001', note: 'декомпозирована, содержимое распределено' }];

function tree(tasks: TaskFixture[] = TASKS, rawConfig: unknown = { ...RAW_FIXTURE_CONFIG, legacyNotes: LEGACY_NOTES }): Tree {
  const built = createTree(tasks, rawConfig);
  scaffold(built.root, 'archive/006/brief.md', '# Старая задача\n');
  scaffold(built.root, 'archive/000/brief.md', '# Самая старая задача\n');
  return built;
}

const text = (built: Tree) => renderRegistry(built.root, built.config);

/** Тело секции до следующего заголовка того же или более высокого уровня. */
const section = (built: Tree, heading: string) => {
  const lines = text(built).split('\n');
  const start = lines.indexOf(heading);
  assert.ok(start >= 0, `в реестре нет секции ${heading}`);
  const level = heading.indexOf(' ');
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => /^#+ /.test(line) && line.indexOf(' ') <= level);
  return (end < 0 ? rest : rest.slice(0, end)).join('\n');
};

const rowIds = (body: string) =>
  body.split('\n').filter((line) => line.startsWith('| [')).map((line) => line.split('|')[1]!.trim());

/** Тело секции очереди без вложенной подсекции истории. */
const queueBody = (built: Tree) => section(built, '## Очередь работ').split('### ')[0]!;

describe('registry — реестр по типам', () => {
  it('шапка объявляет файл генератом', () => {
    assert.match(text(tree()), /^# Реестр задач\n\nГенерируется `scripts\/task registry`; руками не правится\.\n/);
  });

  it('типы идут в порядке конфига, пустые пропускаются', () => {
    const headings = section(tree(), '## Реестр по типам').split('\n').filter((line) => line.startsWith('### '));
    assert.deepEqual(headings, ['### contract', '### back', '### front/ui']);
  });

  it('строка задачи: ссылка на директорию, заголовок, зависимости ссылками, стадия', () => {
    const rows = section(tree(), '## Реестр по типам');
    assert.match(rows, /\| \[back\/001\]\(back\/001-api-skeleton\/\) \| REST-каркас \| \[contract\/001\]\(contract\/001-guest-flow\/\) \| реализация \(3\/5\) \|/);
    assert.match(rows, /\| \[contract\/001\]\(contract\/001-guest-flow\/\) \| Контракт гостевого потока \| — \| завершена \|/);
  });

  it('разделитель колонок внутри заголовка экранируется', () => {
    assert.match(section(tree(), '## Реестр по типам'), /\| Хранилище \\\| Postgres \|/);
  });

  it('пустое дерево остаётся валидным документом', () => {
    const built = createTree([]);
    assert.match(renderRegistry(built.root, built.config), /## Реестр по типам\n\nЗадач нет\./);
    assert.match(renderRegistry(built.root, built.config), /## Очередь работ\n\nОчередь пуста\./);
  });
});

/** Тот же набор задач, но `back/001` доведена до конца — единственный завершённый участник очереди. */
const WITH_DONE: TaskFixture[] = TASKS.map((task) => (task.dir !== 'back/001-api-skeleton' ? task : {
  ...task,
  manifest: { ...task.manifest!, gates: { brief: APPROVED, adr: APPROVED, plan: APPROVED, result: APPROVED } },
}));

describe('registry — очередь работ', () => {
  it('порядок топологический по queue.after, а не по id', () => {
    assert.deepEqual(
      rowIds(queueBody(tree())),
      ['[front/ui/001](front/ui/001-guest-uispec/)', '[back/001](back/001-api-skeleton/)', '[back/002](back/002-database/)'],
    );
  });

  it('колонки: стадия, обоснование, параллельные задачи; задачи без queue в очередь не попадают', () => {
    const rows = section(tree(), '## Очередь работ');
    assert.match(rows, /\| id \| Стадия \| Обоснование \| Параллельно с \|/);
    assert.match(rows, /\| \[back\/001\]\(back\/001-api-skeleton\/\) \| реализация \(3\/5\) \| Вертикальный срез API \| \[contract\/001\]\(contract\/001-guest-flow\/\) \|/);
    assert.match(rows, /\| \[front\/ui\/001\]\(front\/ui\/001-guest-uispec\/\) \| заявлена \| Спеки нужны до экранов \| — \|/);
    assert.doesNotMatch(rows, /contract\/001-guest-flow\/\) \| завершена/, 'задача без блока queue в очереди не участвует');
  });

  it('завершённая задача уходит из очереди в «Историю выполнения»', () => {
    const built = tree(WITH_DONE);
    assert.deepEqual(
      rowIds(queueBody(built)),
      ['[front/ui/001](front/ui/001-guest-uispec/)', '[back/002](back/002-database/)'],
      'в очереди остаются только незавершённые, в прежнем порядке',
    );

    const history = section(built, '### История выполнения');
    assert.match(history, /\| id \| Стадия \| Обоснование \| Параллельно с \|/);
    assert.match(history, /\| \[back\/001\]\(back\/001-api-skeleton\/\) \| завершена \(3\/5\) \| Вертикальный срез API \| \[contract\/001\]\(contract\/001-guest-flow\/\) \|/);
  });

  it('без завершённых задач очереди подсекции истории нет', () => {
    assert.doesNotMatch(text(tree()), /### История выполнения/);
    assert.match(section(tree(), '## Очередь работ'), /Порядок — по `queue\.after`; завершённые — в «Истории выполнения»\./);
  });

  it('когда завершены все — очередь пуста, история хранит порядок', () => {
    const gates = { setup: APPROVED, result: APPROVED };
    const built = tree([
      { dir: 'back/001-a', manifest: { id: 'back/001', slug: 'a', title: 'A', track: 'lite', queue: { after: ['front/ui/001'] }, gates } },
      { dir: 'front/ui/001-b', manifest: { id: 'front/ui/001', slug: 'b', title: 'B', track: 'lite', queue: { rationale: 'Первой' }, gates } },
    ]);

    const queue = queueBody(built);
    assert.match(queue, /Очередь пуста\./);
    assert.deepEqual(rowIds(queue), [], 'таблицы незавершённых нет');
    assert.deepEqual(
      rowIds(section(built, '### История выполнения')),
      ['[front/ui/001](front/ui/001-b/)', '[back/001](back/001-a/)'],
    );
    assert.match(registryCommand(context(built), []) as string, /задач: 2, в очереди: 0/);
  });

  it('цикл в queue.after не роняет генерацию и не ломает детерминизм', () => {
    const cyclic: TaskFixture[] = [
      { dir: 'back/001-a', manifest: { id: 'back/001', slug: 'a', title: 'A', track: 'lite', queue: { after: ['back/002'] } } },
      { dir: 'back/002-b', manifest: { id: 'back/002', slug: 'b', title: 'B', track: 'lite', queue: { after: ['back/001'] } } },
    ];
    const built = tree(cyclic);
    const first = renderRegistry(built.root, built.config);
    assert.match(first, /\[back\/001\]/);
    assert.equal(renderRegistry(built.root, built.config), first);
  });
});

describe('registry — таблица legacy-id', () => {
  it('собирает legacyId манифестов, содержимое archive/ и legacyNotes конфига', () => {
    const rows = section(tree(), '## Таблица legacy-id');
    assert.match(rows, /\| task-contract-001 \| \[contract\/001\]\(contract\/001-guest-flow\/\) \|/);
    assert.match(rows, /\| task-back-001 \| \[back\/001\]\(back\/001-api-skeleton\/\) \|/);
    assert.match(rows, /\| BACK-1 \| \[back\/001\]\(back\/001-api-skeleton\/\) \|/, 'список legacyId разворачивается построчно');
    assert.match(rows, /\| 000 \| \[archive\/000\]\(archive\/000\/\) — дотиповая эпоха, как есть \|/);
    assert.match(rows, /\| 006 \| \[archive\/006\]\(archive\/006\/\) — дотиповая эпоха, как есть \|/);
    assert.match(rows, /\| front-001 \| — декомпозирована, содержимое распределено \|/);
  });

  it('без legacyId, archive/ и legacyNotes секция объявляет пустоту', () => {
    const built = createTree([
      { dir: 'back/001-api-skeleton', manifest: { id: 'back/001', slug: 'api-skeleton', title: 'REST-каркас', track: 'lite' } },
    ]);
    assert.match(renderRegistry(built.root, built.config), /## Таблица legacy-id\n\nЗаписей нет\./);
  });

  it('legacyNotes проверяется схемой конфига', () => {
    assert.throws(
      () => createTree([], { ...RAW_FIXTURE_CONFIG, legacyNotes: [{ id: 'front-001' }] }),
      /legacyNotes\[0\]\.note: ожидалась строка/,
    );
    assert.throws(
      () => createTree([], { ...RAW_FIXTURE_CONFIG, legacyNotes: [{ id: 'x', note: 'a', why: 'b' }] }),
      /legacyNotes\[0\]: неизвестный ключ "why"/,
    );
  });
});

describe('registry — детерминизм и --check', () => {
  it('две генерации по одному дереву дают байт-в-байт одинаковый файл', () => {
    const built = tree();
    registryCommand(context(built), []);
    const first = readFileSync(registryPath(built.root, built.config), 'utf8');
    registryCommand(context(built), []);
    assert.equal(readFileSync(registryPath(built.root, built.config), 'utf8'), first);
    assert.equal(renderRegistry(built.root, built.config), first, 'записанный файл совпадает со сгенерированным в память');
  });

  it('в тексте нет дат генерации и прочей нестабильности', () => {
    const built = tree();
    const generated = text(built);
    assert.doesNotMatch(generated.split('## Реестр по типам')[0]!, /\d{4}-\d{2}-\d{2}/);
    assert.equal(buildRegistry(built.root, built.config).tasks, 4);
  });

  it('registry сообщает, что перезаписывать нечего', () => {
    const built = tree();
    assert.match(registryCommand(context(built), []) as string, /перегенерирован/);
    const second = registryCommand(context(built), []) as string;
    assert.match(second, /актуален — перезаписывать нечего/);
    assert.match(second, /задач: 4, в очереди: 3, legacy-записей: 6/);
  });

  it('--check: актуальный реестр — нулевой код', () => {
    const built = tree();
    registryCommand(context(built), []);
    assert.equal(registryCommand(context(built), ['--check']), 'REGISTRY.md актуален.');
    assert.equal(registryDrift(built.root, built.config), null);
  });

  it('--check: устаревший реестр — сообщение и код 1', () => {
    const built = tree();
    registryCommand(context(built), []);
    writeFileSync(registryPath(built.root, built.config), '# Реестр задач\n', 'utf8');

    const result = registryCommand(context(built), ['--check']) as CommandResult;
    assert.equal(result.code, 1);
    assert.match(result.text, /REGISTRY\.md устарел/);
    assert.match(result.text, /scripts\/task registry/);
  });

  it('--check: отсутствующий реестр — сообщение и код 1', () => {
    const built = tree();
    registryCommand(context(built), []);
    rmSync(registryPath(built.root, built.config));

    const result = registryCommand(context(built), ['--check']) as CommandResult;
    assert.equal(result.code, 1);
    assert.match(result.text, /REGISTRY\.md отсутствует/);
  });

  it('лишний аргумент — ошибка употребления', () => {
    assert.throws(() => registryCommand(context(tree()), ['back/001']), /употребление: scripts\/task registry \[--check\]/);
  });
});
