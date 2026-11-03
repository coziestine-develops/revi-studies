interface UserAvatarProps {
  url?: string | null;
  name: string;
  size?: string;
}

/** Profile photo when one is set, otherwise the REVI mascot. */
export function UserAvatar({ url, name, size = 'h-8 w-8' }: UserAvatarProps) {
  if (url) {
    return <img src={url} alt={name} className={`${size} aspect-square shrink-0 rounded-full object-cover object-center`} />;
  }
  return (
    <img
      src="/revi-avatar.png"
      alt=""
      aria-hidden
      className={`${size} aspect-square shrink-0 rounded-full bg-lavender-surface object-cover object-center`}
    />
  );
}
