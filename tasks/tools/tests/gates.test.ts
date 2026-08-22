import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { after, describe, it } from 'node:test';
import { CliError } from '../lib/cli.ts';
import { trackOf } from '../lib/config.ts';
import { approveCommand, draftCommand, gateDocumentText, gateHash, gateSpec } from '../lib/gates.ts';
import { MANIFEST_FILE, readManifest, writeManifest } from '../lib/manifest.ts';
import { cleanupTrees, context, createTree, manifestOf, taskFile, TODAY, type TaskFixture, type Tree } from './helpers.ts';

after(cleanupTrees);

const APPROVED = { status: 'согласовано', approvedAt: '2026-08-01', sha256: 'a'.repeat(64) };
const DRAFT = { status: 'черновик' };

const BRIEF = '# brief\n\nПостановка задачи.\n';
const ADR = '# adr\n\nРешение.\n';
const PLAN = [
  '# План back/001',
  '',
  '## Декомпозиция',
  '',
  '| ID | Цель / проблема | Решение | Состояние |',
  '|---|---|---|---|',
  '| P01 | Каркаса нет | `lib/config.ts` и guard `test ! -d tasks \\|\\|` | в плане |',
  '| P02 | Стадии не считаются | `lib/stage.ts` | в плане |',
  '',
  '## Порядок и зависимости',
  '',
].join('\n');
const RESULT = '# Результат\n\n## Итог\n\nГотово.\n';

const LITE = [
  '# process/001 — правка скрипта',
  '',
  '## Контекст и цель',
  '',
  'Скрипт падает без `docs/`.',
  '',
  '## Решение',
  '',
  'Добавить guard.',
  '',
  '## Чеклист',
  '',
  '| ID | Цель / проблема | Решение | Состояние |',
  '|---|---|---|---|',
  '| C1 | Guard | Добавить | в плане |',
  '',
  '## Результат и проверки',
  '',
].join('\n');

const FULL_DOCS = { 'brief.md': BRIEF, 'adr.md': ADR, 'plan.md': PLAN, 'result.md': RESULT };

function tree(gates: Record<string, { status: string; approvedAt?: string; sha256?: string }>, over: Partial<TaskFixture> = {}): Tree {
  const fixture: TaskFixture = {
    dir: 'back/001-api-skeleton',
    manifest: { id: 'back/001', slug: 'api-skeleton', title: 'REST-каркас', track: 'full', gates },
    documents: FULL_DOCS,
    ...over,
  };
  return createTree([fixture]);
}

function liteTree(gates: Record<string, { status: string; approvedAt?: string; sha256?: string }>): Tree {
  return createTree([
    {
      dir: 'process/001-script-guard',
      manifest: { id: 'process/001', slug: 'script-guard', title: 'Guard в скрипте', track: 'lite', gates },
      documents: { 'task.md': LITE },
    },
  ]);
}

const sha256 = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex');

describe('gates — hash-стратегии', () => {
  const config = createTree([]).config;
  const full = trackOf(config, 'full');
  const lite = trackOf(config, 'lite');

  it('без стратегии хэшируется весь файл', () => {
    const brief = gateSpec(full, 'brief');
    assert.equal(brief.hash, undefined);
    assert.equal(gateHash(BRIEF, brief, full), sha256(BRIEF));
  });

  it('ignore-state-column: перевод пункта не меняет хэш, правка решения — меняет', () => {
    const plan = gateSpec(full, 'plan');
    const base = gateHash(PLAN, plan, full);

    const moved = PLAN.replace('| P01 | Каркаса нет | `lib/config.ts` и guard `test ! -d tasks \\|\\|` | в плане |', '| P01 | Каркаса нет | `lib/config.ts` и guard `test ! -d tasks \\|\\|` | завершено — прогон зелёный |');
    assert.equal(gateHash(moved, plan, full), base, 'состояние пункта вне согласованной части');

    const rewidened = PLAN.replace('| P02 | Стадии не считаются | `lib/stage.ts` | в плане |', '|  P02  |  Стадии не считаются  |  `lib/stage.ts`  |  в плане  |');
    assert.equal(gateHash(rewidened, plan, full), base, 'ширина колонок таблицы пунктов не считается правкой');

    const rescoped = PLAN.replace('`lib/stage.ts`', '`lib/stage.ts` + отдельный парсер');
    assert.notEqual(gateHash(rescoped, plan, full), base, 'правка решения пункта — материальная');

    const outside = PLAN.replace('## Порядок и зависимости', '## Порядок, зависимости и риски');
    assert.notEqual(gateHash(outside, plan, full), base, 'текст вне таблицы хэшируется как есть');

    assert.match(gateDocumentText(PLAN, plan, full), /\| P01 \| Каркаса нет \| `lib\/config\.ts` и guard `test ! -d tasks \\\|\\\|` \| \|/);
  });

  it('until:<маркер>: согласована часть до маркера, ниже — свободна', () => {
    const setup = gateSpec(lite, 'setup');
    const base = gateHash(LITE, setup, lite);
    assert.equal(base, sha256(LITE.split('\n').slice(0, LITE.split('\n').indexOf('## Чеклист')).join('\n')));

    const below = LITE.replace('| C1 | Guard | Добавить | в плане |', '| C1 | Guard | Добавить | завершено |\n| C2 | Тест | Добавить | в плане |');
    assert.equal(gateHash(below, setup, lite), base, 'работа ниже маркера не трогает setup');

    const above = LITE.replace('Добавить guard.', 'Добавить guard и переписать вызов.');
    assert.notEqual(gateHash(above, setup, lite), base);

    assert.throws(() => gateHash(LITE.replace('## Чеклист', '## Чек-лист'), setup, lite), /не найдена строка-маркер "## Чеклист"/);
  });

  it('result у lite хэширует файл целиком — включая чеклист', () => {
    const result = gateSpec(lite, 'result');
    assert.equal(gateHash(LITE, result, lite), sha256(LITE));
  });

  it('неизвестный гейт называет гейты трека', () => {
    assert.throws(() => gateSpec(full, 'setup'), /неизвестный гейт "setup".*brief, adr, plan, result/s);
  });
});

