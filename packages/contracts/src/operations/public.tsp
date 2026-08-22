namespace MiniCal;
using Http;

/**
 * Get the publicly visible identity of the calendar: the owner display name.
 * Requires calendar owner to have completed onboarding — until then the
 * operation answers 400 CALENDAR_NOT_CONFIGURED, which is how onboarding state
 * is expressed publicly.
 */
@route("/calendar")
@get
op getPublicCalendar():
  | {
      @statusCode _: 200;
      @body body: PublicCalendarResponse;
    }
  | {
      @statusCode _: 400;
      @body body: CalendarNotConfigured;
    };

/**
 * List all event types available for public booking.
 * Requires calendar owner to have completed onboarding.
 */
@route("/event-types")
@get
op getPublicEventTypes():
  | {
      @statusCode _: 200;
      @body body: EventType[];
    }
  | {
      @statusCode _: 400;
      @body body: CalendarNotConfigured;
    };

/**
 * Get available slots for a given event type.
 * Server computes a 14-day booking window in the owner's timezone.
 * Slots that are already booked or in the past are excluded.
 */
@route("/slots")
@get
op getPublicSlots(
  /** The event type id to get slots for. */
  @query
  @minLength(1)
  @maxLength(100)
  eventTypeId: string,
):
  | {
      @statusCode _: 200;
      @body body: Slot[];
    }
  | {
      @statusCode _: 400;
      @body body: ValidationError;
    }
  | {
      @statusCode _: 400;
      @body body: CalendarNotConfigured;
    }
  | {
      @statusCode _: 404;
      @body body: EventTypeNotFound;
    };

/**
 * Create a new booking.
 * Server validates the slot, computes endAtUtc from event type duration,
 * and checks for conflicts.
 *
 * Idempotency. The optional `id` of the request body is the idempotency key.
 * 201 means the booking was created by this request; 200 means the request was
 * an idempotent repeat and the body carries the booking created by an earlier
 * attempt — nothing was created. A request counts as a repeat when its key
 * matches an existing booking and its payload is equivalent: `eventTypeId`,
 * `startAtUtc` and every field of `guest` are equal as parsed values, not as
 * raw strings (the same instant written `...Z` and `....000Z` is the same
 * payload). The key `id` itself takes no part in the comparison. The same key
 * with a payload that is not equivalent fails with DUPLICATE_BOOKING_ID.
 * The comparison by key runs before the availability check and only for the key
 * that arrived in the request, so a slot taken by a different key still fails
 * with SLOT_UNAVAILABLE — idempotency never masks a real conflict.
 * Because `id` is optional, a client that needs a safe retry has to generate the
 * key before its first attempt: without a key a repeat cannot be recognised.
 */
@route("/bookings")
@post
op createPublicBooking(@body body: CreateBookingRequest):
  | {
      @statusCode _: 201;
      @body body: Booking;
    }
  | {
      @statusCode _: 200;
      @body body: Booking;
    }
  | {
      @statusCode _: 400;
      @body body: ValidationError;
    }
  | {
      @statusCode _: 400;
      @body body: CalendarNotConfigured;
    }
  | {
      @statusCode _: 404;
      @body body: EventTypeNotFound;
    }
  | {
      @statusCode _: 400;
      @body body: SlotOutsideWindow;
    }
  | {
      @statusCode _: 400;
      @body body: SlotNotAligned;
    }
  | {
      @statusCode _: 409;
      @body body: SlotUnavailable;
    }
  | {
      @statusCode _: 409;
      @body body: DuplicateBookingId;
    }
  | {
      @statusCode _: 400;
      @body body: GuestNameRequired;
    }
  | {
      @statusCode _: 400;
      @body body: GuestEmailRequired;
    };
