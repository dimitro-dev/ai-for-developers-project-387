import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { CliError, parseFlags, type CommandContext } from './cli.ts';
import { CONFIG_FILE, trackOf, type TasksConfig } from './config.ts';
import { gateHash } from './gates.ts';
import { MANIFEST_FILE, newManifest, writeManifest, type Gate, type Queue } from './manifest.ts';

/**
 * Разовый перенос дотипового каталога `tasks/` в схему `<тип>/<номер>-<слаг>/` (P14 задачи
 * process/001). Команда остаётся в инструменте как документация переноса: все данные миграции —
 * литеральные таблицы ниже, поэтому «что и куда уехало» читается здесь, а не восстанавливается
 * из истории. Повторно не запускается: пре-флайт требует, чтобы исходные директории были на
 * месте, а целевые отсутствовали.
 */

/** Дотиповая эпоха: переезжает в `archive/` без переименования, содержимое не трогается вовсе. */
const ARCHIVE: Array<{ from: string; to: string }> = [
  { from: 'task-000', to: '000' },
  { from: 'task-001', to: '001' },
  { from: 'task-002', to: '002' },
  { from: 'task-003', to: '003' },
  { from: 'task-006', to: '006' },
];

/** Задача, декомпозированная до миграции: директория удаляется, след остаётся в legacyNotes. */
const REMOVED_DIR = 'task-front-001';
const REMOVED_NOTE = {
  id: 'front-001',
  note: 'декомпозирована 2026-08-12 на front/ui/001 и линейку front/guest; FR и acceptance criteria распределены по их brief',
};

/**
 * Гейты мигрируемой задачи: `approved` — все согласованы без известных дат, `draft` — все в
 * черновике, карта — дата согласования по имени гейта (отсутствующий в карте гейт — черновик).
 */
type GatesSpec = 'approved' | 'draft' | Record<string, string>;

interface MigrationSpec {
  from: string;
  /** Новый путь от корня `tasks/`: `<тип>/<номер>-<слаг>`. */
  to: string;
  legacyId: string | string[];
  track: string;
  depends?: string[];
  queue?: Queue;
  gates: GatesSpec;
  /**
   * «Заявленная» задача: реальный brief в черновике, а adr/plan/result — нетронутый скаффолд.
   * Пустышки удаляются (ADR §4), их вернёт `task new` при старте работы.
   */
  declared?: boolean;
}

/**
 * Соответствие старых директорий новым путям. `depends` — только id задач новой схемы: ссылки
 * на архивные 000–006 опущены сознательно (ADR §7), не-задачные условия остаются текстом в brief.
 * `queue` — из «Плана разработки» старого README: `after` задаёт линейную цепочку очереди.
 */
