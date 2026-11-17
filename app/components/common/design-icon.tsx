type Icon =
    | 'search'
    | 'home'
    | 'bell'
    | 'calendar'
    | 'sidebar'
    | 'chevron'
    | 'plus'
    | 'add-cell'
    | 'apply-template'
    | 'clear'
    | 'deselect';

export function DesignIcon({ name, className = '' }: { name: Icon; className?: string }) {
    return <img className={`DesignIcon ${className}`} src={`/design/${name}.svg`} alt="" />;
}
