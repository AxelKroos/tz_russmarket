import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import { shiftMinutes } from '../shared/schedule.js';
import type { Draft, Shift } from '../shared/schedule.js';
import { openDatabase } from '../server/database.js';
import type { Database } from '../server/database.js';
import { createScheduleApi } from '../server/schedule.js';

const shift: Shift = {
    employeeId: 1,
    date: '2028-02-29',
    start: '22:00',
    end: '06:30',
    templateId: null,
};
let database: Database;
let api: ReturnType<typeof createScheduleApi>;

before(async () => {
    database = await openDatabase({ demo: true });
    api = createScheduleApi(database);
});
after(() => database.close());

function publish(payload: Draft) {
    return api.request('/publication', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
}

test('01 — возвращает сохранённый график и отклоняет устаревшую публикацию', async () => {
    const initial = await (await api.request('/')).json();
    assert.equal(initial.revision, 0);
    assert.equal(initial.employees.length, 8);
    const responses = await Promise.all([
        publish({ revision: initial.revision, shifts: [shift] }),
        publish({ revision: initial.revision, shifts: [shift] }),
    ]);
    assert.deepEqual(responses.map(({ status }) => status).sort(), [200, 409]);
    const updated = await (await api.request('/')).json();
    assert.equal(updated.revision, 1);
    assert.ok(updated.publishedAt);
    assert.deepEqual(updated.shifts, [shift]);
});

test('02 — ошибочные даты, дубли и неизвестные сотрудники не меняют график', async () => {
    const original = await (await api.request('/')).json();
    const invalidDates = [{ ...shift, date: '2027-02-29' }];
    const duplicates = [shift, { ...shift, start: '21:00' }];
    const unknownEmployee = [{ ...shift, employeeId: 999 }];
    for (const shifts of [invalidDates, duplicates, unknownEmployee]) {
        assert.equal((await publish({ revision: original.revision, shifts })).status, 400);
    }
    const updated = await (await api.request('/')).json();
    assert.equal(updated.revision, original.revision);
    assert.deepEqual(updated.shifts, original.shifts);
});

test('03 — считает смену через полночь без округления', () => {
    assert.equal(shiftMinutes(shift), 510);
    assert.equal(shiftMinutes({ start: '15:00', end: '23:00' }), 480);
});

test('08 — сохраняет публикацию после повторного открытия локальной базы', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'shift-scheduler-db-'));
    try {
        const path = join(directory, 'db');
        const first = await openDatabase({ path });
        try {
            const result = await createScheduleApi(first).request('/publication', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ revision: 0, shifts: [shift] }),
            });
            assert.equal(result.status, 200);
        } finally {
            await first.close();
        }
        const reopened = await openDatabase({ path });
        try {
            const snapshot = await (await createScheduleApi(reopened).request('/')).json();
            assert.equal(snapshot.revision, 1);
            assert.deepEqual(snapshot.shifts, [shift]);
        } finally {
            await reopened.close();
        }
    } finally {
        await rm(directory, { recursive: true, force: true });
    }
});
