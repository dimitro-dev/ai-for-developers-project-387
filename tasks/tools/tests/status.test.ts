import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';
import { CliError } from '../lib/cli.ts';
import { MANIFEST_FILE, readManifest, writeManifest } from '../lib/manifest.ts';
import { ResolveError } from '../lib/resolve.ts';
import { listCommand, statusCommand } from '../lib/status.ts';
import { cleanupTrees, context, createTree, type TaskFixture, type Tree } from './helpers.ts';

after(cleanupTrees);

const APPROVED = { status: 'согласовано', approvedAt: '2026-08-01', sha256: 'a'.repeat(64) };
const DRAFT = { status: 'черновик' };

const PLAN_HALF = [
  '# План',
  '',
  '## Декомпозиция',
  '',
  '| ID | Цель / проблема | Решение | Состояние |',
  '|---|---|---|---|',
  '| P01 | раз | раз | завершено |',
  '| P02 | два | два | выполняется |',
  '| P03 | три | три | в плане |',
  '',
].join('\n');

const PLAN_DONE = PLAN_HALF.replace('выполняется', 'завершено').replace('в плане', 'завершено');

const TASKS: TaskFixture[] = [
  {
    dir: 'back/001-api-skeleton',
    manifest: {
      id: 'back/001',
      slug: 'api-skeleton',
      title: 'REST-каркас',
      track: 'full',
      legacyId: 'back-001',
      gates: { brief: APPROVED, adr: APPROVED, plan: APPROVED, result: APPROVED },
    },
    documents: { 'brief.md': '# brief', 'adr.md': '# adr', 'plan.md': PLAN_DONE, 'result.md': '# result' },
  },
  {
    dir: 'front/ui/001-guest-uispec',
    manifest: {
      id: 'front/ui/001',
      slug: 'guest-uispec',
      title: 'UISpec гостя',
      track: 'full',
      gates: { brief: APPROVED, adr: DRAFT, plan: DRAFT, result: DRAFT },
    },
    documents: { 'brief.md': '# brief' },
  },
  {
    dir: 'front/guest/002-guest-screens',
    manifest: {
      id: 'front/guest/002',
      slug: 'guest-screens',
      title: 'Экраны гостя',
      track: 'full',
      legacyId: 'front-guest-002',
      depends: ['back/001', 'front/ui/001', 'back/009'],
      queue: { after: ['back/001'], parallel: ['front/ui/001'], rationale: 'Вертикальная задача' },
      gates: { brief: APPROVED, adr: APPROVED, plan: APPROVED, result: DRAFT },
    },
    documents: { 'brief.md': '# brief', 'adr.md': '# adr', 'plan.md': PLAN_HALF },
  },
  {
    dir: 'process/001-tasks-rework',
    manifest: { id: 'process/001', slug: 'tasks-rework', title: 'Переработка процесса', track: 'lite' },
  },
];

/** Рабочий контекст с живыми путями известен только после создания дерева. */
function tree(): Tree {
  const built = createTree(TASKS);
  const file = join(built.root, 'front', 'guest', '002-guest-screens', MANIFEST_FILE);
  const manifest = readManifest(file, built.config);
  writeManifest(
    file,
    {
      ...manifest,
      workspace: { branch: 'feat/front-guest-002', worktree: built.root, mr: 'https://example.test/pull/7' },
      uispec: [join(built.root, 'tasks.config.json'), 'docs/ui-spec-kit/specs/ui/screens/guest-catalog.screen.md'],
    },
    built.config,
  );
  return built;
}

describe('status — детальный вывод задачи', () => {
  it('печатает заголовок, стадию, гейты и прогресс', () => {
    const built = tree();
    const out = statusCommand(context(built), ['front/guest/002']);

    assert.match(out, /^front\/guest\/002 — Экраны гостя$/m);
    assert.match(out, /директория: front\/guest\/002-guest-screens/);
    assert.match(out, /трек: full/);
    assert.match(out, /legacyId: front-guest-002/);
    assert.match(out, /стадия: реализация/);
    assert.match(out, /активный гейт: result \(result\.md\)/);
    assert.match(out, /пункты: 1 из 3/);
    assert.match(out, /^ {2}brief\s+согласовано\s+2026-08-01$/m);
    assert.match(out, /^ {2}result\s+черновик\s+← активный$/m);
  });

  it('показывает стадию каждой зависимости и отсутствующие задачи', () => {
    const out = statusCommand(context(tree()), ['front/guest/002']);
    assert.match(out, /^ {2}back\/001\s+завершена$/m);
    assert.match(out, /^ {2}front\/ui\/001\s+проектирование$/m);
    assert.match(out, /^ {2}back\/009\s+\(задача не найдена\)$/m);
  });

  it('печатает очередь работ как её задал владелец', () => {
    const out = statusCommand(context(tree()), ['front/guest/002']);
    assert.match(out, /после: back\/001/);
    assert.match(out, /параллельно: front\/ui\/001/);
    assert.match(out, /обоснование: Вертикальная задача/);
  });

  it('проверяет рабочий контекст живьём: существующее и отсутствующее помечены', () => {
    const built = tree();
    const out = statusCommand(context(built), ['front/guest/002']);

    assert.match(out, new RegExp(`worktree: ${built.root.replace(/[/\\]/g, '\\$&')} \\(есть\\)`));
    assert.match(out, /uispec: .*tasks\.config\.json \(есть\)/);
    assert.match(out, /uispec: docs\/ui-spec-kit\/specs\/ui\/screens\/guest-catalog\.screen\.md \(отсутствует\)/);
    assert.match(out, /mr: https:\/\/example\.test\/pull\/7/);
  });

  it('без git-репозитория строка ветки деградирует, а не роняет вывод', () => {
    // Фикстура лежит во временной директории вне репозитория — git не может ответить про ветку.
    const out = statusCommand(context(tree()), ['front/guest/002']);
    assert.match(out, /ветка: feat\/front-guest-002 \((git недоступен|отсутствует|есть)\)/);
  });

  it('блоки без данных не печатаются', () => {
    const out = statusCommand(context(tree()), ['process/001']);
    assert.match(out, /стадия: заявлена/);
    assert.match(out, /пункты: —/);
    assert.ok(!out.includes('Зависимости:'));
    assert.ok(!out.includes('Очередь:'));
    assert.ok(!out.includes('Рабочий контекст:'));
  });

  it('резолвит задачу по legacyId и по пути со слагом', () => {
    const built = tree();
    const byLegacy = statusCommand(context(built), ['front-guest-002']);
    const byPath = statusCommand(context(built), ['front/guest/002-guest-screens']);
    assert.equal(byLegacy, byPath);
    assert.throws(() => statusCommand(context(built), ['back/042']), ResolveError);
  });
});