const TASKS: MigrationSpec[] = [
  {
    from: 'task-contract-001',
    to: 'contract/001-guest-flow-extensions',
    legacyId: 'contract-001',
    track: 'full',
    depends: ['infra/005', 'front/ui/001', 'infra/004'],
    queue: {
      after: ['infra/005'],
      parallel: ['front/ui/002'],
      rationale: 'Контракт вперёд кода: расширения по макету гостевого флоу и гапы G1, G2, G4 — дешевле до реализации backend',
    },
    gates: 'approved',
  },
  {
    from: 'task-infra-001',
    to: 'infra/001-postgres-compose',
    legacyId: ['infra-001', '004'],
    track: 'full',
    queue: {
      after: ['front/guest/002'],
      rationale: 'Контейнер PostgreSQL — шаг к персистентности (back/002); Docker Engine — внешняя предпосылка',
    },
    gates: 'draft',
    declared: true,
  },
  {
    from: 'task-infra-002',
    to: 'infra/002-android-builder',
    legacyId: ['infra-002', '005'],
    track: 'full',
    queue: {
      after: ['front/owner/001'],
      rationale: 'Сборка APK в Docker; приоритет низкий — Android проверяется expo run:android на хосте; начинать со спайка QEMU',
    },
    gates: 'draft',
    declared: true,
  },
  {
    from: 'task-infra-003',
    to: 'infra/003-http-security',
    legacyId: ['infra-003', 'INFRA-001'],
    track: 'full',
    depends: ['back/001'],
    queue: {
      after: ['back/001'],
      rationale: 'CORS, security-заголовки, лимит тела — условие соединения web-клиента с реальным API',
    },
    gates: 'approved',
  },
  {
    from: 'task-infra-004',
    to: 'infra/004-contract-mock-prism',
    legacyId: 'infra-004',
    track: 'full',
    gates: 'approved',
  },
  {
    from: 'task-infra-005',
    to: 'infra/005-generated-entrypoints',
    legacyId: 'infra-005',
    track: 'full',
    queue: {
      after: [],
      rationale: 'Точки входа generated-пакетов: без exports пакеты не импортируются по имени; блокировала контракт и backend',
    },
    gates: 'approved',
  },
  {
    from: 'task-infra-006',
    to: 'infra/006-ci-release-please',
    legacyId: 'infra-006',
    track: 'full',
    queue: {
      after: ['infra/002'],
      rationale: 'CI + release-please; выполнена параллельно front/guest/002, первый релиз v0.2.0',
    },
    gates: { brief: '2026-08-15', adr: '2026-08-15', plan: '2026-08-15', result: '2026-08-15' },
  },
  {
    from: 'task-back-001',
    to: 'back/001-api-skeleton',
    legacyId: 'back-001',
    track: 'full',
    depends: ['infra/005', 'contract/001'],
    queue: {
      after: ['contract/001'],
      parallel: ['front/ui/002', 'front/guest/001', 'front/guest/002'],
      rationale: 'Каркас API по итоговому контракту 0.2.0; разблокировал infra/003 и сквозную проверку',
    },
    gates: 'approved',
  },
  {
    from: 'task-front-ui-001',
    to: 'front/ui/001-guest-uispec',
    legacyId: 'front-ui-001',
    track: 'full',
    gates: 'approved',
  },
  {
    from: 'task-front-ui-002',
    to: 'front/ui/002-guest-uispec-rebuild',
    legacyId: 'front-ui-002',
    track: 'full',
    depends: ['front/ui/001', 'contract/001'],
    queue: {
      after: ['infra/003'],
      parallel: ['contract/001', 'back/001'],
      rationale: 'Пересборка гостевого UISpec по канону от макета; спеки — документы, backend не ждут',
    },
    gates: 'approved',
  },
  {
    from: 'task-front-guest-001',
    to: 'front/guest/001-client-foundation',
    legacyId: 'front-guest-001',
    track: 'full',
    depends: ['front/ui/002', 'infra/004', 'infra/005'],
    queue: {
      after: ['front/ui/002'],
      rationale: 'Клиентский фундамент: дизайн-система по registry, SDK, guest-flow state, тестовая инфраструктура',
    },
    gates: { brief: '2026-08-12', adr: '2026-08-12', plan: '2026-08-12', result: '2026-08-13' },
  },
  {
    from: 'task-front-guest-002',
    to: 'front/guest/002-guest-screens',
    legacyId: 'front-guest-002',
    track: 'full',
    depends: ['front/ui/002', 'front/guest/001', 'infra/004', 'back/001', 'infra/003'],
    queue: {
      after: ['front/guest/001'],
      parallel: ['front/owner/001', 'infra/001'],
      rationale: 'Вертикальная задача: четыре гостевых экрана и сквозная проверка против реального API',
    },
    gates: { brief: '2026-08-13', adr: '2026-08-15', plan: '2026-08-15', result: '2026-08-15' },
  },
  {
    from: 'task-front-owner-001',
    to: 'front/owner/001-owner-screens',
    legacyId: 'front-owner-001',
    track: 'full',
    depends: ['back/001', 'front/guest/001'],
    queue: {
      after: ['back/003'],
      rationale: 'Экраны владельца; объём зависел от решения contract/001 по иконке и цвету типа встречи',
    },
    gates: 'draft',
    declared: true,
  },
  {
    from: 'task-process-001',
    to: 'process/001-tasks-rework',
    legacyId: 'process-001',
    track: 'full',
    queue: {
      after: ['infra/006'],
      rationale: 'Активная задача: инструмент task, треки full/lite, миграция каталога, растворение ролей',
    },
    gates: { brief: '2026-08-15', adr: '2026-08-15', plan: '2026-08-15' },
  },
];

interface StubSpec {
  to: string;
  title: string;
  track: string;
  depends?: string[];
  queue?: Queue;
}

/** Задачи очереди, которые ещё не заводились: только манифест, стадия «заявлена». */
const STUBS: StubSpec[] = [
  {
    to: 'back/002-database-persistence',
    title: 'Персистентность: схема БД, миграции и exclusion constraint',
    track: 'full',
    depends: ['infra/001'],
    queue: {
      after: ['infra/001'],
      rationale: 'Схема БД, миграции и exclusion constraint — последняя линия защиты от пересечения Booking, недостижимая на in-memory',
    },
  },
  {
    to: 'back/003-slot-engine-package',
    title: 'Вынесение Slot Engine в packages/slot-engine',
    track: 'full',
    depends: ['back/001'],
    queue: {
      after: ['back/002'],
      rationale: 'Вынесение Slot Engine в packages/slot-engine с полным набором доменных тестов',
    },
  },
];

