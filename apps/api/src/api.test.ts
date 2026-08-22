// HTTP-тесты поверх createApp: харнесс зоны (`http/testServer.ts`) поднимает приложение
// на listen(0) и ходит глобальным fetch, без supertest (Р9). Тела успешных ответов
// сверяются generated response-схемами — дешёвая проверка соответствия контракту в
// момент прогона.

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  zCompleteAdminSetupResponse,
  zCreateAdminEventTypeResponse,
  zCreatePublicBookingResponse,
  zGetAdminEventTypesResponse,
  zGetAdminSettingsResponse,
  zGetAdminUpcomingBookingsResponse,
  zGetAdminSetupResponse,
  zGetHealthResponse,
  zGetPublicCalendarResponse,
  zGetPublicEventTypesResponse,
  zGetPublicSlotsResponse,
  zUpdateAdminSettingsResponse,
} from '@minical/backend-contract/zod';

import { DomainError } from './domain/errors.ts';
import type { Booking } from './domain/model.ts';
import { expectError, withServer, TEST_PUBLIC_WEB_URL } from './http/testServer.ts';
import type { JsonClient, JsonResponse } from './http/testServer.ts';
import { createMemoryStore } from './store/memory.ts';
import type { Store } from './store/repositories.ts';
import { createPublicBooking } from './usecases/booking.ts';

const PUBLIC_WEB_URL = TEST_PUBLIC_WEB_URL;

const SETUP_BODY = {
  displayName: 'Мария Иванова',
  timeZone: 'UTC',
  availabilityRules: [
    {
      daysOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
      startLocal: '09:00',
      endLocal: '18:00',
    },
  ],
  slotIntervalMinutes: 30,
};

async function completeSetup(
  http: JsonClient,
  overrides: Record<string, unknown> = {},
): Promise<JsonResponse> {
  return http.put('/admin/setup', { ...SETUP_BODY, ...overrides });
}

// --- транспортный фундамент (FR1, AC2, Р8, G3) --------------------------------

test('GET /health отдаёт ровно {"status":"ok"} (AC2)', async () => {
  await withServer(async ({ http }) => {
    const response = await http.get('/health');
    assert.equal(response.status, 200);
    assert.deepEqual(response.body, { status: 'ok' });
    assert.equal(zGetHealthResponse.safeParse(response.body).success, true);
  });
});

test('неизвестный маршрут и неподдерживаемый метод → 404 NOT_FOUND (вне контракта, G3)', async () => {
  await withServer(async ({ http }) => {
    expectError(await http.get('/nope'), 404, 'NOT_FOUND');
    expectError(await http.post('/health', {}), 404, 'NOT_FOUND');
  });
});

test('нераспарсенное тело → 400 VALIDATION_ERROR', async () => {
  await withServer(async ({ http }) => {
    expectError(await http.raw('PUT', '/admin/setup', '{ not json'), 400, 'VALIDATION_ERROR');
  });
});

test('неожиданный отказ репозитория доходит до error-middleware → 500 INTERNAL_ERROR', async () => {
  // Проверка допущения Р8: Express 5 сам передаёт отказ промиса async-обработчика в
  // error-middleware, обёрток вида asyncHandler нет.
  const store = createMemoryStore();
  const failing: Store = {
    ...store,
    owner: {
      ...store.owner,
      get: async () => {
        throw new Error('storage is down');
      },
    },
  };

  await withServer(
    async ({ http }) => {
      expectError(await http.get('/admin/setup'), 500, 'INTERNAL_ERROR');
    },
    { store: failing },
  );
});

// --- onboarding (FR3, I5, AC4, V1–V4) ----------------------------------------

test('GET /admin/setup до онбординга → onboardingCompleted: false', async () => {
  await withServer(async ({ http }) => {
    const response = await http.get('/admin/setup');
    assert.equal(response.status, 200);
    assert.deepEqual(response.body, { onboardingCompleted: false });
    assert.equal(zGetAdminSetupResponse.safeParse(response.body).success, true);
  });
});

