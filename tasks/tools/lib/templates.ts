import { trackOf, type TasksConfig } from './config.ts';

/** Плейсхолдер id в шаблонах: подставляется при `task new` и `task promote`. */
export const ID_PLACEHOLDER = '<id>';
const TITLE_PLACEHOLDER = 'Название';

const BRIEF = `# ${ID_PLACEHOLDER} — ${TITLE_PLACEHOLDER}

## Контекст и проблема

## Цель

## Зависимости

## Пользовательские сценарии

## Функциональные требования

## Нефункциональные требования

## API impact

\`NONE | CHANGE | UNKNOWN\`

## Acceptance criteria

## Non-goals

## Связанные документы
`;

const ADR = `# Architecture decision — ${ID_PLACEHOLDER}

## Контекст

## Решение

## Затронутые компоненты

## Последствия и компромиссы

## Рассмотренные альтернативы

## Совместимость и миграция
`;

const PLAN = `# План ${ID_PLACEHOLDER}

## Декомпозиция

| ID | Цель / проблема | Решение | Состояние |
|---|---|---|---|
| P01 |  |  | в плане |

Допустимые состояния:

\`\`\`text
в плане
выполняется
завершено
\`\`\`

## Порядок и зависимости

## Обязательные проверки

Полный список — в корневом \`AGENTS.md\`, результаты фиксируются в \`result.md\`.

- [ ] \`npm run uispec:validate\` — при изменениях в \`docs/ui-spec-kit/\` или UI-коде \`apps/client/\` (входит в \`npm test\`, в клоне без \`docs/\` скипается)

## Блокеры и открытые вопросы
`;

const RESULT = `# Результат ${ID_PLACEHOLDER}

## Итог

## Что изменено

## Контракт и generated-артефакты

## База данных и миграции

## Выполненные проверки

## Отклонения от brief / ADR / plan

## Известные ограничения и риски

## Описание для MR

### Summary

### Changes

### Verification

### Known limitations
`;

const TASK_LITE = `# ${ID_PLACEHOLDER} — ${TITLE_PLACEHOLDER}

## Контекст и цель

## Решение

## Чеклист

| ID | Цель / проблема | Решение | Состояние |
|---|---|---|---|

## Результат и проверки
`;

/** Разделы документов трека full — их же собирает `promote` при эскалации lite → full. */
export const FULL_TEMPLATES: Record<string, string> = {
  'brief.md': BRIEF,
  'adr.md': ADR,
  'plan.md': PLAN,
  'result.md': RESULT,
};

export const LITE_TEMPLATES: Record<string, string> = { 'task.md': TASK_LITE };

const KNOWN: Record<string, Record<string, string>> = { full: FULL_TEMPLATES, lite: LITE_TEMPLATES };

/**
 * Скелеты документов трека. Треки full и lite несут готовые разделы процесса; трек с другим
 * именем получает минимальный каркас по гейтам конфига — инструмент остаётся project-agnostic.
 */
export function trackTemplates(track: string, config: TasksConfig): Record<string, string> {
  const known = KNOWN[track];
  if (known) return known;

  const spec = trackOf(config, track);
  const templates: Record<string, string> = {};
  for (const gate of spec.gates) {
    if (gate.file in templates) continue;
    const sections = spec.gates.filter((other) => other.file === gate.file).map((other) => `## ${other.name}`);
    const items = spec.items.file === gate.file
      ? ['', spec.items.section ?? '## Пункты', '', '| ID | Цель / проблема | Решение | Состояние |', '|---|---|---|---|']
      : [];
    templates[gate.file] = [`# ${ID_PLACEHOLDER} — ${TITLE_PLACEHOLDER}`, '', ...sections.flatMap((s) => [s, '']), ...items, ''].join('\n');
  }
  return templates;
}

/** Подстановка id и заголовка задачи; `Название` меняется только в строке заголовка документа. */
export function renderTemplate(text: string, id: string, title: string): string {
  const lines = text.split('\n');
  const heading = lines.findIndex((line) => line.startsWith('# '));
  if (heading >= 0) lines[heading] = lines[heading]!.replace(TITLE_PLACEHOLDER, title);
  return lines.join('\n').split(ID_PLACEHOLDER).join(id);
}

/** Конфиг для нового проекта: образец, который владелец правит под свои типы и треки. */
export const DEFAULT_CONFIG = {
  types: ['contract', 'infra', 'back', 'front/ui', 'front/guest', 'front/owner', 'process'],
  archiveDir: 'archive',
  templateDir: '_template',
  registryFile: 'REGISTRY.md',
  numberWidth: 3,
  statuses: { draft: 'черновик', approved: 'согласовано' },
  itemStates: ['в плане', 'выполняется', 'завершено'],
  tracks: {
    full: {
      gates: [
        { name: 'brief', file: 'brief.md' },
        { name: 'adr', file: 'adr.md' },
        { name: 'plan', file: 'plan.md', hash: 'ignore-state-column' },
        { name: 'result', file: 'result.md' },
      ],
      items: { file: 'plan.md' },
    },
    lite: {
      gates: [
        { name: 'setup', file: 'task.md', hash: 'until:## Чеклист' },
        { name: 'result', file: 'task.md' },
      ],
      items: { file: 'task.md', section: '## Чеклист' },
    },
  },
};
