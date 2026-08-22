import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadOpenAPI() {
  const yaml = readFileSync(resolve(__dirname, '../packages/contracts/generated/openapi.yaml'), 'utf-8');
  return parse(yaml);
}

const failures: string[] = [];

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    failures.push(message);
    return;
  }
  console.log(`PASS: ${message}`);
}

const spec = loadOpenAPI();
const paths = spec.paths as Record<string, any>;
const schemas = spec.components?.schemas ?? {};
const expectedRoutes = [
  '/health',
  '/admin/setup',
  '/admin/settings',
  '/admin/event-types',
  '/admin/bookings',
  '/calendar',
  '/event-types',
  '/slots',
  '/bookings',
];

const expectedOperations = [
  'getHealth',
  'getAdminSetup',
  'completeAdminSetup',
  'getAdminSettings',
  'updateAdminSettings',
  'getAdminEventTypes',
  'createAdminEventType',
  'getAdminUpcomingBookings',
  'getPublicCalendar',
  'getPublicEventTypes',
  'getPublicSlots',
  'createPublicBooking',
];

console.log('\n=== 1. Route coverage ===');
for (const route of expectedRoutes) {
  assert(route in paths, `Route ${route} exists`);
}
const actualCount = Object.keys(paths).length;
assert(actualCount === expectedRoutes.length, `Route count: ${actualCount} === ${expectedRoutes.length}`);

console.log('\n=== 2. Operation IDs ===');
const actualOps = new Set<string>();
for (const [, methods] of Object.entries(paths)) {
  for (const [, op] of Object.entries(methods as Record<string, any>)) {
    if (op.operationId) actualOps.add(op.operationId);
  }
}
for (const opId of expectedOperations) {
  assert(actualOps.has(opId), `Operation ${opId} exists`);
}
assert(actualOps.size === expectedOperations.length, `Operation count: ${actualOps.size} === ${expectedOperations.length}`);

console.log('\n=== 3. Prohibited fields in CreateBookingRequest ===');
const createBookingReq = schemas['CreateBookingRequest'];
assert(createBookingReq != null, 'CreateBookingRequest schema exists');
const reqProps = Object.keys(createBookingReq.properties ?? {});
assert(!reqProps.includes('endAtUtc'), 'endAtUtc NOT in CreateBookingRequest');
assert(!reqProps.includes('endAt'), 'endAt NOT in CreateBookingRequest');
assert(!(createBookingReq.required ?? []).includes('endAtUtc'), 'endAtUtc not required in request');

console.log('\n=== 4. Prohibited: no auth/security scheme ===');
assert(spec.components?.securitySchemes == null, 'No security schemes defined');
assert(spec.security == null, 'No top-level security');

