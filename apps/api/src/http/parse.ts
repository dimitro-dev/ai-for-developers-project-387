// Единственная точка runtime-валидации transport-входа (FR3, Р2): явный вызов
// generated-схемы в обработчике, а не middleware-фабрика — так тип результата
// выводится из схемы без приведения.

import type { ZodType } from 'zod';

import { DomainError } from '../domain/errors.ts';

export function parseOrThrow<T>(schema: ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (parsed.success) return parsed.data;

  const detail = parsed.error.issues
    .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('; ');
  throw new DomainError('VALIDATION_ERROR', `Invalid request: ${detail}`);
}