/** Плоские шаблоны дотиповой эпохи: их место заняли `_template/full/` и `_template/lite/`. */
const FLAT_TEMPLATES = ['brief.md', 'adr.md', 'plan.md', 'result.md'];

/** Четыре lifecycle-документа: только у них снимается frontmatter (ADR §9). */
const LIFECYCLE = ['brief.md', 'adr.md', 'plan.md', 'result.md'];

const FRONTMATTER_RE = /^---\r?\nstatus:[^\n]*\r?\n---\r?\n(\r?\n)?/;
const TITLE_RE = /^#[ \t]+(.+)$/m;
const TITLE_PREFIX_RE = /^TASK-[A-Za-z0-9-]+\s+—\s+/;
const LINK_RE = /\[([^\]]*)\]\(([^)\s]+)\)/g;

/** Старая директория задачи → новый путь от корня `tasks/`. */
function pathMap(config: TasksConfig): Map<string, string> {
  const map = new Map<string, string>();
  for (const entry of ARCHIVE) map.set(entry.from, `${config.archiveDir}/${entry.to}`);
  for (const spec of TASKS) map.set(spec.from, spec.to);
  return map;
}

function id(spec: MigrationSpec | StubSpec): string {
  const slash = spec.to.lastIndexOf('/');
  return `${spec.to.slice(0, slash)}/${spec.to.slice(slash + 1).split('-')[0]}`;
}

function slugOf(spec: MigrationSpec | StubSpec): string {
  return spec.to.slice(spec.to.lastIndexOf('/') + 1).split('-').slice(1).join('-');
}

function titleFromBrief(file: string): string {
  const match = TITLE_RE.exec(readFileSync(file, 'utf8'));
  if (!match) throw new CliError(`${file}: не найден заголовок "# …" — из него берётся title задачи`);
  return match[1]!.replace(TITLE_PREFIX_RE, '').trim();
}

/**
 * Строки документа, которых нет в шаблоне: пустой список — документ остался нетронутым
 * скаффолдом, удалять его безопасно. Сверка построчная, потому что сам шаблон с тех пор
 * дополнялся: важно не «байт в байт», а «ни одной авторской строки».
 */
function templateResidue(document: string, template: string): string[] {
  const known = new Set(template.split(/\r?\n/).map((line) => line.trim()));
  return document
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== '' && !line.startsWith('# ') && !known.has(line));
}

function stripFrontmatter(text: string): string {
  return text.replace(FRONTMATTER_RE, '');
}

/** Путь от директории задачи к цели, заданной от корня `tasks/`. */
function relativeTarget(taskDir: string, target: string): string {
  const trailing = target.endsWith('/') ? '/' : '';
  const path = relative(taskDir, target.replace(/\/+$/, ''));
  return `${path}${trailing}`;
}

export interface LinkChange {
  file: string;
  from: string;
  to: string;
}

/**
 * Переписывание ссылок под новую глубину. Дотиповые задачи лежали на один уровень ниже `tasks/`,
 * новые — на два (front/* — на три), поэтому любая ссылка «наверх» становится короче нужного:
 * `](../task-…)` на другую задачу переписывается по карте переноса, всё остальное за пределами
 * директории (`](../README.md)` в `tasks/`, `](../../docs/…)` в корень репозитория) — удлинением
 * на разницу глубин. Ссылки на удалённую `front-001` становятся упоминанием без ссылки.
 */