describe('approve', () => {
  it('пишет статус, дату и checksum одной операцией', () => {
    const built = tree({ brief: DRAFT, adr: DRAFT, plan: DRAFT, result: DRAFT });
    const out = approveCommand(context(built), ['back/001', 'brief']);

    const manifest = manifestOf(built, 'back/001-api-skeleton');
    assert.deepEqual(manifest.gates.brief, { status: 'согласовано', approvedAt: TODAY, sha256: sha256(BRIEF) });
    assert.equal(manifest.meta.rev, 2, 'запись через writeManifest поднимает rev');
    assert.match(out, /Гейт «brief» задачи back\/001 согласован \(2026-08-15\)/);
    assert.match(out, /документ: brief\.md — sha256 [0-9a-f]{12}…, стратегия хэширования: весь файл/);
    assert.match(out, /стадия: проектирование/);
  });

  it('не согласует гейт, пока предыдущий в черновике', () => {
    const built = tree({ brief: DRAFT, adr: DRAFT, plan: DRAFT, result: DRAFT });
    assert.throws(() => approveCommand(context(built), ['back/001', 'plan']), /предыдущий гейт "brief" в статусе "черновик"/);
    assert.throws(() => approveCommand(context(built), ['back/001', 'plan']), /brief → adr → plan → result/);
    assert.equal(manifestOf(built, 'back/001-api-skeleton').gates.plan?.status, 'черновик');
  });

  it('повторное согласование отвергается', () => {
    const built = tree({ brief: APPROVED, adr: DRAFT, plan: DRAFT, result: DRAFT });
    assert.throws(() => approveCommand(context(built), ['back/001', 'brief']), /уже в статусе "согласовано" — откатить можно командой draft/);
  });

  it('пишет стратегию хэширования гейта', () => {
    const built = tree({ brief: APPROVED, adr: APPROVED, plan: DRAFT, result: DRAFT });
    const out = approveCommand(context(built), ['back/001', 'plan']);
    assert.match(out, /стратегия хэширования: ignore-state-column/);
    assert.equal(manifestOf(built, 'back/001-api-skeleton').gates.plan?.sha256, gateHash(PLAN, gateSpec(trackOf(built.config, 'full'), 'plan'), trackOf(built.config, 'full')));
  });

  it('отсутствующий документ — понятная ошибка, а не исключение fs', () => {
    const built = tree({ brief: DRAFT, adr: DRAFT, plan: DRAFT, result: DRAFT });
    rmSync(taskFile(built, 'back/001-api-skeleton', 'brief.md'));
    assert.throws(() => approveCommand(context(built), ['back/001', 'brief']), /документ "brief\.md" гейта "brief" не найден/);
  });

  it('неизвестный гейт и неверное число аргументов отвергаются', () => {
    const built = tree({ brief: DRAFT, adr: DRAFT, plan: DRAFT, result: DRAFT });
    assert.throws(() => approveCommand(context(built), ['back/001', 'setup']), /неизвестный гейт "setup"/);
    assert.throws(() => approveCommand(context(built), ['back/001']), CliError);
  });
});

