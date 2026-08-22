namespace MiniCal;
using Http;

/** Server health check. */
@route("/health")
@get
op getHealth(): {
  @statusCode _: 200;
  @body body: HealthResponse;
};
