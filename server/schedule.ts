import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { publishSchema } from '../shared/schedule.js';
import type { Employee, Schedule, Shift, Template } from '../shared/schedule.js';
import type { Database } from './database.js';

type Snapshot = Pick<Schedule, 'revision' | 'publishedAt' | 'shifts'>;

async function readSnapshot(database: Pick<Database, 'query'>): Promise<Snapshot> {
    const { rows } = await database.query<Snapshot>(`
        SELECT revision, published_at AS "publishedAt",
            COALESCE((
                SELECT json_agg(json_build_object(
                    'employeeId', employee_id, 'date', to_char(shift_date, 'YYYY-MM-DD'),
                    'start', to_char(starts_at, 'HH24:MI'), 'end', to_char(ends_at, 'HH24:MI'),
                    'templateId', template_id
                ) ORDER BY employee_id, shift_date)
                FROM published_shifts
            ), '[]'::json) AS shifts
        FROM schedule_state
    `);
    return rows[0];
}

export function createScheduleApi(database: Database) {
    const api = new Hono();

    api.use('*', async (context, next) => {
        context.header('Cache-Control', 'no-store');
        await next();
    });

    api.get('/', async (context) => {
        const [snapshot, employees, templates] = await Promise.all([
            readSnapshot(database),
            database.query<Employee>('SELECT id, name, role, avatar FROM employees ORDER BY id'),
            database.query<Template>(`
                SELECT id, name, to_char(starts_at, 'HH24:MI') AS start,
                    to_char(ends_at, 'HH24:MI') AS "end", color
                FROM shift_templates ORDER BY id
            `),
        ]);
        return context.json({
            ...snapshot,
            employees: employees.rows,
            templates: templates.rows,
        });
    });

    api.put(
        '/publication',
        bodyLimit({
            maxSize: 2 * 1024 * 1024,
            onError: (context) => context.json({ message: 'График слишком большой.' }, 413),
        }),
        async (context) => {
            const payload = publishSchema.safeParse(await context.req.json().catch(() => null));
            if (!payload.success) {
                return context.json({ message: 'Проверьте даты и время смен.' }, 400);
            }

            const updated = await database
                .transaction(async (connection) => {
                    const { rows } = await connection.query<{ revision: number }>(
                        `UPDATE schedule_state SET revision = revision + 1, published_at = NOW()
                    WHERE id = true AND revision = $1 RETURNING revision`,
                        [payload.data.revision],
                    );
                    if (!rows.length) return null;

                    await connection.query('DELETE FROM published_shifts');
                    const shifts = payload.data.shifts.map(
                        ({ employeeId, date, start, end, templateId }: Shift) => ({
                            employee_id: employeeId,
                            shift_date: date,
                            starts_at: start,
                            ends_at: end,
                            template_id: templateId,
                        }),
                    );
                    await connection.query(
                        `INSERT INTO published_shifts
                    SELECT * FROM jsonb_to_recordset($1::jsonb) AS rows(
                        employee_id integer, shift_date date, starts_at time,
                        ends_at time, template_id integer
                    )`,
                        [JSON.stringify(shifts)],
                    );
                    return readSnapshot(connection);
                })
                .catch((error: unknown) => {
                    if (
                        typeof error === 'object' &&
                        error &&
                        'code' in error &&
                        error.code === '23503'
                    ) {
                        return false;
                    }
                    throw error;
                });

            if (updated === false) {
                return context.json({ message: 'Сотрудник или шаблон больше не доступен.' }, 400);
            }
            if (!updated) {
                return context.json(
                    { message: 'На сервере есть более свежий график. Обновите перед публикацией.' },
                    409,
                );
            }
            return context.json(updated);
        },
    );

    return api;
}
