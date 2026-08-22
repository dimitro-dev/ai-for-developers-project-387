// Интеграционные тесты схемы и раннера (Р8): инварианты проверяются на настоящей PostgreSQL —
// exclusion constraint и гонку двух параллельных INSERT в памяти воспроизвести нечем.

import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, beforeEach, describe, test } from 'node:test';

import pg from 'pg';
import type { Pool as PgPool, PoolClient } from 'pg';

import { BOOKINGS_NO_OVERLAP_CONSTRAINT } from './index.ts';
import { runMigrations } from './migrations.ts';

const { Pool } = pg;

// Без адреса тестовой базы набор пропускается с причиной, а не падает: `make gates` из чистого
// чекаута без Docker остаётся зелёным, обязательный прогон обеспечивают `make db-test` и CI (Р8).
const connectionString = process.env.TEST_DATABASE_URL;
const skip = connectionString
  ? false
  : 'TEST_DATABASE_URL не задана: поднимите контур (make db-up) и запускайте через make db-test';

type Queryable = Pick<PoolClient, 'query'>;

interface PgError {
  code?: string;
  constraint?: string;
}

// Схему поднимает каждый набор сам: наборы идут последовательно, и любой из них должен быть
// запускаем в одиночку. Чистка — до миграций, а не после: упавший прогон не должен уносить
// с собой возможность запустить следующий.
async function freshDatabase(): Promise<PgPool> {
  const pool = new Pool({ connectionString });
  await pool.query('DROP TABLE IF EXISTS bookings, event_types, owner, schema_migrations CASCADE');
  return pool;
}

const at = (time: string): string => `2026-03-02T${time}:00.000Z`;

async function insertEventType(db: Queryable, id: string, durationMinutes = 30): Promise<void> {
  await db.query('INSERT INTO event_types (id, name, duration_minutes) VALUES ($1, $2, $3)', [
    id,
    `Тип ${id}`,
    durationMinutes,
  ]);
}

interface BookingFields {
  id?: string;
  eventTypeId?: string;
  startAt?: string;
  endAt?: string;
  guestName?: string;
  guestEmail?: string;
}

async function insertBooking(db: Queryable, fields: BookingFields = {}): Promise<void> {
  await db.query(
    `INSERT INTO bookings (id, event_type_id, event_type_name, start_at_utc, end_at_utc,
                           guest_name, guest_email, created_at_utc)
     VALUES ($1, $2, 'Intro call', $3, $4, $5, $6, now())`,
    [
      fields.id ?? randomUUID(),
      fields.eventTypeId ?? 'intro',
      fields.startAt ?? at('10:00'),
      fields.endAt ?? at('11:00'),
      fields.guestName ?? 'Гость',
      fields.guestEmail ?? 'guest@example.com',
    ],
  );
}

async function insertOwner(db: Queryable, id = true, slotIntervalMinutes = 30): Promise<void> {
  await db.query(
    `INSERT INTO owner (id, display_name, time_zone, availability_rules,
                        slot_interval_minutes, onboarding_completed)
     VALUES ($1, 'Владелец', 'Europe/Moscow', $2, $3, true)`,
    [
      id,
      JSON.stringify([{ daysOfWeek: ['Monday'], startLocal: '09:00', endLocal: '17:00' }]),
      slotIntervalMinutes,
    ],
  );
}

async function countBookings(db: Queryable): Promise<number> {
  const { rows } = await db.query<{ count: number }>('SELECT count(*)::int AS count FROM bookings');
  return rows[0].count;
}

// Проверяется не только факт отказа, но и SQLSTATE с именем констрейнта: по ним прикладной слой
// (Р5) отличает пересечение от дубля, и подмена одного констрейнта другим тестом не заметилась бы.
async function failureOf(action: () => Promise<unknown>): Promise<PgError> {
  try {
    await action();
  } catch (error) {
    return error as PgError;
  }
  assert.fail('ожидалась ошибка PostgreSQL, но запрос прошёл');
}

function assertExactlyOneOverlapRejected(results: PromiseSettledResult<unknown>[]): void {
  const rejected = results.filter((result) => result.status === 'rejected');
  assert.equal(rejected.length, 1, `ожидался ровно один отказ, получено ${rejected.length}`);

  // Исходов у гонки два, и оба означают одно и то же. `23P01` — проигравший дождался вердикта
  // exclusion constraint. `40P01` — проверка идёт после вставки индексной записи, поэтому оба
  // INSERT успели встать в ожидание друг друга и одного прервал детектор дедлоков; имени
  // констрейнта у такого отказа нет.
  const error = rejected[0].reason as PgError;
  assert.ok(
    error.code === '23P01' || error.code === '40P01',
    `ожидался 23P01 или 40P01, получено ${String(error.code)}`,
  );
  if (error.code === '23P01') {
    assert.equal(error.constraint, BOOKINGS_NO_OVERLAP_CONSTRAINT);
  }
}

