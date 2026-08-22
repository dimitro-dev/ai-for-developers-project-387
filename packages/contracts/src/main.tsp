import "@typespec/http";
import "@typespec/openapi";
import "./models/common.tsp";
import "./models/errors.tsp";
import "./models/owner.tsp";
import "./models/event-type.tsp";
import "./models/booking.tsp";
import "./operations/health.tsp";
import "./operations/admin.tsp";
import "./operations/public.tsp";

using Http;
using OpenAPI;

@service(#{ title: "MiniCal API" })
@info(#{ version: "0.2.0" })
namespace MiniCal;