test('PUT /admin/setup завершает онбординг, повтор → 409 ONBOARDING_ALREADY_COMPLETED (AC4)', async () => {
  await withServer(async ({ http }) => {
    const created = await completeSetup(http);
    assert.equal(created.status, 200);
    assert.equal(zCompleteAdminSetupResponse.safeParse(created.body).success, true);
    assert.deepEqual(created.body, {
      displayName: SETUP_BODY.displayName,
      timeZone: SETUP_BODY.timeZone,
      availabilityRules: SETUP_BODY.availabilityRules,
      slotIntervalMinutes: SETUP_BODY.slotIntervalMinutes,
      publicUrl: PUBLIC_WEB_URL,
    });

    const state = await http.get('/admin/setup');
    assert.deepEqual(state.body, {
      onboardingCompleted: true,
      displayName: SETUP_BODY.displayName,
    });

    expectError(await completeSetup(http), 409, 'ONBOARDING_ALREADY_COMPLETED');
  });
});

test('PUT /admin/setup: нарушения transport-схемы → 400 VALIDATION_ERROR', async () => {
  await withServer(async ({ http }) => {
    // G2 закрыт task-contract-001: пустой daysOfWeek отвергает zAvailabilityRule (.min(1)).
    expectError(
      await completeSetup(http, {
        availabilityRules: [{ daysOfWeek: [], startLocal: '09:00', endLocal: '18:00' }],
      }),
      400,
      'VALIDATION_ERROR',
    );
    expectError(await completeSetup(http, { slotIntervalMinutes: 10 }), 400, 'VALIDATION_ERROR');
    expectError(await completeSetup(http, { displayName: '' }), 400, 'VALIDATION_ERROR');
    expectError(await completeSetup(http, { availabilityRules: [] }), 400, 'VALIDATION_ERROR');
    expectError(await http.put('/admin/setup', {}), 400, 'VALIDATION_ERROR');

    // ни одна из попыток не создала владельца
    assert.deepEqual((await http.get('/admin/setup')).body, { onboardingCompleted: false });
  });
});

test('PUT /admin/setup: доменные проверки V1, V2, V4 → 400 VALIDATION_ERROR', async () => {
  await withServer(async ({ http }) => {
    // V1: 25 проходит @minValue(15)/@maxValue(60), но 60 на него не делится
    expectError(await completeSetup(http, { slotIntervalMinutes: 25 }), 400, 'VALIDATION_ERROR');
    // V2: startLocal >= endLocal
    expectError(
      await completeSetup(http, {
        availabilityRules: [{ daysOfWeek: ['Monday'], startLocal: '18:00', endLocal: '09:00' }],
      }),
      400,
      'VALIDATION_ERROR',
    );
    // V4: структурно верная, но несуществующая зона
    expectError(await completeSetup(http, { timeZone: 'Foo/Bar' }), 400, 'VALIDATION_ERROR');

    assert.deepEqual((await http.get('/admin/setup')).body, { onboardingCompleted: false });
  });
});

// --- настройки календаря (FR8, AC7, AC9) --------------------------------------

test('GET/PUT /admin/settings до онбординга → 400 CALENDAR_NOT_CONFIGURED (AC7)', async () => {
  await withServer(async ({ http }) => {
    expectError(await http.get('/admin/settings'), 400, 'CALENDAR_NOT_CONFIGURED');
    expectError(await http.put('/admin/settings', SETUP_BODY), 400, 'CALENDAR_NOT_CONFIGURED');
  });
});

test('GET /admin/settings после онбординга отдаёт publicUrl из конфигурации (AC9)', async () => {
  await withServer(async ({ http }) => {
    await completeSetup(http);

    const response = await http.get('/admin/settings');
    assert.equal(response.status, 200);
    // format: uri в схеме — проверка валидности publicUrl, а не только его наличия
    assert.equal(zGetAdminSettingsResponse.safeParse(response.body).success, true);
    assert.equal((response.body as { publicUrl: string }).publicUrl, PUBLIC_WEB_URL);
  });
});

test('GET /admin/settings: publicUrl берётся из env, а не захардкожен (AC9)', async () => {
  await withServer(
    async ({ http }) => {
      await completeSetup(http);
      const response = await http.get('/admin/settings');
      assert.equal((response.body as { publicUrl: string }).publicUrl, 'https://calendar.example.test');
      assert.equal(zGetAdminSettingsResponse.safeParse(response.body).success, true);
    },
    { config: { publicWebUrl: 'https://calendar.example.test' } },
  );
});