describe('раннер миграций на реальной PostgreSQL', { skip }, () => {
  let pool: PgPool;

  before(async () => {
    pool = await freshDatabase();
  });

  after(async () => {
    await pool.end();
  });

  test('AC4: миграция применяется на чистой базе, повторный прогон — no-op', async () => {
    const first = await runMigrations(pool);
    assert.ok(first.applied.includes('001_initial-schema.sql'), `применено: ${first.applied.join(', ')}`);

    const second = await runMigrations(pool);
    assert.deepEqual(second.applied, []);

    // Проверяется наличие таблиц, а не точный их список: следующая миграция добавит свои,
    // и тест про идемпотентность не должен из-за этого краснеть.
    const { rows: tables } = await pool.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`,
    );
    const present = new Set(tables.map((row) => row.table_name));
    for (const table of ['owner', 'event_types', 'bookings', 'schema_migrations']) {
      assert.ok(present.has(table), `таблица ${table} не создана`);
    }

    // Учёт применённого совпадает с тем, что раннер отчитался применить: иначе повторный
    // прогон не был бы no-op, а прогнал бы миграцию второй раз.
    const { rows: recorded } = await pool.query<{ name: string }>('SELECT name FROM schema_migrations');
    assert.deepEqual(recorded.map((row) => row.name).sort(), [...first.applied].sort());
  });
});

describe('ограничения схемы на реальной PostgreSQL', { skip }, () => {
  let pool: PgPool;

  before(async () => {
    pool = await freshDatabase();
    await runMigrations(pool);
  });

  beforeEach(async () => {
    await pool.query('TRUNCATE bookings, event_types, owner');
  });

  after(async () => {
    await pool.end();
  });

  test('AC3 (I2): из двух одновременных пересекающихся броней проходит ровно одна', async () => {
    await insertEventType(pool, 'intro');
    // Два отдельных соединения, а не два запроса подряд: пересечение должна отбить СУБД в гонке,
    // а не порядок выполнения в тесте.
    const [first, second] = await Promise.all([pool.connect(), pool.connect()]);
    try {
      const results = await Promise.allSettled([
        insertBooking(first, { startAt: at('10:00'), endAt: at('11:00') }),
        insertBooking(second, { startAt: at('10:30'), endAt: at('11:30') }),
      ]);
      assertExactlyOneOverlapRejected(results);
    } finally {
      first.release();
      second.release();
    }

    assert.equal(await countBookings(pool), 1);
  });

  test('AC3 (I2): пересечение броней разных EventType отбивается так же', async () => {
    await insertEventType(pool, 'intro');
    await insertEventType(pool, 'review', 60);
    const [first, second] = await Promise.all([pool.connect(), pool.connect()]);
    try {
      const results = await Promise.allSettled([
        insertBooking(first, { eventTypeId: 'intro', startAt: at('14:00'), endAt: at('14:30') }),
        insertBooking(second, { eventTypeId: 'review', startAt: at('14:15'), endAt: at('15:15') }),
      ]);
      assertExactlyOneOverlapRejected(results);
    } finally {
      first.release();
      second.release();
    }

    assert.equal(await countBookings(pool), 1);
  });

  test('I3: брони встык не пересекаются', async () => {
    await insertEventType(pool, 'intro');
    await insertBooking(pool, { startAt: at('10:00'), endAt: at('10:30') });
    await insertBooking(pool, { startAt: at('10:30'), endAt: at('11:00') });

    assert.equal(await countBookings(pool), 2);
  });

  test('повторный id брони и повторный id EventType (I11) отклонены как дубли', async () => {
    await insertEventType(pool, 'intro');
    const duplicateType = await failureOf(() => insertEventType(pool, 'intro', 60));
    assert.equal(duplicateType.code, '23505');

    const id = randomUUID();
    await insertBooking(pool, { id, startAt: at('10:00'), endAt: at('10:30') });
    // Интервал другой: сработать обязан именно дубль ключа, а не запрет пересечений.
    const duplicateBooking = await failureOf(() =>
      insertBooking(pool, { id, startAt: at('12:00'), endAt: at('12:30') }),
    );
    assert.equal(duplicateBooking.code, '23505');
    assert.equal(await countBookings(pool), 1);
  });

  test('I1: вторая строка owner невставляема при любом значении ключа', async () => {
    await insertOwner(pool);

    const sameKey = await failureOf(() => insertOwner(pool));
    assert.equal(sameKey.code, '23505');

    const otherKey = await failureOf(() => insertOwner(pool, false));
    assert.equal(otherKey.code, '23514');
  });

  test('check-констрейнты отбивают невалидные значения', async () => {
    await insertEventType(pool, 'intro');

    const notPositive = await failureOf(() =>
      insertBooking(pool, { startAt: at('11:00'), endAt: at('10:00') }),
    );
    assert.equal(notPositive.code, '23514');
    assert.equal(notPositive.constraint, 'bookings_positive_duration');

    const blankName = await failureOf(() => insertBooking(pool, { guestName: '' }));
    assert.equal(blankName.code, '23514');
    assert.equal(blankName.constraint, 'bookings_guest_name_not_blank');

    const blankEmail = await failureOf(() => insertBooking(pool, { guestEmail: '' }));
    assert.equal(blankEmail.code, '23514');
    assert.equal(blankEmail.constraint, 'bookings_guest_email_not_blank');

    // 25 минут проходят по нижней границе, но не делят час нацело.
    const badInterval = await failureOf(() => insertOwner(pool, true, 25));
    assert.equal(badInterval.code, '23514');

    const zeroDuration = await failureOf(() => insertEventType(pool, 'zero', 0));
    assert.equal(zeroDuration.code, '23514');
  });
});
