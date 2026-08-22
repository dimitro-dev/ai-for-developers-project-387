// Сид проверяется по результату в хранилище и по гостевому сценарию: смысл флага —
// чтобы посетитель публичной ссылки увидел не CALENDAR_NOT_CONFIGURED, а слоты.

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { DomainError } from '../domain/errors.ts';
import { createMemoryStore } from '../store/memory.ts';
import { getPublicSlots } from '../usecases/booking.ts';
import { maybeSeedDemoCalendar, seedDemoCalendar } from './seed.ts';

test('сид завершает онбординг: владелец сохранён с рабочими настройками', async () => {
  const store = createMemoryStore();
  await seedDemoCalendar(store);

  const owner = await store.owner.get();
  assert.ok(owner !== null, 'владелец сохранён');
  assert.equal(owner.onboardingCompleted, true);
  assert.ok(owner.displayName.length > 0);
  assert.equal(owner.settings.slotIntervalMinutes, 30);
  assert.deepEqual(owner.settings.availabilityRules[0].daysOfWeek, [
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
  ]);
});

test('сид создаёт два типа встреч разной длительности', async () => {
  const store = createMemoryStore();
  await seedDemoCalendar(store);

  const eventTypes = await store.eventTypes.list();
  assert.equal(eventTypes.length, 2);
  assert.deepEqual(
    eventTypes.map((eventType) => eventType.durationMinutes).sort((a, b) => a - b),
    [30, 60],
  );
  for (const eventType of eventTypes) {
    assert.ok(eventType.name.length > 0, `у типа "${eventType.id}" есть имя`);
  }
});

test('после сида гость получает свободные слоты по каждому типу встречи (FR10)', async () => {
  // Окно бронирования — 14 дней, правила покрывают пн–пт: хотя бы один рабочий
  // день попадает в него в любую дату прогона, поэтому проверка не плавающая.
  const store = createMemoryStore();
  await seedDemoCalendar(store);

  for (const eventType of await store.eventTypes.list()) {
    const slots = await getPublicSlots(store, { eventTypeId: eventType.id });
    assert.ok(slots.length > 0, `тип "${eventType.id}" отдаёт свободные слоты`);
  }
});

test('повторный сид на настроенном хранилище отказывает: сид рассчитан на пустое', async () => {
  const store = createMemoryStore();
  await seedDemoCalendar(store);

  await assert.rejects(
    () => seedDemoCalendar(store),
    (error: unknown) => {
      assert.ok(error instanceof DomainError, `ожидался DomainError, получен ${String(error)}`);
      assert.equal(error.code, 'ONBOARDING_ALREADY_COMPLETED');
      return true;
    },
  );
});

test('guard (Р7): на пустом хранилище сид выполняется', async () => {
  const store = createMemoryStore();

  assert.equal(await maybeSeedDemoCalendar(store), 'seeded');
  assert.ok((await store.owner.get()) !== null, 'календарь настроен');
  assert.equal((await store.eventTypes.list()).length, 2);
});

test('guard (Р7): повторный старт против настроенного хранилища сид пропускает', async () => {
  // Сценарий рестарта процесса с тем же SEED_DEMO поверх постоянной базы: настройки
  // владельца остаются его собственными, типы встреч не удваиваются.
  const store = createMemoryStore();
  await maybeSeedDemoCalendar(store);
  const seeded = await store.owner.get();
  assert.ok(seeded !== null);
  await store.owner.save({ ...seeded, displayName: 'Настройки владельца' });

  assert.equal(await maybeSeedDemoCalendar(store), 'skipped');

  const owner = await store.owner.get();
  assert.equal(owner?.displayName, 'Настройки владельца', 'сид не переписал настройки');
  assert.equal((await store.eventTypes.list()).length, 2, 'типы встреч не задублированы');
});
