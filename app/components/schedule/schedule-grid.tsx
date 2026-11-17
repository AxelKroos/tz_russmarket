import { useMemo } from 'react';
import type { DragEvent, MouseEvent } from 'react';
import type { Cell, Employee, Shift, Template } from '../../../shared/schedule.js';
import { cellKey, formatDuration, shiftMinutes } from '../../../shared/schedule.js';
import type { CalendarMode } from '../../utils/calendar.js';
import { formatDay, formatFullDate } from '../../utils/calendar.js';
import { DesignIcon } from '../common/design-icon.js';

export const templateDragType = 'application/x-schedule-template';
const shiftDragType = 'application/x-schedule-shift';

function formatCardInterval({ start, end }: Shift) {
    if (start.endsWith(':00') && end.endsWith(':00')) {
        return `${start.slice(0, 2)} - ${end.slice(0, 2)}`;
    }

    return `${start} -\u00a0${end}`;
}

interface ScheduleGridProps {
    days: string[];
    employees: Employee[];
    shifts: Shift[];
    templates: Template[];
    mode: CalendarMode;
    readonly: boolean;
    disabled: boolean;
    selected: Set<string>;
    onCell: (cell: Cell, event: MouseEvent<HTMLButtonElement>) => void;
    onDate: (date: string, anchor: HTMLButtonElement) => void;
    onTemplateDrop: (cell: Cell, templateId: number) => void;
    onShiftDrop: (source: Cell, target: Cell) => void;
}

