import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { parseConfig, type TasksConfig } from '../lib/config.ts';
import { newManifest, type TaskManifest } from '../lib/manifest.ts';
import {
  computeStage,
  normalizeState,
  parseItems,
  sectionLines,
  splitRow,
  type StageName,
  type TaskDocuments,
} from '../lib/stage.ts';
import { FIXTURES_DIR, RAW_FIXTURE_CONFIG } from './helpers.ts';

const config: TasksConfig = parseConfig(RAW_FIXTURE_CONFIG, 'fixture');
const PLAN = readFileSync(join(FIXTURES_DIR, 'docs', 'plan-full.md'), 'utf8');
const LITE = readFileSync(join(FIXTURES_DIR, 'docs', 'task-lite.md'), 'utf8');

const APPROVED = 'согласовано';
const DRAFT = 'черновик';

function manifest(track: string, statuses: string[]): TaskManifest {
  const base = newManifest({ id: 'back/001', slug: 'api-skeleton', title: 'Задача', track }, config);
  Object.keys(base.gates).forEach((name, index) => {
    base.gates[name] = { status: statuses[index] ?? DRAFT };
  });
  return base;
}

function stageOf(track: string, statuses: string[], documents: TaskDocuments): {
  stage: StageName;
  activeGate?: string;
  progress?: { done: number; total: number };
} {
  const info = computeStage(manifest(track, statuses), documents, config);
  const result: { stage: StageName; activeGate?: string; progress?: { done: number; total: number } } = {
    stage: info.stage,
  };
  if (info.activeGate !== undefined) result.activeGate = info.activeGate;
  if (info.progress) result.progress = info.progress;
  return result;
}

const ALL_DONE = ['| ID | Шаг | Состояние |', '|---|---|---|', '| P01 | Раз | завершено |'].join('\n');
const HALF_DONE = [
  '| ID | Шаг | Состояние |',
  '|---|---|---|',
  '| P01 | Раз | завершено |',
  '| P02 | Два | выполняется |',
].join('\n');

describe('stage — разбор таблицы пунктов', () => {
  it('разбивает строку по неэкранированным разделителям', () => {
    assert.deepEqual(splitRow('| a | b | c |'), ['a', 'b', 'c']);
    assert.deepEqual(splitRow('| a | `x \\| y` | c |'), ['a', '`x | y`', 'c']);
    assert.deepEqual(splitRow('| a | путь C:\\dir | c |'), ['a', 'путь C:\\dir', 'c']);
    assert.deepEqual(splitRow('| a |  | c |'), ['a', '', 'c']);
  });

  it('находит первую таблицу пунктов в реальном формате плана', () => {
    const items = parseItems(PLAN, { states: config.itemStates });
    assert.deepEqual(items.map((item) => item.id), ['P01', 'P02', 'P03', 'P04', 'P05']);
    assert.deepEqual(items.map((item) => item.state), [
      'завершено',
      'завершено',
      'выполняется',
      'в плане',
      'завершено',
    ]);
    assert.equal(items[0]?.cells.length, 4);
  });

  it('узнаёт состояние, к которому дописано обоснование', () => {
    const items = parseItems(PLAN, { states: config.itemStates });
    const annotated = items.find((item) => item.id === 'P05');
    assert.equal(annotated?.state, 'завершено');
    assert.match(annotated?.stateRaw ?? '', /^завершено — подтверждено эмпирически/);

    assert.equal(normalizeState('завершено', config.itemStates), 'завершено');
    assert.equal(normalizeState('завершено — почему', config.itemStates), 'завершено');
    assert.equal(normalizeState('в плане (после P03)', config.itemStates), 'в плане');
    assert.equal(normalizeState('заблокировано', config.itemStates), '', 'состояние вне словаря не выдумывается');
    assert.equal(normalizeState('завершеноX', config.itemStates), '', 'префикс без границы слова не считается');
    assert.equal(normalizeState('что угодно'), 'что угодно', 'без словаря состояние берётся как есть');
  });

  it('снимает экранирование разделителя внутри ячейки', () => {
    const items = parseItems(PLAN);
    assert.match(items[0]?.cells[2] ?? '', /test ! -d tasks \|\|/);
    assert.ok(!items[0]?.cells[2]?.includes('\\|'));
  });

  it('не путает таблицу пунктов с соседними таблицами и блоками кода', () => {
    const items = parseItems(PLAN);
    assert.ok(!items.some((item) => item.id === 'AC1'), 'таблица AC не должна попадать в пункты');
    assert.ok(!items.some((item) => item.id === 'back-001'), 'таблица миграции не должна попадать в пункты');
    assert.ok(!items.some((item) => item.id.startsWith('это не таблица')));
  });

  it('для lite читает только секцию чеклиста', () => {
    const items = parseItems(LITE, { section: '## Чеклист' });
    assert.deepEqual(items.map((item) => item.id), ['C1', 'C2', 'C3']);
    assert.deepEqual(items.map((item) => item.state), ['завершено', 'завершено', 'в плане']);
    assert.deepEqual(parseItems(LITE).map((item) => item.id), ['V1'], 'без секции берётся первая таблица документа');
  });

  it('секция обрывается следующим заголовком того же уровня', () => {
    const lines = sectionLines(LITE.split('\n'), '## Чеклист');
    assert.ok(lines.some((line) => line.includes('C3')));
    assert.ok(!lines.some((line) => line.includes('Пока пусто')));
    assert.deepEqual(sectionLines(LITE.split('\n'), '## Нет такой секции'), []);
    assert.deepEqual(parseItems(LITE, { section: '## Нет такой секции' }), []);
  });

  it('документ без таблицы пунктов даёт пустой список', () => {
    assert.deepEqual(parseItems('# Заголовок\n\nтекст без таблиц\n'), []);
    assert.deepEqual(parseItems('| Старый id | Новый путь |\n|---|---|\n| a | b |\n'), []);
    assert.deepEqual(parseItems('| ID | Шаг | Состояние |\n| P01 | без разделителя | в плане |\n'), []);
  });
});

