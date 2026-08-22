import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';
import { CliError } from '../lib/cli.ts';
import { loadConfig } from '../lib/config.ts';
import { initCommand, newCommand } from '../lib/create.ts';
import { MANIFEST_FILE } from '../lib/manifest.ts';
import { statusCommand } from '../lib/status.ts';
import { cleanupTrees, context, createTree, REPO_TASKS_ROOT, tempRoot, type Tree } from './helpers.ts';

after(cleanupTrees);

/** Дерево с конфигом фикстуры и материализованными шаблонами — исходная точка для `new`. */
function tree(): Tree {
  const built = createTree([]);
  initCommand(built.root);
  return built;
}

const filesIn = (root: string, dir: string) => readdirSync(join(root, ...dir.split('/'))).sort();
const read = (root: string, path: string) => readFileSync(join(root, ...path.split('/')), 'utf8');

describe('init', () => {
  it('на пустом каталоге создаёт конфиг и шаблоны обоих треков', () => {
    const root = tempRoot();
    const out = initCommand(root);

    assert.match(out, /^Создано \(6\):$/m);
    assert.match(out, /tasks\.config\.json/);
    assert.match(out, /Проверьте tasks\.config\.json: типы задач и треки правит владелец/);

    const config = loadConfig(root);
    assert.deepEqual(Object.keys(config.tracks), ['full', 'lite']);
    assert.deepEqual(filesIn(root, '_template/full'), ['adr.md', 'brief.md', 'plan.md', 'result.md']);
    assert.deepEqual(filesIn(root, '_template/lite'), ['task.md']);
    assert.match(read(root, '_template/lite/task.md'), /^## Чеклист$/m);
    assert.match(read(root, '_template/full/plan.md'), /\| ID \| Цель \/ проблема \| Решение \| Состояние \|/);
  });

  it('повторный запуск ничего не перезаписывает', () => {
    const root = tempRoot();
    initCommand(root);
    writeFileSync(join(root, '_template', 'full', 'brief.md'), '# правка владельца\n', 'utf8');

    const out = initCommand(root);
    assert.match(out, /Создавать нечего/);
    assert.match(out, /Уже было \(3\)/);
    assert.equal(read(root, '_template/full/brief.md'), '# правка владельца\n');
  });

  it('конфиг проекта не трогается, недостающие шаблоны дописываются', () => {
    const built = createTree([]);
    const before = read(built.root, 'tasks.config.json');
    const out = initCommand(built.root);

    assert.equal(read(built.root, 'tasks.config.json'), before);
    assert.match(out, /Уже было \(1\)/);
    assert.ok(existsSync(join(built.root, '_template', 'full', 'brief.md')));
  });
});

describe('new — полный трек', () => {
  it('заводит директорию, документы и манифест', () => {
    const built = tree();
    const out = newCommand(context(built), ['back', 'api-skeleton', '--title', 'REST-каркас']);

    assert.deepEqual(filesIn(built.root, 'back/001-api-skeleton'), ['adr.md', 'brief.md', 'plan.md', 'result.md', 'task.yaml']);
    assert.match(out, /Создана задача back\/001 — REST-каркас \(трек full\)/);
    assert.match(out, /tasks\/back\/001-api-skeleton\/task\.yaml/);
    assert.match(out, /1\. заполнить brief\.md/);
    assert.match(out, /2\. после явного «согласовано» владельца → scripts\/task approve back\/001 brief/);
  });

  it('подставляет id и заголовок в документы', () => {
    const built = tree();
    newCommand(context(built), ['back', 'api-skeleton', '--title', 'REST-каркас']);

    assert.match(read(built.root, 'back/001-api-skeleton/brief.md'), /^# back\/001 — REST-каркас$/m);
    assert.match(read(built.root, 'back/001-api-skeleton/adr.md'), /^# Architecture decision — back\/001$/m);
    assert.match(read(built.root, 'back/001-api-skeleton/plan.md'), /^# План back\/001$/m);
    assert.match(read(built.root, 'back/001-api-skeleton/result.md'), /^# Результат back\/001$/m);
    assert.ok(!read(built.root, 'back/001-api-skeleton/brief.md').includes('<id>'));
  });

  it('манифест заводится инструментом: гейты трека в черновике', () => {
    const built = tree();
    newCommand(context(built), ['back', 'api-skeleton']);
    const config = built.config;
    const manifest = loadConfig(built.root) && readFileSync(join(built.root, 'back', '001-api-skeleton', MANIFEST_FILE), 'utf8');

    assert.match(manifest, /^id: back\/001$/m);
    assert.match(manifest, /^slug: api-skeleton$/m);
    assert.match(manifest, /^title: Api skeleton$/m, 'без --title заголовок выводится из слага');
    assert.match(manifest, /^track: full$/m);
    assert.match(manifest, /selfHash: [0-9a-f]{64}/);
    assert.equal((manifest.match(/status: черновик/g) ?? []).length, config.tracks.full!.gates.length);
    assert.match(statusCommand(context(built), ['back/001']), /стадия: постановка/);
  });

  it('номер выдаётся сквозной по типу', () => {
    const built = tree();
    newCommand(context(built), ['back', 'api-skeleton']);
    newCommand(context(built), ['back', 'slot-engine']);
    newCommand(context(built), ['front/guest', 'guest-screens']);

    assert.ok(existsSync(join(built.root, 'back', '002-slot-engine')));
    assert.ok(existsSync(join(built.root, 'front', 'guest', '001-guest-screens')));
  });
});

describe('new — lite и стабы', () => {
  it('--lite создаёт один task.md и гейты setup/result', () => {
    const built = tree();
    const out = newCommand(context(built), ['process', 'tasks-rework', '--lite']);

    assert.deepEqual(filesIn(built.root, 'process/001-tasks-rework'), ['task.md', 'task.yaml']);
    assert.match(read(built.root, 'process/001-tasks-rework/task.md'), /^# process\/001 — Tasks rework$/m);
    assert.match(out, /трек lite/);
    assert.match(out, /1\. заполнить task\.md/);
    assert.match(out, /approve process\/001 setup/);
  });

  it('--stub создаёт только манифест — стадия «заявлена»', () => {
    const built = tree();
    const out = newCommand(context(built), ['back', 'database-persistence', '--stub']);

    assert.deepEqual(filesIn(built.root, 'back/001-database-persistence'), ['task.yaml']);
    assert.match(out, /Создан стаб back\/001/);
    assert.match(out, /стадия «заявлена»/);
    assert.match(statusCommand(context(built), ['back/001']), /стадия: заявлена/);
  });
});

describe('new — отказы', () => {
  it('неизвестный тип и слаг не в kebab-case отвергаются', () => {
    const built = tree();
    assert.throws(() => newCommand(context(built), ['infra', 'compose']), /неизвестный тип задачи "infra"/);
    assert.throws(() => newCommand(context(built), ['back', 'API Skeleton']), /не в kebab-case/);
    assert.throws(() => newCommand(context(built), ['back', 'Api-Skeleton']), /не в kebab-case/);
    assert.throws(() => newCommand(context(built), ['back']), CliError);
    assert.throws(() => newCommand(context(built), ['back', 'api', '--full']), /неизвестный флаг "--full"/);
  });

  it('без шаблонов трека команда отсылает к init', () => {
    const built = createTree([]);
    assert.throws(() => newCommand(context(built), ['back', 'api-skeleton']), /шаблоны трека "full" не найдены.*scripts\/task init/s);
    assert.ok(!existsSync(join(built.root, 'back', '001-api-skeleton')), 'директория не создаётся до проверки шаблонов');
  });
});

describe('шаблоны проекта', () => {
  it('в дереве задач лежат оба трека', () => {
    assert.deepEqual(filesIn(REPO_TASKS_ROOT, '_template/full'), ['adr.md', 'brief.md', 'plan.md', 'result.md']);
    assert.deepEqual(filesIn(REPO_TASKS_ROOT, '_template/lite'), ['task.md']);
    for (const name of ['brief.md', 'adr.md', 'plan.md', 'result.md']) {
      const text = read(REPO_TASKS_ROOT, `_template/full/${name}`);
      assert.ok(!text.startsWith('---'), `${name}: документы больше не носят frontmatter`);
      assert.match(text, /<id>/, `${name}: плейсхолдер id должен подставляться при new`);
    }
  });
});
