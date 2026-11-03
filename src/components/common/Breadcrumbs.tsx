import { Link } from 'react-router-dom';
import { ChevronRight } from '../../icons';

export interface Crumb { label: string; to?: string }

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="min-w-0 text-sm text-muted">
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((item, index) => {
          const last = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`} className="flex min-w-0 items-center gap-1.5">
              {item.to && !last
                ? <Link to={item.to} className="hover:text-foreground hover:underline">{item.label}</Link>
                : <span aria-current={last ? 'page' : undefined} className={`truncate ${last ? 'font-medium text-foreground' : ''}`}>{item.label}</span>}
              {!last && <ChevronRight className="h-3.5 w-3.5" aria-hidden />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
