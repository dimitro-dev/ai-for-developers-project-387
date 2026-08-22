import type { Booking, CreateBookingRequest, EventType, Slot } from '@minical/api-client';

import { createBooking, loadPublicCalendar, loadPublicEventTypes, loadPublicSlots } from './guest';

/**
 * Ответ generated SDK в свободной форме: типизированные `Responses`/`Errors` не позволяют
 * выразить транспортный сбой (в поле `error` там лежит `TypeError`, а не `ErrorResponse`),
 * а именно он проверяется ниже.
 */
type MockedSdkResult = { data?: unknown; error?: unknown; response?: Response };

const mockGetPublicCalendar = jest.fn<Promise<MockedSdkResult>, [unknown?]>();
const mockGetPublicEventTypes = jest.fn<Promise<MockedSdkResult>, [unknown?]>();
const mockGetPublicSlots = jest.fn<Promise<MockedSdkResult>, [unknown?]>();
const mockCreatePublicBooking = jest.fn<Promise<MockedSdkResult>, [unknown?]>();

// Мокается сам generated SDK, а не fetch: use-case обязан ходить только через него (ADR §8),
// и подмена модуля это заодно доказывает — прямой сети в тестах нет.
jest.mock('@minical/api-client', () => ({
  getPublicCalendar: (options?: unknown) => mockGetPublicCalendar(options),
  getPublicEventTypes: (options?: unknown) => mockGetPublicEventTypes(options),
  getPublicSlots: (options?: unknown) => mockGetPublicSlots(options),
  createPublicBooking: (options?: unknown) => mockCreatePublicBooking(options),
}));

const serverResponse = new Response(null, { status: 400 });

beforeEach(() => {
  jest.clearAllMocks();
});

describe('loadPublicCalendar', () => {
  it('успех отдаёт view-model календаря', async () => {
    mockGetPublicCalendar.mockResolvedValue({ data: { displayName: 'Анна Петрова' } });

    await expect(loadPublicCalendar()).resolves.toEqual({
      ok: true,
      data: { displayName: 'Анна Петрова' },
    });
  });

  it('ошибка сервера отдаёт $error с кодом контракта', async () => {
    mockGetPublicCalendar.mockResolvedValue({
      error: { code: 'CALENDAR_NOT_CONFIGURED', message: 'Owner has not completed setup' },
      response: serverResponse,
    });

    await expect(loadPublicCalendar()).resolves.toEqual({
      ok: false,
      error: {
        code: 'CALENDAR_NOT_CONFIGURED',
        message: 'Owner has not completed setup',
        transport: false,
      },
    });
  });
});

describe('loadPublicEventTypes', () => {
  it('успех маппит список и нормализует description', async () => {
    const dtos: EventType[] = [
      { id: 'intro', name: 'Знакомство', description: 'Созвон', durationMinutes: 30 },
      { id: 'demo', name: 'Демо', durationMinutes: 45 },
    ];
    mockGetPublicEventTypes.mockResolvedValue({ data: dtos });

    await expect(loadPublicEventTypes()).resolves.toEqual({
      ok: true,
      data: [
        { id: 'intro', name: 'Знакомство', description: 'Созвон', durationMinutes: 30 },
        { id: 'demo', name: 'Демо', description: null, durationMinutes: 45 },
      ],
    });
  });

  it('пустой каталог — это успех с пустым списком, не ошибка', async () => {
    mockGetPublicEventTypes.mockResolvedValue({ data: [] });

    await expect(loadPublicEventTypes()).resolves.toEqual({ ok: true, data: [] });
  });

  it('обрыв сети даёт transport: true', async () => {
    // fetch бросил TypeError, SDK вернул его в error и оставил response неопределённым.
    mockGetPublicEventTypes.mockResolvedValue({ error: new TypeError('Network request failed') });

    await expect(loadPublicEventTypes()).resolves.toEqual({
      ok: false,
      error: { code: null, message: null, transport: true },
    });
  });
});

describe('loadPublicSlots', () => {
  it('передаёт eventTypeId в query и маппит слоты', async () => {
    const dtos: Slot[] = [
      {
        startAtUtc: '2026-08-13T09:00:00.000Z',
        endAtUtc: '2026-08-13T09:30:00.000Z',
        eventTypeId: 'intro',
      },
    ];
    mockGetPublicSlots.mockResolvedValue({ data: dtos });

    await expect(loadPublicSlots('intro')).resolves.toEqual({ ok: true, data: dtos });
    expect(mockGetPublicSlots).toHaveBeenCalledWith({ query: { eventTypeId: 'intro' } });
  });

  it('несуществующий тип встречи отдаёт EVENT_TYPE_NOT_FOUND', async () => {
    mockGetPublicSlots.mockResolvedValue({
      error: { code: 'EVENT_TYPE_NOT_FOUND', message: 'Event type does not exist' },
      response: serverResponse,
    });

    await expect(loadPublicSlots('ghost')).resolves.toEqual({
      ok: false,
      error: {
        code: 'EVENT_TYPE_NOT_FOUND',
        message: 'Event type does not exist',
        transport: false,
      },
    });
  });
});

describe('createBooking', () => {
  const request: CreateBookingRequest = {
    eventTypeId: 'intro',
    startAtUtc: '2026-08-13T09:00:00.000Z',
    id: '2f1c4d7e-0a1b-4c2d-8e3f-5a6b7c8d9e0f',
    guest: { name: 'Иван', email: 'ivan@example.com' },
  };

  const booking: Booking = {
    id: '2f1c4d7e-0a1b-4c2d-8e3f-5a6b7c8d9e0f',
    eventTypeId: 'intro',
    eventTypeName: 'Знакомство',
    startAtUtc: '2026-08-13T09:00:00.000Z',
    endAtUtc: '2026-08-13T09:30:00.000Z',
    guestName: 'Иван',
    guestEmail: 'ivan@example.com',
    createdAtUtc: '2026-08-12T18:00:00.000Z',
  };

  it('отправляет нагрузку телом запроса и маппит бронь', async () => {
    mockCreatePublicBooking.mockResolvedValue({ data: booking });

    await expect(createBooking(request)).resolves.toEqual({
      ok: true,
      data: { ...booking, guestNote: null },
    });
    expect(mockCreatePublicBooking).toHaveBeenCalledWith({ body: request });
  });

  it('занятый слот отдаёт SLOT_UNAVAILABLE', async () => {
    mockCreatePublicBooking.mockResolvedValue({
      error: { code: 'SLOT_UNAVAILABLE', message: 'Slot is already booked' },
      response: serverResponse,
    });

    await expect(createBooking(request)).resolves.toEqual({
      ok: false,
      error: { code: 'SLOT_UNAVAILABLE', message: 'Slot is already booked', transport: false },
    });
  });

  it('исключение SDK не выходит наружу — становится transport-ошибкой', async () => {
    mockCreatePublicBooking.mockRejectedValue(new TypeError('Failed to construct request'));

    await expect(createBooking(request)).resolves.toEqual({
      ok: false,
      error: { code: null, message: null, transport: true },
    });
  });
});
