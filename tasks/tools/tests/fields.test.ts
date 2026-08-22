import assert from 'node:assert/strict';
import { after, describe, it } from 'node:test';
import { CliError } from '../lib/cli.ts';
import { applyListValue, setCommand, unsetCommand } from '../lib/fields.ts';
import { cleanupTrees, context, createTree, manifestOf, type Tree } from './helpers.ts';

after(cleanupTrees);

const DIR = 'front/guest/002-guest-screens';

function tree(): Tree {
  return createTree([
    {
      dir: DIR,
      manifest: {
        id: 'front/guest/002',
        slug: 'guest-screens',
        title: 'Экраны гостя',
        track: 'full',
        legacyId: 'front-guest-002',
        depends: ['back/001'],
        queue: { after: ['back/001'], rationale: 'Вертикальная задача' },
        workspace: { branch: 'feat/guest', worktree: '../minical-guest' },
      },
    },
    { dir: 'back/001-api-skeleton', manifest: { id: 'back/001', slug: 'api-skeleton', title: 'REST-каркас', track: 'full' } },
  ]);
}

const set = (built: Tree, path: string, value: string) => setCommand(context(built), ['front/guest/002', path, value]);
const unset = (built: Tree, path: string) => unsetCommand(context(built), ['front/guest/002', path]);
const manifest = (built: Tree) => manifestOf(built, DIR);

describe('set — скалярные поля', () => {
  it('меняет title и поднимает rev', () => {
    const built = tree();
    const before = manifest(built).meta.rev;
    const out = set(built, 'title', 'Гостевой сценарий — четыре экрана');

    assert.equal(manifest(built).title, 'Гостевой сценарий — четыре экрана');
    assert.equal(manifest(built).meta.rev, before + 1);
    assert.match(out, /^front\/guest\/002: title = Гостевой сценарий — четыре экрана \(rev \d+\)$/);
  });

  it('заводит вложенные блоки по мере надобности', () => {
    const built = tree();
    set(built, 'workspace.mr', 'https://example.test/pull/7');
    set(built, 'links.tracker', 'https://example.test/issue/42');
    set(built, 'queue.rationale', 'После контракта');

    assert.equal(manifest(built).workspace?.mr, 'https://example.test/pull/7');
    assert.equal(manifest(built).links?.tracker, 'https://example.test/issue/42');
    assert.equal(manifest(built).queue?.rationale, 'После контракта');
  });

  it('пустое значение отправляет к unset', () => {
    assert.throws(() => set(tree(), 'workspace.branch', '   '), /пустое значение — используйте unset/);
  });
});

describe('set — списковые поля', () => {
  it('CSV заменяет список целиком', () => {
    const built = tree();
    set(built, 'depends', 'back/001, front/ui/001');
    assert.deepEqual(manifest(built).depends, ['back/001', 'front/ui/001']);
  });

  it('+ и − правят список точечно', () => {
    const built = tree();
    set(built, 'depends', '+front/ui/001');
    assert.deepEqual(manifest(built).depends, ['back/001', 'front/ui/001']);

    set(built, 'depends', '+process/001,-back/001');
    assert.deepEqual(manifest(built).depends, ['front/ui/001', 'process/001']);

    set(built, 'depends', '+front/ui/001');
    assert.deepEqual(manifest(built).depends, ['front/ui/001', 'process/001'], 'повторное добавление не дублирует');
  });

  it('удаление последнего элемента убирает поле целиком', () => {
    const built = tree();
    set(built, 'depends', '-back/001');
    assert.equal(manifest(built).depends, undefined);
  });

  it('ссылки на задачи приводятся к каноническому id', () => {
    const built = tree();
    set(built, 'depends', 'tasks/back/001-api-skeleton/, front/ui/001');
    assert.deepEqual(manifest(built).depends, ['back/001', 'front/ui/001']);

    set(built, 'queue.parallel', '+process/001');
    assert.deepEqual(manifest(built).queue?.parallel, ['process/001']);
  });

  it('uispec — просто пути, без нормализации id', () => {
    const built = tree();
    set(built, 'uispec', 'docs/ui-spec-kit/specs/ui/screens/guest-catalog.screen.md');
    assert.deepEqual(manifest(built).uispec, ['docs/ui-spec-kit/specs/ui/screens/guest-catalog.screen.md']);
  });

  it('смешивать замену и операции нельзя', () => {
    assert.throws(() => set(tree(), 'depends', 'back/001,+front/ui/001'), /нельзя смешивать замену списка и операции/);
    assert.throws(() => set(tree(), 'depends', '+'), /пустой элемент в операции/);
    assert.throws(() => set(tree(), 'depends', ' , '), /пустое значение/);
  });

  it('значение, не похожее на id задачи, отвергается до записи', () => {
    const built = tree();
    assert.throws(() => set(built, 'depends', 'починить-CI'), /не похоже на id задачи/);
    assert.deepEqual(manifest(built).depends, ['back/001'], 'манифест не тронут');
  });

  it('дубль в CSV ловит схема манифеста', () => {
    assert.throws(() => set(tree(), 'depends', 'back/001,back/001'), /повторяющиеся значения/);
  });

  it('applyListValue — чистая функция разбора значения', () => {
    assert.deepEqual(applyListValue(undefined, 'a, b', 'поле'), ['a', 'b']);
    assert.deepEqual(applyListValue(['a'], '+b,-a', 'поле'), ['b']);
    assert.deepEqual(applyListValue(['a'], '-нет-такого', 'поле'), ['a']);
    assert.throws(() => applyListValue(['a'], 'b,+c', 'поле'), CliError);
  });
});

