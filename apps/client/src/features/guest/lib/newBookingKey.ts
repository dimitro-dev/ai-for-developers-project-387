import * as Crypto from 'expo-crypto';

/**
 * Helper `newBookingKey` из `components.registry.xml`: новый UUID v4 — ключ идемпотентности
 * `CreateBookingRequest.id`.
 *
 * `expo-crypto`, а не глобальный `crypto.randomUUID`: в Hermes глобальный API не гарантирован.
 */
export function newBookingKey(): string {
  return Crypto.randomUUID();
}
