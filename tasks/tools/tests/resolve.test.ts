import assert from 'node:assert/strict';
import { after, describe, it } from 'node:test';
import {
  duplicateNumbers,
  formatNumber,
  listTasks,
  nextNumber,
  normalizeRef,
  parseTaskDirName,
  resolveTask,
  ResolveError,
  taskId,
} from '../lib/resolve.ts';
import { cleanupTrees, createTree, scaffold, type TaskFixture } from './helpers.ts';

after(cleanupTrees);

const TREE: TaskFixture[] = [
  {
    dir: 'contract/001-guest-flow',
    manifest: { id: 'contract/001', slug: 'guest-flow', title: 'Расширения контракта', track: 'full', legacyId: 'contract-001' },
  },
  {
    dir: 'back/001-api-skeleton',
    manifest: { id: 'back/001', slug: 'api-skeleton', title: 'REST-каркас', track: 'full', legacyId: 'back-001' },
  },
  {
    dir: 'back/003-slot-engine',
    manifest: { id: 'back/003', slug: 'slot-engine', title: 'Slot Engine', track: 'lite' },
  },
  {
    dir: 'contract/002-http-security',
    // Задачу переименовывали дважды: 004 → infra-001 (см. «История переименований» tasks/README.md).
    manifest: { id: 'contract/002', slug: 'http-security', title: 'Заголовки безопасности', track: 'full', legacyId: ['004', 'infra-001'] },
  },
  {
    dir: 'front/ui/001-guest-uispec',
    manifest: { id: 'front/ui/001', slug: 'guest-uispec', title: 'UISpec гостя', track: 'full', legacyId: 'front-ui-001' },
  },
  {
    dir: 'front/guest/002-guest-screens',
    manifest: { id: 'front/guest/002', slug: 'guest-screens', title: 'Экраны гостя', track: 'full', legacyId: 'front-guest-002' },
  },
];

function tree() {
  const built = createTree(TREE);
  // Шум, который обход обязан игнорировать.
  scaffold(built.root, 'archive/000/brief.md', '# архив');
  scaffold(built.root, '_template/full/brief.md', '# шаблон');
  scaffold(built.root, 'tools/task.ts', '// инструмент');
  scaffold(built.root, 'REGISTRY.md', '# реестр');
  scaffold(built.root, 'back/notes.md', 'заметка внутри типа');
  scaffold(built.root, 'back/draft-idea/task.yaml', 'мусорное имя директории');
  return built;
}

describe('resolve — обход дерева', () => {
  it('находит задачи всех типов, включая вложенные, и игнорирует остальное', () => {
    const { root, config } = tree();
    const tasks = listTasks(root, config);
    assert.deepEqual(tasks.map((task) => task.id), [
      'contract/001',
      'contract/002',
      'back/001',
      'back/003',
      'front/ui/001',
      'front/guest/002',
    ]);
    assert.deepEqual(tasks.map((task) => task.dirName), [
      '001-guest-flow',
      '002-http-security',
      '001-api-skeleton',
      '003-slot-engine',
      '001-guest-uispec',
      '002-guest-screens',
    ]);
    const nested = tasks.find((task) => task.type === 'front/guest');
    assert.equal(nested?.slug, 'guest-screens');
    assert.equal(nested?.number, '002');
  });

  it('канонический id не содержит слаг', () => {
    const { root, config } = tree();
    for (const task of listTasks(root, config)) {
      assert.equal(task.id, taskId(task.type, task.number));
      assert.ok(!task.id.includes(task.slug));
    }
  });

  it('разбирает имя директории и отвергает неподходящие', () => {
    const { config } = tree();
    assert.deepEqual(parseTaskDirName('002-guest-screens', config), { number: '002', slug: 'guest-screens' });
    assert.equal(parseTaskDirName('2-guest', config), null);
    assert.equal(parseTaskDirName('0002-guest', config), null);
    assert.equal(parseTaskDirName('002', config), null);
    assert.equal(parseTaskDirName('002-Guest', config), null);
    assert.equal(formatNumber(7, config), '007');
  });
});

describe('resolve — поиск задачи', () => {
  it('резолвит по каноническому id, по пути со слагом и по префиксу tasks/', () => {
    const { root, config } = tree();
    const tasks = listTasks(root, config);
    assert.equal(resolveTask(tasks, 'front/guest/002', config).dirName, '002-guest-screens');
    assert.equal(resolveTask(tasks, 'front/guest/002-guest-screens', config).id, 'front/guest/002');
    assert.equal(resolveTask(tasks, 'tasks/front/guest/002-guest-screens/', config).id, 'front/guest/002');
    assert.equal(normalizeRef('tasks/back/001-api-skeleton/', config), 'back/001');
    assert.equal(normalizeRef('back/001', config), 'back/001');
  });

  it('резолвит по legacyId', () => {
    const { root, config } = tree();
    const tasks = listTasks(root, config);
    assert.equal(resolveTask(tasks, 'front-guest-002', config).id, 'front/guest/002');
    assert.equal(resolveTask(tasks, 'back-001', config).id, 'back/001');
  });

  it('резолвит по каждому историческому id из списка', () => {
    const { root, config } = tree();
    const tasks = listTasks(root, config);
    assert.equal(resolveTask(tasks, '004', config).id, 'contract/002');
    assert.equal(resolveTask(tasks, 'infra-001', config).id, 'contract/002');
  });

  it('сообщает, когда задача не найдена', () => {
    const { root, config } = tree();
    const tasks = listTasks(root, config);
    assert.throws(() => resolveTask(tasks, 'back/009', config), ResolveError);
    assert.throws(() => resolveTask(tasks, 'infra-042', config), /не найдена — ни по id, ни по legacyId/);
  });
});

describe('resolve — номера', () => {
  it('следующий номер продолжает максимум, а не заполняет дыры', () => {
    const { root, config } = tree();
    const tasks = listTasks(root, config);
    assert.equal(nextNumber(tasks, 'back', config), '004');
    assert.equal(nextNumber(tasks, 'contract', config), '003');
    assert.equal(nextNumber(tasks, 'front/guest', config), '003');
    assert.equal(nextNumber(tasks, 'process', config), '001');
  });

  it('неизвестный тип отвергается', () => {
    const { root, config } = tree();
    assert.throws(() => nextNumber(listTasks(root, config), 'infra', config), /неизвестный тип задачи "infra"/);
  });

  it('дубль номера виден и ломает резолв', () => {
    const { root, config } = createTree([
      { dir: 'back/001-first', manifest: { id: 'back/001', slug: 'first', title: 'Первая', track: 'full' } },
      { dir: 'back/001-second', manifest: { id: 'back/001', slug: 'second', title: 'Вторая', track: 'full' } },
      { dir: 'back/002-third', manifest: { id: 'back/002', slug: 'third', title: 'Третья', track: 'full' } },
    ]);
    const tasks = listTasks(root, config);
    assert.deepEqual(duplicateNumbers(tasks), [{ id: 'back/001', dirs: ['001-first', '001-second'] }]);
    assert.throws(() => resolveTask(tasks, 'back/001', config), /занят несколькими директориями/);
    assert.equal(resolveTask(tasks, 'back/002', config).slug, 'third');
  });

  it('дублей нет — пустой список', () => {
    const { root, config } = tree();
    assert.deepEqual(duplicateNumbers(listTasks(root, config)), []);
  });
});