describe('set/unset — границы', () => {
  it('канонические поля меняются только своими командами', () => {
    const built = tree();
    assert.throws(() => set(built, 'id', 'back/009'), /только через new и migrate/);
    assert.throws(() => set(built, 'slug', 'другой'), /только через new и migrate/);
    assert.throws(() => set(built, 'track', 'lite'), /только через promote/);
    assert.throws(() => set(built, 'gates.brief.status', 'согласовано'), /только через approve и draft/);
    assert.throws(() => set(built, 'meta.rev', '1'), /только через repair/);
    assert.throws(() => set(built, 'legacyId', 'front-guest-002'), /только через migrate/);
    assert.throws(() => unset(built, 'gates'), /только через approve и draft/);
  });

  it('поле вне белого списка отвергается со списком допустимых', () => {
    assert.throws(() => set(tree(), 'workspace.pr', 'x'), /неизвестное поле "workspace\.pr" \(допустимы: depends/);
    assert.throws(() => set(tree(), 'links', 'x'), /неизвестное поле "links"/);
  });

  it('неверное число аргументов — подсказка по употреблению', () => {
    const built = tree();
    assert.throws(() => setCommand(context(built), ['front/guest/002', 'title']), /scripts\/task set <id> <путь> <значение>/);
    assert.throws(() => unsetCommand(context(built), ['front/guest/002']), CliError);
  });
});

describe('unset', () => {
  it('убирает лист и схлопывает опустевший блок', () => {
    const built = tree();
    unset(built, 'workspace.branch');
    assert.deepEqual(manifest(built).workspace, { worktree: '../minical-guest' });

    unset(built, 'workspace.worktree');
    assert.equal(manifest(built).workspace, undefined, 'пустой блок в манифесте не хранится');
  });

  it('убирает блок целиком — уборка рабочего контекста одной командой', () => {
    const built = tree();
    unset(built, 'workspace');
    assert.equal(manifest(built).workspace, undefined);

    unset(built, 'queue');
    assert.equal(manifest(built).queue, undefined);
  });

  it('убирает списковое поле', () => {
    const built = tree();
    unset(built, 'depends');
    assert.equal(manifest(built).depends, undefined);
  });

  it('незаданное поле не порождает запись', () => {
    const built = tree();
    const before = manifest(built).meta.rev;
    const out = unset(built, 'links.tracker');
    assert.match(out, /и так не задано — манифест не изменён/);
    assert.equal(manifest(built).meta.rev, before);
  });

  it('title убрать нельзя — только изменить', () => {
    assert.throws(() => unset(tree(), 'title'), /поле "title" обязательно/);
  });
});
