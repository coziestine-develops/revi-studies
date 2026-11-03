import type { ButtonHTMLAttributes } from 'react';
import { Loader2 } from '../../icons';

export type ButtonVariant = 'primary' | 'secondary' | 'mint' | 'lavender' | 'success' | 'danger' | 'danger-outline' | 'ghost';

// Minimal buttons: flat fills, thin borders, small radius, no shadows, no motion beyond a color change.
const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
  secondary: 'border border-border bg-transparent text-foreground hover:bg-surface-muted',
  mint: 'bg-mint text-on-accent hover:bg-mint/90',
  lavender: 'bg-lavender-surface text-foreground hover:bg-lavender-surface/70',
  success: 'bg-success text-[rgb(var(--revi-cream))] hover:bg-success/90 dark:text-[rgb(var(--revi-navy))]',
  danger: 'bg-error text-[rgb(var(--revi-cream))] hover:bg-error/90 dark:bg-[rgb(220_38_38)] dark:text-[rgb(var(--revi-cream))] dark:hover:bg-[rgb(185_28_28)]',
  'danger-outline': 'border border-error/50 bg-transparent text-error hover:bg-error/10',
  ghost: 'text-muted hover:bg-surface-muted hover:text-foreground',
};

/** Shared classes so links can look like buttons. */
export function buttonClasses(variant: ButtonVariant = 'primary', className = ''): string {
  return [
    'inline-flex items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium',
    'transition-colors duration-150',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
    'disabled:cursor-not-allowed disabled:opacity-50',
    variantClasses[variant],
    className,
  ].join(' ');
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  loading?: boolean;
}

export function Button({ variant = 'primary', loading = false, disabled, className = '', children, ...props }: ButtonProps) {
  return (
    <button
      type={props.type ?? 'button'}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClasses(variant, className)}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}