describe('stage — матрица full', () => {
  const docs = (over: TaskDocuments = {}): TaskDocuments => ({
    'brief.md': null,
    'adr.md': null,
    'plan.md': null,
    'result.md': null,
    ...over,
  });

  it('заявлена: только стаб task.yaml', () => {
    assert.deepEqual(stageOf('full', [DRAFT, DRAFT, DRAFT, DRAFT], docs()), {
      stage: 'заявлена',
      activeGate: 'brief',
    });
  });

  it('постановка: brief в черновике', () => {
    assert.deepEqual(stageOf('full', [DRAFT, DRAFT, DRAFT, DRAFT], docs({ 'brief.md': '# brief' })), {
      stage: 'постановка',
      activeGate: 'brief',
    });
  });

  it('проектирование: brief согласован, adr или plan в черновике', () => {
    assert.deepEqual(
      stageOf('full', [APPROVED, DRAFT, DRAFT, DRAFT], docs({ 'brief.md': '# brief', 'adr.md': '# adr' })),
      { stage: 'проектирование', activeGate: 'adr' },
    );
    assert.deepEqual(
      stageOf('full', [APPROVED, APPROVED, DRAFT, DRAFT], docs({ 'brief.md': '# brief', 'plan.md': HALF_DONE })),
      { stage: 'проектирование', activeGate: 'plan', progress: { done: 1, total: 2 } },
    );
  });

  it('реализация: постановочные гейты согласованы, пункты не закрыты', () => {
    assert.deepEqual(
      stageOf('full', [APPROVED, APPROVED, APPROVED, DRAFT], docs({ 'brief.md': '#', 'plan.md': HALF_DONE })),
      { stage: 'реализация', activeGate: 'result', progress: { done: 1, total: 2 } },
    );
  });

  it('результат: пункты закрыты, result в черновике', () => {
    assert.deepEqual(
      stageOf('full', [APPROVED, APPROVED, APPROVED, DRAFT], docs({ 'brief.md': '#', 'plan.md': ALL_DONE })),
      { stage: 'результат', activeGate: 'result', progress: { done: 1, total: 1 } },
    );
  });

  it('результат: плана без пунктов достаточно, чтобы не застрять в реализации', () => {
    assert.deepEqual(
      stageOf('full', [APPROVED, APPROVED, APPROVED, DRAFT], docs({ 'brief.md': '#', 'plan.md': '# план' })),
      { stage: 'результат', activeGate: 'result' },
    );
  });

  it('завершена: все гейты согласованы', () => {
    assert.deepEqual(
      stageOf('full', [APPROVED, APPROVED, APPROVED, APPROVED], docs({ 'brief.md': '#', 'plan.md': ALL_DONE })),
      { stage: 'завершена', progress: { done: 1, total: 1 } },
    );
  });

  it('прогресс считается по живому плану задачи', () => {
    const info = computeStage(
      manifest('full', [APPROVED, APPROVED, APPROVED, DRAFT]),
      { 'brief.md': '#', 'adr.md': '#', 'plan.md': PLAN, 'result.md': null },
      config,
    );
    assert.equal(info.stage, 'реализация');
    assert.deepEqual(info.progress, { done: 3, total: 5 }, 'пункт с обоснованием в состоянии тоже считается закрытым');
  });
});

describe('stage — матрица lite', () => {
  const docs = (content: string | null): TaskDocuments => ({ 'task.md': content });

  it('заявлена: task.md ещё нет', () => {
    assert.deepEqual(stageOf('lite', [DRAFT, DRAFT], docs(null)), { stage: 'заявлена', activeGate: 'setup' });
  });

  it('постановка: setup в черновике — прогресс уже виден, стадию он не двигает', () => {
    assert.deepEqual(stageOf('lite', [DRAFT, DRAFT], docs(LITE)), {
      stage: 'постановка',
      activeGate: 'setup',
      progress: { done: 2, total: 3 },
    });
  });

  it('проектирования у lite нет: после setup сразу реализация', () => {
    assert.deepEqual(stageOf('lite', [APPROVED, DRAFT], docs(LITE)), {
      stage: 'реализация',
      activeGate: 'result',
      progress: { done: 2, total: 3 },
    });
  });

  it('результат: чеклист закрыт', () => {
    const closed = LITE.replace('| C3 | Обновить README | в плане |', '| C3 | Обновить README | завершено |');
    assert.deepEqual(stageOf('lite', [APPROVED, DRAFT], docs(closed)), {
      stage: 'результат',
      activeGate: 'result',
      progress: { done: 3, total: 3 },
    });
  });

  it('завершена: оба гейта согласованы', () => {
    assert.deepEqual(stageOf('lite', [APPROVED, APPROVED], docs(LITE)), {
      stage: 'завершена',
      progress: { done: 2, total: 3 },
    });
  });
});
