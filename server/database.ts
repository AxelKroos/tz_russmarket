import { mkdir, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import pg from 'pg';

interface Queryable {
    query<Row extends object>(sql: string, params?: unknown[]): Promise<{ rows: Row[] }>;
}

export interface Database extends Queryable {
    transaction<Result>(run: (connection: Queryable) => Promise<Result>): Promise<Result>;
    close(): Promise<void>;
}

interface DatabaseOptions {
    url?: string;
    path?: string;
    demo?: boolean;
}

export async function openDatabase({ url, path, demo = !url }: DatabaseOptions) {
    let database: Database;

    if (url) {
        const pool = new pg.Pool({ connectionString: url });
        database = {
            query: (sql, params) => pool.query(sql, params),
            async transaction(run) {
                const client = await pool.connect();
                try {
                    await client.query('BEGIN');
                    const result = await run(client);
                    await client.query('COMMIT');
                    return result;
                } catch (error) {
                    await client.query('ROLLBACK');
                    throw error;
                } finally {
                    client.release();
                }
            },
            close: () => pool.end(),
        };
    } else {
        if (path) await mkdir(dirname(path), { recursive: true });
        const client = await PGlite.create(path);
        database = {
            query: (sql, params) => client.query(sql, params),
            transaction: (run) => client.transaction(run),
            close: () => client.close(),
        };
    }

    try {
        const scripts = ['db/schema.sql', ...(demo ? ['db/demo.sql'] : [])];
        const sql = await Promise.all(scripts.map((script) => readFile(resolve(script), 'utf8')));
        await database.transaction(async (connection) => {
            for (const statement of sql
                .join('\n')
                .split(';')
                .map((part) => part.trim())) {
                if (statement) await connection.query(statement);
            }
        });
        return database;
    } catch (error) {
        await database.close();
        throw error;
    }
}
