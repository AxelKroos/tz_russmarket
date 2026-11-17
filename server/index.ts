import { resolve } from 'node:path';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { openDatabase } from './database.js';
import { createScheduleApi } from './schedule.js';

const database = await openDatabase({
    url: process.env.DATABASE_URL,
    path: resolve(process.env.SCHEDULE_DB_PATH ?? '.data/schedule'),
    demo: process.env.DEMO_DATA === undefined ? undefined : process.env.DEMO_DATA === '1',
});
const app = new Hono();
app.route('/api/schedule', createScheduleApi(database));
app.onError((error, context) => {
    console.error(error);
    return context.json({ message: 'Сервер не смог выполнить запрос.' }, 500);
});
app.get('/api/health', (context) => context.json({ status: 'ok' }));
app.get('*', serveStatic({ root: './dist/client' }));

const server = serve(
    {
        fetch: app.fetch,
        hostname: process.env.HOST ?? '127.0.0.1',
        port: Number(process.env.PORT ?? 3001),
    },
    ({ address, port }) => {
        console.log(`График смен: http://${address}:${port}`);
    },
);

for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, () => {
        server.close(() => {
            void database.close();
        });
    });
}
