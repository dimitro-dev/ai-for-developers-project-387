namespace MiniCal;

/** One availability rule: days of the week and a local time interval. */
model AvailabilityRule {
  /** Days of the week this rule applies to. */
  @minItems(1)
  daysOfWeek: DayOfWeek[];

  /** Start of the working interval (local time, inclusive). */
  startLocal: LocalTime;

  /** End of the working interval (local time, exclusive). */
  endLocal: LocalTime;
}

/** Calendar settings that control slot generation. */
model CalendarSettings {
  /** IANA timezone for the calendar. */
  timeZone: IanaTimeZone;

  /** Rules defining working hours. At least one rule is required. */
  @minItems(1)
  availabilityRules: AvailabilityRule[];

  /** Slot grid interval in minutes (must be a divisor of 60, >= 15). */
  @minValue(15)
  @maxValue(60)
  slotIntervalMinutes: int32;
}

/** Request payload to complete initial owner setup or update settings. */
model SetupRequest {
  /** Owner display name. */
  @minLength(1)
  @maxLength(200)
  displayName: string;

  /** IANA timezone for the calendar. */
  timeZone: IanaTimeZone;

  /** Rules defining working hours. */
  @minItems(1)
  availabilityRules: AvailabilityRule[];

  /** Slot grid interval in minutes. */
  @minValue(15)
  @maxValue(60)
  slotIntervalMinutes: int32;
}

/** Response returned for setup state query (GET /admin/setup). */
model SetupStateResponse {
  /** Whether onboarding has been completed. */
  onboardingCompleted: boolean;

  /** Owner display name. Present only if onboarding is completed. */
  @maxLength(200)
  displayName?: string;
}

/** Full calendar settings response including owner display name. */
model CalendarSettingsResponse {
  /** Owner display name. */
  @maxLength(200)
  displayName: string;

  /** IANA timezone for the calendar. */
  timeZone: IanaTimeZone;

  /** Rules defining working hours. */
  @minItems(1)
  availabilityRules: AvailabilityRule[];

  /** Slot grid interval in minutes. */
  @minValue(15)
  @maxValue(60)
  slotIntervalMinutes: int32;

  /** Canonical public URL of the guest calendar (web client). Value comes from deployment env (PUBLIC_WEB_URL). */
  publicUrl: url;
}

/**
 * Publicly visible projection of the owner profile.
 * Carries the display name only: calendar settings (availabilityRules,
 * slotIntervalMinutes, publicUrl) are never disclosed to guests.
 */
model PublicCalendarResponse {
  /** Owner display name. */
  @maxLength(200)
  displayName: string;
}
