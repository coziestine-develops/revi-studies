import type { ReactNode } from 'react';

interface CardProps {
  title?: string;
  description?: string;
  action?: ReactNode;
  tone?: 'default' | 'mint' | 'lavender';
  className?: string;
  children?: ReactNode;
}

const toneClasses = {
  default: 'bg-surface',
  mint: 'bg-mint-surface',
  lavender: 'bg-lavender-surface',
};

export function Card({ title, description, action, tone = 'default', className = '', children }: CardProps) {
  return (
    <section className={`min-w-0 rounded-card border border-border p-5 text-foreground shadow-sm sm:p-6 ${toneClasses[tone]} ${className}`}>
      {(title || action) && (
        <header className="mb-4 flex items-start justify-between gap-3">
          <div>
            {title && <h2 className="text-base font-semibold tracking-tight">{title}</h2>}
            {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}