test('PUT /admin/settings заменяет availabilityRules целиком, а не дописывает', async () => {
  await withServer(async ({ http }) => {
    await completeSetup(http);

    const replacement = {
      displayName: 'Мария И.',
      timeZone: 'Europe/Berlin',
      availabilityRules: [
        { daysOfWeek: ['Monday'], startLocal: '10:00', endLocal: '12:00' },
        { daysOfWeek: ['Friday'], startLocal: '14:00', endLocal: '15:00' },
      ],
      slotIntervalMinutes: 60,
    };

    const updated = await http.put('/admin/settings', replacement);
    assert.equal(updated.status, 200);
    assert.equal(zUpdateAdminSettingsResponse.safeParse(updated.body).success, true);
    assert.deepEqual(updated.body, { ...replacement, publicUrl: PUBLIC_WEB_URL });
    assert.deepEqual((await http.get('/admin/settings')).body, {
      ...replacement,
      publicUrl: PUBLIC_WEB_URL,
    });
  });
});

test('PUT /admin/settings: transport- и доменные нарушения → 400 VALIDATION_ERROR', async () => {
  await withServer(async ({ http }) => {
    await completeSetup(http);

    expectError(await http.put('/admin/settings', { ...SETUP_BODY, slotIntervalMinutes: 25 }), 400, 'VALIDATION_ERROR');
    expectError(await http.put('/admin/settings', { ...SETUP_BODY, timeZone: 'Foo/Bar' }), 400, 'VALIDATION_ERROR');
    expectError(await http.put('/admin/settings', { ...SETUP_BODY, availabilityRules: [] }), 400, 'VALIDATION_ERROR');

    // отказ не испортил сохранённые настройки
    assert.equal((await http.get('/admin/settings')).status, 200);
    assert.deepEqual((await http.get('/admin/settings')).body, {
      ...SETUP_BODY,
      publicUrl: PUBLIC_WEB_URL,
    });
  });
});

// --- типы встреч (I11, AC5, AC6, AC7) -----------------------------------------

const EVENT_TYPE = { id: 'intro', name: 'Знакомство', description: 'Короткий звонок', durationMinutes: 30 };

test('POST /admin/event-types создаёт тип встречи (201), повтор id → 409 DUPLICATE_EVENT_TYPE_ID (AC6)', async () => {
  await withServer(async ({ http }) => {
    const created = await http.post('/admin/event-types', EVENT_TYPE);
    assert.equal(created.status, 201);
    assert.equal(zCreateAdminEventTypeResponse.safeParse(created.body).success, true);
    assert.deepEqual(created.body, EVENT_TYPE);

    expectError(
      await http.post('/admin/event-types', { ...EVENT_TYPE, name: 'Другое имя' }),
      409,
      'DUPLICATE_EVENT_TYPE_ID',
    );

    const list = await http.get('/admin/event-types');
    assert.equal(list.status, 200);
    assert.equal(zGetAdminEventTypesResponse.safeParse(list.body).success, true);
    assert.deepEqual(list.body, [EVENT_TYPE]);
  });
});

test('POST /admin/event-types: нарушения transport-схемы → 400 VALIDATION_ERROR (AC5)', async () => {
  await withServer(async ({ http }) => {
    expectError(await http.post('/admin/event-types', { ...EVENT_TYPE, durationMinutes: 0 }), 400, 'VALIDATION_ERROR');
    expectError(await http.post('/admin/event-types', { ...EVENT_TYPE, id: '' }), 400, 'VALIDATION_ERROR');
    expectError(await http.post('/admin/event-types', { id: 'x', name: 'x' }), 400, 'VALIDATION_ERROR');

    assert.deepEqual((await http.get('/admin/event-types')).body, []);
  });
});

test('admin-операции над типами встреч не требуют завершённого onboarding (Q6)', async () => {
  await withServer(async ({ http }) => {
    assert.deepEqual((await http.get('/admin/event-types')).body, []);
    assert.equal((await http.post('/admin/event-types', EVENT_TYPE)).status, 201);
  });
});

