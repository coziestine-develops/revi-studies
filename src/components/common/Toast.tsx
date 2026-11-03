import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { CheckCircle2, CircleAlert, X } from '../../icons';

type ToastTone = 'success' | 'error' | 'info';
interface ToastItem { id: number; message: string; tone: ToastTone }
interface ToastContextValue {
  toast: (message: string, tone?: ToastTone) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);
const DURATION_MS = 4500;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setItems((current) => current.filter((item) => item.id !== id)), []);
  const toast = useCallback((message: string, tone: ToastTone = 'success') => {
    const id = nextId.current++;
    setItems((current) => [...current.slice(-3), { id, message, tone }]);
    window.setTimeout(() => dismiss(id), DURATION_MS);
  }, [dismiss]);

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(6rem+env(safe-area-inset-bottom))] z-50 flex flex-col items-center gap-2 px-4 md:bottom-6 md:items-end md:px-6" aria-live="polite">
        {items.map((item) => (
          <div
            key={item.id}
            role={item.tone === 'error' ? 'alert' : 'status'}
            className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-control border bg-surface px-4 py-3 text-sm text-foreground shadow-lg ${
              item.tone === 'error'
                ? 'border-error/50'
                : 'border-success/40 bg-[linear-gradient(rgb(var(--success)/0.12),rgb(var(--success)/0.12))]'
            }`}
          >
            {item.tone === 'error'
              ? <CircleAlert className="mt-0.5 h-4 w-4 text-error" aria-hidden />
              : <CheckCircle2 className="mt-0.5 h-4 w-4 text-success" aria-hidden />}
            <span className="min-w-0 flex-1">{item.message}</span>
            <button type="button" onClick={() => dismiss(item.id)} aria-label="Dismiss notification" className="rounded p-0.5 text-muted hover:text-foreground">
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}
