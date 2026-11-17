export type CalendarMode = 'week' | 'month';

const weekdays = new Intl.DateTimeFormat('ru-RU', { weekday: 'short', timeZone: 'UTC' });
const month = new Intl.DateTimeFormat('ru-RU', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
});
const dateLabel = new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
});

function parseDate(date: string) {
    return new Date(`${date}T00:00:00Z`);
}

function formatDate(date: Date) {
    return date.toISOString().slice(0, 10);
}

export function today() {
    const date = new Date();
    return formatDate(new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())));
}

export function calendarDays(anchor: string, mode: CalendarMode) {
    const first = parseDate(anchor);
    if (mode === 'week') {
        first.setUTCDate(first.getUTCDate() - ((first.getUTCDay() + 6) % 7));
    } else {
        first.setUTCDate(1);
    }

    const last = new Date(first);
    if (mode === 'week') last.setUTCDate(last.getUTCDate() + 7);
    else last.setUTCMonth(last.getUTCMonth() + 1);

    const days: string[] = [];
    while (first < last) {
        days.push(formatDate(first));
        first.setUTCDate(first.getUTCDate() + 1);
    }
    return days;
}

export function stepPeriod(anchor: string, mode: CalendarMode, direction: number) {
    const date = parseDate(calendarDays(anchor, mode)[0]);
    if (mode === 'week') date.setUTCDate(date.getUTCDate() + direction * 7);
    else date.setUTCMonth(date.getUTCMonth() + direction);
    return formatDate(date);
}

export function formatPeriod(days: string[], mode: CalendarMode) {
    const first = parseDate(days[0]);
    const last = parseDate(days[days.length - 1]);
    if (mode === 'month') return month.format(first);
    return dateLabel.formatRange(first, last);
}

export function formatDay(date: string) {
    return { weekday: weekdays.format(parseDate(date)), day: Number(date.slice(-2)) };
}

export function formatFullDate(date: string) {
    return dateLabel.format(parseDate(date));
}
