import type {
  Booking,
  CalendarSettingsResponse,
  CreateEventTypeRequest,
  EventType,
  SetupRequest,
  SetupStateResponse,
} from '@minical/api-client';

import {
  checkSetup,
  completeSetup,
  createEventType,
  loadEventTypes,
  loadOwnerSettings,
  loadUpcomingBookings,
  saveOwnerSettings,
} from './owner';

/**
 * Ответ generated SDK в свободной форме — тот же приём, что и в
 * `features/guest/usecases/guest.test.ts`: типизированные `Responses`/`Errors` не выражают
 * транспортный сбой (`error` там — `TypeError`, а не `ErrorResponse`), а именно он проверяется.
 */
type MockedSdkResult = { data?: unknown; error?: unknown; response?: Response };

const mockGetAdminSetup = jest.fn<Promise<MockedSdkResult>, [unknown?]>();
const mockCompleteAdminSetup = jest.fn<Promise<MockedSdkResult>, [unknown?]>();
const mockGetAdminUpcomingBookings = jest.fn<Promise<MockedSdkResult>, [unknown?]>();
const mockGetAdminSettings = jest.fn<Promise<MockedSdkResult>, [unknown?]>();
const mockUpdateAdminSettings = jest.fn<Promise<MockedSdkResult>, [unknown?]>();
const mockGetAdminEventTypes = jest.fn<Promise<MockedSdkResult>, [unknown?]>();
const mockCreateAdminEventType = jest.fn<Promise<MockedSdkResult>, [unknown?]>();

// Мокается сам generated SDK, а не fetch: use-case обязан ходить только через него
// (`apps/client/AGENTS.md` — "использовать generated SDK"), и подмена модуля это заодно
// доказывает — прямой сети в тестах нет.
jest.mock('@minical/api-client', () => ({
  getAdminSetup: (options?: unknown) => mockGetAdminSetup(options),
  completeAdminSetup: (options?: unknown) => mockCompleteAdminSetup(options),
  getAdminUpcomingBookings: (options?: unknown) => mockGetAdminUpcomingBookings(options),
  getAdminSettings: (options?: unknown) => mockGetAdminSettings(options),
  updateAdminSettings: (options?: unknown) => mockUpdateAdminSettings(options),
  getAdminEventTypes: (options?: unknown) => mockGetAdminEventTypes(options),
  createAdminEventType: (options?: unknown) => mockCreateAdminEventType(options),
}));

const serverResponse = new Response(null, { status: 400 });

beforeEach(() => {
  jest.clearAllMocks();
});

describe('checkSetup', () => {
  it('успех отдаёт SetupStateResponse без мапинга (модель source="api")', async () => {
    const dto: SetupStateResponse = { onboardingCompleted: true, displayName: 'Анна Петрова' };
    mockGetAdminSetup.mockResolvedValue({ data: dto });

    await expect(checkSetup()).resolves.toEqual({ ok: true, data: dto });
  });

  it('обрыв сети даёт transport: true', async () => {
    mockGetAdminSetup.mockResolvedValue({ error: new TypeError('Network request failed') });

    await expect(checkSetup()).resolves.toEqual({
      ok: false,
      error: { code: null, message: null, transport: true },
    });
  });
});

describe('completeSetup', () => {
  const request: SetupRequest = {
    displayName: 'Анна Петрова',
    timeZone: 'Europe/Moscow',
    availabilityRules: [{ daysOfWeek: ['Monday'], startLocal: '09:00', endLocal: '18:00' }],
    slotIntervalMinutes: 30,
  };

  const settings: CalendarSettingsResponse = {
    ...request,
    publicUrl: 'https://minical.example.com/anna',
  };

  it('отправляет SetupRequest телом запроса и маппит настройки', async () => {
    mockCompleteAdminSetup.mockResolvedValue({ data: settings });

    await expect(completeSetup(request)).resolves.toEqual({ ok: true, data: settings });
    expect(mockCompleteAdminSetup).toHaveBeenCalledWith({ body: request });
  });

  it('повторный setup отдаёт ONBOARDING_ALREADY_COMPLETED', async () => {
    mockCompleteAdminSetup.mockResolvedValue({
      error: { code: 'ONBOARDING_ALREADY_COMPLETED', message: 'Owner has already completed setup' },
      response: serverResponse,
    });

    await expect(completeSetup(request)).resolves.toEqual({
      ok: false,
      error: {
        code: 'ONBOARDING_ALREADY_COMPLETED',
        message: 'Owner has already completed setup',
        transport: false,
      },
    });
  });
});

describe('loadUpcomingBookings', () => {
  const booking: Booking = {
    id: '2f1c4d7e-0a1b-4c2d-8e3f-5a6b7c8d9e0f',
    eventTypeId: 'intro-call',
    eventTypeName: 'Знакомство',
    startAtUtc: '2026-08-13T09:00:00.000Z',
    endAtUtc: '2026-08-13T09:30:00.000Z',
    guestName: 'Иван',
    guestEmail: 'ivan@example.com',
    createdAtUtc: '2026-08-12T18:00:00.000Z',
  };

  it('успех маппит Booking[] в BookingView[]', async () => {
    mockGetAdminUpcomingBookings.mockResolvedValue({ data: [booking] });

    await expect(loadUpcomingBookings()).resolves.toEqual({
      ok: true,
      data: [
        {
          id: booking.id,
          eventTypeTitle: 'Знакомство',
          startAt: booking.startAtUtc,
          endAt: booking.endAtUtc,
          guest: { name: 'Иван', email: 'ivan@example.com', comment: undefined },
        },
      ],
    });
  });

  it('пустой список встреч — это успех с пустым списком, не ошибка', async () => {
    mockGetAdminUpcomingBookings.mockResolvedValue({ data: [] });

    await expect(loadUpcomingBookings()).resolves.toEqual({ ok: true, data: [] });
  });
});

