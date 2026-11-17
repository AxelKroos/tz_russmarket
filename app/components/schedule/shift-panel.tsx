import { useState } from 'react';
import { formatDuration, shiftMinutes } from '../../../shared/schedule.js';
import type { Template } from '../../../shared/schedule.js';
import { DesignIcon } from '../common/design-icon.js';
import { templateDragType } from './schedule-grid.js';

interface ShiftPanelProps {
    templates: Template[];
    selectedCount: number;
    disabled: boolean;
    onTemplate: (template: Template) => void;
    onCustom: (start: string, end: string) => void;
}

export function ShiftPanel({
    templates,
    selectedCount,
    disabled,
    onTemplate,
    onCustom,
}: ShiftPanelProps) {
    const [start, setStart] = useState('09:00');
    const [end, setEnd] = useState('17:00');
    const [error, setError] = useState(false);

    return (
        <aside className="ShiftPanel" aria-label="Настройка смен">
            <h2>Шаблоны смен</h2>
            <div className="ShiftPanel-templates">
                {templates.map((template) => (
                    <button
                        type="button"
                        className={`ShiftPanel-template ShiftPanel-template--${template.color}`}
                        key={template.id}
                        disabled={disabled}
                        draggable={!disabled}
                        onClick={() => onTemplate(template)}
                        onDragStart={(event) => {
                            event.dataTransfer.setData(templateDragType, String(template.id));
                            event.dataTransfer.effectAllowed = 'copy';
                        }}
                    >
                        <span className="ShiftPanel-templateName">{template.name}</span>
                        <span>
                            {template.start} - {template.end} ·{' '}
                            {formatDuration(shiftMinutes(template))}
                        </span>
                        {template.id <= 3 && <kbd aria-hidden="true">{template.id}</kbd>}
                    </button>
                ))}
            </div>
            <h2>Своя смена</h2>
            <form
                className="ShiftPanel-form"
                onSubmit={(event) => {
                    event.preventDefault();
                    if (start === end) {
                        setError(true);
                        return;
                    }
                    onCustom(start, end);
                }}
            >
                <div className="ShiftPanel-times">
                    <label>
                        Начало
                        <input
                            type="time"
                            required
                            value={start}
                            disabled={disabled}
                            onChange={(event) => {
                                setStart(event.target.value);
                                setError(false);
                            }}
                        />
                    </label>
                    <label>
                        Конец
                        <input
                            type="time"
                            required
                            value={end}
                            disabled={disabled}
                            onChange={(event) => {
                                setEnd(event.target.value);
                                setError(false);
                            }}
                        />
                    </label>
                </div>
                {error && (
                    <p className="FormError" role="alert">
                        Начало и конец смены должны отличаться.
                    </p>
                )}
                <button
                    type="submit"
                    className="Button Button--secondary"
                    disabled={disabled || !selectedCount}
                >
                    <DesignIcon name="plus" /> Поставить в выделенные
                </button>
            </form>
        </aside>
    );
}
