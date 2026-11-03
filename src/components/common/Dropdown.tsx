import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

interface DropdownProps {
  /** Renders the trigger button content. */
  label: ReactNode;
  ariaLabel: string;
  triggerClassName?: string;
  align?: 'left' | 'right';
  children: (close: () => void) => ReactNode;
}

/** Small accessible menu: closes on outside click, Escape, and after an item is chosen. */
export function Dropdown({ label, ariaLabel, triggerClassName = '', align = 'right', children }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((value) => !value)}
        className={triggerClassName}
      >
        {label}
      </button>
      {open && (
        <div
          id={menuId}
          role="menu"
          className={`absolute z-40 mt-2 w-max min-w-[220px] max-w-[calc(100vw-2rem)] rounded-control border border-border bg-surface-raised p-1.5 shadow-lg ${align === 'right' ? 'right-0' : 'left-0'}`}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

export const menuItemClass =
  'flex w-full items-center gap-2.5 rounded-control px-3 py-2 text-left text-sm font-medium text-foreground transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand';