export function ScheduleGrid({
    days,
    employees,
    shifts,
    templates,
    mode,
    readonly,
    disabled,
    selected,
    onCell,
    onDate,
    onTemplateDrop,
    onShiftDrop,
}: ScheduleGridProps) {
    const { entries, coverage, hours } = useMemo(() => {
        const visibleDays = new Set(days);
        const entries = new Map<string, Shift>();
        const coverage = new Map<string, number>();
        const hours = new Map<number, number>();

        for (const shift of shifts) {
            if (!visibleDays.has(shift.date)) continue;
            entries.set(cellKey(shift), shift);
            coverage.set(shift.date, (coverage.get(shift.date) ?? 0) + 1);
            hours.set(shift.employeeId, (hours.get(shift.employeeId) ?? 0) + shiftMinutes(shift));
        }
        return { entries, coverage, hours };
    }, [days, shifts]);

    function allowDrop(event: DragEvent) {
        if (readonly || disabled) return;
        if (event.dataTransfer.types.includes(templateDragType)) {
            event.preventDefault();
            event.dataTransfer.dropEffect = 'copy';
        }
        if (event.dataTransfer.types.includes(shiftDragType)) {
            event.preventDefault();
            event.dataTransfer.dropEffect = 'move';
        }
    }

    function drop(event: DragEvent, cell: Cell) {
        if (readonly || disabled) return;
        event.preventDefault();
        const templateId = event.dataTransfer.getData(templateDragType);
        const sourceKey = event.dataTransfer.getData(shiftDragType);
        if (templateId) onTemplateDrop(cell, Number(templateId));
        const source = entries.get(sourceKey);
        if (source) onShiftDrop(source, cell);
    }

    return (
        <div
            className="ScheduleGrid"
            role="region"
            tabIndex={0}
            aria-label="Таблица графика смен"
            aria-describedby={readonly ? undefined : 'schedule-selection-help'}
        >
            <table className={`ScheduleGrid-table ScheduleGrid-table--${mode}`}>
                <colgroup>
                    <col className="ScheduleGrid-employeeColumn" />
                    {days.map((date) => (
                        <col className="ScheduleGrid-dateColumn" key={date} />
                    ))}
                </colgroup>
                <thead>
                    <tr>
                        <th scope="col" className="ScheduleGrid-rowLabel">
                            Сотрудник
                        </th>
                        {days.map((date) => {
                            const { weekday, day } = formatDay(date);
                            return (
                                <th scope="col" key={date}>
                                    {readonly ? (
                                        <span className="ScheduleGrid-date">
                                            <span>{weekday}</span> {day}
                                        </span>
                                    ) : (
                                        <button
                                            className="ScheduleGrid-date"
                                            type="button"
                                            disabled={disabled || !employees.length}
                                            aria-label={`Назначить смену, ${formatFullDate(date)}`}
                                            onClick={(event) => onDate(date, event.currentTarget)}
                                        >
                                            <span>{weekday}</span> {day}
                                        </button>
                                    )}
                                </th>
                            );
                        })}
                    </tr>
                </thead>
                <tbody>
                    {employees.map((employee) => (
                        <tr key={employee.id}>
                            <th scope="row" className="ScheduleGrid-rowLabel">
                                <span className="ScheduleGrid-employee">
                                    <img
                                        className={`ScheduleGrid-avatar${employee.avatar ? '' : ' ScheduleGrid-avatar--placeholder'}`}
                                        src={employee.avatar ?? '/design/avatar.svg'}
                                        alt=""
                                    />
                                    <span className="ScheduleGrid-employeeDetails">
                                        <span title={employee.name}>{employee.name}</span>
                                        <small>
                                            {employee.role} ·{' '}
                                            {formatDuration(hours.get(employee.id) ?? 0)}
                                        </small>
                                    </span>
                                </span>
                            </th>
                            {days.map((date) => {
                                const cell = { employeeId: employee.id, date };
                                const key = cellKey(cell);
                                const shift = entries.get(key);
                                const template = templates.find(
                                    ({ id }) => id === shift?.templateId,
                                );
                                const color = shift ? (template?.color ?? 'custom') : 'empty';
                                const isSelected = selected.has(key);
                                const interval = shift && `${shift.start} – ${shift.end}`;
                                const label = `${employee.name}, ${formatFullDate(date)}: ${interval || 'нет смены'}`;
                                const className = `ScheduleGrid-cell ScheduleGrid-cell--${color}`;
                                const content = shift ? (
                                    <>
                                        <span className="ScheduleGrid-interval">
                                            {formatCardInterval(shift)}
                                        </span>
                                        <span className="ScheduleGrid-duration">
                                            {formatDuration(shiftMinutes(shift))}
                                        </span>
                                    </>
                                ) : (
                                    <DesignIcon name="add-cell" className="ScheduleGrid-add" />
                                );
                                return (
                                    <td key={key} className={isSelected ? 'isSelected' : undefined}>
                                        {readonly ? (
                                            <span
                                                className={className}
                                                aria-label={label}
                                                title={label}
                                            >
                                                {content}
                                            </span>
                                        ) : (
                                            <button
                                                type="button"
                                                className={className}
                                                aria-label={label}
                                                aria-pressed={isSelected}
                                                title={label}
                                                disabled={disabled}
                                                draggable={Boolean(shift) && !disabled}
                                                onClick={(event) => onCell(cell, event)}
                                                onDragOver={allowDrop}
                                                onDrop={(event) => drop(event, cell)}
                                                onDragStart={(event) => {
                                                    event.dataTransfer.setData(shiftDragType, key);
                                                    event.dataTransfer.effectAllowed = 'move';
                                                }}
                                            >
                                                {content}
                                            </button>
                                        )}
                                    </td>
                                );
                            })}
                        </tr>
                    ))}
                    {!employees.length && (
                        <tr>
                            <td colSpan={days.length + 1} className="ScheduleGrid-empty">
                                Сотрудники не найдены.
                            </td>
                        </tr>
                    )}
                </tbody>
                <tfoot>
                    <tr>
                        <th scope="row" className="ScheduleGrid-rowLabel">
                            Покрытие
                        </th>
                        {days.map((date) => {
                            const count = coverage.get(date) ?? 0;
                            return (
                                <td
                                    key={date}
                                    className={count > 0 ? 'isCovered' : undefined}
                                    data-date={date}
                                >
                                    {count}
                                </td>
                            );
                        })}
                    </tr>
                </tfoot>
            </table>
        </div>
    );
}
