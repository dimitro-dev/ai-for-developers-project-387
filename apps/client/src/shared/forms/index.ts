/**
 * Helper `fieldError` из `components.registry.xml` (модуль `@/shared/forms`).
 *
 * `FieldError` — локальная view-model спек (`<Model name="FieldError">` экрана 14), в контракте
 * такой сущности нет: `ErrorResponse {code, message}` по-полевых данных не отдаёт (GAP-004).
 */

export interface FieldError {
  field: string;
  message: string;
}

/** Сообщение об ошибке поля `field`; `null`, если ошибки нет. */
export function fieldError(errors: readonly FieldError[], field: string): string | null {
  return errors.find((error) => error.field === field)?.message ?? null;
}