console.log('\n=== 5. ownerId absent in all request bodies ===');
// Bodies and responses are emitted as `{ $ref: '#/components/schemas/Name' }`. To actually verify
// anything, $refs must be resolved against components.schemas and walked recursively —
// including into nested properties, array items, and allOf/anyOf/oneOf branches — while
// guarding against cyclic schema references via the `seen` set of already-visited schema names.
// The set of prohibited property names is a parameter: section 5 forbids `ownerId` in requests,
// section 11 forbids owner settings in public responses (AC1 of task-contract-001).
function checkForbiddenProperties(
  schema: any,
  path: string,
  forbidden: readonly string[],
  seen: Set<string> = new Set(),
): boolean {
  if (schema == null || typeof schema !== 'object') return true;

  if (schema.$ref) {
    const refName = schema.$ref.replace(/^#\/components\/schemas\//, '');
    if (seen.has(refName)) return true; // cyclic reference already checked on this path
    const target = schemas[refName];
    if (target == null) return true;
    return checkForbiddenProperties(target, `${path} -> ${refName}`, forbidden, new Set(seen).add(refName));
  }

  let ok = true;

  if (schema.properties) {
    for (const name of forbidden) {
      if (name in schema.properties) {
        console.error(`FAIL: ${name} found in schema at ${path}`);
        ok = false;
      }
    }
  }

  if (schema.properties) {
    for (const [key, value] of Object.entries(schema.properties)) {
      if (!checkForbiddenProperties(value, `${path}.properties.${key}`, forbidden, seen)) ok = false;
    }
  }

  if (schema.items) {
    if (!checkForbiddenProperties(schema.items, `${path}.items`, forbidden, seen)) ok = false;
  }

  for (const combinator of ['allOf', 'anyOf', 'oneOf'] as const) {
    const list = schema[combinator];
    if (Array.isArray(list)) {
      list.forEach((sub: any, i: number) => {
        if (!checkForbiddenProperties(sub, `${path}.${combinator}[${i}]`, forbidden, seen)) ok = false;
      });
    }
  }

  return ok;
}
for (const [route, methods] of Object.entries(paths)) {
  for (const [, op] of Object.entries(methods as Record<string, any>)) {
    if (op.requestBody?.content?.['application/json']?.schema) {
      const ok = checkForbiddenProperties(op.requestBody.content['application/json'].schema, `${route} requestBody`, ['ownerId']);
      assert(ok, `ownerId absent in request body of ${route}`);
    }
  }
}

console.log('\n=== 6. Error codes present in responses ===');
const expectedErrorCodes = [
  'VALIDATION_ERROR',
  'CALENDAR_NOT_CONFIGURED',
  'ONBOARDING_ALREADY_COMPLETED',
  'EVENT_TYPE_NOT_FOUND',
  'DUPLICATE_EVENT_TYPE_ID',
  'SLOT_UNAVAILABLE',
  'SLOT_OUTSIDE_WINDOW',
  'SLOT_NOT_ALIGNED',
  'DUPLICATE_BOOKING_ID',
  'GUEST_NAME_REQUIRED',
  'GUEST_EMAIL_REQUIRED',
];
const foundInResponses = new Set<string>();
for (const [, methods] of Object.entries(paths)) {
  for (const [, op] of Object.entries(methods as Record<string, any>)) {
    for (const [, resp] of Object.entries(op.responses ?? {}) as [string, any][]) {
      const schema = resp.content?.['application/json']?.schema;
      if (!schema) continue;
      const refs: string[] = [];
      if (schema.$ref) refs.push(schema.$ref.split('/').pop()!);
      if (schema.anyOf) {
        for (const item of schema.anyOf) {
          if (item.$ref) refs.push(item.$ref.split('/').pop()!);
        }
      }
      for (const ref of refs) {
        const model = schemas[ref];
        if (model?.properties?.code?.enum) {
          for (const code of model.properties.code.enum) {
            foundInResponses.add(code);
          }
        }
      }
    }
  }
}
for (const code of expectedErrorCodes) {
  assert(foundInResponses.has(code), `Error code ${code} referenced in responses`);
}

console.log('\n=== 7. No arbitrary from/to query params ===');
for (const [route, methods] of Object.entries(paths)) {
  for (const [, op] of Object.entries(methods as Record<string, any>)) {
    const params = op.parameters ?? [];
    for (const p of params) {
      const name = p.name ?? '';
      assert(!['from', 'to', 'fromUtc', 'toUtc', 'startDate', 'endDate'].includes(name),
        `No arbitrary date range param '${name}' in ${route}`);
    }
  }
}

console.log('\n=== 8. No 428 status codes (onboarding check uses 400 CALENDAR_NOT_CONFIGURED) ===');
for (const [route, methods] of Object.entries(paths)) {
  for (const [, op] of Object.entries(methods as Record<string, any>)) {
    const statuses = Object.keys(op.responses ?? {});
    assert(!statuses.includes('428'),
      `${route} ${op.operationId} does not use 428 — the contract intentionally signals ` +
      `owner-not-onboarded via 400 CALENDAR_NOT_CONFIGURED instead of 428 Precondition Required`);
  }
}

console.log('\n=== 9. Prohibited: no API surface beyond MVP ===');
for (const route of Object.keys(paths)) {
  assert(expectedRoutes.includes(route), `Route ${route} is within MVP scope`);
}

console.log('\n=== 10. Field constraints added in contract hardening ===');
for (const modelName of ['EventType', 'CreateEventTypeRequest']) {
  const durationProp = schemas[modelName]?.properties?.durationMinutes;
  assert(durationProp?.minimum === 1, `${modelName}.durationMinutes minimum === 1`);
  assert(durationProp?.maximum === 1440, `${modelName}.durationMinutes maximum === 1440`);
}

for (const modelName of ['CalendarSettings', 'SetupRequest', 'CalendarSettingsResponse']) {
  const model = schemas[modelName];
  const slotIntervalProp = model?.properties?.slotIntervalMinutes;
  assert(slotIntervalProp?.minimum === 15, `${modelName}.slotIntervalMinutes minimum === 15`);
  assert(slotIntervalProp?.maximum === 60, `${modelName}.slotIntervalMinutes maximum === 60`);

  const availabilityRulesProp = model?.properties?.availabilityRules;
  assert(availabilityRulesProp?.minItems === 1, `${modelName}.availabilityRules minItems === 1`);
}

const eventTypeIdParam = (paths['/slots']?.get?.parameters ?? []).find((p: any) => p.name === 'eventTypeId');
assert(eventTypeIdParam?.schema?.maxLength === 100, `getPublicSlots query param eventTypeId has schema.maxLength === 100`);

assert(schemas['ErrorResponse']?.properties?.code?.maxLength === 100, 'ErrorResponse.code has maxLength === 100');

assert(spec.info?.version !== '0.0.0', `info.version is not the placeholder '0.0.0' (got ${spec.info?.version})`);

console.log('\n=== 11. Guest-flow extensions (task-contract-001: AC1, AC2, AC3, AC5, AC6, AC7) ===');
// Six checks, one per acceptance criteria that would otherwise rest on a single manual reading of
// the generated YAML. Each of the six is verified to FAIL against a deliberately corrupted copy of
// the document — see task-contract-001/result.md.

// (1) AC1 — the public surface exposes the owner display name and nothing else from the calendar
// settings. Walked recursively through $ref, so a settings model wrapped into a public response
// (directly, via a nested property, or via array items) is caught as well.
const publicOperationIds = ['getPublicCalendar', 'getPublicEventTypes', 'getPublicSlots', 'createPublicBooking'];
const ownerSettingsProperties = ['availabilityRules', 'slotIntervalMinutes', 'publicUrl'];
const publicOpsReached = new Set<string>();
for (const [route, methods] of Object.entries(paths)) {
  for (const [, op] of Object.entries(methods as Record<string, any>)) {
    if (!publicOperationIds.includes(op.operationId)) continue;
    publicOpsReached.add(op.operationId);
    for (const [status, resp] of Object.entries(op.responses ?? {}) as [string, any][]) {
      if (!status.startsWith('2')) continue;
      const schema = resp.content?.['application/json']?.schema;
      if (!schema) continue;
      const ok = checkForbiddenProperties(schema, `${route} ${op.operationId} ${status}`, ownerSettingsProperties);
      assert(ok, `${op.operationId} ${status} response discloses none of: ${ownerSettingsProperties.join(', ')}`);
    }
  }
}
for (const opId of publicOperationIds) {
  // Without this the check above would pass vacuously if an operation were renamed or removed.
  assert(publicOpsReached.has(opId), `AC1 check reached public operation ${opId}`);
}

// (2) AC2 — the booking response carries the event type name, in one and the same form for the
// guest flow (createPublicBooking) and the owner flow (getAdminUpcomingBookings): both return Booking.
const bookingSchema = schemas['Booking'];
assert(bookingSchema?.properties?.eventTypeName != null, 'Booking.eventTypeName exists');
assert((bookingSchema?.required ?? []).includes('eventTypeName'), 'Booking.eventTypeName is required');

// (3) AC3 — the idempotent repeat is documented machine-readably: 201 created, 200 replayed, one body.
const createBookingResponses = paths['/bookings']?.post?.responses ?? {};
for (const status of ['200', '201']) {
  const ref = createBookingResponses[status]?.content?.['application/json']?.schema?.$ref;
  assert(ref === '#/components/schemas/Booking',
    `POST /bookings documents '${status}' with $ref Booking (got ${ref ?? 'no such response'})`);
}

// (4) AC5 — both setup-writing operations document the 400 that transport and domain validation
// oblige the backend to return. The 400 may be a bare $ref or an anyOf of several error models.
const setupWriteOperationIds = ['completeAdminSetup', 'updateAdminSettings'];
const setupWriteOpsReached = new Set<string>();
for (const [route, methods] of Object.entries(paths)) {
  for (const [, op] of Object.entries(methods as Record<string, any>)) {
    if (!setupWriteOperationIds.includes(op.operationId)) continue;
    setupWriteOpsReached.add(op.operationId);
    const schema = op.responses?.['400']?.content?.['application/json']?.schema;
    const refs: string[] = [];
    if (schema?.$ref) refs.push(schema.$ref.split('/').pop()!);
    for (const item of schema?.anyOf ?? []) {
      if (item.$ref) refs.push(item.$ref.split('/').pop()!);
    }
    assert(refs.includes('ValidationError'),
      `${op.operationId} (${route}) documents 400 ValidationError (400 references: ${refs.join(', ') || 'nothing'})`);
  }
}
for (const opId of setupWriteOperationIds) {
  assert(setupWriteOpsReached.has(opId), `AC5 check reached operation ${opId}`);
}

// (5) AC6 — an availability rule cannot apply to an empty set of days.
assert(schemas['AvailabilityRule']?.properties?.daysOfWeek?.minItems === 1, 'AvailabilityRule.daysOfWeek minItems === 1');

// (6) AC7 — references to an event type id are constrained like the id itself
// (CreateEventTypeRequest.id has minLength 1): an empty string cannot be created, nor referenced.
const slotsEventTypeIdParam = (paths['/slots']?.get?.parameters ?? []).find((p: any) => p.name === 'eventTypeId');
assert(slotsEventTypeIdParam?.schema?.minLength === 1, 'getPublicSlots query param eventTypeId has schema.minLength === 1');
assert(schemas['CreateBookingRequest']?.properties?.eventTypeId?.minLength === 1, 'CreateBookingRequest.eventTypeId minLength === 1');

console.log('\n=== SECURITY: String length constraints on user-input fields ===');
const userInputFields: Record<string, string[]> = {
  'GuestDetails': ['name', 'email', 'note'],
  'SetupRequest': ['displayName'],
  'CreateEventTypeRequest': ['id', 'name', 'description'],
  'CreateBookingRequest': ['eventTypeId'],
};
for (const [modelName, fields] of Object.entries(userInputFields)) {
  const model = schemas[modelName];
  if (!model) { console.warn(`WARN: Model ${modelName} not found`); continue; }
  for (const f of fields) {
    const prop = model.properties?.[f];
    if (!prop) { console.warn(`WARN: ${modelName}.${f} not found`); continue; }
    if (prop.type === 'string') {
      const hasMax = prop.maxLength != null;
      assert(hasMax, `${modelName}.${f} has maxLength`);
    }
  }
}
for (const [route, methods] of Object.entries(paths)) {
  for (const [, op] of Object.entries(methods as Record<string, any>)) {
    const params = op.parameters ?? [];
    for (const p of params) {
      if (p.in === 'query' && p.schema?.type === 'string') {
        assert(p.schema.maxLength != null, `Query param '${p.name}' in ${route} (${op.operationId}) has maxLength`);
      }
    }
  }
}

console.log('\n=== SECURITY: Email validation on GuestDetails.email ===');
const emailProp = schemas['GuestDetails']?.properties?.email;
assert(emailProp != null, 'GuestDetails.email exists');
assert(emailProp.pattern != null, 'GuestDetails.email has pattern');
assert(emailProp.pattern.includes('@'), 'Email pattern contains @');
assert(emailProp.minLength === 1, 'GuestDetails.email minLength=1');
assert(emailProp.maxLength === 320, 'GuestDetails.email maxLength=320');

console.log('\n=== INFO: Unbounded arrays (pagination) ===');
for (const [route, methods] of Object.entries(paths)) {
  for (const [, op] of Object.entries(methods as Record<string, any>)) {
    const responses = op.responses ?? {};
    for (const [, resp] of Object.entries(responses) as [string, any][]) {
      const schema = resp.content?.['application/json']?.schema;
      if (schema?.type === 'array') {
        console.log(`INFO: ${route} ${op.operationId} returns an unbounded array (no pagination) — accepted MVP limitation, not a check`);
      }
    }
  }
}

console.log('\n=== SECURITY: Error response message field presence ===');
for (const [name, schema] of Object.entries(schemas) as [string, any][]) {
  if (schema.allOf?.some((r: any) => r.$ref?.endsWith('/ErrorResponse'))) {
    assert(schema.properties?.code != null, `Error model ${name} has code field`);
    assert(schema.required?.includes('code') ?? false, `Error model ${name} requires code`);
  }
}

console.log('\n=== SECURITY: No PII in URL paths ===');
for (const route of Object.keys(paths)) {
  assert(!route.includes('{email}'), `No email in path: ${route}`);
  assert(!route.includes('{name}'), `No name in path: ${route}`);
  assert(!route.includes('{guest'), `No guest data in path: ${route}`);
}

console.log('\n=== SECURITY: Health endpoint minimal disclosure ===');
const healthResp = paths['/health']?.get?.responses?.['200']?.content?.['application/json']?.schema;
if (healthResp?.$ref) {
  const healthModel = schemas[healthResp.$ref.split('/').pop()!];
  if (healthModel?.properties?.status?.enum) {
    assert(healthModel.properties.status.enum.length === 1 &&
           healthModel.properties.status.enum[0] === 'ok',
           'Health response only returns {"status":"ok"}');
  }
}

if (failures.length > 0) {
  console.error(`\n❌ ${failures.length} contract validation check(s) failed:`);
  for (const message of failures) {
    console.error(`  - ${message}`);
  }
  process.exit(1);
}

console.log('\n✅ All contract validation checks passed');
