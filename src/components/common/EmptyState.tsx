import type { IconComponent } from '../../icons';
import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon: IconComponent;
  title: string;
  description: string;
  action?: ReactNode;
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-control border border-dashed border-border bg-surface-muted px-6 py-10 text-center">
      <span className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-full bg-lavender-surface">
        <Icon className="h-5 w-5 text-foreground" aria-hidden />
      </span>
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="mt-1 max-w-xs text-sm text-muted">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