describe('approve последнего гейта — уборка рабочего контекста', () => {
  function withWorkspace(workspace: Record<string, string>): Tree {
    const built = tree({ brief: APPROVED, adr: APPROVED, plan: APPROVED, result: DRAFT });
    const file = taskFile(built, 'back/001-api-skeleton', MANIFEST_FILE);
    const manifest = readManifest(file, built.config);
    writeManifest(file, { ...manifest, workspace }, built.config);
    return built;
  }

  it('предупреждает о неубранных ветке и worktree и вычищает workspace, сохраняя mr', () => {
    const built = withWorkspace({ branch: 'feat/api', worktree: '../minical-api', mr: 'https://example.test/pull/3' });
    const out = approveCommand(context(built), ['back/001', 'result']);

    assert.match(out, /Предупреждение: рабочий контекст не убран по протоколу/);
    assert.match(out, /ветка feat\/api не удалена/);
    assert.match(out, /worktree \.\.\/minical-api не удалён/);
    assert.match(out, /блок workspace вычищен \(mr сохранён как история\)/);
    assert.deepEqual(manifestOf(built, 'back/001-api-skeleton').workspace, { mr: 'https://example.test/pull/3' });
    assert.match(out, /стадия: завершена/);
  });

  it('без mr блок workspace исчезает целиком', () => {
    const built = withWorkspace({ branch: 'feat/api' });
    approveCommand(context(built), ['back/001', 'result']);
    assert.equal(manifestOf(built, 'back/001-api-skeleton').workspace, undefined);
  });

  it('убранный по протоколу контекст не вызывает предупреждения', () => {
    const built = withWorkspace({ mr: 'https://example.test/pull/3' });
    const out = approveCommand(context(built), ['back/001', 'result']);
    assert.ok(!out.includes('Предупреждение'));
    assert.deepEqual(manifestOf(built, 'back/001-api-skeleton').workspace, { mr: 'https://example.test/pull/3' });
  });
});

describe('draft — каскад', () => {
  it('возврат brief сбрасывает все последующие гейты', () => {
    const built = tree({ brief: APPROVED, adr: APPROVED, plan: APPROVED, result: APPROVED });
    const out = draftCommand(context(built), ['back/001', 'brief']);

    const manifest = manifestOf(built, 'back/001-api-skeleton');
    assert.deepEqual(Object.values(manifest.gates).map((gate) => gate.status), ['черновик', 'черновик', 'черновик', 'черновик']);
    assert.ok(Object.values(manifest.gates).every((gate) => gate.approvedAt === undefined && gate.sha256 === undefined));
    assert.match(out, /каскадом сброшены: adr, plan, result \(даты и checksum стёрты\)/);
    assert.match(out, /стадия: постановка/);
  });

  it('возврат середины трека не трогает предыдущие гейты', () => {
    const built = tree({ brief: APPROVED, adr: APPROVED, plan: APPROVED, result: DRAFT });
    draftCommand(context(built), ['back/001', 'plan']);

    const manifest = manifestOf(built, 'back/001-api-skeleton');
    assert.equal(manifest.gates.brief?.status, 'согласовано');
    assert.equal(manifest.gates.brief?.approvedAt, '2026-08-01');
    assert.equal(manifest.gates.adr?.status, 'согласовано');
    assert.equal(manifest.gates.plan?.status, 'черновик');
  });

  it('lite: сброс setup уводит в черновик и result', () => {
    const built = liteTree({ setup: APPROVED, result: APPROVED });
    const out = draftCommand(context(built), ['process/001', 'setup']);
    assert.deepEqual(Object.values(manifestOf(built, 'process/001-script-guard').gates).map((gate) => gate.status), ['черновик', 'черновик']);
    assert.match(out, /каскадом сброшены: result/);
  });

  it('сбрасывать нечего — ошибка, а не пустая запись', () => {
    const built = tree({ brief: APPROVED, adr: DRAFT, plan: DRAFT, result: DRAFT });
    const before = manifestOf(built, 'back/001-api-skeleton').meta.rev;
    assert.throws(() => draftCommand(context(built), ['back/001', 'adr']), /уже в статусе "черновик" — сбрасывать нечего/);
    assert.equal(manifestOf(built, 'back/001-api-skeleton').meta.rev, before);
  });
});

describe('gates — жизненный цикл lite', () => {
  it('setup согласуется по части файла до чеклиста, работа ниже маркера идёт свободно', () => {
    const built = liteTree({ setup: DRAFT, result: DRAFT });
    approveCommand(context(built), ['process/001', 'setup']);
    const stored = manifestOf(built, 'process/001-script-guard').gates.setup?.sha256;

    const file = taskFile(built, 'process/001-script-guard', 'task.md');
    writeFileSync(file, readFileSync(file, 'utf8').replace('| C1 | Guard | Добавить | в плане |', '| C1 | Guard | Добавить | завершено |'), 'utf8');

    const lite = trackOf(built.config, 'lite');
    assert.equal(gateHash(readFileSync(file, 'utf8'), gateSpec(lite, 'setup'), lite), stored, 'дрифта нет: правка ниже маркера');
    assert.notEqual(gateHash(readFileSync(file, 'utf8'), gateSpec(lite, 'result'), lite), stored);
  });
});
