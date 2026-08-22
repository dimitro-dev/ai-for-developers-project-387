import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';
import { parseConfig, type TasksConfig } from '../lib/config.ts';
import {
  computeSelfHash,
  legacyIds,
  MANIFEST_FILE,
  ManifestError,
  newManifest,
  parseManifest,
  readManifest,
  serializeManifest,
  validateManifest,
  verifySelfHash,
  writeManifest,
  type NewManifestInput,
  type TaskManifest,
} from '../lib/manifest.ts';
import { cleanupTrees, createTree, RAW_FIXTURE_CONFIG } from './helpers.ts';

after(cleanupTrees);

const config: TasksConfig = parseConfig(RAW_FIXTURE_CONFIG, 'fixture');

const BASE: NewManifestInput = {
  id: 'front/guest/002',
  slug: 'guest-screens',
  title: 'Гостевой сценарий — четыре экрана',
  track: 'full',
};

function captureProblems(raw: unknown): string[] {
  try {
    validateManifest(raw, config, 'fixture');
  } catch (error) {
    assert.ok(error instanceof ManifestError, `ожидался ManifestError, получено ${String(error)}`);
    return error.problems;
  }
  throw new assert.AssertionError({ message: 'ожидалась ошибка схемы манифеста, но разбор прошёл' });
}

function expectProblem(raw: unknown, fragment: string) {
  const problems = captureProblems(raw);
  assert.ok(
    problems.some((problem) => problem.includes(fragment)),
    `ожидалась жалоба про «${fragment}», получено:\n${problems.join('\n')}`,
  );
}

/** Валидный объект манифеста в виде «как в YAML» — отправная точка для негативных проб. */
function raw(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'back/001',
    slug: 'api-skeleton',
    title: 'REST-каркас',
    track: 'full',
    gates: {
      brief: { status: 'согласовано', approvedAt: '2026-08-01', sha256: 'a'.repeat(64) },
      adr: { status: 'согласовано' },
      plan: { status: 'черновик' },
      result: { status: 'черновик' },
    },
    meta: { rev: 3, selfHash: 'b'.repeat(64) },
    ...overrides,
  };
}

