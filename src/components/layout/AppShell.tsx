import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { IconComponent } from '../../icons';
import { navItems } from './navigation';
import {
  Bell, BookOpen, Calendar, ChevronDown, ClipboardCheck, Ellipsis, House, Layers, LogOut, MessageSquare, Moon, Plus, Search, Settings, Sparkles, Sun, User, X,
} from '../../icons';
import { Dropdown, menuItemClass } from '../common/Dropdown';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { displayName } from '../../lib/user';
import { getMyProfile } from '../../services/social';
import { countUnreadMessages } from '../../services/messages';
import { supabase } from '../../lib/supabase';
import { Logo, LogoMark } from '../common/Logo';
import { UserAvatar } from '../common/UserAvatar';
import { buttonClasses } from '../common/Button';
import { useNotificationsRealtime } from '../../lib/useNotificationsRealtime';
import { useMessagesRealtime } from '../../lib/useMessagesRealtime';
import { useEventReminders } from '../../lib/useEventReminders';
import { GlobalSearch } from './GlobalSearch';


// Sidebar: everything except Settings, which is pinned at the bottom with Log out.
const sidebarMain = navItems.filter((item) => item.to !== '/settings');
const settingsItem = navItems.find((item) => item.to === '/settings')!;
// Phone tabs: the four most-used pages. Everything else lives under More.
const tabItems = navItems.filter((item) => ['/dashboard', '/library', '/chat', '/flashcards'].includes(item.to));
// Shorter labels so every tab fits on narrow phones.
const tabLabels: Record<string, string> = { '/dashboard': 'Home', '/library': 'Library', '/chat': 'Chat', '/flashcards': 'Cards' };

/* Phones show a house for Dashboard; desktop keeps the gauge. */
function mobileIconFor(to: string, fallback: IconComponent): IconComponent {
  return to === '/dashboard' ? House : fallback;
}

function sidebarLinkClass(isActive: boolean): string {
  return `flex items-center gap-3 rounded-control px-3 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint ${
    isActive ? 'bg-mint text-on-accent' : 'text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-foreground'
  }`;
}

const iconButtonClass =
  'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-foreground transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand';

