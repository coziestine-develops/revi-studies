import type { ComponentType, HTMLAttributes } from 'react';

/**
 * Font Awesome (Free, solid) icons exposed under the names the app already uses,
 * so every `import { Check } from '../icons'` keeps working.
 *
 * The stylesheet is loaded once in main.tsx. To add an icon, add one line below
 * with the Font Awesome icon name (https://fontawesome.com/search?o=r&m=free&s=solid).
 *
 * Sizing: components pass Tailwind `h-*` / `w-*` classes. Font icons size by font-size,
 * so the h-* value is converted to a matching font-size. With no size class, icons are 16px.
 */
export type IconProps = HTMLAttributes<HTMLElement> & {
  /** Kept so older call sites type-check. Font Awesome glyphs have no stroke. */
  strokeWidth?: number;
};
export type IconComponent = ComponentType<IconProps>;

const GLYPH_RATIO = 0.875;

function fontSizeFromClasses(className: string): string | undefined {
  const match = className.match(/(?:^|\s)h-(\d+(?:\.\d+)?)(?=\s|$)/);
  if (!match) return undefined;
  return `${(Number(match[1]) * 0.25 * GLYPH_RATIO).toFixed(3)}rem`;
}

function fa(name: string, extraClass = ''): IconComponent {
  function FaIcon({ className = '', style, strokeWidth: _strokeWidth, ...rest }: IconProps) {
    const hasSize = /(?:^|\s)[hw]-/.test(className);
    const sizeClass = hasSize ? '' : 'h-4 w-4';
    const fontSize = fontSizeFromClasses(`${sizeClass} ${className}`);
    const classes = [
      'fa-solid',
      `fa-${name}`,
      'inline-flex shrink-0 items-center justify-center',
      sizeClass,
      extraClass,
      className,
    ]
      .filter(Boolean)
      .join(' ');
    const decorative = rest['aria-label'] === undefined && rest['aria-labelledby'] === undefined;
    return (
      <i
        aria-hidden={decorative ? true : undefined}
        {...rest}
        className={classes}
        style={{ ...(fontSize ? { fontSize } : null), ...style }}
      />
    );
  }
  FaIcon.displayName = `FaIcon(${name})`;
  return FaIcon;
}

