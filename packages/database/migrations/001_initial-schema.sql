-- Начальная схема MiniCal: владелец, типы встреч, брони (Р4 ADR back/002).
-- Инварианты домена (docs/domain-model.md) закрыты constraints, а не только кодом приложения:
-- use-case проверяет их первым и даёт понятную ошибку, СУБД остаётся последней линией при гонке.
-- Конкретные встречи хранятся в UTC (timestamptz), часовой пояс владельца — отдельным полем.

CREATE TABLE owner (
    -- I1: владелец единственный. Ключ-константа делает вторую строку невставляемой,
    -- а не «запрещённой по соглашению»: обойти нечего, свободных значений ключа нет.
    id boolean PRIMARY KEY DEFAULT true CHECK (id),
    display_name text NOT NULL,
    time_zone text NOT NULL,
    -- Правила доступности замещаются целиком при каждом изменении настроек, адресоваться
    -- к отдельному правилу неоткуда — jsonb вместо таблицы точно повторяет форму VO.
    availability_rules jsonb NOT NULL,
    -- Шаг сетки обязан делить час нацело, иначе слоты уползают от начала часа день ото дня.
    slot_interval_minutes integer NOT NULL
        CHECK (slot_interval_minutes >= 15 AND 60 % slot_interval_minutes = 0),
    onboarding_completed boolean NOT NULL
);

CREATE TABLE event_types (
    -- I11: id публичный, задаётся владельцем и попадает в ссылки для гостей,
    -- поэтому он же и первичный ключ — суррогатному не за что отвечать.
    id text PRIMARY KEY,
    name text NOT NULL,
    description text,
    duration_minutes integer NOT NULL CHECK (duration_minutes > 0)
);

CREATE TABLE bookings (
    id uuid PRIMARY KEY,
    -- Ссылка без ON DELETE: удаление типа встречи с бронями обязано падать,
    -- а не уносить состоявшиеся договорённости.
    event_type_id text NOT NULL REFERENCES event_types(id),
    -- I15: snapshot названия на момент брони, не join — переименование типа
    -- не переписывает историю уже подтверждённых встреч.
    event_type_name text NOT NULL,
    start_at_utc timestamptz NOT NULL,
    end_at_utc timestamptz NOT NULL,
    CONSTRAINT bookings_positive_duration CHECK (end_at_utc > start_at_utc),
    -- I12: гость не заводит аккаунт, его данные живут только внутри брони. Пустая строка
    -- проходит NOT NULL, поэтому обязательность проверяется явно.
    guest_name text NOT NULL CONSTRAINT bookings_guest_name_not_blank CHECK (guest_name <> ''),
    guest_email text NOT NULL CONSTRAINT bookings_guest_email_not_blank CHECK (guest_email <> ''),
    guest_note text,
    created_at_utc timestamptz NOT NULL,
    -- I2: пересечения запрещены глобально, а не в пределах одного типа встречи, поэтому
    -- event_type_id в выражение не входит; без скалярных колонок gist по встроенному
    -- range-типу работает без расширения btree_gist.
    -- I3: tstzrange по умолчанию полуоткрытый [), поэтому встык идущие брони не конфликтуют.
    CONSTRAINT bookings_no_overlap EXCLUDE USING gist (tstzrange(start_at_utc, end_at_utc) WITH &&)
);
