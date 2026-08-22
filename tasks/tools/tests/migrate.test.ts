import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { rewriteLinks } from '../lib/migrate.ts';

/**
 * Карта переноса в том же виде, в каком её строит migrate: старая директория → путь от корня
 * `tasks/`. Проверяется арифметика глубины — из-за неё правятся не только ссылки на задачи.
 */
const MAP = new Map([
  ['task-002', 'archive/002'],
  ['task-back-001', 'back/001-api-skeleton'],
  ['task-front-ui-002', 'front/ui/002-guest-uispec-rebuild'],
]);

const rewrite = (text: string, dir: string) => rewriteLinks(text, dir, MAP).text;

describe('migrate — переписывание ссылок', () => {
  it('ссылка на задачу считается от новой глубины обеих сторон', () => {
    assert.equal(
      rewrite('[`../task-back-001/adr.md`](../task-back-001/adr.md)', 'infra/005-generated-entrypoints'),
      '[`../../back/001-api-skeleton/adr.md`](../../back/001-api-skeleton/adr.md)',
    );
    assert.equal(
      rewrite('[x](../task-front-ui-002/result.md)', 'front/guest/002-guest-screens'),
      '[x](../../ui/002-guest-uispec-rebuild/result.md)',
    );
  });

  it('ссылка на архивную задачу ведёт в archive/, слаг у неё не появляется', () => {
    assert.equal(rewrite('[x](../task-002/)', 'infra/003-http-security'), '[x](../../archive/002/)');
    assert.equal(rewrite('[x](../task-002/result.md)', 'front/guest/001-client-foundation'), '[x](../../../archive/002/result.md)');
  });

  it('ссылка за пределы задачи удлиняется на разницу глубин', () => {
    assert.equal(rewrite('[x](../../docs/architecture.md)', 'back/001-api-skeleton'), '[x](../../../docs/architecture.md)');
    assert.equal(rewrite('[x](../../AGENTS.md)', 'front/ui/001-guest-uispec'), '[x](../../../../AGENTS.md)');
    assert.equal(rewrite('[x](../README.md)', 'infra/004-contract-mock-prism'), '[x](../../README.md)');
    assert.equal(rewrite('[x](../README.md)', 'front/guest/002-guest-screens'), '[x](../../../README.md)');
  });

  it('подпись правится, только когда она сама путь: старый id в тексте остаётся', () => {
    assert.equal(
      rewrite('[`task-back-001`](../task-back-001/)', 'contract/001-guest-flow-extensions'),
      '[`task-back-001`](../../back/001-api-skeleton/)',
    );
    assert.equal(
      rewrite('[`tasks/task-002/result.md`](../task-002/result.md)', 'infra/003-http-security'),
      '[`../../archive/002/result.md`](../../archive/002/result.md)',
    );
  });

  it('ссылка на удалённую front-001 становится упоминанием без ссылки', () => {
    const text = rewrite('- [`../task-front-001/brief.md`](../task-front-001/brief.md)', 'front/ui/001-guest-uispec');
    assert.match(text, /^- `task-front-001\/brief\.md` — задача удалена/);
    assert.doesNotMatch(text, /\]\(/);
  });

  it('прочие ссылки и текст про миграцию не трогаются', () => {
    for (const text of ['[x](brief.md)', '[x](./adr.md)', '[x](https://example.com/task-002/)', 'ссылки `](../task-…` переписываются']) {
      assert.equal(rewrite(text, 'process/001-tasks-rework'), text);
    }
  });
});