test('GET /event-types до онбординга → 400 CALENDAR_NOT_CONFIGURED, после — список (AC7)', async () => {
  await withServer(async ({ http }) => {
    await http.post('/admin/event-types', EVENT_TYPE);
    expectError(await http.get('/event-types'), 400, 'CALENDAR_NOT_CONFIGURED');

    await completeSetup(http);
    const list = await http.get('/event-types');
    assert.equal(list.status, 200);
    assert.equal(zGetPublicEventTypesResponse.safeParse(list.body).success, true);
    assert.deepEqual(list.body, [EVENT_TYPE]);
  });
});

test('GET /calendar до онбординга → 400 CALENDAR_NOT_CONFIGURED, после — только displayName', async () => {
  await withServer(async ({ http }) => {
    expectError(await http.get('/calendar'), 400, 'CALENDAR_NOT_CONFIGURED');

    await completeSetup(http);
    const response = await http.get('/calendar');
    assert.equal(response.status, 200);
    assert.equal(zGetPublicCalendarResponse.safeParse(response.body).success, true);
    // публичная проекция узкая: настройки календаря гостю не раскрываются
    assert.deepEqual(response.body, { displayName: SETUP_BODY.displayName });
  });
});

// --- свободные слоты (I6–I10, AC5, AC7) ---------------------------------------

interface SlotDto {
  startAtUtc: string;
  endAtUtc: string;
  eventTypeId: string;
}

async function readySlots(http: JsonClient): Promise<SlotDto[]> {
  await completeSetup(http);
  assert.equal((await http.post('/admin/event-types', EVENT_TYPE)).status, 201);
  const response = await http.get(`/slots?eventTypeId=${EVENT_TYPE.id}`);
  assert.equal(response.status, 200, `unexpected status, body: ${JSON.stringify(response.body)}`);
  assert.equal(zGetPublicSlotsResponse.safeParse(response.body).success, true);
  return response.body as SlotDto[];
}

test('GET /slots отдаёт слоты окна: внутри 14 дат, кратны интервалу, длительность типа встречи', async () => {
  await withServer(async ({ http }) => {
    const slots = await readySlots(http);
    assert.ok(slots.length > 0);

    const windowStart = new Date();
    const windowEnd = new Date(windowStart.getTime() + 14 * 86_400_000);
    for (const slot of slots) {
      const start = new Date(slot.startAtUtc);
      assert.ok(start.getTime() >= windowStart.getTime() - 60_000); // I9
      assert.ok(start.getTime() < windowEnd.getTime()); // I6
      assert.equal(start.getUTCMinutes() % SETUP_BODY.slotIntervalMinutes, 0); // I8
      const local = { hour: start.getUTCHours(), minute: start.getUTCMinutes() };
      assert.ok(local.hour >= 9 && local.hour * 60 + local.minute + EVENT_TYPE.durationMinutes <= 18 * 60); // I7
      assert.equal(
        new Date(slot.endAtUtc).getTime() - start.getTime(),
        EVENT_TYPE.durationMinutes * 60_000,
      ); // I4
      assert.equal(slot.eventTypeId, EVENT_TYPE.id);
    }
    assert.deepEqual(
      [...slots].sort((a, b) => a.startAtUtc.localeCompare(b.startAtUtc)),
      slots,
    );
  });
});

test('GET /slots не резервирует слот (I10): повторный вызов даёт тот же результат', async () => {
  await withServer(async ({ http }) => {
    const first = await readySlots(http);
    const second = (await http.get(`/slots?eventTypeId=${EVENT_TYPE.id}`)).body as SlotDto[];
    assert.deepEqual(second, first);
  });
});