describe('loadOwnerSettings', () => {
  const settings: CalendarSettingsResponse = {
    displayName: 'Анна Петрова',
    timeZone: 'Europe/Moscow',
    availabilityRules: [{ daysOfWeek: ['Monday'], startLocal: '09:00', endLocal: '18:00' }],
    slotIntervalMinutes: 30,
    publicUrl: 'https://minical.example.com/anna',
  };

  it('успех отдаёт полный OwnerSettingsView', async () => {
    mockGetAdminSettings.mockResolvedValue({ data: settings });

    await expect(loadOwnerSettings()).resolves.toEqual({ ok: true, data: settings });
  });

  it('CALENDAR_NOT_CONFIGURED отдаётся как $error с кодом контракта', async () => {
    mockGetAdminSettings.mockResolvedValue({
      error: { code: 'CALENDAR_NOT_CONFIGURED', message: 'Owner has not completed setup' },
      response: serverResponse,
    });

    await expect(loadOwnerSettings()).resolves.toEqual({
      ok: false,
      error: {
        code: 'CALENDAR_NOT_CONFIGURED',
        message: 'Owner has not completed setup',
        transport: false,
      },
    });
  });
});

describe('saveOwnerSettings', () => {
  const request: SetupRequest = {
    displayName: 'Анна Петрова',
    timeZone: 'Europe/Moscow',
    availabilityRules: [{ daysOfWeek: ['Monday'], startLocal: '09:00', endLocal: '18:00' }],
    slotIntervalMinutes: 30,
  };
  const settings: CalendarSettingsResponse = {
    ...request,
    publicUrl: 'https://minical.example.com/anna',
  };

  it('отправляет полный SetupRequest телом запроса (read-modify-write)', async () => {
    mockUpdateAdminSettings.mockResolvedValue({ data: settings });

    await expect(saveOwnerSettings(request)).resolves.toEqual({ ok: true, data: settings });
    expect(mockUpdateAdminSettings).toHaveBeenCalledWith({ body: request });
  });

  it('ValidationError отдаётся как $error', async () => {
    mockUpdateAdminSettings.mockResolvedValue({
      error: { code: 'VALIDATION_ERROR', message: 'Invalid request' },
      response: serverResponse,
    });

    await expect(saveOwnerSettings(request)).resolves.toEqual({
      ok: false,
      error: { code: 'VALIDATION_ERROR', message: 'Invalid request', transport: false },
    });
  });
});

describe('loadEventTypes', () => {
  it('успех отдаёт EventType[] без мапинга (модель source="api")', async () => {
    const dtos: EventType[] = [
      { id: 'intro', name: 'Знакомство', description: 'Созвон', durationMinutes: 30 },
      { id: 'demo', name: 'Демо', durationMinutes: 45 },
    ];
    mockGetAdminEventTypes.mockResolvedValue({ data: dtos });

    await expect(loadEventTypes()).resolves.toEqual({ ok: true, data: dtos });
  });

  it('пустой список типов — это успех с пустым списком, не ошибка', async () => {
    mockGetAdminEventTypes.mockResolvedValue({ data: [] });

    await expect(loadEventTypes()).resolves.toEqual({ ok: true, data: [] });
  });
});

describe('createEventType', () => {
  const request: CreateEventTypeRequest = {
    id: 'demo-call',
    name: 'Демо-встреча',
    durationMinutes: 30,
  };
  const created: EventType = request;

  it('отправляет CreateEventTypeRequest телом запроса и отдаёт созданный тип', async () => {
    mockCreateAdminEventType.mockResolvedValue({ data: created });

    await expect(createEventType(request)).resolves.toEqual({ ok: true, data: created });
    expect(mockCreateAdminEventType).toHaveBeenCalledWith({ body: request });
  });

  it('дублирующийся публичный id отдаёт DUPLICATE_EVENT_TYPE_ID', async () => {
    mockCreateAdminEventType.mockResolvedValue({
      error: { code: 'DUPLICATE_EVENT_TYPE_ID', message: 'Event type with this id already exists' },
      response: serverResponse,
    });

    await expect(createEventType(request)).resolves.toEqual({
      ok: false,
      error: {
        code: 'DUPLICATE_EVENT_TYPE_ID',
        message: 'Event type with this id already exists',
        transport: false,
      },
    });
  });

  it('исключение SDK не выходит наружу — становится transport-ошибкой', async () => {
    mockCreateAdminEventType.mockRejectedValue(new TypeError('Failed to construct request'));

    await expect(createEventType(request)).resolves.toEqual({
      ok: false,
      error: { code: null, message: null, transport: true },
    });
  });
});
