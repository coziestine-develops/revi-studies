const SIZES = { sm: 'h-8 w-8', md: 'h-9 w-9', lg: 'h-14 w-14' } as const;

interface LogoMarkProps {
  className?: string;
  alt?: string;
  size?: keyof typeof SIZES;
}

/** The REVI mascot's head, cropped for small spaces. */
export function LogoMark({ className = '', alt = 'REVI', size = 'md' }: LogoMarkProps) {
  return (
    <img
      src="/revi-avatar.png"
      alt={alt}
      width={512}
      height={512}
      className={`${SIZES[size]} shrink-0 rounded-full bg-lavender-surface object-cover ${className}`}
    />
  );
}

export function Logo({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark alt="" />
      <span className="font-display text-lg font-extrabold tracking-tight">REVI</span>
    </span>
  );
}