export function rewriteLinks(text: string, taskDir: string, map: Map<string, string>): { text: string; changes: Array<{ from: string; to: string }> } {
  const changes: Array<{ from: string; to: string }> = [];
  const deeper = '../'.repeat(taskDir.split('/').length - 1);

  const next = text.replace(LINK_RE, (whole, label: string, target: string) => {
    const task = /^\.\.\/(task-[a-z0-9-]+)(\/.*)?$/.exec(target);
    if (task) {
      const rest = (task[2] ?? '').replace(/^\//, '');
      if (task[1] === REMOVED_DIR) {
        const mention = `\`${task[1]}${rest === '' ? '/' : `/${rest}`}\` — задача удалена: декомпозирована на front/ui/001 и линейку front/guest (таблица legacy-id в REGISTRY.md)`;
        changes.push({ from: whole, to: mention });
        return mention;
      }
      const moved = map.get(task[1]!);
      if (moved === undefined) return whole;
      const replacement = link(label, target, relativeTarget(taskDir, `${moved}/${rest}`));
      changes.push({ from: whole, to: replacement });
      return replacement;
    }

    if (target.startsWith('../')) {
      const replacement = link(label, target, `${deeper}${target}`);
      changes.push({ from: whole, to: replacement });
      return replacement;
    }
    return whole;
  });

  return { text: next, changes };
}

/**
 * Ссылка с новым адресом. Подпись правится только когда она сама — путь в кавычках-бэктиках
 * (`[\`../task-002/result.md\`](…)`); подпись-идентификатор (`\`task-contract-001\``) остаётся:
 * старые id продолжают жить в текстах и резолвятся через таблицу legacy-id.
 */
function link(label: string, oldTarget: string, newTarget: string): string {
  const inner = /^`(.+)`$/.exec(label)?.[1];
  const pathLike = inner !== undefined && inner.includes('/') && (inner === oldTarget || /(^|\/)task-[a-z0-9-]+(\/|$)/.test(inner));
  return `[${pathLike ? `\`${newTarget}\`` : label}](${newTarget})`;
}

function gateState(spec: GatesSpec, name: string): { approved: boolean; at?: string } {
  if (spec === 'approved') return { approved: true };
  if (spec === 'draft') return { approved: false };
  const at = spec[name];
  return at === undefined ? { approved: false } : { approved: true, at };
}

/** Гейты по историческим данным; sha256 считается с уже отредактированных документов. */
function buildGates(spec: MigrationSpec, dir: string, config: TasksConfig): Record<string, Gate> {
  const track = trackOf(config, spec.track);
  const gates: Record<string, Gate> = {};
  for (const gate of track.gates) {
    const state = gateState(spec.gates, gate.name);
    if (!state.approved) {
      gates[gate.name] = { status: config.statuses.draft };
      continue;
    }
    const file = join(dir, gate.file);
    if (!existsSync(file)) {
      throw new CliError(`${spec.to}: гейт "${gate.name}" согласован, а документа ${gate.file} нет`);
    }
    const entry: Gate = { status: config.statuses.approved };
    if (state.at !== undefined) entry.approvedAt = state.at;
    entry.sha256 = gateHash(readFileSync(file, 'utf8'), gate, track);
    gates[gate.name] = entry;
  }
  return gates;
}

function preflight(root: string, config: TasksConfig): void {
  const problems: string[] = [];
  const sources = [...ARCHIVE.map((entry) => entry.from), ...TASKS.map((spec) => spec.from), REMOVED_DIR];
  const targets = [
    ...ARCHIVE.map((entry) => `${config.archiveDir}/${entry.to}`),
    ...TASKS.map((spec) => spec.to),
    ...STUBS.map((spec) => spec.to),
  ];

  for (const source of sources) {
    if (!existsSync(join(root, source))) problems.push(`исходная директория ${source}/ отсутствует — миграция уже выполнена или дерево не то`);
  }
  for (const target of targets) {
    if (existsSync(join(root, target))) problems.push(`целевая директория ${target}/ уже существует`);
  }
  if (existsSync(join(root, config.registryFile))) {
    problems.push(`${config.registryFile} уже существует — миграция рассчитана на дерево до генерации реестра`);
  }
  for (const type of new Set([...TASKS, ...STUBS].map((spec) => spec.to.slice(0, spec.to.lastIndexOf('/'))))) {
    if (!config.types.includes(type)) problems.push(`тип "${type}" не описан в ${CONFIG_FILE}`);
  }
  if ((config.legacyNotes ?? []).some((note) => note.id === REMOVED_NOTE.id)) {
    problems.push(`legacyNotes уже содержит запись "${REMOVED_NOTE.id}"`);
  }

  // «Заявленные» задачи: удаляются только документы без авторского содержания.
  for (const spec of TASKS.filter((candidate) => candidate.declared)) {
    for (const name of LIFECYCLE.slice(1)) {
      const document = join(root, spec.from, name);
      const template = join(root, config.templateDir, name);
      if (!existsSync(document) || !existsSync(template)) continue;
      const residue = templateResidue(readFileSync(document, 'utf8'), readFileSync(template, 'utf8'));
      if (residue.length > 0) {
        problems.push(`${spec.from}/${name}: не пустой скаффолд, удалять нельзя — строки вне шаблона: ${residue.slice(0, 3).join(' / ')}`);
      }
    }
  }

  if (problems.length > 0) {
    throw new CliError(`migrate: пре-флайт не пройден, ничего не перенесено:\n${problems.map((problem) => `  - ${problem}`).join('\n')}`);
  }
}

function move(root: string, from: string, to: string): void {
  const target = join(root, to);
  mkdirSync(dirname(target), { recursive: true });
  renameSync(join(root, from), target);
}

/** Запись `legacyNotes` в конфиг точечной вставкой: файл владельца сохраняет своё форматирование. */
function appendLegacyNote(root: string): void {
  const file = join(root, CONFIG_FILE);
  const text = readFileSync(file, 'utf8');
  const close = text.lastIndexOf('\n}');
  if (close < 0) throw new CliError(`${CONFIG_FILE}: не найдена закрывающая скобка объекта — legacyNotes не записан`);
  const entry = `    { "id": ${JSON.stringify(REMOVED_NOTE.id)}, "note": ${JSON.stringify(REMOVED_NOTE.note)} }`;
  writeFileSync(file, `${text.slice(0, close)},\n  "legacyNotes": [\n${entry}\n  ]${text.slice(close)}`, 'utf8');
}

export function migrateCommand(ctx: CommandContext, args: string[]): string {
  if (parseFlags(args).positional.length > 0) throw new CliError('употребление: scripts/task migrate');
  const { root, config } = ctx;
  preflight(root, config);

  const map = pathMap(config);
  const report: string[] = [];
  const links: LinkChange[] = [];

  for (const entry of ARCHIVE) {
    move(root, entry.from, `${config.archiveDir}/${entry.to}`);
    report.push(`  ${entry.from}/ → ${config.archiveDir}/${entry.to}/ (как есть)`);
  }

  rmSync(join(root, REMOVED_DIR), { recursive: true, force: true });
  report.push(`  ${REMOVED_DIR}/ удалена — запись уходит в legacyNotes`);

  for (const spec of TASKS) {
    move(root, spec.from, spec.to);
    const dir = join(root, spec.to);
    const title = titleFromBrief(join(dir, LIFECYCLE[0]!));

    const dropped: string[] = [];
    if (spec.declared) {
      for (const name of LIFECYCLE.slice(1)) {
        const file = join(dir, name);
        if (!existsSync(file)) continue;
        rmSync(file);
        dropped.push(name);
      }
    }

    for (const name of readdirSync(dir).filter((entry) => entry.endsWith('.md')).sort()) {
      const file = join(dir, name);
      const before = readFileSync(file, 'utf8');
      const stripped = LIFECYCLE.includes(name) ? stripFrontmatter(before) : before;
      const { text, changes } = rewriteLinks(stripped, spec.to, map);
      if (text !== before) writeFileSync(file, text, 'utf8');
      for (const change of changes) links.push({ file: `${spec.to}/${name}`, ...change });
    }

    writeManifest(
      join(dir, MANIFEST_FILE),
      newManifest(
        {
          id: id(spec),
          slug: slugOf(spec),
          title,
          track: spec.track,
          legacyId: spec.legacyId,
          ...(spec.depends ? { depends: spec.depends } : {}),
          ...(spec.queue ? { queue: spec.queue } : {}),
          gates: buildGates(spec, dir, config),
        },
        config,
      ),
      config,
    );
    report.push(`  ${spec.from}/ → ${spec.to}/ — ${MANIFEST_FILE}${dropped.length > 0 ? `, удалены пустышки: ${dropped.join(', ')}` : ''}`);
  }

  for (const spec of STUBS) {
    const dir = join(root, spec.to);
    mkdirSync(dir, { recursive: true });
    writeManifest(
      join(dir, MANIFEST_FILE),
      newManifest(
        {
          id: id(spec),
          slug: slugOf(spec),
          title: spec.title,
          track: spec.track,
          ...(spec.depends ? { depends: spec.depends } : {}),
          ...(spec.queue ? { queue: spec.queue } : {}),
        },
        config,
      ),
      config,
    );
    report.push(`  стаб ${spec.to}/ — только ${MANIFEST_FILE}, стадия «заявлена»`);
  }

  appendLegacyNote(root);

  const templates: string[] = [];
  for (const name of FLAT_TEMPLATES) {
    const file = join(root, config.templateDir, name);
    if (!existsSync(file)) continue;
    rmSync(file);
    templates.push(name);
  }

  return [
    `Миграция выполнена: ${TASKS.length} задач перенесено, ${ARCHIVE.length} — в архив, ${STUBS.length} стаба заведено.`,
    ...report,
    `  ${config.templateDir}/: удалены плоские шаблоны (${templates.join(', ') || '—'}), остались full/ и lite/`,
    `  ${CONFIG_FILE}: добавлен legacyNotes для "${REMOVED_NOTE.id}"`,
    `  ссылок переписано: ${links.length} в ${new Set(links.map((change) => change.file)).size} файлах`,
    '',
    'Дальше:',
    '  1. scripts/task registry',
    '  2. scripts/task check',
  ].join('\n');
}
