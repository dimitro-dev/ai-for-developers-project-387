// FR7 / AC8: реестр ROUTES сверяется с generated/openapi.yaml в обе стороны.
// Приложение монтируется только по этому реестру (см. app.ts), поэтому сверка реестра
// со контрактом равнозначна сверке смонтированных маршрутов.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { parse } from 'yaml';

import { ROUTES } from './routes.ts';

interface ContractOperation {
  operationId: string;
  method: string;
  path: string;
}

const HTTP_METHODS = ['get', 'put', 'post', 'patch', 'delete', 'head', 'options'];

function contractOperations(): ContractOperation[] {
  const specPath = new URL('../../../../packages/contracts/generated/openapi.yaml', import.meta.url);
  const spec = parse(readFileSync(specPath, 'utf-8')) as {
    paths: Record<string, Record<string, { operationId?: string }>>;
  };

  const operations: ContractOperation[] = [];
  for (const [path, methods] of Object.entries(spec.paths)) {
    for (const [method, operation] of Object.entries(methods)) {
      if (!HTTP_METHODS.includes(method)) continue;
      assert.ok(operation.operationId, `${method.toUpperCase()} ${path} has an operationId`);
      operations.push({ operationId: operation.operationId, method, path });
    }
  }
  return operations;
}

function key(operation: ContractOperation): string {
  return `${operation.operationId} ${operation.method.toUpperCase()} ${operation.path}`;
}

test('покрытие контракта: каждая операция контракта имеет маршрут в apps/api', () => {
  const registry = new Set(ROUTES.map((route) => key(route)));
  for (const operation of contractOperations()) {
    assert.ok(registry.has(key(operation)), `operation ${key(operation)} is mounted`);
  }
});

test('покрытие контракта: лишних маршрутов у apps/api нет', () => {
  const contract = new Set(contractOperations().map(key));
  for (const route of ROUTES) {
    assert.ok(contract.has(key(route)), `route ${key(route)} is documented by the contract`);
  }
});

test('покрытие контракта: 12 операций, ни одна не задублирована', () => {
  const operations = contractOperations();
  assert.equal(operations.length, 12);
  assert.equal(ROUTES.length, operations.length);
  assert.equal(new Set(ROUTES.map((route) => route.operationId)).size, ROUTES.length);
});