describe('manifest — создание и запись', () => {
  it('newManifest заводит все гейты трека в черновике и в порядке конфига', () => {
    const manifest = newManifest(BASE, config);
    assert.deepEqual(Object.keys(manifest.gates), ['brief', 'adr', 'plan', 'result']);
    assert.ok(Object.values(manifest.gates).every((gate) => gate.status === 'черновик'));
    assert.deepEqual(manifest.meta, { rev: 0, selfHash: '' });

    const lite = newManifest({ ...BASE, id: 'back/003', slug: 'slot-engine', track: 'lite' }, config);
    assert.deepEqual(Object.keys(lite.gates), ['setup', 'result']);
  });

  it('запись поднимает rev и пересчитывает selfHash', () => {
    const { root } = createTree([{ dir: 'back/001-api-skeleton' }]);
    const file = join(root, 'back', '001-api-skeleton', MANIFEST_FILE);

    const first = writeManifest(file, newManifest({ ...BASE, id: 'back/001', slug: 'api-skeleton' }, config), config);
    assert.equal(first.meta.rev, 1);
    assert.ok(verifySelfHash(first, config));

    const second = writeManifest(file, { ...first, title: 'REST-каркас' }, config);
    assert.equal(second.meta.rev, 2);
    assert.ok(verifySelfHash(second, config));
    assert.notEqual(first.meta.selfHash, second.meta.selfHash);
  });

  it('roundtrip: записанное читается тем же объектом', () => {
    const { root } = createTree([{ dir: 'front/guest/002-guest-screens' }]);
    const file = join(root, 'front', 'guest', '002-guest-screens', MANIFEST_FILE);
    const written = writeManifest(
      file,
      newManifest(
        {
          ...BASE,
          legacyId: 'front-guest-002',
          depends: ['front/ui/002', 'back/001'],
          queue: { after: ['back/001'], parallel: ['front/ui/001'], rationale: 'Вертикальная задача' },
          workspace: { branch: 'feat/front-guest-002', worktree: '../minical-front-guest-002' },
          links: { tracker: 'https://example.test/1' },
          uispec: ['docs/ui-spec-kit/specs/ui/screens/guest-catalog.screen.md'],
        },
        config,
      ),
      config,
    );
    assert.deepEqual(readManifest(file, config), written);
  });

  it('roundtrip сохраняет форму legacyId: строка остаётся строкой, список — списком', () => {
    const { root } = createTree([{ dir: 'contract/001-one' }, { dir: 'contract/002-many' }]);

    const one = join(root, 'contract', '001-one', MANIFEST_FILE);
    const single = writeManifest(
      one,
      newManifest({ ...BASE, id: 'contract/001', slug: 'one', legacyId: 'infra-001' }, config),
      config,
    );
    assert.equal(single.legacyId, 'infra-001');
    assert.match(readFileSync(one, 'utf8'), /^legacyId: infra-001$/m);
    assert.deepEqual(readManifest(one, config), single);

    const many = join(root, 'contract', '002-many', MANIFEST_FILE);
    const list = writeManifest(
      many,
      newManifest({ ...BASE, id: 'contract/002', slug: 'many', legacyId: ['004', 'infra-001'] }, config),
      config,
    );
    assert.deepEqual(list.legacyId, ['004', 'infra-001']);
    assert.match(readFileSync(many, 'utf8'), /^legacyId:\n {2}- "004"\n {2}- infra-001$/m);
    assert.deepEqual(readManifest(many, config), list);

    assert.notEqual(single.meta.selfHash, list.meta.selfHash, 'форма хранения входит в selfHash');
    assert.ok(verifySelfHash(list, config));
  });

  it('сериализация каноническая: порядок ключей стабилен, пустые блоки опущены', () => {
    const manifest: TaskManifest = {
      ...newManifest({ ...BASE, legacyId: 'front-guest-002', depends: [], queue: {} }, config),
      meta: { rev: 1, selfHash: 'c'.repeat(64) },
    };
    const keys = serializeManifest(manifest, config)
      .split('\n')
      .filter((line) => /^[a-zA-Z]/.test(line))
      .map((line) => line.split(':')[0]);
    assert.deepEqual(keys, ['id', 'slug', 'title', 'track', 'legacyId', 'gates', 'meta']);
  });

  it('selfHash не зависит от meta и ломается при ручной правке файла', () => {
    const { root } = createTree([{ dir: 'back/001-api-skeleton' }]);
    const file = join(root, 'back', '001-api-skeleton', MANIFEST_FILE);
    const written = writeManifest(file, newManifest({ ...BASE, id: 'back/001', slug: 'api-skeleton' }, config), config);

    const patched = readFileSync(file, 'utf8').replace(written.title, 'Подменённый заголовок');
    writeFileSync(file, patched, 'utf8');

    const tampered = readManifest(file, config);
    assert.equal(tampered.title, 'Подменённый заголовок');
    assert.equal(verifySelfHash(tampered, config), false);
    assert.equal(verifySelfHash(written, config), true);

    const bumped: TaskManifest = { ...written, meta: { rev: written.meta.rev + 41, selfHash: written.meta.selfHash } };
    assert.equal(computeSelfHash(bumped, config), computeSelfHash(written, config));
  });

  it('пустой selfHash в файле — не манифест инструмента', () => {
    assert.throws(
      () => parseManifest(serializeManifest(newManifest(BASE, config), config), config, 'fixture'),
      /meta.selfHash пуст/,
    );
  });

  it('битый YAML сообщает об этом, а не падает стеком', () => {
    assert.throws(() => parseManifest('id: [back/001\n', config, 'fixture'), /не разбирается как YAML/);
  });
});

