CREATE TABLE IF NOT EXISTS employees (
    id integer PRIMARY KEY,
    name text NOT NULL,
    role text NOT NULL,
    avatar text
);

CREATE TABLE IF NOT EXISTS shift_templates (
    id integer PRIMARY KEY,
    name text NOT NULL,
    starts_at time NOT NULL,
    ends_at time NOT NULL CHECK (starts_at <> ends_at),
    color text NOT NULL CHECK (color IN ('morning', 'day', 'evening'))
);

CREATE TABLE IF NOT EXISTS schedule_state (
    id boolean PRIMARY KEY CHECK (id),
    revision integer NOT NULL DEFAULT 0,
    published_at timestamptz
);

CREATE TABLE IF NOT EXISTS published_shifts (
    employee_id integer NOT NULL REFERENCES employees(id),
    shift_date date NOT NULL,
    starts_at time NOT NULL,
    ends_at time NOT NULL CHECK (starts_at <> ends_at),
    template_id integer REFERENCES shift_templates(id),
    PRIMARY KEY (employee_id, shift_date)
);

INSERT INTO schedule_state (id) VALUES (true) ON CONFLICT DO NOTHING;

INSERT INTO shift_templates (id, name, starts_at, ends_at, color) VALUES
    (1, 'Утро', '07:00', '15:00', 'morning'),
    (2, 'День', '10:00', '18:00', 'day'),
    (3, 'Вечер', '15:00', '23:00', 'evening')
ON CONFLICT DO NOTHING;