describe('status — без id', () => {
  it('перечисляет незавершённые задачи со стадией и активным гейтом', () => {
    const out = statusCommand(context(tree()), []);
    assert.match(out, /^Незавершённые задачи: 3$/m);
    assert.match(out, /front\/ui\/001\s+проектирование\s+гейт: adr\s+UISpec гостя/);
    assert.match(out, /front\/guest\/002\s+реализация \(1\/3\)\s+гейт: result/);
    assert.match(out, /process\/001\s+заявлена\s+гейт: setup/);
    assert.ok(!out.includes('back/001'), 'завершённая задача в списке незавершённых не нужна');
    assert.match(out, /Подробно: scripts\/task status <id>/);
  });

  it('единственную незавершённую задачу показывает сразу детально', () => {
    const built = createTree([TASKS[0]!, TASKS[1]!]);
    const out = statusCommand(context(built), []);
    assert.match(out, /^front\/ui\/001 — UISpec гостя$/m);
    assert.match(out, /Гейты:/);
  });

  it('дерево без незавершённых и дерево без задач говорят об этом прямо', () => {
    assert.match(statusCommand(context(createTree([TASKS[0]!])), []), /Незавершённых задач нет/);
    assert.match(statusCommand(context(createTree([])), []), /Задач нет/);
  });

  it('лишний аргумент — ошибка употребления', () => {
    assert.throws(() => statusCommand(context(tree()), ['back/001', 'brief']), CliError);
  });
});

describe('list — сводка', () => {
  it('печатает таблицу всех задач', () => {
    const out = listCommand(context(tree()), []);
    assert.match(out, /^id\s+трек\s+стадия\s+заголовок$/m);
    assert.match(out, /^back\/001\s+full\s+завершена \(3\/3\)\s+REST-каркас$/m);
    assert.match(out, /^front\/guest\/002\s+full\s+реализация \(1\/3\)\s+Экраны гостя$/m);
    assert.match(out, /^process\/001\s+lite\s+заявлена\s+Переработка процесса$/m);
    assert.match(out, /^Всего: 4$/m);
  });

  it('фильтр по типу принимает и точный тип, и родителя вложенных', () => {
    const built = tree();
    const nested = listCommand(context(built), ['--type', 'front/guest']);
    assert.match(nested, /front\/guest\/002/);
    assert.ok(!nested.includes('front/ui/001'));

    const parent = listCommand(context(built), ['--type', 'front']);
    assert.match(parent, /front\/ui\/001/);
    assert.match(parent, /front\/guest\/002/);
    assert.ok(!parent.includes('back/001'));

    assert.match(listCommand(context(built), ['--type=process']), /^Всего: 1$/m);
  });

  it('неизвестный тип и лишний аргумент отвергаются', () => {
    const built = tree();
    assert.throws(() => listCommand(context(built), ['--type', 'infra']), /неизвестный тип "infra"/);
    assert.throws(() => listCommand(context(built), ['back/001']), CliError);
    assert.throws(() => listCommand(context(built), ['--все']), /неизвестный флаг/);
  });

  it('пустое дерево и пустой тип не выдают таблицу', () => {
    assert.match(listCommand(context(createTree([])), []), /^Задач нет\.$/m);
    assert.match(listCommand(context(tree()), ['--type', 'contract']), /Задач типа "contract" нет/);
  });

  it('нечитаемый манифест не роняет обзор, а попадает в отчёт', () => {
    const built = tree();
    writeFileSync(join(built.root, 'back', '001-api-skeleton', MANIFEST_FILE), 'id: [сломано\n', 'utf8');

    const out = listCommand(context(built), []);
    assert.match(out, /^Всего: 3$/m);
    assert.match(out, /Манифест не читается \(1\)/);
    assert.match(out, /back\/001-api-skeleton/);
    assert.match(statusCommand(context(built), []), /Манифест не читается/);
  });
});