test('GET /slots: занятое время исчезает из списка', async () => {
  await withServer(async ({ http, store }) => {
    const slots = await readySlots(http);
    const taken = slots[0];

    await store.bookings.create({
      id: '11111111-1111-4111-8111-111111111111',
      eventTypeId: EVENT_TYPE.id,
      eventTypeName: EVENT_TYPE.name,
      startAtUtc: new Date(taken.startAtUtc),
      endAtUtc: new Date(taken.endAtUtc),
      guestName: 'Гость',
      guestEmail: 'guest@example.com',
      createdAtUtc: new Date(),
    });

    const after = (await http.get(`/slots?eventTypeId=${EVENT_TYPE.id}`)).body as SlotDto[];
    assert.equal(after.some((slot) => slot.startAtUtc === taken.startAtUtc), false);
    assert.equal(after.length, slots.length - 1);
  });
});

test('GET /slots: порядок отказов — настроенность, затем существование типа встречи', async () => {
  await withServer(async ({ http }) => {
    // до онбординга — CALENDAR_NOT_CONFIGURED, даже если тип встречи не существует (AC7)
    expectError(await http.get('/slots?eventTypeId=missing'), 400, 'CALENDAR_NOT_CONFIGURED');

    await completeSetup(http);
    expectError(await http.get('/slots?eventTypeId=missing'), 404, 'EVENT_TYPE_NOT_FOUND');
  });
});

test('GET /slots: пустой и отсутствующий eventTypeId → 400 VALIDATION_ERROR (AC5)', async () => {
  await withServer(async ({ http }) => {
    await completeSetup(http);
    // G4 закрыт task-contract-001: zGetPublicSlotsQuery.eventTypeId — .min(1)
    expectError(await http.get('/slots?eventTypeId='), 400, 'VALIDATION_ERROR');
    expectError(await http.get('/slots'), 400, 'VALIDATION_ERROR');
  });
});

// --- создание бронирования (AC3, AC5, AC7, I2–I4, I12, I15) --------------------

const GUEST = { name: 'Пётр Гость', email: 'guest@example.com', note: 'Первый разговор' };
const LONG_EVENT_TYPE = { id: 'deep', name: 'Длинная встреча', durationMinutes: 60 };

/** Слот, в который заведомо влезает и 30-, и 60-минутная встреча. */
function bookableSlot(slots: SlotDto[]): SlotDto {
  const slot = slots.find((candidate) => new Date(candidate.startAtUtc).getUTCHours() <= 16);
  assert.ok(slot !== undefined, 'в окне есть слот, начинающийся не позже 16:00');
  return slot;
}

function bookingBody(slot: SlotDto, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { eventTypeId: EVENT_TYPE.id, startAtUtc: slot.startAtUtc, guest: GUEST, ...overrides };
}

test('сквозной сценарий гостя: /event-types → /slots → POST /bookings → 201 (AC3)', async () => {
  await withServer(async ({ http }) => {
    await completeSetup(http);
    await http.post('/admin/event-types', EVENT_TYPE);

    const eventTypes = (await http.get('/event-types')).body as Array<{ id: string }>;
    assert.deepEqual(eventTypes.map((item) => item.id), [EVENT_TYPE.id]);

    const slots = (await http.get(`/slots?eventTypeId=${eventTypes[0].id}`)).body as SlotDto[];
    const slot = bookableSlot(slots);

    const created = await http.post('/bookings', bookingBody(slot));
    assert.equal(created.status, 201, JSON.stringify(created.body));
    assert.equal(zCreatePublicBookingResponse.safeParse(created.body).success, true);

    const body = created.body as Record<string, string>;
    assert.equal(body.eventTypeId, EVENT_TYPE.id);
    assert.equal(body.eventTypeName, EVENT_TYPE.name); // I15: snapshot названия
    assert.equal(body.startAtUtc, slot.startAtUtc);
    assert.equal(body.endAtUtc, slot.endAtUtc); // I4: endAtUtc считает сервер
    assert.equal(
      new Date(body.endAtUtc).getTime() - new Date(body.startAtUtc).getTime(),
      EVENT_TYPE.durationMinutes * 60_000,
    );
    assert.equal(body.guestName, GUEST.name); // I13: плоский snapshot гостя
    assert.equal(body.guestEmail, GUEST.email);
    assert.equal(body.guestNote, GUEST.note);
    assert.ok(body.createdAtUtc.length > 0);
    assert.ok(body.id.length > 0);

    // слот занят и больше не предлагается
    const after = (await http.get(`/slots?eventTypeId=${EVENT_TYPE.id}`)).body as SlotDto[];
    assert.equal(after.some((item) => item.startAtUtc === slot.startAtUtc), false);
  });
});