export default function AppShell() {
  const { user, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  const profileQuery = useQuery({
    queryKey: ['my-profile', user?.id ?? ''],
    queryFn: () => getMyProfile(user!.id),
    enabled: !!user,
  });

  const unreadQuery = useQuery({
    queryKey: ['notifications-unread', user?.id ?? ''],
    enabled: !!user,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { count, error } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('recipient_id', user!.id)
        .is('read_at', null);
      if (error) throw error;
      return count ?? 0;
    },
  });
  const unreadCount = unreadQuery.data ?? 0;
  useNotificationsRealtime(user?.id);

  const messageUnreadQuery = useQuery({
    queryKey: ['messages-unread', user?.id ?? ''],
    enabled: !!user,
    refetchInterval: 60_000,
    queryFn: () => countUnreadMessages(user!.id),
  });
  const messageUnread = messageUnreadQuery.data ?? 0;
  useMessagesRealtime(user?.id);
  useEventReminders(user?.id);

  // Unread counts shown on sidebar items.
  const badgeFor = (to: string) => (to === '/notifications' ? unreadCount : to === '/messages' ? messageUnread : 0);

  useEffect(() => {
    setMoreOpen(false);
    setMobileSearchOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!moreOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMoreOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [moreOpen]);

  async function handleSignOut() {
    const error = await signOut();
    if (!error) navigate('/login', { replace: true });
  }

  const avatarUrl = profileQuery.data?.avatar_url;
  const name = displayName(user);

  return (
    <div className="min-h-[100dvh] md:grid md:grid-cols-[76px_minmax(0,1fr)] md:gap-4 md:p-4 lg:grid-cols-[248px_minmax(0,1fr)]">
      {/* Desktop sidebar. Scrolls internally with no visible bar, so Settings and Log out stay reachable. */}
      <aside className="hidden rounded-card border border-sidebar-border bg-sidebar p-3 text-sidebar-foreground shadow-sm md:sticky md:top-4 md:flex md:h-[calc(100dvh-2rem)] md:flex-col md:self-start lg:p-4">
        <div className="mb-4 flex shrink-0 justify-center px-1 lg:justify-start lg:px-2">
          <span className="lg:hidden"><LogoMark alt="REVI" /></span>
          <span className="hidden lg:inline-flex"><Logo /></span>
        </div>

        <nav aria-label="Main navigation" className="no-scrollbar flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto pr-0.5">
          {sidebarMain.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              aria-label={item.label}
              title={item.label}
              className={({ isActive }) => `${sidebarLinkClass(isActive)} justify-center lg:justify-start`}
            >
              <span className="relative inline-flex shrink-0">
                <item.icon className="h-[18px] w-[18px]" aria-hidden />
                {badgeFor(item.to) > 0 && (
                  <span className="absolute -right-2 -top-1.5 min-w-[18px] rounded-full bg-lavender px-1 text-center text-[10px] font-semibold leading-[18px] text-on-accent">
                    {badgeFor(item.to) > 99 ? '99+' : badgeFor(item.to)}
                    <span className="sr-only"> unread</span>
                  </span>
                )}
              </span>
              <span className="hidden truncate lg:inline">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="mt-3 flex shrink-0 flex-col gap-1 border-t border-sidebar-border pt-3">
          <NavLink
            to={settingsItem.to}
            aria-label={settingsItem.label}
            title={settingsItem.label}
            className={({ isActive }) => `${sidebarLinkClass(isActive)} justify-center lg:justify-start`}
          >
            <settingsItem.icon className="h-[18px] w-[18px] shrink-0" aria-hidden />
            <span className="hidden truncate lg:inline">{settingsItem.label}</span>
          </NavLink>
          <button
            type="button"
            onClick={handleSignOut}
            aria-label="Log out"
            title="Log out"
            className={`${sidebarLinkClass(false)} w-full justify-center lg:justify-start`}
          >
            <LogOut className="h-[18px] w-[18px] shrink-0" aria-hidden />
            <span className="hidden truncate lg:inline">Log out</span>
          </button>
        </div>
      </aside>

      <div className="flex min-h-[100dvh] min-w-0 flex-col md:min-h-0">
        <header className="sticky top-0 z-20 border-b border-border bg-background/95 px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))] backdrop-blur md:static md:rounded-card md:border md:bg-surface md:px-4 md:py-3 md:shadow-sm">
          <div className="flex items-center gap-2 sm:gap-3">
            <Link to="/dashboard" className="flex min-w-0 shrink-0 items-center gap-2 md:hidden" aria-label="REVI home">
              <LogoMark />
              <span className="font-display text-base font-extrabold tracking-tight">REVI</span>
            </Link>

            <div className="hidden min-w-0 flex-1 md:flex">
              <GlobalSearch variant="desktop" />
            </div>

            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={() => setMobileSearchOpen((open) => !open)}
                aria-label={mobileSearchOpen ? 'Close search' : 'Search reviewers and pages'}
                aria-expanded={mobileSearchOpen}
                aria-controls="mobile-search"
                className={`${iconButtonClass} md:hidden ${mobileSearchOpen ? 'bg-surface-muted' : ''}`}
              >
                {mobileSearchOpen ? <X className="h-4 w-4" aria-hidden /> : <Search className="h-4 w-4" aria-hidden />}
              </button>

              <Dropdown
                ariaLabel="Quick actions"
                triggerClassName={buttonClasses('primary', 'h-10 w-10 px-0 sm:w-auto sm:px-3')}
                label={<><Plus className="h-4 w-4" aria-hidden /><span className="hidden sm:inline">Create</span><ChevronDown className="hidden h-3.5 w-3.5 sm:block" aria-hidden /></>}
              >
                {(close) => (
                  <>
                    <Link role="menuitem" to="/upload" onClick={close} className={menuItemClass}><BookOpen className="h-4 w-4" aria-hidden /> New reviewer</Link>
                    <Link role="menuitem" to="/ai" onClick={close} className={menuItemClass}><Sparkles className="h-4 w-4" aria-hidden /> Generate with AI</Link>
                    <Link role="menuitem" to="/flashcards" onClick={close} className={menuItemClass}><Layers className="h-4 w-4" aria-hidden /> Flashcard decks</Link>
                    <Link role="menuitem" to="/quizzes" onClick={close} className={menuItemClass}><ClipboardCheck className="h-4 w-4" aria-hidden /> Quizzes</Link>
                    <Link role="menuitem" to="/chat" onClick={close} className={menuItemClass}><MessageSquare className="h-4 w-4" aria-hidden /> Ask Study Chat</Link>
                    <Link role="menuitem" to="/calendar" onClick={close} className={menuItemClass}><Calendar className="h-4 w-4" aria-hidden /> Add calendar event</Link>
                  </>
                )}
              </Dropdown>

              <Link
                to="/notifications"
                aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
                className={`relative ${iconButtonClass}`}
              >
                <Bell className="h-4 w-4" aria-hidden />
                {unreadCount > 0 && (
                  <span aria-hidden className="absolute -right-1.5 -top-1.5 min-w-[18px] rounded-full bg-lavender px-1 text-center text-[10px] font-semibold leading-[18px] text-on-accent">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </Link>

              <button
                type="button"
                onClick={toggleTheme}
                aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                className={`${iconButtonClass} hidden md:flex`}
              >
                {theme === 'dark' ? <Sun className="h-4 w-4" aria-hidden /> : <Moon className="h-4 w-4" aria-hidden />}
              </button>

              {/* Phones: the avatar opens the profile page directly. */}
              <Link
                to="/profile"
                aria-label="Your profile"
                className="flex shrink-0 rounded-full ring-1 ring-border transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand md:hidden"
              >
                <UserAvatar url={avatarUrl} name={name} size="h-10 w-10" />
              </Link>

              {/* Desktop: avatar opens a menu with profile, settings, and log out. */}
              <div className="hidden md:block">
                <Dropdown
                  ariaLabel="Account menu"
                  triggerClassName="flex min-w-0 items-center gap-2 rounded-control border border-border bg-surface py-1 pl-1 pr-3 transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                  label={<>
                    <UserAvatar url={avatarUrl} name={name} />
                    <span className="hidden max-w-[140px] truncate text-sm font-semibold lg:inline">{name}</span>
                    <ChevronDown className="h-3.5 w-3.5 text-muted" aria-hidden />
                  </>}
                >
                  {(close) => (
                    <>
                      <div className="flex items-center gap-3 border-b border-border px-3 pb-3 pt-2">
                        <UserAvatar url={avatarUrl} name={name} size="h-10 w-10" />
                        <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{name}</p>
                        {user?.email && <p className="truncate text-xs text-muted">{user.email}</p>}
                        </div>
                      </div>
                      <div className="pt-1.5">
                        <Link role="menuitem" to="/profile" onClick={close} className={menuItemClass}><User className="h-4 w-4" aria-hidden /> Profile</Link>
                        <Link role="menuitem" to="/settings" onClick={close} className={menuItemClass}><Settings className="h-4 w-4" aria-hidden /> Settings</Link>
                        <button type="button" role="menuitem" onClick={() => { close(); void handleSignOut(); }} className={menuItemClass}><LogOut className="h-4 w-4" aria-hidden /> Log out</button>
                      </div>
                    </>
                  )}
                </Dropdown>
              </div>
            </div>
          </div>
          {mobileSearchOpen && (
            <div id="mobile-search" className="mt-3 md:hidden">
              <GlobalSearch variant="mobile" autoFocus onDone={() => setMobileSearchOpen(false)} />
            </div>
          )}
        </header>

        <main id="main" className="min-w-0 flex-1 px-4 pb-28 pt-5 md:px-2 md:pb-10 md:pt-4">
          <div className="mx-auto w-full max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Phone navigation: four main tabs plus a sheet with every page */}
      <nav
        aria-label="Mobile navigation"
        className="fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-30 grid grid-cols-5 gap-1 rounded-card border border-border bg-surface p-1.5 shadow-lg md:hidden"
      >
        {tabItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            aria-label={item.label}
            className={({ isActive }) =>
              `flex min-w-0 flex-col items-center gap-1 rounded-control py-2 text-[11px] font-semibold transition-colors ${isActive ? 'bg-primary text-primary-foreground' : 'text-muted'}`
            }
          >
            {(() => { const TabIcon = mobileIconFor(item.to, item.icon); return <TabIcon className="h-5 w-5" aria-hidden />; })()}
            <span className="w-full truncate text-center">{tabLabels[item.to] ?? item.label}</span>
          </NavLink>
        ))}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={moreOpen}
          className="relative flex min-w-0 flex-col items-center gap-1 rounded-control py-2 text-[11px] font-semibold text-muted"
        >
          <Ellipsis className="h-5 w-5" aria-hidden />
          <span>More</span>
          {unreadCount + messageUnread > 0 && (
            <span aria-hidden className="absolute right-3 top-1.5 h-2 w-2 rounded-full bg-lavender" />
          )}
        </button>
      </nav>

      {moreOpen && (
        <div className="fixed inset-0 z-40 flex items-end bg-overlay/50 md:hidden" onClick={() => setMoreOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="All pages"
            onClick={(event) => event.stopPropagation()}
            className="max-h-[88dvh] w-full overflow-y-auto rounded-t-card border-t border-border bg-surface p-5 pb-[calc(2rem+env(safe-area-inset-bottom))] shadow-lg"
          >
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <LogoMark />
                <span className="font-semibold">All pages</span>
              </div>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                aria-label="Close menu"
                className="rounded-control p-2 text-muted hover:bg-surface-muted"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>

            <Link
              to="/profile"
              className="mb-4 flex items-center gap-3 rounded-card border border-border bg-surface-muted p-3"
            >
              <UserAvatar url={avatarUrl} name={name} size="h-12 w-12" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{name}</p>
                {user?.email && <p className="truncate text-xs text-muted">{user.email}</p>}
              </div>
              <span className="text-xs font-semibold text-muted">View</span>
            </Link>

            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  aria-label={item.label}
                  className={({ isActive }) =>
                    `flex flex-col items-center gap-2 rounded-control p-3 text-center text-xs font-semibold transition-colors ${isActive ? 'bg-primary text-primary-foreground' : 'bg-surface-muted text-foreground hover:bg-background'}`
                  }
                >
                  {(() => { const SheetIcon = mobileIconFor(item.to, item.icon); return <SheetIcon className="h-5 w-5" aria-hidden />; })()}
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button type="button" onClick={toggleTheme} className={buttonClasses('secondary')}>
                {theme === 'dark' ? <Sun className="h-4 w-4" aria-hidden /> : <Moon className="h-4 w-4" aria-hidden />}
                {theme === 'dark' ? 'Light mode' : 'Dark mode'}
              </button>
              <button type="button" onClick={handleSignOut} className={buttonClasses('secondary')}>
                <LogOut className="h-4 w-4" aria-hidden /> Log out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}