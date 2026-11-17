import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defineConfig, devices } from '@playwright/test';

const baseURL = 'http://127.0.0.1:47391';

export default defineConfig({
    testDir: './tests/browser',
    use: {
        ...devices['Desktop Chrome'],
        channel: 'chrome',
        baseURL,
        viewport: { width: 1700, height: 1024 },
    },
    workers: 1,
    webServer: {
        command: 'npm start',
        url: `${baseURL}/api/health`,
        env: {
            DATABASE_URL: '',
            DEMO_DATA: '1',
            PORT: '47391',
            SCHEDULE_DB_PATH: join(mkdtempSync(join(tmpdir(), 'shift-scheduler-test-')), 'db'),
        },
    },
});