test('повтор без ключа id на тот же слот → 409 SLOT_UNAVAILABLE (AC3)', async () => {
  await withServer(async ({ http, store }) => {
    const slots = await readySlots(http);
    const slot = bookableSlot(slots);

    assert.equal((await http.post('/bookings', bookingBody(slot))).status, 201);
    expectError(await http.post('/bookings', bookingBody(slot)), 409, 'SLOT_UNAVAILABLE');
    assert.equal((await store.bookings.listNotEndedBefore(new Date(0))).length, 1);
  });
});

test('повтор с тем же ключом id и эквивалентной нагрузкой → 200 с той же бронью (AC3)', async () => {
  await withServer(async ({ http, store }) => {
    const slots = await readySlots(http);
    const slot = bookableSlot(slots);
    const key = '22222222-2222-4222-8222-222222222222';

    const created = await http.post('/bookings', bookingBody(slot, { id: key }));
    assert.equal(created.status, 201);
    assert.equal((created.body as { id: string }).id, key);

    // тот же instant, записанный иначе: `…Z` без миллисекунд — та же нагрузка
    const withoutMillis = slot.startAtUtc.replace('.000Z', 'Z');
    const replayed = await http.post(
      '/bookings',
      bookingBody(slot, { id: key, startAtUtc: withoutMillis }),
    );
    assert.equal(replayed.status, 200);
    assert.equal(zCreatePublicBookingResponse.safeParse(replayed.body).success, true);
    assert.deepEqual(replayed.body, created.body);
    assert.equal((await store.bookings.listNotEndedBefore(new Date(0))).length, 1);
  });
});

test('повтор с тем же ключом id и изменённой нагрузкой → 409 DUPLICATE_BOOKING_ID (AC3)', async () => {
  await withServer(async ({ http, store }) => {
    const slots = await readySlots(http);
    const slot = bookableSlot(slots);
    const key = '33333333-3333-4333-8333-333333333333';

    assert.equal((await http.post('/bookings', bookingBody(slot, { id: key }))).status, 201);
    expectError(
      await http.post(
        '/bookings',
        bookingBody(slot, { id: key, guest: { ...GUEST, name: 'Другой гость' } }),
      ),
      409,
      'DUPLICATE_BOOKING_ID',
    );
    assert.equal((await store.bookings.listNotEndedBefore(new Date(0))).length, 1);
  });
});

test('пересечение с бронированием другого EventType → 409 SLOT_UNAVAILABLE (I2)', async () => {
  await withServer(async ({ http }) => {
    const slots = await readySlots(http);
    assert.equal((await http.post('/admin/event-types', LONG_EVENT_TYPE)).status, 201);
    const slot = bookableSlot(slots);

    assert.equal((await http.post('/bookings', bookingBody(slot))).status, 201);
    expectError(
      await http.post('/bookings', bookingBody(slot, { eventTypeId: LONG_EVENT_TYPE.id })),
      409,
      'SLOT_UNAVAILABLE',
    );
  });
});

test('соседний слот принимается (I3): [start, end) полуоткрыт', async () => {
  await withServer(async ({ http }) => {
    const slots = await readySlots(http);
    const index = slots.findIndex(
      (slot, position) => position + 1 < slots.length && slot.endAtUtc === slots[position + 1].startAtUtc,
    );
    assert.ok(index >= 0, 'в окне есть два смежных слота');

    assert.equal((await http.post('/bookings', bookingBody(slots[index]))).status, 201);
    assert.equal((await http.post('/bookings', bookingBody(slots[index + 1]))).status, 201);
  });
});