describe('manifest — валидация схемы', () => {
  it('принимает корректный манифест', () => {
    const manifest = validateManifest(raw(), config, 'fixture');
    assert.equal(manifest.id, 'back/001');
    assert.equal(manifest.gates.brief?.approvedAt, '2026-08-01');
  });

  it('неизвестное поле — ошибка на любом уровне', () => {
    expectProblem(raw({ owner: 'dm' }), 'неизвестное поле "owner"');
    expectProblem(raw({ queue: { after: [], why: 'потому что' } }), 'queue: неизвестное поле "why"');
    expectProblem(raw({ workspace: { branch: 'x', pr: 'y' } }), 'workspace: неизвестное поле "pr"');
    expectProblem(raw({ links: { jira: 'y' } }), 'links: неизвестное поле "jira"');
    expectProblem(raw({ meta: { rev: 1, selfHash: 'b'.repeat(64), extra: 1 } }), 'meta: неизвестное поле "extra"');
    expectProblem(
      raw({ gates: { ...(raw().gates as object), brief: { status: 'черновик', note: 'x' } } }),
      'gates.brief: неизвестное поле "note"',
    );
  });

  it('id проверяется против типов и ширины номера из конфига', () => {
    expectProblem(raw({ id: 'back/1' }), 'id: значение "back/1"');
    expectProblem(raw({ id: 'infra/001' }), 'id: значение "infra/001"');
    expectProblem(raw({ id: 'back/001-api-skeleton' }), 'id: значение');
    assert.equal(validateManifest(raw({ id: 'front/ui/001' }), config, 'fixture').id, 'front/ui/001');
  });

  it('legacyId принимает и одно значение, и список', () => {
    assert.equal(validateManifest(raw({ legacyId: 'infra-001' }), config, 'fixture').legacyId, 'infra-001');
    assert.deepEqual(
      validateManifest(raw({ legacyId: ['004', 'infra-001'] }), config, 'fixture').legacyId,
      ['004', 'infra-001'],
    );
  });

  it('legacyId отвергает пустой список, дубли и не-строки', () => {
    expectProblem(raw({ legacyId: [] }), 'legacyId: пустой список');
    expectProblem(raw({ legacyId: ['004', '004'] }), 'legacyId: повторяющиеся значения');
    expectProblem(raw({ legacyId: [''] }), 'legacyId[0]');
    expectProblem(raw({ legacyId: ['004', 7] }), 'legacyId[1]');
    expectProblem(raw({ legacyId: '' }), 'legacyId');
  });

  it('legacyIds нормализует форму хранения к списку', () => {
    const single = validateManifest(raw({ legacyId: 'infra-001' }), config, 'fixture');
    const many = validateManifest(raw({ legacyId: ['004', 'infra-001'] }), config, 'fixture');
    assert.deepEqual(legacyIds(single), ['infra-001']);
    assert.deepEqual(legacyIds(many), ['004', 'infra-001']);
    assert.deepEqual(legacyIds(validateManifest(raw(), config, 'fixture')), []);
    legacyIds(many).push('подделка');
    assert.deepEqual(many.legacyId, ['004', 'infra-001'], 'копия не должна протекать в манифест');
  });

  it('слаг и трек ограничены словарём', () => {
    expectProblem(raw({ slug: 'API Skeleton' }), 'slug');
    expectProblem(raw({ track: 'medium' }), 'неизвестный трек "medium"');
  });

  it('состав гейтов должен точно совпадать с треком', () => {
    const gates = raw().gates as Record<string, unknown>;
    const { adr, ...withoutAdr } = gates;
    assert.ok(adr);
    expectProblem(raw({ gates: withoutAdr }), 'отсутствует гейт "adr"');
    expectProblem(raw({ gates: { ...gates, setup: { status: 'черновик' } } }), 'гейт "setup" не входит в трек "full"');
    expectProblem(raw({ gates: [] }), 'gates: ожидался объект');
  });

  it('статус гейта — только из словаря конфига', () => {
    expectProblem(raw({ gates: { ...(raw().gates as object), plan: { status: 'approved' } } }), 'вне словаря статусов');
  });

  it('черновик не может нести approvedAt и sha256', () => {
    expectProblem(
      raw({ gates: { ...(raw().gates as object), plan: { status: 'черновик', approvedAt: '2026-08-01' } } }),
      'не может быть approvedAt/sha256',
    );
  });

  it('формат даты и хэша проверяется', () => {
    expectProblem(
      raw({ gates: { ...(raw().gates as object), brief: { status: 'согласовано', approvedAt: '13.08.2026' } } }),
      'approvedAt',
    );
    expectProblem(
      raw({ gates: { ...(raw().gates as object), brief: { status: 'согласовано', sha256: 'ZZZ' } } }),
      'sha256',
    );
  });

  it('meta обязательна и типизирована', () => {
    const { meta, ...withoutMeta } = raw();
    assert.ok(meta);
    expectProblem(withoutMeta, 'meta: ожидался объект');
    expectProblem(raw({ meta: { rev: -1, selfHash: 'b'.repeat(64) } }), 'meta.rev');
    expectProblem(raw({ meta: { rev: 1, selfHash: 'nope' } }), 'meta.selfHash');
  });

  it('списки — строки без повторов', () => {
    expectProblem(raw({ depends: ['back/001', 'back/001'] }), 'повторяющиеся значения');
    expectProblem(raw({ depends: 'back/001' }), 'depends: ожидался массив строк');
    expectProblem(raw({ uispec: [''] }), 'uispec[0]');
  });

  it('пустые необязательные блоки не попадают в результат', () => {
    const manifest = validateManifest(raw({ depends: [], queue: {}, uispec: [] }), config, 'fixture');
    assert.equal(manifest.depends, undefined);
    assert.equal(manifest.queue, undefined);
    assert.equal(manifest.uispec, undefined);
  });
});