export const ArrowLeftIcon = fa('arrow-left');
export { ArrowLeftIcon as ArrowLeft };
export const ArrowRightIcon = fa('arrow-right');
export { ArrowRightIcon as ArrowRight };
export const ArrowsRotateIcon = fa('arrows-rotate');
export { ArrowsRotateIcon as ArrowsRotate };
export const AtSignIcon = fa('at');
export { AtSignIcon as AtSign };
export const BarChart3Icon = fa('chart-simple');
export { BarChart3Icon as BarChart3 };
export const BellIcon = fa('bell');
export { BellIcon as Bell };
export const BellSlashIcon = fa('bell-slash');
export { BellSlashIcon as BellOff };
export const BookOpenIcon = fa('book-open');
export { BookOpenIcon as BookOpen };
export const CalendarIcon = fa('calendar');
export { CalendarIcon as Calendar };
export const CameraIcon = fa('camera');
export { CameraIcon as Camera };
export const CheckIcon = fa('check');
export { CheckIcon as Check };
export const CheckCircle2Icon = fa('circle-check');
export { CheckCircle2Icon as CheckCircle2 };
export const ChevronDownIcon = fa('chevron-down');
export { ChevronDownIcon as ChevronDown };
export const ChevronLeftIcon = fa('chevron-left');
export { ChevronLeftIcon as ChevronLeft };
export const ChevronRightIcon = fa('chevron-right');
export { ChevronRightIcon as ChevronRight };
export const CircleAlertIcon = fa('circle-exclamation');
export { CircleAlertIcon as CircleAlert };
export const ClipboardCheckIcon = fa('clipboard-check');
export { ClipboardCheckIcon as ClipboardCheck };
export const ClockIcon = fa('clock');
export { ClockIcon as Clock };
export const CompassIcon = fa('compass');
export { CompassIcon as Compass };
export const CookieIcon = fa('cookie-bite');
export { CookieIcon as Cookie };
export const DownloadIcon = fa('download');
export { DownloadIcon as Download };
export const EllipsisIcon = fa('ellipsis');
export { EllipsisIcon as Ellipsis };
export const EyeIcon = fa('eye');
export { EyeIcon as Eye };
export const EyeOffIcon = fa('eye-slash');
export { EyeOffIcon as EyeOff };
export const FileTextIcon = fa('file-lines');
export { FileTextIcon as FileText };
export const FireIcon = fa('fire');
export { FireIcon as Fire };
export const FolderOpenIcon = fa('folder-open');
export { FolderOpenIcon as FolderOpen };
export const GlobeIcon = fa('globe');
export { GlobeIcon as Globe };
export const GraduationCapIcon = fa('graduation-cap');
export { GraduationCapIcon as GraduationCap };
export const HistoryIcon = fa('clock-rotate-left');
export { HistoryIcon as History };
export const KeyRoundIcon = fa('key');
export { KeyRoundIcon as KeyRound };
export const LayersIcon = fa('layer-group');
export { LayersIcon as Layers };
export const LayoutDashboardIcon = fa('gauge-high');
export { LayoutDashboardIcon as Gauge };
export { LayoutDashboardIcon as LayoutDashboard };
/* Desktop Dashboard: <i class="fa-solid fa-gauge"></i> */
export const DashboardIcon = fa('gauge');
export { DashboardIcon as Dashboard };
/* Mobile Dashboard (tab bar and All pages sheet): <i class="fa-solid fa-house"></i> */
export const HouseIcon = fa('house');
export { HouseIcon as House };
export const LayoutGridIcon = fa('grip');
export { LayoutGridIcon as LayoutGrid };
export const LightbulbIcon = fa('lightbulb');
export { LightbulbIcon as Lightbulb };
export const ListIcon = fa('list');
export { ListIcon as List };
export const LockIcon = fa('lock');
export { LockIcon as Lock };
export const LogOutIcon = fa('right-from-bracket');
export { LogOutIcon as LogOut };
export const MailIcon = fa('envelope');
export { MailIcon as Mail };
export const MenuIcon = fa('bars');
export { MenuIcon as Menu };
export const MessageSquareIcon = fa('message');
export { MessageSquareIcon as MessageSquare };
export const MonitorIcon = fa('desktop');
export { MonitorIcon as Monitor };
export const MoonIcon = fa('moon');
export { MoonIcon as Moon };
export const PencilIcon = fa('pencil');
export { PencilIcon as Pencil };
export const PauseIcon = fa('pause');
export { PauseIcon as Pause };
export const PlayIcon = fa('play');
export { PlayIcon as Play };
export const PlusIcon = fa('plus');
export { PlusIcon as Plus };
export const RotateCcwIcon = fa('rotate-left');
export { RotateCcwIcon as RotateCcw };
export const SchoolIcon = fa('school');
export { SchoolIcon as School };
export const SearchIcon = fa('magnifying-glass');
export { SearchIcon as Search };
export const StarIcon = fa('star');
export { StarIcon as Star };
export const SendIcon = fa('paper-plane');
export { SendIcon as Send };
export const SettingsIcon = fa('gear');
export { SettingsIcon as Settings };
export const Share2Icon = fa('share-nodes');
export { Share2Icon as Share2 };
export const ShieldIcon = fa('shield-halved');
export { ShieldIcon as Shield };
export const ShuffleIcon = fa('shuffle');
export { ShuffleIcon as Shuffle };
export const SparklesIcon = fa('wand-magic-sparkles');
export { SparklesIcon as Sparkles };
export const SquareIcon = fa('square');
export { SquareIcon as Square };
export const SunIcon = fa('sun');
export { SunIcon as Sun };
export const TargetIcon = fa('bullseye');
export { TargetIcon as Target };
export const Trash2Icon = fa('trash-can');
export { Trash2Icon as Trash2 };
export const TrendingUpIcon = fa('arrow-trend-up');
export { TrendingUpIcon as TrendingUp };
export const UserIcon = fa('user');
export { UserIcon as User };
export const UserMinusIcon = fa('user-minus');
export { UserMinusIcon as UserMinus };
export const UserPlusIcon = fa('user-plus');
export { UserPlusIcon as UserPlus };
export const UsersIcon = fa('user-group');
export { UsersIcon as Users };
export const XIcon = fa('xmark');
export { XIcon as X };
export const XCircleIcon = fa('circle-xmark');
export { XCircleIcon as XCircle };
export const Loader2 = fa('spinner', 'animate-spin');

/** Google's own full-color "G" mark. */
export function GoogleIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true" focusable="false">
      <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3l5.7-5.7C34.0 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.9z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.7-.4-3.9z" />
    </svg>
  );
}

export const RocketIcon = fa('rocket');
export { RocketIcon as Rocket };
export const FileArrowUpIcon = fa('file-arrow-up');
export { FileArrowUpIcon as FileArrowUp };
export const StopwatchIcon = fa('stopwatch');
export { StopwatchIcon as Stopwatch };
export const CommentsIcon = fa('comments');
export { CommentsIcon as Comments };
export const RightToBracketIcon = fa('right-to-bracket');
export { RightToBracketIcon as RightToBracket };
export const FilePdfIcon = fa('file-pdf');
export { FilePdfIcon as FilePdf };
export const FileWordIcon = fa('file-word');
export { FileWordIcon as FileWord };
export const FilePowerpointIcon = fa('file-powerpoint');
export { FilePowerpointIcon as FilePowerpoint };
export const ImageIcon = fa('image');
export { ImageIcon as Image };
export const ReplyIcon = fa('reply');
export { ReplyIcon as Reply };
export const CopyIcon = fa('copy');
export { CopyIcon as Copy };
export const ZoomInIcon = fa('magnifying-glass-plus');
export { ZoomInIcon as ZoomIn };
export const ZoomOutIcon = fa('magnifying-glass-minus');
export { ZoomOutIcon as ZoomOut };
export const ExpandIcon = fa('expand');
export { ExpandIcon as Expand };
