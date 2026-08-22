import type { Booking, EventType, PublicCalendarResponse, Slot } from '@minical/api-client';

import {
  toBookingDto,
  toBookingView,
  toCalendarView,
  toEventTypeView,
  toEventTypeViews,
  toSlotView,
  toSlotViews,
} from './mappers';

describe('toCalendarView', () => {
  it('переносит displayName', () => {
    const dto: PublicCalendarResponse = { displayName: 'Анна Петрова' };

    expect(toCalendarView(dto)).toEqual({ displayName: 'Анна Петрова' });
  });
});

describe('toEventTypeView', () => {
  const withDescription: EventType = {
    id: 'intro-call',
    name: 'Знакомство',
    description: 'Короткий созвон',
    durationMinutes: 30,
  };

  it('переносит поля DTO', () => {
    expect(toEventTypeView(withDescription)).toEqual({
      id: 'intro-call',
      name: 'Знакомство',
      description: 'Короткий созвон',
      durationMinutes: 30,
    });
  });

  it('нормализует отсутствующий description в null', () => {
    const withoutDescription: EventType = { id: 'demo', name: 'Демо', durationMinutes: 45 };

    expect(toEventTypeView(withoutDescription).description).toBeNull();
  });

  it('view-model не тащит лишних ключей DTO', () => {
    expect(Object.keys(toEventTypeView(withDescription)).sort()).toEqual([
      'description',
      'durationMinutes',
      'id',
      'name',
    ]);
  });

  it('toEventTypeViews сохраняет порядок списка', () => {
    const dtos: EventType[] = [
      { id: 'a', name: 'A', durationMinutes: 15 },
      { id: 'b', name: 'B', durationMinutes: 30 },
    ];

    expect(toEventTypeViews(dtos).map((view) => view.id)).toEqual(['a', 'b']);
  });

  it('toEventTypeViews на пустом ответе даёт пустой список', () => {
    expect(toEventTypeViews([])).toEqual([]);
  });
});

describe('toSlotView', () => {
  const dto: Slot = {
    startAtUtc: '2026-08-13T09:00:00.000Z',
    endAtUtc: '2026-08-13T09:30:00.000Z',
    eventTypeId: 'intro-call',
  };

  it('переносит UTC-моменты как есть — арифметикой занимается сервер', () => {
    expect(toSlotView(dto)).toEqual({
      startAtUtc: '2026-08-13T09:00:00.000Z',
      endAtUtc: '2026-08-13T09:30:00.000Z',
      eventTypeId: 'intro-call',
    });
  });

  it('toSlotViews сохраняет порядок', () => {
    const later: Slot = { ...dto, startAtUtc: '2026-08-13T10:00:00.000Z' };

    expect(toSlotViews([dto, later]).map((view) => view.startAtUtc)).toEqual([
      '2026-08-13T09:00:00.000Z',
      '2026-08-13T10:00:00.000Z',
    ]);
  });
});

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

  it('переносит все поля брони', () => {
    expect(toBookingView(dto)).toEqual({
      id: '2f1c4d7e-0a1b-4c2d-8e3f-5a6b7c8d9e0f',
      eventTypeId: 'intro-call',
      eventTypeName: 'Знакомство',
      startAtUtc: '2026-08-13T09:00:00.000Z',
      endAtUtc: '2026-08-13T09:30:00.000Z',
      guestName: 'Иван',
      guestEmail: 'ivan@example.com',
      guestNote: 'Обсудить интеграцию',
      createdAtUtc: '2026-08-12T18:00:00.000Z',
    });
  });

  it('нормализует отсутствующий guestNote в null', () => {
    const { guestNote: _omitted, ...withoutNote } = dto;

    expect(toBookingView(withoutNote).guestNote).toBeNull();
  });
});

describe('toBookingDto', () => {
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

  it('возвращает исходный DTO для параметра route', () => {
    expect(toBookingDto(toBookingView(dto))).toEqual(dto);
  });

  it('null-комментарий становится отсутствующим полем DTO', () => {
    const { guestNote: _omitted, ...withoutNote } = dto;
    const restored = toBookingDto(toBookingView(withoutNote));

    expect(restored).toEqual(withoutNote);
    expect('guestNote' in restored).toBe(false);
  });
});
