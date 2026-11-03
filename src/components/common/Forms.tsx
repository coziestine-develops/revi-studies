import { forwardRef, useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { CheckCircle2, Eye, EyeOff } from '../../icons';

export const inputClass =
  'w-full rounded-control border border-border bg-surface px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted focus:border-lavender focus:outline-none focus:ring-2 focus:ring-brand aria-[invalid=true]:border-error disabled:opacity-60';

export const selectClass =
  'min-w-0 max-w-full truncate rounded-control border border-border bg-surface px-3.5 py-2.5 text-sm text-foreground focus:border-lavender focus:outline-none focus:ring-2 focus:ring-brand';

/** Password field with one show/hide button. The browser's own reveal icon is hidden in index.css, so there is never a second eye. */
export const PasswordInput = forwardRef<HTMLInputElement, Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>>(function PasswordInput({ className = '', ...props }, ref) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input ref={ref} {...props} type={show ? 'text' : 'password'} className={`${className} pr-11`} />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        aria-label={show ? 'Hide password' : 'Show password'}
        aria-pressed={show}
        className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-control text-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      >
        {show ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
      </button>
    </div>
  );
});

export function Field({ id, label, error, hint, children }: { id: string; label: string; error?: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium">{label}</label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-muted">{hint}</p>}
      {error && <p id={`${id}-error`} role="alert" className="mt-1.5 text-xs text-error">{error}</p>}
    </div>
  );
}

export function Alert({ tone = 'error', children }: { tone?: 'error' | 'success' | 'info'; children: ReactNode }) {
  const styles = {
    error: 'border-error text-error bg-surface-muted',
    success: 'border-success/40 bg-success/10 text-foreground',
    info: 'border-info text-foreground',
  };
  return (
    <p
      role={tone === 'error' ? 'alert' : 'status'}
      className={`flex items-center gap-2 rounded-control border px-3.5 py-2.5 text-sm ${styles[tone]}`}
    >
      {tone === 'success' && <CheckCircle2 className="h-4 w-4 text-success" aria-hidden />}
      <span className="min-w-0">{children}</span>
    </p>
  );
}
