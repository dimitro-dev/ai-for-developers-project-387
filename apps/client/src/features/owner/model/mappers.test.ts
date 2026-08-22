import type { Booking, CalendarSettingsResponse, SetupRequest } from '@minical/api-client';

import { toBookingView, toBookingViews, toOwnerSettingsView, toSetupRequest } from './mappers';
import type { OwnerSettingsView } from './types';

describe('toBookingView', () => {
  const dto: Booking = {
    id: '2f1c4d7e-0a1b-4c2d-8e3f-5a6b7c8d9e0f',
    eventTypeId: 'intro-call',
    eventTypeName: 'Знакомство',
    startAtUtc: '2026-08-13T09:00:00.000Z',
    endAtUtc: '2026-08-13T09:30:00.000Z',
    guestName: 'Иван',
    guestEmail: 'ivan@example.com',
    guestNote: 'Обсудить интеграцию',
    createdAtUtc: '2026-08-12T18:00:00.000Z',
  };

  it('переименовывает eventTypeName в eventTypeTitle и группирует гостя в GuestView', () => {
    expect(toBookingView(dto)).toEqual({
      id: '2f1c4d7e-0a1b-4c2d-8e3f-5a6b7c8d9e0f',
      eventTypeTitle: 'Знакомство',
      startAt: '2026-08-13T09:00:00.000Z',
      endAt: '2026-08-13T09:30:00.000Z',
      guest: { name: 'Иван', email: 'ivan@example.com', comment: 'Обсудить интеграцию' },
    });
  });

  it('отсутствующий guestNote даёт guest.comment === undefined, а не null', () => {
    const { guestNote: _omitted, ...withoutNote } = dto;

    expect(toBookingView(withoutNote).guest.comment).toBeUndefined();
  });

  it('toBookingViews сохраняет порядок списка', () => {
    const later: Booking = { ...dto, id: 'later', startAtUtc: '2026-08-13T10:00:00.000Z' };

    expect(toBookingViews([dto, later]).map((view) => view.id)).toEqual([dto.id, 'later']);
  });

  it('toBookingViews на пустом ответе даёт пустой список', () => {
    expect(toBookingViews([])).toEqual([]);
  });
});

describe('toOwnerSettingsView', () => {
  const dto: CalendarSettingsResponse = {
    displayName: 'Анна Петрова',
    timeZone: 'Europe/Moscow',
    availabilityRules: [{ daysOfWeek: ['Monday', 'Tuesday'], startLocal: '09:00', endLocal: '18:00' }],
    slotIntervalMinutes: 30,
    publicUrl: 'https://minical.example.com/anna',
  };

  it('переносит все поля настроек как есть', () => {
    expect(toOwnerSettingsView(dto)).toEqual({
      displayName: 'Анна Петрова',
      timeZone: 'Europe/Moscow',
      availabilityRules: [{ daysOfWeek: ['Monday', 'Tuesday'], startLocal: '09:00', endLocal: '18:00' }],
      slotIntervalMinutes: 30,
      publicUrl: 'https://minical.example.com/anna',
    });
  });

  it('view-model не тащит лишних ключей DTO', () => {
    expect(Object.keys(toOwnerSettingsView(dto)).sort()).toEqual([
      'availabilityRules',
      'displayName',
      'publicUrl',
      'slotIntervalMinutes',
      'timeZone',
    ]);
  });
});

describe('toSetupRequest', () => {
  const base: OwnerSettingsView = {
    displayName: 'Анна Петрова',
    timeZone: 'Europe/Moscow',
    availabilityRules: [{ daysOfWeek: ['Monday'], startLocal: '09:00', endLocal: '18:00' }],
    slotIntervalMinutes: 30,
    publicUrl: 'https://minical.example.com/anna',
  };

  it('без patch отдаёт SetupRequest из снимка настроек один в один', () => {
    const expected: SetupRequest = {
      displayName: 'Анна Петрова',
      timeZone: 'Europe/Moscow',
      availabilityRules: [{ daysOfWeek: ['Monday'], startLocal: '09:00', endLocal: '18:00' }],
      slotIntervalMinutes: 30,
    };

    expect(toSetupRequest(base)).toEqual(expected);
  });

  it('экран профиля (09) правит displayName/timeZone — расписание и шаг слота остаются из base', () => {
    const request = toSetupRequest(base, { displayName: 'Анна Иванова', timeZone: 'Europe/Berlin' });

    expect(request).toEqual({
      displayName: 'Анна Иванова',
      timeZone: 'Europe/Berlin',
      availabilityRules: base.availabilityRules,
      slotIntervalMinutes: base.slotIntervalMinutes,
    });
  });

  it('экран рабочего времени (07) правит расписание — профиль остаётся из base', () => {
    const newRules: OwnerSettingsView['availabilityRules'] = [
      { daysOfWeek: ['Saturday'], startLocal: '10:00', endLocal: '14:00' },
    ];

    const request = toSetupRequest(base, {
      availabilityRules: newRules,
      slotIntervalMinutes: 15,
    });

    expect(request).toEqual({
      displayName: base.displayName,
      timeZone: base.timeZone,
      availabilityRules: newRules,
      slotIntervalMinutes: 15,
    });
  });

  it('не мутирует base', () => {
    const snapshot = { ...base, availabilityRules: [...base.availabilityRules] };

    toSetupRequest(base, { displayName: 'Другое имя' });

    expect(base).toEqual(snapshot);
  });
});