test('POST /bookings: нарушения transport-схемы → 400 VALIDATION_ERROR (AC5)', async () => {
  await withServer(async ({ http }) => {
    const slots = await readySlots(http);
    const slot = bookableSlot(slots);

    expectError(await http.post('/bookings', { eventTypeId: EVENT_TYPE.id, startAtUtc: slot.startAtUtc }), 400, 'VALIDATION_ERROR');
    expectError(await http.post('/bookings', bookingBody(slot, { eventTypeId: '' })), 400, 'VALIDATION_ERROR');
    expectError(await http.post('/bookings', bookingBody(slot, { guest: { name: 'x', email: 'not-an-email' } })), 400, 'VALIDATION_ERROR');
    expectError(await http.post('/bookings', bookingBody(slot, { guest: { name: '', email: GUEST.email } })), 400, 'VALIDATION_ERROR');
    expectError(await http.post('/bookings', bookingBody(slot, { startAtUtc: '2026-08-20 09:00' })), 400, 'VALIDATION_ERROR');
    expectError(await http.post('/bookings', bookingBody(slot, { id: 'not-a-uuid' })), 400, 'VALIDATION_ERROR');
    // клиент не может задать endAtUtc: лишнее поле игнорируется схемой, сервер считает сам (I4)
    const created = await http.post('/bookings', bookingBody(slot, { endAtUtc: '2030-01-01T00:00:00.000Z' }));
    assert.equal(created.status, 201);
    assert.equal((created.body as { endAtUtc: string }).endAtUtc, slot.endAtUtc);
  });
});

test('POST /bookings: доменные отказы окна, сетки и предусловий', async () => {
  await withServer(async ({ http }) => {
    const slots = await readySlots(http);
    const slot = bookableSlot(slots);
    const startMs = new Date(slot.startAtUtc).getTime();
    const day = 86_400_000;

    // за пределами 14-дневного окна и в прошлом → SLOT_OUTSIDE_WINDOW
    expectError(
      await http.post('/bookings', bookingBody(slot, { startAtUtc: new Date(startMs + 20 * day).toISOString() })),
      400,
      'SLOT_OUTSIDE_WINDOW',
    );
    expectError(
      await http.post('/bookings', bookingBody(slot, { startAtUtc: new Date(startMs - 20 * day).toISOString() })),
      400,
      'SLOT_OUTSIDE_WINDOW',
    );
    // внутри окна, но не на сетке → SLOT_NOT_ALIGNED
    expectError(
      await http.post('/bookings', bookingBody(slot, { startAtUtc: new Date(startMs + 5 * 60_000).toISOString() })),
      400,
      'SLOT_NOT_ALIGNED',
    );
    // вне рабочего интервала отдельного кода не имеет — это «нет такого слота в сетке».
    // Время фиксированное (03:00 UTC назавтра), а не смещение от первого слота: тот
    // зависит от часа запуска теста, и вычисленная точка может попасть на валидный слот.
    const offHoursUtc = new Date(startMs + day);
    offHoursUtc.setUTCHours(3, 0, 0, 0);
    expectError(
      await http.post('/bookings', bookingBody(slot, { startAtUtc: offHoursUtc.toISOString() })),
      400,
      'SLOT_NOT_ALIGNED',
    );
    // несуществующий тип встречи → 404
    expectError(await http.post('/bookings', bookingBody(slot, { eventTypeId: 'missing' })), 404, 'EVENT_TYPE_NOT_FOUND');
  });
});

test('POST /bookings до онбординга → 400 CALENDAR_NOT_CONFIGURED (AC7)', async () => {
  await withServer(async ({ http }) => {
    await http.post('/admin/event-types', EVENT_TYPE);
    expectError(
      await http.post('/bookings', {
        eventTypeId: EVENT_TYPE.id,
        startAtUtc: new Date(Date.now() + 86_400_000).toISOString(),
        guest: GUEST,
      }),
      400,
      'CALENDAR_NOT_CONFIGURED',
    );
  });
});

test('GUEST_NAME_REQUIRED / GUEST_EMAIL_REQUIRED достижимы только прямым вызовом use-case (I12)', async () => {
  // Через HTTP недостижимы: zGuestDetails требует непустые name/email раньше домена.
  const store = createMemoryStore();
  const command = {
    eventTypeId: EVENT_TYPE.id,
    startAtUtc: new Date(),
    guestName: 'Гость',
    guestEmail: 'guest@example.com',
  };

  await assert.rejects(
    () => createPublicBooking(store, { ...command, guestName: '   ' }),
    (error: unknown) => error instanceof DomainError && error.code === 'GUEST_NAME_REQUIRED',
  );
  await assert.rejects(
    () => createPublicBooking(store, { ...command, guestEmail: '' }),
    (error: unknown) => error instanceof DomainError && error.code === 'GUEST_EMAIL_REQUIRED',
  );
});

