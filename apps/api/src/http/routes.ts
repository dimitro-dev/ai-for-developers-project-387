// Декларативный реестр операций контракта (Р9): данные, без обработчиков.
// createApp монтирует приложение только циклом по этому массиву, поэтому
// смонтированное множество маршрутов равно реестру по построению, а тесту достаточно
// сверить реестр с generated/openapi.yaml (FR7).

export const ROUTES = [
  { operationId: 'getHealth', method: 'get', path: '/health' },
  { operationId: 'getAdminSetup', method: 'get', path: '/admin/setup' },
  { operationId: 'completeAdminSetup', method: 'put', path: '/admin/setup' },
  { operationId: 'getAdminSettings', method: 'get', path: '/admin/settings' },
  { operationId: 'updateAdminSettings', method: 'put', path: '/admin/settings' },
  { operationId: 'getAdminEventTypes', method: 'get', path: '/admin/event-types' },
  { operationId: 'createAdminEventType', method: 'post', path: '/admin/event-types' },
  { operationId: 'getAdminUpcomingBookings', method: 'get', path: '/admin/bookings' },
  { operationId: 'getPublicCalendar', method: 'get', path: '/calendar' },
  { operationId: 'getPublicEventTypes', method: 'get', path: '/event-types' },
  { operationId: 'getPublicSlots', method: 'get', path: '/slots' },
  { operationId: 'createPublicBooking', method: 'post', path: '/bookings' },
] as const;

export type OperationId = (typeof ROUTES)[number]['operationId'];
export type HttpMethod = (typeof ROUTES)[number]['method'];
