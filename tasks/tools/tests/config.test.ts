import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';
import { ConfigError, doneState, loadConfig, parseConfig, trackOf } from '../lib/config.ts';
import { cleanupTrees, RAW_FIXTURE_CONFIG, REPO_TASKS_ROOT, tempRoot } from './helpers.ts';

after(cleanupTrees);

function withConfig(raw: unknown): string {
  const root = tempRoot();
  writeFileSync(join(root, 'tasks.config.json'), typeof raw === 'string' ? raw : JSON.stringify(raw), 'utf8');
  return root;
}

function mutate(patch: Record<string, unknown>): unknown {
  return { ...structuredClone(RAW_FIXTURE_CONFIG), ...patch };
}

function capture(raw: unknown): ConfigError {
  try {
    parseConfig(raw, 'fixture');
  } catch (error) {
    assert.ok(error instanceof ConfigError, `ожидался ConfigError, получено ${String(error)}`);
    return error;
  }
  throw new assert.AssertionError({ message: 'ожидалась ошибка конфига, но разбор прошёл' });
}

function expectProblem(raw: unknown, fragment: string) {
  const error = capture(raw);
  assert.ok(
    error.problems.some((problem) => problem.includes(fragment)),
    `ожидалась жалоба про «${fragment}», получено:\n${error.problems.join('\n')}`,
  );
}

describe('config', () => {
  it('принимает боевой tasks.config.json проекта', () => {
    const config = loadConfig(REPO_TASKS_ROOT);
    assert.deepEqual(config.types, ['contract', 'infra', 'back', 'front/ui', 'front/guest', 'front/owner', 'process']);
    assert.equal(config.numberWidth, 3);
    assert.equal(config.registryFile, 'REGISTRY.md');
    assert.equal(config.statuses.draft, 'черновик');
    assert.equal(doneState(config), 'завершено');
    assert.deepEqual(Object.keys(config.tracks), ['full', 'lite']);
    assert.deepEqual(trackOf(config, 'full').gates.map((gate) => gate.name), ['brief', 'adr', 'plan', 'result']);
    assert.equal(trackOf(config, 'full').gates[2]?.hash, 'ignore-state-column');
    assert.deepEqual(trackOf(config, 'lite').gates.map((gate) => gate.name), ['setup', 'result']);
    assert.equal(trackOf(config, 'lite').gates[0]?.hash, 'until:## Чеклист');
    assert.equal(trackOf(config, 'lite').items.section, '## Чеклист');
  });

  it('принимает фикстурный конфиг', () => {
    const config = parseConfig(RAW_FIXTURE_CONFIG, 'fixture');
    assert.deepEqual(config.types, ['contract', 'back', 'front/ui', 'front/guest', 'process']);
    assert.equal(config.tracks.full?.items.file, 'plan.md');
  });

  it('trackOf сообщает о неизвестном треке', () => {
    const config = parseConfig(RAW_FIXTURE_CONFIG, 'fixture');
    assert.throws(() => trackOf(config, 'medium'), /неизвестный трек "medium"/);
  });

  it('читает файл с диска и сообщает о его отсутствии', () => {
    const root = withConfig(RAW_FIXTURE_CONFIG);
    assert.equal(loadConfig(root).numberWidth, 3);
    assert.throws(() => loadConfig(join(root, 'nope')), /конфиг не найден/);
  });

  it('сообщает о битом JSON, не роняя стек', () => {
    const root = withConfig('{ "types": [ }');
    assert.throws(() => loadConfig(root), (error: unknown) => {
      assert.ok(error instanceof ConfigError);
      assert.match(error.message, /не разбирается как JSON/);
      return true;
    });
  });

  it('верхний уровень должен быть объектом', () => {
    assert.throws(() => parseConfig([], 'fixture'), /ожидался объект верхнего уровня/);
    assert.throws(() => parseConfig(null, 'fixture'), /ожидался объект верхнего уровня/);
  });

  it('ловит неизвестные и отсутствующие ключи', () => {
    expectProblem({ ...structuredClone(RAW_FIXTURE_CONFIG), roadmapFile: 'ROADMAP.md' }, 'неизвестный ключ "roadmapFile"');
    const { types, ...withoutTypes } = structuredClone(RAW_FIXTURE_CONFIG);
    assert.ok(types.length > 0);
    expectProblem(withoutTypes, 'отсутствует обязательный ключ "types"');
  });

  it('ловит пустые и некорректные типы', () => {
    expectProblem(mutate({ types: [] }), 'types: массив не может быть пустым');
    expectProblem(mutate({ types: ['Back'] }), 'types[0]');
    expectProblem(mutate({ types: ['back', 'back'] }), 'повторяющиеся значения');
    expectProblem(mutate({ types: ['front', 'front/ui'] }), 'является родителем');
  });

  it('ловит некорректный numberWidth', () => {
    expectProblem(mutate({ numberWidth: 0 }), 'numberWidth');
    expectProblem(mutate({ numberWidth: 2.5 }), 'numberWidth');
    expectProblem(mutate({ numberWidth: '3' }), 'numberWidth');
  });

  it('ловит некорректный словарь статусов', () => {
    expectProblem(mutate({ statuses: { draft: 'черновик' } }), 'statuses.approved');
    expectProblem(mutate({ statuses: { draft: 'x', approved: 'x' } }), 'draft и approved должны различаться');
    expectProblem(mutate({ statuses: { draft: 'x', approved: 'y', done: 'z' } }), 'неизвестный ключ "done"');
    expectProblem(mutate({ statuses: 'черновик' }), 'statuses: ожидался объект');
  });

  it('ловит пустые состояния пунктов', () => {
    expectProblem(mutate({ itemStates: [] }), 'itemStates: массив не может быть пустым');
  });

  it('ловит поломанные треки', () => {
    expectProblem(mutate({ tracks: {} }), 'должен быть описан хотя бы один трек');
    expectProblem(mutate({ tracks: { full: { gates: [], items: { file: 'plan.md' } } } }), 'хотя бы один гейт');
    expectProblem(mutate({ tracks: { full: { gates: [{ name: 'brief', file: 'brief.md' }] } } }), 'tracks.full.items');
    expectProblem(
      mutate({ tracks: { full: { gates: [{ name: 'brief', file: 'brief.md' }], items: { file: 'plan.md' }, phases: [] } } }),
      'неизвестный ключ "phases"',
    );
    expectProblem(
      mutate({
        tracks: {
          full: {
            gates: [{ name: 'brief', file: 'brief.md' }, { name: 'brief', file: 'adr.md' }],
            items: { file: 'plan.md' },
          },
        },
      }),
      'повторяющиеся имена гейтов',
    );
  });

  it('ловит неизвестную стратегию хэширования', () => {
    expectProblem(
      mutate({
        tracks: {
          full: { gates: [{ name: 'brief', file: 'brief.md', hash: 'skip-everything' }], items: { file: 'plan.md' } },
        },
      }),
      'hash',
    );
  });

  it('собирает все проблемы разом, а не первую', () => {
    const error = capture({ types: [], numberWidth: 0 });
    assert.ok(error.problems.length >= 3, `ожидалось несколько проблем, получено ${error.problems.length}`);
    assert.match(error.message, /конфиг не прошёл проверку/);
  });
});
