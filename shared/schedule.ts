import { z } from 'zod';

export const dateSchema = z.iso.date();
export const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

export const shiftSchema = z
    .object({
        employeeId: z.number().int().positive(),
        date: dateSchema,
        start: timeSchema,
        end: timeSchema,
        templateId: z.number().int().positive().nullable(),
    })
    .refine(({ start, end }) => start !== end);

export const publishSchema = z.object({
    revision: z.number().int().nonnegative(),
    shifts: z
        .array(shiftSchema)
        .max(10_000)
        .refine(
            (shifts) => new Set(shifts.map(cellKey)).size === shifts.length,
            'На сотрудника и дату допускается одна смена',
        ),
});

export interface Cell {
    employeeId: number;
    date: string;
}

export type Shift = z.infer<typeof shiftSchema>;
export type Draft = z.infer<typeof publishSchema>;

export interface Employee {
    id: number;
    name: string;
    role: string;
    avatar: string | null;
}

export interface Template {
    id: number;
    name: string;
    start: string;
    end: string;
    color: 'morning' | 'day' | 'evening';
}

export interface Schedule extends Draft {
    employees: Employee[];
    templates: Template[];
    publishedAt: string | null;
}

export function cellKey({ employeeId, date }: Cell): string {
    return `${employeeId}:${date}`;
}

export function shiftMinutes({ start, end }: Pick<Shift, 'start' | 'end'>): number {
    function toMinutes(time: string) {
        const [hours, minutes] = time.split(':').map(Number);
        return hours * 60 + minutes;
    }

    return (toMinutes(end) - toMinutes(start) + 1440) % 1440;
}

export function formatDuration(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const remainder = minutes % 60;
    if (!hours && remainder) return `${remainder} мин`;
    if (!remainder) return `${hours} ч`;
    return `${hours} ч ${remainder} мин`;
}
