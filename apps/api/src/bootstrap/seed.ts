// Демо-наполнение публичной ссылки (FR10, ADR §5): на пустом хранилище посетитель
// встречает CALENDAR_NOT_CONFIGURED вместо календаря. Включается флагом SEED_DEMO,
// вызывается из server.ts сразу после создания хранилища.

import type { Store } from '../store/repositories.ts';
import { completeAdminSetup, createAdminEventType } from '../usecases/owner.ts';

/**
 * Точка входа для старта процесса (Р7 ADR `back/002`): сид выполняется не более
 * одного раза за жизнь хранилища. С постоянным хранилищем рестарт с тем же
 * `SEED_DEMO` — штатная ситуация, и настроенный календарь он застаёт уже
 * наполненным: реальные данные владельца не затираются и типы встреч не двоятся.
 * Для in-memory поведение прежнее — память на старте всегда пуста.
 */
export async function maybeSeedDemoCalendar(store: Store): Promise<'seeded' | 'skipped'> {
  if ((await store.owner.get()) !== null) return 'skipped';
  await seedDemoCalendar(store);
  return 'seeded';
}

/**
 * Наполнение идёт через use-cases, а не записью в store: доменные проверки
 * (существование зоны, делимость интервала, порядок границ) выполняются те же,
 * что и на HTTP-входе, и демо-данные не разъедутся с доменом при его изменении.
 *
 * Хранилище обязано быть пустым: на уже настроенном календаре
 * `completeAdminSetup` штатно бросает `ONBOARDING_ALREADY_COMPLETED`, и отказ не
 * подавляется — состояние проверяет вызывающий, а сработавшая здесь ошибка
 * означала бы, что сид зовут в обход `maybeSeedDemoCalendar`.
 */
export async function seedDemoCalendar(store: Store): Promise<void> {
  await completeAdminSetup(store, {
    displayName: 'Мария Иванова (демо)',
    timeZone: 'Europe/Moscow',
    availabilityRules: [
      {
        daysOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        startLocal: '10:00',
        endLocal: '18:00',
      },
    ],
    slotIntervalMinutes: 30,
  });

  await createAdminEventType(store, {
    id: 'intro-30',
    name: 'Знакомство',
    description: 'Короткий разговор: обсудить задачу и понять, чем могу помочь.',
    durationMinutes: 30,
  });

  await createAdminEventType(store, {
    id: 'consultation-60',
    name: 'Консультация',
    description: 'Разбор вопроса целиком, с планом дальнейших шагов.',
    durationMinutes: 60,
  });
}
