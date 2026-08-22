// Прикладной слой owner-flow: знает домен и интерфейсы репозиториев, но не знает
// express — ни `req`, ни `res`, ни статусов (Р1). Транспортная валидация уже прошла,
// поэтому здесь работают только доменные правила.

import { DomainError } from '../domain/errors.ts';
import type { AvailabilityRule, Booking, EventType, OwnerRecord } from '../domain/model.ts';
import { isValidTimeZone } from '../domain/timezone.ts';
import type { Store } from '../store/repositories.ts';

export interface SetupCommand {
  displayName: string;
  timeZone: string;
  availabilityRules: AvailabilityRule[];
  slotIntervalMinutes: number;
}

export interface CreateEventTypeCommand {
  id: string;
  name: string;
  description?: string;
  durationMinutes: number;
}

/**
 * Проверка настроенности включена ровно на тех операциях, где
 * `CALENDAR_NOT_CONFIGURED` документирован контрактом (Р3).
 */
export async function requireConfiguredOwner(store: Store): Promise<OwnerRecord> {
  const owner = await store.owner.get();
  if (owner === null || !owner.onboardingCompleted) {
    throw new DomainError(
      'CALENDAR_NOT_CONFIGURED',
      'Calendar owner has not completed onboarding setup yet',
    );
  }
  return owner;
}

export async function getAdminSetup(store: Store): Promise<OwnerRecord | null> {
  return store.owner.get();
}

export async function completeAdminSetup(store: Store, command: SetupCommand): Promise<OwnerRecord> {
  const existing = await store.owner.get();
  if (existing !== null && existing.onboardingCompleted) {
    throw new DomainError(
      'ONBOARDING_ALREADY_COMPLETED',
      'Owner onboarding has already been completed',
    );
  }
  assertSettingsUsable(command);

  const record = toOwnerRecord(command);
  await store.owner.save(record);
  return record;
}

export async function getAdminSettings(store: Store): Promise<OwnerRecord> {
  return requireConfiguredOwner(store);
}

/** Полная замена настроек, не merge (`CalendarSettings` замещается целиком). */
export async function updateAdminSettings(store: Store, command: SetupCommand): Promise<OwnerRecord> {
  await requireConfiguredOwner(store);
  assertSettingsUsable(command);

  const record = toOwnerRecord(command);
  await store.owner.save(record);
  return record;
}

export async function getPublicCalendar(store: Store): Promise<OwnerRecord> {
  return requireConfiguredOwner(store);
}

export async function getAdminEventTypes(store: Store): Promise<EventType[]> {
  return store.eventTypes.list();
}

/**
 * Создание типа встречи до onboarding разрешено: `CALENDAR_NOT_CONFIGURED` у этой
 * операции контрактом не документирован (Q6). Асимметрия с публичным списком
 * намеренная.
 */
export async function createAdminEventType(
  store: Store,
  command: CreateEventTypeCommand,
): Promise<EventType> {
  const eventType: EventType = {
    id: command.id,
    name: command.name,
    description: command.description,
    durationMinutes: command.durationMinutes,
  };
  await store.eventTypes.create(eventType); // DUPLICATE_EVENT_TYPE_ID (I11)
  return eventType;
}

export async function getPublicEventTypes(store: Store): Promise<EventType[]> {
  await requireConfiguredOwner(store);
  return store.eventTypes.list();
}

/** Предстоящие — те, что ещё не закончились (`endAtUtc > now`, решение Q4). */
export async function getAdminUpcomingBookings(store: Store): Promise<Booking[]> {
  const upcoming = await store.bookings.listNotEndedBefore(new Date());
  return upcoming.sort((a, b) => a.startAtUtc.getTime() - b.startAtUtc.getTime());
}

function toOwnerRecord(command: SetupCommand): OwnerRecord {
  return {
    displayName: command.displayName,
    onboardingCompleted: true,
    settings: {
      timeZone: command.timeZone,
      availabilityRules: command.availabilityRules,
      slotIntervalMinutes: command.slotIntervalMinutes,
    },
  };
}

/**
 * Доменные проверки настроек V1–V4 (Р2): то, что transport-схема выразить не может.
 * Без них мусорные настройки попадают в хранилище и обрушают документированный
 * `getPublicSlots`. V3 через HTTP недостижим — пустой `daysOfWeek` отвергает
 * `zAvailabilityRule` (`.min(1)`); он остаётся для прямых вызовов use-case.
 */
function assertSettingsUsable(command: SetupCommand): void {
  // V4: regex контракта пропускает структурно верные, но несуществующие зоны.
  if (!isValidTimeZone(command.timeZone)) {
    throw new DomainError('VALIDATION_ERROR', `Unknown IANA time zone "${command.timeZone}"`);
  }
  // V1: кратность 60 не выразима keyword'ами OpenAPI 3.0 — 25 и 40 проходят схему.
  if (60 % command.slotIntervalMinutes !== 0) {
    throw new DomainError(
      'VALIDATION_ERROR',
      `slotIntervalMinutes must divide 60, got ${command.slotIntervalMinutes}`,
    );
  }
  for (const rule of command.availabilityRules) {
    // V3
    if (rule.daysOfWeek.length === 0) {
      throw new DomainError('VALIDATION_ERROR', 'availabilityRules[].daysOfWeek must not be empty');
    }
    // V2: сравнение двух полей схемой не выражается. Строковое сравнение корректно —
    // формат `HH:mm` с ведущими нулями гарантирован transport-схемой.
    if (rule.startLocal >= rule.endLocal) {
      throw new DomainError(
        'VALIDATION_ERROR',
        `availabilityRules[].startLocal must be earlier than endLocal, got ${rule.startLocal}–${rule.endLocal}`,
      );
    }
  }
}
