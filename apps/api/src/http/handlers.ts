// По одному обработчику на строку реестра. Тотальность `Record<OperationId, …>` не
// даёт ни забыть операцию, ни добавить лишнюю (Р9).
//
// Обработчик — единственный, кто знает transport DTO: он валидирует вход
// generated-схемой, собирает плоский command и отдаёт результат презентеру.

import type { RequestHandler } from 'express';
import type { HealthResponse, SetupRequest } from '@minical/backend-contract';
import {
  zCompleteAdminSetupBody,
  zCreateAdminEventTypeBody,
  zCreatePublicBookingBody,
  zGetPublicSlotsQuery,
  zUpdateAdminSettingsBody,
} from '@minical/backend-contract/zod';

import type { AppConfig } from '../config.ts';
import type { Store } from '../store/repositories.ts';
import * as booking from '../usecases/booking.ts';
import * as owner from '../usecases/owner.ts';
import { parseOrThrow } from './parse.ts';
import { present } from './present.ts';
import type { OperationId } from './routes.ts';

export interface Deps {
  config: AppConfig;
  store: Store;
}

export const handlers: Record<OperationId, (deps: Deps) => RequestHandler> = {
  getHealth: () => (_req, res) => {
    // Тело собирается из литерала, а не из состояния сервера: регрессия task-006 с
    // лишним полем не повторяется (FR1).
    const body: HealthResponse = { status: 'ok' };
    res.status(200).json(body);
  },

  getAdminSetup: (deps) => async (_req, res) => {
    res.status(200).json(present.setupState(await owner.getAdminSetup(deps.store)));
  },

  completeAdminSetup: (deps) => async (req, res) => {
    const body = parseOrThrow(zCompleteAdminSetupBody, req.body);
    const record = await owner.completeAdminSetup(deps.store, toSetupCommand(body));
    res.status(200).json(present.settings(record, deps.config.publicWebUrl));
  },

  getAdminSettings: (deps) => async (_req, res) => {
    const record = await owner.getAdminSettings(deps.store);
    res.status(200).json(present.settings(record, deps.config.publicWebUrl));
  },

  updateAdminSettings: (deps) => async (req, res) => {
    const body = parseOrThrow(zUpdateAdminSettingsBody, req.body);
    const record = await owner.updateAdminSettings(deps.store, toSetupCommand(body));
    res.status(200).json(present.settings(record, deps.config.publicWebUrl));
  },

  getAdminEventTypes: (deps) => async (_req, res) => {
    const eventTypes = await owner.getAdminEventTypes(deps.store);
    res.status(200).json(eventTypes.map(present.eventType));
  },

  createAdminEventType: (deps) => async (req, res) => {
    const body = parseOrThrow(zCreateAdminEventTypeBody, req.body);
    const created = await owner.createAdminEventType(deps.store, {
      id: body.id,
      name: body.name,
      description: body.description,
      durationMinutes: body.durationMinutes,
    });
    res.status(201).json(present.eventType(created));
  },

  getAdminUpcomingBookings: (deps) => async (_req, res) => {
    // Проверки настроенности нет: CALENDAR_NOT_CONFIGURED у операции не документирован,
    // до onboarding список просто пуст (Р3).
    const bookings = await owner.getAdminUpcomingBookings(deps.store);
    res.status(200).json(bookings.map(present.booking));
  },

  getPublicCalendar: (deps) => async (_req, res) => {
    const record = await owner.getPublicCalendar(deps.store);
    res.status(200).json(present.publicCalendar(record));
  },

  getPublicEventTypes: (deps) => async (_req, res) => {
    const eventTypes = await owner.getPublicEventTypes(deps.store);
    res.status(200).json(eventTypes.map(present.eventType));
  },

  getPublicSlots: (deps) => async (req, res) => {
    const query = parseOrThrow(zGetPublicSlotsQuery, req.query);
    const slots = await booking.getPublicSlots(deps.store, { eventTypeId: query.eventTypeId });
    res.status(200).json(slots.map((slot) => present.slot(slot, query.eventTypeId)));
  },

  createPublicBooking: (deps) => async (req, res) => {
    const body = parseOrThrow(zCreatePublicBookingBody, req.body);
    const result = await booking.createPublicBooking(deps.store, {
      id: body.id,
      eventTypeId: body.eventTypeId,
      startAtUtc: new Date(body.startAtUtc),
      guestName: body.guest.name,
      guestEmail: body.guest.email,
      guestNote: body.guest.note,
    });
    // Единственная операция с двумя успешными статусами: 201 — бронь создана этим
    // запросом, 200 — идемпотентный повтор с ранее созданной бронью.
    res.status(result.replayed ? 200 : 201).json(present.booking(result.booking));
  },
};

/**
 * transport DTO → domain command. Вложенный `guest` разворачивается в плоские поля
 * прямо в `createPublicBooking` (I13), настройкам достаточно этой функции.
 */
function toSetupCommand(body: SetupRequest): owner.SetupCommand {
  return {
    displayName: body.displayName,
    timeZone: body.timeZone,
    slotIntervalMinutes: body.slotIntervalMinutes,
    availabilityRules: body.availabilityRules.map((rule) => ({
      daysOfWeek: [...rule.daysOfWeek],
      startLocal: rule.startLocal,
      endLocal: rule.endLocal,
    })),
  };
}
