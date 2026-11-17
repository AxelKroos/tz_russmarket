import { DesignIcon } from '../common/design-icon.js';

interface CrmSidebarProps {
    readonly: boolean;
    collapsed: boolean;
    onToggle: () => void;
}

export function CrmSidebar({ readonly, collapsed, onToggle }: CrmSidebarProps) {
    return (
        <aside className={`CrmSidebar${collapsed ? ' CrmSidebar--collapsed' : ''}`}>
            <div className="CrmSidebar-head">
                <a className="CrmSidebar-brand" href="/?view=published">
                    CRM
                </a>
                <a
                    className="CrmSidebar-bell"
                    href="/?view=published"
                    aria-label="Статус публикации"
                >
                    <DesignIcon name="bell" />
                </a>
            </div>
            <nav aria-label="Главное меню" className="CrmSidebar-nav">
                <a
                    href="/?view=published"
                    aria-current={readonly ? 'page' : undefined}
                    aria-label="Главная"
                >
                    <DesignIcon name="home" />
                    <span>Главная</span>
                </a>
                <a href="/" aria-current={readonly ? undefined : 'page'} aria-label="Смены">
                    <DesignIcon name="calendar" />
                    <span>Смены</span>
                </a>
            </nav>
            <button
                className="CrmSidebar-toggle"
                type="button"
                onClick={onToggle}
                aria-expanded={!collapsed}
                aria-label={collapsed ? 'Развернуть меню' : 'Свернуть меню'}
            >
                <DesignIcon name="sidebar" />
                <span>Свернуть меню</span>
            </button>
        </aside>
    );
}
