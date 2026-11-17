import { useCallback, useEffect, useMemo, useState } from 'react';
import type { MouseEvent } from 'react';
import { cellKey } from '../../../shared/schedule.js';
import type { Cell, Template } from '../../../shared/schedule.js';
import { useSchedule } from '../../hooks/use-schedule.js';
import {
    calendarDays,
    formatFullDate,
    formatPeriod,
    stepPeriod,
    today,
} from '../../utils/calendar.js';
import type { CalendarMode } from '../../utils/calendar.js';
import { DesignIcon } from '../common/design-icon.js';
import { CrmSidebar } from './crm-sidebar.js';
import { ScheduleGrid } from './schedule-grid.js';
import { DateAssignment, ShiftEditor, ShiftMenu, TemplateOptions } from './shift-menu.js';
import { ShiftPanel } from './shift-panel.js';

type Menu =
    | { kind: 'cell'; anchor: HTMLElement; cell: Cell }
    | { kind: 'date'; anchor: HTMLElement; date: string }
    | { kind: 'selection'; anchor: HTMLElement };

function normalizeName(name: string) {
    return name.toLocaleLowerCase('ru').replaceAll('ё', 'е').trim();
}

const pluralRules = new Intl.PluralRules('ru');

function formatCount(count: number, one: string, few: string, many: string) {
    const forms = { one, few, many, zero: many, two: few, other: many };
    return `${count} ${forms[pluralRules.select(count)]}`;
}

