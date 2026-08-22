namespace MiniCal;

/**
 * IANA timezone identifier.
 * @example "UTC"
 * @example "Europe/London"
 * @example "America/New_York"
 * @example "Asia/Tokyo"
 */
@pattern("^[A-Za-z0-9+_-]+(/[A-Za-z0-9+_-]+){0,2}$")
scalar IanaTimeZone extends string;

/**
 * Local time in HH:mm format (24-hour).
 * @example "09:00"
 * @example "17:30"
 */
@pattern("^([01][0-9]|2[0-3]):[0-5][0-9]$")
scalar LocalTime extends string;

/** Day of the week. */
enum DayOfWeek {
  Monday,
  Tuesday,
  Wednesday,
  Thursday,
  Friday,
  Saturday,
  Sunday,
}

/** Universally unique identifier (UUID v4). */
@format("uuid")
scalar Uuid extends string;

/** Health check response. */
model HealthResponse {
  status: "ok";
}
