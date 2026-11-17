import { useCallback, useEffect, useState } from 'react';
import { cellKey, publishSchema } from '../../shared/schedule.js';
import type { Cell, Draft, Schedule, Shift } from '../../shared/schedule.js';

const draftKey = 'shift-scheduler:draft';

async function requestSchedule<T>(path = '', init?: RequestInit): Promise<T> {
    const response = await fetch(`/api/schedule${path}`, init);
    const data = await response.json();
    if (!response.ok) throw new Error(data.message);
    return data;
}

function readDraft() {
    try {
        const saved = publishSchema.safeParse(JSON.parse(localStorage.getItem(draftKey) ?? 'null'));
        return saved.data;
    } catch {
        return undefined;
    }
}

export function useSchedule(readonly: boolean) {
    const [published, setPublished] = useState<Schedule>();
    const [draft, setDraft] = useState<Draft>();
    const [dirty, setDirty] = useState(false);
    const [loading, setLoading] = useState(true);
    const [publishing, setPublishing] = useState(false);
    const [message, setMessage] = useState<{ text: string; error?: boolean }>();

    const load = useCallback(async () => {
        setLoading(true);
        setMessage(undefined);
        try {
            const schedule = await requestSchedule<Schedule>();
            setPublished(schedule);
            setDraft((readonly ? undefined : readDraft()) ?? schedule);
            setDirty(false);
        } catch {
            setMessage({ text: 'Не удалось загрузить график.', error: true });
        } finally {
            setLoading(false);
        }
    }, [readonly]);

    useEffect(() => {
        void load();
    }, [load]);

    useEffect(() => {
        if (!dirty) return;
        function confirmLeave(event: BeforeUnloadEvent) {
            event.preventDefault();
        }
        window.addEventListener('beforeunload', confirmLeave);
        return () => window.removeEventListener('beforeunload', confirmLeave);
    }, [dirty]);

    function updateCells(cells: Cell[], shift?: Pick<Shift, 'start' | 'end' | 'templateId'>) {
        const keys = new Set(cells.map(cellKey));
        setDraft((current) => {
            if (!current) return current;
            return {
                revision: current.revision,
                shifts: [
                    ...current.shifts.filter((item) => !keys.has(cellKey(item))),
                    ...(shift ? cells.map((cell) => ({ ...cell, ...shift })) : []),
                ],
            };
        });
        setMessage(undefined);
        setDirty(true);
    }

    function moveShift(source: Cell, target: Cell) {
        if (cellKey(source) === cellKey(target)) return;
        const sourceShift = draft?.shifts.find((shift) => cellKey(shift) === cellKey(source));
        if (!sourceShift) return;
        if (draft?.shifts.some((shift) => cellKey(shift) === cellKey(target))) {
            setMessage({ text: 'В этой ячейке уже есть смена.', error: true });
            return;
        }
        const { start, end, templateId } = sourceShift;
        updateCells([source]);
        updateCells([target], { start, end, templateId });
    }

    function save() {
        if (!draft) return;
        try {
            const { revision, shifts } = draft;
            localStorage.setItem(draftKey, JSON.stringify({ revision, shifts }));
            setDirty(false);
            setMessage({ text: 'Черновик сохранён в этом браузере.' });
        } catch {
            setMessage({ text: 'Браузер не смог сохранить черновик.', error: true });
        }
    }

    function discard() {
        if (!window.confirm('Удалить локальный черновик и загрузить опубликованный график?')) {
            return;
        }
        try {
            localStorage.removeItem(draftKey);
            setDraft(undefined);
            void load();
        } catch {
            setMessage({ text: 'Браузер не смог удалить локальный черновик.', error: true });
        }
    }

    async function publish() {
        if (!published || !draft || publishing) return;
        setPublishing(true);
        try {
            const { revision, shifts } = draft;
            const snapshot = await requestSchedule<Pick<Schedule, keyof Draft | 'publishedAt'>>(
                '/publication',
                {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ revision, shifts }),
                },
            );
            setPublished({ ...published, ...snapshot });
            setDraft(snapshot);
            setDirty(false);
            try {
                localStorage.removeItem(draftKey);
                setMessage({ text: 'График опубликован.' });
            } catch {
                setMessage({ text: 'График опубликован. Браузер не смог удалить черновик.' });
            }
        } catch (error) {
            setMessage({
                text: error instanceof Error ? error.message : 'Не удалось опубликовать график.',
                error: true,
            });
            const latest = await requestSchedule<Schedule>().catch(() => undefined);
            if (latest) setPublished(latest);
        } finally {
            setPublishing(false);
        }
    }

    return {
        published,
        draft,
        loading,
        publishing,
        message,
        setMessage,
        load,
        save,
        discard,
        publish,
        updateCells,
        moveShift,
    };
}