// --- предстоящие бронирования владельца (Q4, I15) -----------------------------

function storedBooking(overrides: Partial<Booking> & Pick<Booking, 'id' | 'startAtUtc' | 'endAtUtc'>): Booking {
  return {
    eventTypeId: EVENT_TYPE.id,
    eventTypeName: EVENT_TYPE.name,
    guestName: GUEST.name,
    guestEmail: GUEST.email,
    createdAtUtc: new Date(),
    ...overrides,
  };
}

test('GET /admin/bookings до онбординга → пустой список, без CALENDAR_NOT_CONFIGURED', async () => {
  await withServer(async ({ http }) => {
    const response = await http.get('/admin/bookings');
    assert.equal(response.status, 200);
    assert.deepEqual(response.body, []);
    assert.equal(zGetAdminUpcomingBookingsResponse.safeParse(response.body).success, true);
  });
});

test('GET /admin/bookings: идущая встреча в списке, закончившаяся — нет, порядок возрастающий', async () => {
  await withServer(async ({ http, store }) => {
    const now = Date.now();
    const hour = 3_600_000;
    await store.bookings.create(
      storedBooking({
        id: '44444444-4444-4444-8444-444444444444',
        startAtUtc: new Date(now - 3 * hour),
        endAtUtc: new Date(now - 2 * hour), // уже закончилась
      }),
    );
    await store.bookings.create(
      storedBooking({
        id: '55555555-5555-4555-8555-555555555555',
        startAtUtc: new Date(now - hour / 2),
        endAtUtc: new Date(now + hour / 2), // идёт прямо сейчас
      }),
    );
    await store.bookings.create(
      storedBooking({
        id: '66666666-6666-4666-8666-666666666666',
        startAtUtc: new Date(now + 2 * hour),
        endAtUtc: new Date(now + 3 * hour),
      }),
    );

    const response = await http.get('/admin/bookings');
    assert.equal(response.status, 200);
    assert.equal(zGetAdminUpcomingBookingsResponse.safeParse(response.body).success, true);
    const bookings = response.body as Array<{ id: string; startAtUtc: string }>;
    assert.deepEqual(
      bookings.map((item) => item.id),
      ['55555555-5555-4555-8555-555555555555', '66666666-6666-4666-8666-666666666666'],
    );
    assert.ok(bookings[0].startAtUtc < bookings[1].startAtUtc);
  });
});

test('GET /admin/bookings: eventTypeName берётся из snapshot записи, а не из текущего типа (I15)', async () => {
  await withServer(async ({ http, store }) => {
    // Переименование типа встречи через HTTP невозможно — контракт такой операции не
    // описывает; расхождение имён воспроизводится на уровне хранилища.
    await http.post('/admin/event-types', EVENT_TYPE);
    await store.bookings.create(
      storedBooking({
        id: '77777777-7777-4777-8777-777777777777',
        eventTypeName: 'Имя на момент брони',
        startAtUtc: new Date(Date.now() + 3_600_000),
        endAtUtc: new Date(Date.now() + 5_400_000),
      }),
    );

    const bookings = (await http.get('/admin/bookings')).body as Array<Record<string, string>>;
    assert.equal(bookings.length, 1);
    assert.equal(bookings[0].eventTypeName, 'Имя на момент брони');
    assert.equal(bookings[0].eventTypeId, EVENT_TYPE.id);
    assert.equal((await http.get('/admin/event-types')).status, 200);
  });
});

test('GET /admin/bookings: бронь, созданная гостем, видна владельцу целиком', async () => {
  await withServer(async ({ http }) => {
    const slots = await readySlots(http);
    const created = await http.post('/bookings', bookingBody(bookableSlot(slots)));
    assert.equal(created.status, 201);

    const bookings = (await http.get('/admin/bookings')).body as unknown[];
    assert.deepEqual(bookings, [created.body]);
  });
});
