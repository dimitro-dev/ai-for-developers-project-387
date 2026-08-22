namespace MiniCal;
using Http;

/** Get current onboarding setup state of the calendar owner. */
@route("/admin/setup")
@get
op getAdminSetup(): {
  @statusCode _: 200;
  @body body: SetupStateResponse;
};

/**
 * Complete initial owner onboarding.
 * Fails with ONBOARDING_ALREADY_COMPLETED if setup has already been done.
 */
@route("/admin/setup")
@put
op completeAdminSetup(@body body: SetupRequest):
  | {
      @statusCode _: 200;
      @body body: CalendarSettingsResponse;
    }
  | {
      @statusCode _: 400;
      @body body: ValidationError;
    }
  | {
      @statusCode _: 409;
      @body body: OnboardingAlreadyCompleted;
    };

/** Get current calendar settings. Requires onboarding to be completed. */
@route("/admin/settings")
@get
op getAdminSettings():
  | {
      @statusCode _: 200;
      @body body: CalendarSettingsResponse;
    }
  | {
      @statusCode _: 400;
      @body body: CalendarNotConfigured;
    };

/** Fully replace calendar settings. Requires onboarding to be completed. */
@route("/admin/settings")
@put
op updateAdminSettings(@body body: SetupRequest):
  | {
      @statusCode _: 200;
      @body body: CalendarSettingsResponse;
    }
  | {
      @statusCode _: 400;
      @body body: ValidationError;
    }
  | {
      @statusCode _: 400;
      @body body: CalendarNotConfigured;
    };

/** Get all event types owned by the calendar owner. */
@route("/admin/event-types")
@get
op getAdminEventTypes(): {
  @statusCode _: 200;
  @body body: EventType[];
};

/**
 * Create a new event type.
 * Fails with DUPLICATE_EVENT_TYPE_ID if an event type with the same id exists.
 */
@route("/admin/event-types")
@post
op createAdminEventType(@body body: CreateEventTypeRequest):
  | {
      @statusCode _: 201;
      @body body: EventType;
    }
  | {
      @statusCode _: 400;
      @body body: ValidationError;
    }
  | {
      @statusCode _: 409;
      @body body: DuplicateEventTypeId;
    };

/** Get all upcoming bookings for all event types. */
@route("/admin/bookings")
@get
op getAdminUpcomingBookings(): {
  @statusCode _: 200;
  @body body: Booking[];
};
