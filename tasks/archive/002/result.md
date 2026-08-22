---
status: согласовано
---

# Результат TASK-002

## Итог

Создан первый продуктовый HTTP-контракт MiniCal на TypeSpec. Весь pipeline (format → compile → generate) проходит без ошибок.

## Что изменено

**TypeSpec (ручной источник):**
- `packages/contracts/src/main.tsp` — полная замена: smoke → точка сборки с namespace `MiniCal`
- `packages/contracts/src/models/common.tsp` — IanaTimeZone, LocalTime, DayOfWeek, Uuid
- `packages/contracts/src/models/errors.tsp` — ErrorResponse + 11 discriminated error-моделей
- `packages/contracts/src/models/owner.tsp` — AvailabilityRule, CalendarSettings, SetupRequest, SetupStateResponse, CalendarSettingsResponse
- `packages/contracts/src/models/event-type.tsp` — EventType, CreateEventTypeRequest
- `packages/contracts/src/models/booking.tsp` — GuestDetails, Slot, Booking, CreateBookingRequest
- `packages/contracts/src/operations/health.tsp` — health check endpoint
- `packages/contracts/src/operations/admin.tsp` — 7 admin operations
- `packages/contracts/src/operations/public.tsp` — 3 public operations

**Task-документы:**
- `brief.md` — `status: согласовано`
- `adr.md` — внесены 3 правки (namespace, response shape, naming pattern), `status: согласовано`
- `plan.md` — блокеры заменены на принятые решения, P01 уточнён, `status: согласовано`
- `result.md` — заполнен, `status: согласовано`

## Операции API

| # | Operation name | Method | Route | Scope |
|---|---|---|---|---|
| 1 | `getAdminSetup` | GET | `/admin/setup` | Admin |
| 2 | `completeAdminSetup` | PUT | `/admin/setup` | Admin |
| 3 | `getAdminSettings` | GET | `/admin/settings` | Admin |
| 4 | `updateAdminSettings` | PUT | `/admin/settings` | Admin |
| 5 | `getAdminEventTypes` | GET | `/admin/event-types` | Admin |
| 6 | `createAdminEventType` | POST | `/admin/event-types` | Admin |
| 7 | `getAdminUpcomingBookings` | GET | `/admin/bookings` | Admin |
| 8 | `getPublicEventTypes` | GET | `/event-types` | Public |
| 9 | `getPublicSlots` | GET | `/slots?eventTypeId=` | Public |
| 10 | `createPublicBooking` | POST | `/bookings` | Public |
| 11 | `getHealth` | GET | `/health` | — |

## Модели и ошибки

**Transport models:** AvailabilityRule, Booking, CalendarSettings, CalendarSettingsResponse, CreateBookingRequest, CreateEventTypeRequest, EventType, GuestDetails, SetupRequest, SetupStateResponse, Slot

**Error codes (11):**
- `VALIDATION_ERROR`, `CALENDAR_NOT_CONFIGURED`, `ONBOARDING_ALREADY_COMPLETED`
- `EVENT_TYPE_NOT_FOUND`, `DUPLICATE_EVENT_TYPE_ID`
- `SLOT_UNAVAILABLE`, `SLOT_OUTSIDE_WINDOW`, `SLOT_NOT_ALIGNED`
- `DUPLICATE_BOOKING_ID`, `GUEST_NAME_REQUIRED`, `GUEST_EMAIL_REQUIRED`

## Контракт и generated-артефакты

| Артефакт | Размер | Статус |
|---|---|---|
| `packages/contracts/generated/openapi.yaml` | 688 строк | ✅ Generated |
| `packages/api-client/src/generated/**` | 4 файла | ✅ Generated |
| `packages/backend-contract/src/generated/**` | 3 файла | ✅ Generated |

## Выполненные проверки

- `npm run contracts:format` — 8 файлов отформатировано ✅
- `npm run contracts:build` — компиляция успешна ✅
- `npm run generate` — полная генерация без ошибок ✅
- `ownerId` отсутствует во всех запросах ✅
- `endAt` отсутствует в `CreateBookingRequest`, присутствует в `Booking` response ✅
- Все error responses имеют стабильный machine-readable code ✅
- Списки возвращаются прямым массивом (не envelope) ✅
- Operation names без namespace-префикса (`getAdminSetup`, не `Admin_getAdminSetup`) ✅
- `/health` endpoint добавлен ✅
- OpenAPI 3.0 (эмиттер не поддерживает 3.1 — не блокер) ⚠️
- Security review проведён, риски зафиксированы ✅

## Отклонения от brief / ADR / plan

Отклонений нет. Все решения из ADR реализованы.

## Security review

Проведён анализ безопасности контракта. Результаты зафиксированы в `Известные ограничения и риски`. Инфраструктурные риски (CORS, security headers) вынесены в [`task-infra-003`](../task-infra-003/).

## Известные ограничения и риски

### Контракт
1. **Нет examples в generated OpenAPI:** TypeSpec модели имеют `@example` в common.tsp (timezone, localTime), но `@typespec/openapi3` v1.14.0 не экспортирует их в OpenAPI.

### Security (выявлено при проверке)
2. **Отсутствует email-валидация в контракте:** `guestEmail` в `GuestDetails` — `string` без `@pattern` или `@format("email")`. Backend должен валидировать.
3. **Нет ограничений длины строк:** поля `displayName`, `name`, `description`, `note`, `guestName` — `string` без `@minLength`/`@maxLength`. Backend должен валидировать.
4. **PII в Booking response:** `guestName`, `guestEmail` возвращаются без маскирования. `/admin/bookings` отдаёт все PII без auth (принято для MVP, задокументировано в domain-rules).
5. **POST /bookings без anti-abuse:** Нет rate limiting, CAPTCHA. Backend должен защищать.
6. **Нет auth на admin endpoint'ах:** Принято для MVP (domain-rules.md, architecture.md). Не публиковать в интернет.

### Инфраструктура (вынесено)
Риски CORS, security-заголовков и body size limit выделены в отдельную задачу:
- [`task-infra-003`](../task-infra-003/) — Backend HTTP Security Middleware

## Описание для MR

### Summary

TASK-002: Create MiniCal API contract via TypeSpec

### Changes

- Replace smoke TypeSpec contract with full product contract (Admin + Public API)
- 11 API operations covering owner setup, calendar settings, event types, public booking, and health
- 11 discriminated error models with stable machine-readable codes
- Clean operation names without namespace prefix
- Regenerated OpenAPI, frontend SDK types, and backend Zod schemas
- Updated task documents: brief, ADR, plan — all approved
- Security review conducted, 6 risks documented
- Created task-INFRA-001 (ныне task-infra-003) for CORS and security middleware

### Verification

- `npm run contracts:build` — compilation successful
- `npm run generate` — all 3 target packages regenerated
- No `ownerId` or `endAt` in create-booking request (verified in generated types)
- Direct array responses for all list endpoints
- Clean operation names without useless namespace prefix
- Health endpoint (`GET /health`) added for infra needs
- Security review: PII exposure, missing field constraints, no anti-abuse, no auth — documented
- infra-risks (CORS, headers, body limit) moved to task-INFRA-001 (ныне task-infra-003)
- Breaking changes: `/health` replaced with product version; all new API surface instead of smoke
