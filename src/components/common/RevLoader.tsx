interface RevLoaderProps {
  /** Shown under the spinner and read by screen readers. */
  label?: string;
  /** Fill the whole screen height (used for session checks and first page loads). */
  fullPage?: boolean;
  className?: string;
}

/**
 * Loading state for phones and tablets (below the lg breakpoint).
 * The REVI mascot sits inside a spinning ring. On desktop and laptop screens this renders nothing.
 */
export function RevLoader({ label = 'Loading', fullPage = false, className = '' }: RevLoaderProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={label}
      className={`flex items-center justify-center lg:hidden ${fullPage ? 'min-h-[100dvh] bg-white p-6' : 'py-16'} ${className}`}
    >
      <div className="flex flex-col items-center gap-5">
        <div className="relative flex h-24 w-24 items-center justify-center">
          <span
            aria-hidden
            className="absolute inset-0 animate-spin rounded-full border-[3px] border-mint-surface border-t-mint"
          />
          <img
            src="/revi-avatar.png"
            alt=""
            aria-hidden
            width={512}
            height={512}
            className="h-16 w-16 rounded-full bg-lavender-surface object-cover"
          />
        </div>
        <p className="text-sm font-semibold tracking-wide text-muted">{label}</p>
      </div>
    </div>
  );
}