export function SchedulePage() {
    const readonly = new URLSearchParams(window.location.search).get('view') === 'published';
    const schedule = useSchedule(readonly);
    const { published, draft, loading, publishing, message } = schedule;
    const [anchorDate, setAnchorDate] = useState(today);
    const [mode, setMode] = useState<CalendarMode>('week');
    const [query, setQuery] = useState('');
    const [collapsed, setCollapsed] = useState(() => matchMedia('(max-width: 1199px)').matches);
    const [selected, setSelected] = useState<Cell[]>([]);
    const [multiSelect, setMultiSelect] = useState(false);
    const [selectionAnchor, setSelectionAnchor] = useState<Cell>();
    const [menu, setMenu] = useState<Menu>();
    const closeMenu = useCallback(() => setMenu(undefined), []);
    const days = useMemo(() => calendarDays(anchorDate, mode), [anchorDate, mode]);
    const employees =
        published?.employees.filter(({ name }) =>
            normalizeName(name).includes(normalizeName(query)),
        ) ?? [];
    const templates = published?.templates ?? [];
    const selectedKeys = new Set(selected.map(cellKey));
    const stale = Boolean(draft && published && draft.revision < published.revision);
    const activeShift =
        menu?.kind === 'cell'
            ? draft?.shifts.find((shift) => cellKey(shift) === cellKey(menu.cell))
            : undefined;

    function resetSelection() {
        setSelected([]);
        setMultiSelect(false);
        setSelectionAnchor(undefined);
        closeMenu();
    }

    function assignTemplate(cells: Cell[], template: Template) {
        if (!cells.length) {
            schedule.setMessage({ text: 'Выберите ячейки или перетащите шаблон в таблицу.' });
            return;
        }
        schedule.updateCells(cells, {
            start: template.start,
            end: template.end,
            templateId: template.id,
        });
        resetSelection();
    }

    useEffect(() => {
        if (readonly || publishing || !selected.length) return;

        function onKey(event: KeyboardEvent) {
            if (
                event.target instanceof HTMLElement &&
                event.target.closest('input, textarea, select, [contenteditable]')
            )
                return;
            if (event.key === 'Escape') {
                setSelected([]);
                setMultiSelect(false);
                setSelectionAnchor(undefined);
                setMenu(undefined);
            }
            if (event.altKey || event.ctrlKey || event.metaKey) return;
            if (!/^[1-3]$/.test(event.key)) return;
            if (
                !(event.target instanceof HTMLElement) ||
                !event.target.closest('.ScheduleGrid, .SelectionToolbar, .ShiftMenu, .ShiftPanel')
            )
                return;
            const template = published?.templates.find(({ id }) => id === Number(event.key));
            if (!template) return;
            schedule.updateCells(selected, {
                start: template.start,
                end: template.end,
                templateId: template.id,
            });
            setSelected([]);
            setMultiSelect(false);
            setSelectionAnchor(undefined);
            setMenu(undefined);
        }

        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [readonly, publishing, published, selected, schedule.updateCells]);

    function selectCell(cell: Cell, event: MouseEvent<HTMLButtonElement>) {
        if (event.shiftKey && selectionAnchor) {
            const row = employees.findIndex(({ id }) => id === cell.employeeId);
            const anchorRow = employees.findIndex(({ id }) => id === selectionAnchor.employeeId);
            const column = days.indexOf(cell.date);
            const anchorColumn = days.indexOf(selectionAnchor.date);
            if (anchorRow >= 0 && anchorColumn >= 0) {
                const rows = employees.slice(
                    Math.min(row, anchorRow),
                    Math.max(row, anchorRow) + 1,
                );
                const dates = days.slice(
                    Math.min(column, anchorColumn),
                    Math.max(column, anchorColumn) + 1,
                );
                setSelected(
                    rows.flatMap(({ id }) => dates.map((date) => ({ employeeId: id, date }))),
                );
                closeMenu();
                return;
            }
        }

        setSelectionAnchor(cell);
        if (multiSelect || event.ctrlKey || event.metaKey || event.shiftKey) {
            const next = selectedKeys.has(cellKey(cell))
                ? selected.filter((item) => cellKey(item) !== cellKey(cell))
                : [...selected, cell];
            setSelected(next);
            if (!next.length) setMultiSelect(false);
            closeMenu();
            return;
        }
        setSelected([cell]);
        setMenu({ kind: 'cell', anchor: event.currentTarget, cell });
    }

    return (
        <div className="SchedulePage">
            <CrmSidebar
                readonly={readonly}
                collapsed={collapsed}
                onToggle={() => setCollapsed(!collapsed)}
            />
            <main className="SchedulePage-main">
                <a className="SchedulePage-back" href={readonly ? '/' : '/?view=published'}>
                    <span>
                        <DesignIcon name="chevron" />
                    </span>
                    {readonly ? 'Редактор смен' : 'Графики смен'}
                </a>
                <header className="SchedulePage-header">
                    <h1>{readonly ? 'Опубликованный график' : 'График'}</h1>
                    {!readonly && (
                        <div className="SchedulePage-actions">
                            <button
                                className="Button Button--secondary"
                                type="button"
                                disabled={!draft || loading || publishing || stale}
                                onClick={() => {
                                    resetSelection();
                                    void schedule.publish();
                                }}
                            >
                                {publishing ? 'Публикуем…' : 'Опубликовать'}
                            </button>
                            <button
                                className="Button Button--primary"
                                type="button"
                                disabled={!draft || publishing || loading}
                                onClick={schedule.save}
                            >
                                Сохранить
                            </button>
                        </div>
                    )}
                </header>
                {readonly && published && (
                    <p className="SchedulePage-status">
                        {published.publishedAt
                            ? `Обновлён ${new Date(published.publishedAt).toLocaleString('ru-RU')}`
                            : 'График ещё не опубликован.'}
                    </p>
                )}
                {message && (
                    <div
                        className={`SchedulePage-message${message.error ? ' isError' : ''}`}
                        role={message.error ? 'alert' : 'status'}
                    >
                        {message.text}
                    </div>
                )}
                {stale && (
                    <div className="SchedulePage-message isError" role="status">
                        Черновик создан на основе предыдущей версии. Общий график уже обновился.
                        <button type="button" onClick={schedule.discard}>
                            Удалить черновик и обновить
                        </button>
                    </div>
                )}
                {loading && (
                    <div className="SchedulePage-state" role="status">
                        Загрузка графика…
                    </div>
                )}
                {!loading && !published && (
                    <div className="SchedulePage-state">
                        <button
                            className="Button Button--secondary"
                            type="button"
                            onClick={() => void schedule.load()}
                        >
                            Повторить загрузку
                        </button>
                    </div>
                )}
                {published && draft && !loading && (
                    <div
                        className={`SchedulePage-workspace${readonly ? ' SchedulePage-workspace--readonly' : ''}`}
                    >
                        <section className="SchedulePage-calendar" aria-label="Календарь смен">
                            <div className="SchedulePage-toolbar">
                                {selected.length > 0 && !readonly ? (
                                    <div className="SelectionToolbar">
                                        <span className="SelectionToolbar-summary">
                                            Выделено:{' '}
                                            <strong>
                                                {formatCount(
                                                    selected.length,
                                                    'ячейка',
                                                    'ячейки',
                                                    'ячеек',
                                                )}
                                            </strong>
                                            <span>
                                                {formatCount(
                                                    new Set(
                                                        selected.map(
                                                            ({ employeeId }) => employeeId,
                                                        ),
                                                    ).size,
                                                    'сотрудник',
                                                    'сотрудника',
                                                    'сотрудников',
                                                )}{' '}
                                                ·{' '}
                                                {formatCount(
                                                    new Set(selected.map(({ date }) => date)).size,
                                                    'день',
                                                    'дня',
                                                    'дней',
                                                )}
                                            </span>
                                        </span>
                                        <div className="SelectionToolbar-actions">
                                            <button
                                                type="button"
                                                onClick={(event) =>
                                                    setMenu({
                                                        kind: 'selection',
                                                        anchor: event.currentTarget,
                                                    })
                                                }
                                            >
                                                <DesignIcon name="apply-template" /> Применить
                                                шаблон
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    schedule.updateCells(selected);
                                                    resetSelection();
                                                }}
                                            >
                                                <DesignIcon name="clear" /> Очистить
                                            </button>
                                            <button type="button" onClick={resetSelection}>
                                                <DesignIcon name="deselect" /> Снять
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <label className="SchedulePage-search">
                                            <DesignIcon name="search" />
                                            <input
                                                type="search"
                                                placeholder="Поиск по ФИО"
                                                aria-label="Поиск по ФИО"
                                                value={query}
                                                onChange={(event) => {
                                                    resetSelection();
                                                    setQuery(event.target.value);
                                                }}
                                            />
                                        </label>
                                        <div
                                            className="SchedulePage-modes"
                                            role="group"
                                            aria-label="Вид календаря"
                                        >
                                            <button
                                                type="button"
                                                aria-pressed={mode === 'month'}
                                                onClick={() => setMode('month')}
                                            >
                                                Месяц
                                            </button>
                                            <button
                                                type="button"
                                                aria-pressed={mode === 'week'}
                                                onClick={() => setMode('week')}
                                            >
                                                Неделя
                                            </button>
                                        </div>
                                        <div
                                            className="SchedulePage-navigation"
                                            role="group"
                                            aria-label="Период графика"
                                        >
                                            <button
                                                type="button"
                                                aria-label="Предыдущий период"
                                                onClick={() =>
                                                    setAnchorDate(stepPeriod(anchorDate, mode, -1))
                                                }
                                            >
                                                <DesignIcon name="chevron" />
                                            </button>
                                            <span aria-live="polite">
                                                {formatPeriod(days, mode)}
                                            </span>
                                            <button
                                                type="button"
                                                aria-label="Следующий период"
                                                onClick={() =>
                                                    setAnchorDate(stepPeriod(anchorDate, mode, 1))
                                                }
                                            >
                                                <DesignIcon
                                                    name="chevron"
                                                    className="SchedulePage-nextIcon"
                                                />
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                            <p id="schedule-selection-help" className="VisuallyHidden">
                                Shift выделяет диапазон. Ctrl или Command добавляет отдельные
                                ячейки.
                            </p>
                            <ScheduleGrid
                                key={`${mode}:${days[0]}`}
                                days={days}
                                employees={employees}
                                shifts={draft.shifts}
                                templates={templates}
                                mode={mode}
                                readonly={readonly}
                                disabled={publishing}
                                selected={selectedKeys}
                                onCell={selectCell}
                                onDate={(date, anchor) => setMenu({ kind: 'date', date, anchor })}
                                onTemplateDrop={(cell, id) => {
                                    const template = templates.find((item) => item.id === id);
                                    if (template) assignTemplate([cell], template);
                                }}
                                onShiftDrop={(source, target) => {
                                    schedule.moveShift(source, target);
                                    resetSelection();
                                }}
                            />
                        </section>
                        {!readonly && (
                            <ShiftPanel
                                templates={templates}
                                selectedCount={selected.length}
                                disabled={publishing}
                                onTemplate={(template) => assignTemplate(selected, template)}
                                onCustom={(start, end) => {
                                    schedule.updateCells(selected, {
                                        start,
                                        end,
                                        templateId: null,
                                    });
                                    resetSelection();
                                }}
                            />
                        )}
                    </div>
                )}
            </main>
            {menu?.kind === 'cell' && (
                <ShiftMenu
                    key={cellKey(menu.cell)}
                    anchor={menu.anchor}
                    title={`${published?.employees.find(({ id }) => id === menu.cell.employeeId)?.name} · ${formatFullDate(menu.cell.date)}`}
                    close={closeMenu}
                >
                    {activeShift && (
                        <ShiftEditor
                            shift={activeShift}
                            onSave={(start, end) => {
                                schedule.updateCells([menu.cell], { start, end, templateId: null });
                                menu.anchor.focus();
                                resetSelection();
                            }}
                            onRemove={() => {
                                schedule.updateCells([menu.cell]);
                                menu.anchor.focus();
                                resetSelection();
                            }}
                        />
                    )}
                    <TemplateOptions
                        templates={templates}
                        onSelect={(template) => {
                            menu.anchor.focus();
                            assignTemplate([menu.cell], template);
                        }}
                    />
                    <button
                        className="ShiftMenu-multiSelect"
                        type="button"
                        onClick={() => {
                            setMultiSelect(true);
                            closeMenu();
                            menu.anchor.focus();
                        }}
                    >
                        Выбрать несколько ячеек
                    </button>
                </ShiftMenu>
            )}
            {menu?.kind === 'date' && (
                <ShiftMenu
                    key={menu.date}
                    anchor={menu.anchor}
                    title="Быстрое назначение"
                    close={closeMenu}
                >
                    <DateAssignment
                        date={menu.date}
                        employees={employees}
                        templates={templates}
                        selected={selected
                            .filter(({ date }) => date === menu.date)
                            .map(({ employeeId }) => employeeId)}
                        onApply={(ids, template) => {
                            menu.anchor.focus();
                            assignTemplate(
                                ids.map((employeeId) => ({ employeeId, date: menu.date })),
                                template,
                            );
                        }}
                    />
                </ShiftMenu>
            )}
            {menu?.kind === 'selection' && (
                <ShiftMenu anchor={menu.anchor} title="Применить шаблон" close={closeMenu}>
                    <TemplateOptions
                        templates={templates}
                        onSelect={(template) => assignTemplate(selected, template)}
                    />
                </ShiftMenu>
            )}
        </div>
    );
}
