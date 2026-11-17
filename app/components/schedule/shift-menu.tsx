import { useLayoutEffect, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import type { Employee, Shift, Template } from '../../../shared/schedule.js';
import { formatDuration, shiftMinutes } from '../../../shared/schedule.js';
import { formatFullDate } from '../../utils/calendar.js';

interface ShiftMenuProps {
    anchor: HTMLElement;
    title: string;
    close: () => void;
    children: ReactNode;
}

export function ShiftMenu({ anchor, title, close, children }: ShiftMenuProps) {
    const menuRef = useRef<HTMLDivElement>(null);

    useLayoutEffect(() => {
        const menu = menuRef.current;
        if (!menu) return;

        function align() {
            if (!menu) return;
            const rect = anchor.getBoundingClientRect();
            const width = menu.offsetWidth;
            const height = menu.offsetHeight;
            menu.style.left = `${Math.max(12, Math.min(rect.left, innerWidth - width - 12))}px`;
            const below = rect.bottom + 6;
            const top = below + height <= innerHeight - 12 ? below : rect.top - height - 6;
            menu.style.top = `${Math.max(12, top)}px`;
        }

        const observer = new ResizeObserver(align);
        observer.observe(menu);
        align();
        menu.focus({ preventScroll: true });

        function dismiss(event: PointerEvent) {
            if (
                event.target instanceof Node &&
                !menu?.contains(event.target) &&
                !anchor.contains(event.target)
            ) {
                close();
            }
        }

        function onEscape(event: KeyboardEvent) {
            if (event.key === 'Escape') {
                event.stopPropagation();
                close();
                anchor.focus();
            }
        }

        window.addEventListener('resize', align);
        window.addEventListener('scroll', align, true);
        document.addEventListener('pointerdown', dismiss);
        menu.addEventListener('keydown', onEscape);
        return () => {
            observer.disconnect();
            window.removeEventListener('resize', align);
            window.removeEventListener('scroll', align, true);
            document.removeEventListener('pointerdown', dismiss);
            menu.removeEventListener('keydown', onEscape);
        };
    }, [anchor, close]);

    return (
        <div className="ShiftMenu" ref={menuRef} role="dialog" aria-label={title} tabIndex={-1}>
            <div className="ShiftMenu-header">
                <strong>{title}</strong>
                <button
                    type="button"
                    onClick={() => {
                        close();
                        anchor.focus();
                    }}
                    aria-label="Закрыть"
                >
                    ×
                </button>
            </div>
            {children}
        </div>
    );
}

export function TemplateOptions({
    templates,
    onSelect,
}: {
    templates: Template[];
    onSelect: (template: Template) => void;
}) {
    return (
        <div className="ShiftMenu-templateOptions" aria-label="Выберите шаблон смены">
            {templates.map((template) => (
                <button
                    className={`ShiftMenu-templateOption ShiftMenu-templateOption--${template.color}`}
                    type="button"
                    key={template.id}
                    onClick={() => onSelect(template)}
                >
                    <span>{template.name}</span>
                    <small>
                        {template.start} – {template.end}
                    </small>
                </button>
            ))}
        </div>
    );
}

export function ShiftEditor({
    shift,
    onSave,
    onRemove,
}: {
    shift: Shift;
    onSave: (start: string, end: string) => void;
    onRemove: () => void;
}) {
    const [start, setStart] = useState(shift.start);
    const [end, setEnd] = useState(shift.end);
    const [invalid, setInvalid] = useState(false);

    function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setInvalid(start === end);
        if (start !== end) onSave(start, end);
    }

    return (
        <form className="ShiftMenu-editor" onSubmit={submit}>
            <div className="ShiftPanel-times">
                <label>
                    Начало
                    <input
                        type="time"
                        required
                        value={start}
                        onChange={(event) => {
                            setStart(event.target.value);
                            setInvalid(false);
                        }}
                    />
                </label>
                <label>
                    Конец
                    <input
                        type="time"
                        required
                        value={end}
                        onChange={(event) => {
                            setEnd(event.target.value);
                            setInvalid(false);
                        }}
                    />
                </label>
            </div>
            {invalid && (
                <p className="FormError" role="alert">
                    Начало и конец смены должны отличаться.
                </p>
            )}
            <div className="ShiftMenu-actions">
                <button type="submit" className="Button Button--secondary">
                    Изменить время
                </button>
                <button type="button" className="ShiftMenu-remove" onClick={onRemove}>
                    Удалить смену
                </button>
            </div>
        </form>
    );
}

export function DateAssignment({
    date,
    employees,
    templates,
    selected,
    onApply,
}: {
    date: string;
    employees: Employee[];
    templates: Template[];
    selected: number[];
    onApply: (employees: number[], template: Template) => void;
}) {
    const [ids, setIds] = useState(() => new Set(selected));

    return (
        <>
            <fieldset className="ShiftMenu-employees">
                <legend>Сотрудники на {formatFullDate(date)}</legend>
                {employees.map((employee) => (
                    <label key={employee.id}>
                        <input
                            type="checkbox"
                            checked={ids.has(employee.id)}
                            onChange={(event) => {
                                const next = new Set(ids);
                                if (event.target.checked) next.add(employee.id);
                                else next.delete(employee.id);
                                setIds(next);
                            }}
                        />
                        {employee.name}
                    </label>
                ))}
            </fieldset>
            <div className="ShiftMenu-templateOptions">
                {templates.map((template) => (
                    <button
                        className={`ShiftMenu-templateOption ShiftMenu-templateOption--${template.color}`}
                        type="button"
                        key={template.id}
                        disabled={!ids.size}
                        onClick={() => onApply([...ids], template)}
                    >
                        <span>{template.name}</span>
                        <small>{formatDuration(shiftMinutes(template))}</small>
                    </button>
                ))}
            </div>
        </>
    );
}
