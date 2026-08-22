namespace MiniCal;

/** An event type representing a kind of meeting that guests can book. */
model EventType {
  /** Unique, stable identifier chosen by the owner. */
  @maxLength(100)
  id: string;

  /** Display name of the event type. */
  @maxLength(200)
  name: string;

  /** Optional description of what this event type is for. */
  @maxLength(2000)
  description?: string;

  /** Meeting duration in minutes. */
  @minValue(1)
  @maxValue(1440)
  durationMinutes: int32;
}

/** Request payload to create a new event type. */
model CreateEventTypeRequest {
  /** Unique, stable identifier chosen by the owner. */
  @minLength(1)
  @maxLength(100)
  id: string;

  /** Display name of the event type. */
  @minLength(1)
  @maxLength(200)
  name: string;

  /** Optional description of what this event type is for. */
  @maxLength(2000)
  description?: string;

  /** Meeting duration in minutes. */
  @minValue(1)
  @maxValue(1440)
  durationMinutes: int32;
}
