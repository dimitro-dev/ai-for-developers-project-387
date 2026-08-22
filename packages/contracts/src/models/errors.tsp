namespace MiniCal;

/** Base error response with machine-readable code and human-readable message. */
model ErrorResponse {
  /** Machine-readable error code. */
  @maxLength(100)
  code: string;

  /** Human-readable error description. */
  @maxLength(2000)
  message: string;
}

/** Generic validation error — input does not satisfy transport constraints. */
model ValidationError extends ErrorResponse {
  code: "VALIDATION_ERROR";
}

/** Calendar owner has not completed onboarding setup yet. */
model CalendarNotConfigured extends ErrorResponse {
  code: "CALENDAR_NOT_CONFIGURED";
}

/** Calendar owner has already completed onboarding; cannot set up again. */
model OnboardingAlreadyCompleted extends ErrorResponse {
  code: "ONBOARDING_ALREADY_COMPLETED";
}

/** Referenced EventType does not exist. */
model EventTypeNotFound extends ErrorResponse {
  code: "EVENT_TYPE_NOT_FOUND";
}

/** EventType with the given id already exists. */
model DuplicateEventTypeId extends ErrorResponse {
  code: "DUPLICATE_EVENT_TYPE_ID";
}

/** Requested slot is already booked or conflicts with an existing booking. */
model SlotUnavailable extends ErrorResponse {
  code: "SLOT_UNAVAILABLE";
}

/** Requested slot start is outside the 14-day booking window. */
model SlotOutsideWindow extends ErrorResponse {
  code: "SLOT_OUTSIDE_WINDOW";
}

/** Requested slot start does not align with the slot interval grid. */
model SlotNotAligned extends ErrorResponse {
  code: "SLOT_NOT_ALIGNED";
}

/**
 * The provided id key belongs to an existing booking whose payload differs from the request.
 * A repeat with an equivalent payload is not an error: it returns 200 with the existing booking.
 */
model DuplicateBookingId extends ErrorResponse {
  code: "DUPLICATE_BOOKING_ID";
}

/** Guest name was not provided. */
model GuestNameRequired extends ErrorResponse {
  code: "GUEST_NAME_REQUIRED";
}

/** Guest email was not provided or is invalid. */
model GuestEmailRequired extends ErrorResponse {
  code: "GUEST_EMAIL_REQUIRED";
}
