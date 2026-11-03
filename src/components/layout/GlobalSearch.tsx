import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { BookOpen, Search, X } from '../../icons';
import { useAuth } from '../../contexts/AuthContext';
import { listReviewers, listSavedIds, listSharedWithMeIds } from '../../services/reviewers';
import { listFriendships } from '../../services/social';
import type { Reviewer } from '../../types/database';
import { navItems } from './navigation';

const MAX_REVIEWERS = 6;

interface GlobalSearchProps {
  variant: 'desktop' | 'mobile';
  autoFocus?: boolean;
  /** Called after a result is chosen or the search is submitted (used to close the mobile search row). */
  onDone?: () => void;
}

type Option =
  | { kind: 'reviewer'; key: string; to: string; label: string; detail: string }
  | { kind: 'page'; key: string; to: string; label: string; detail: string }
  | { kind: 'all'; key: string; to: string; label: string; detail: string };

/** Case-insensitive check: does any field contain the search term? */
function matches(term: string, fields: (string | null | undefined)[]): boolean {
  return fields.some((field) => (field ?? '').toLowerCase().includes(term));
}

export function GlobalSearch({ variant, autoFocus = false, onDone }: GlobalSearchProps) {
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const navigate = useNavigate();
  const listId = useId();
  const rootRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [value, setValue] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  // Same queries as the library page, so results come from the cache without extra requests.
  const reviewersQuery = useQuery({ queryKey: ['reviewers', userId], queryFn: listReviewers, enabled: !!userId });
  const savedQuery = useQuery({ queryKey: ['saved', userId], queryFn: () => listSavedIds(userId), enabled: !!userId });
  const sharedQuery = useQuery({ queryKey: ['shared-with-me', userId], queryFn: () => listSharedWithMeIds(userId), enabled: !!userId });
  const friendsQuery = useQuery({ queryKey: ['friendships', userId], queryFn: () => listFriendships(userId), enabled: !!userId });

  const term = value.trim().toLowerCase();

  // Only reviewers this user can open: their own, saved, shared with them, or friends-only from a friend.
  const accessible = useMemo<Reviewer[]>(() => {
    const saved = new Set(savedQuery.data ?? []);
    const shared = new Set(sharedQuery.data ?? []);
    const friends = new Set((friendsQuery.data ?? []).filter((f) => f.direction === 'friend' && f.other).map((f) => f.other!.id));
    return (reviewersQuery.data ?? []).filter(
      (r) =>
        r.owner_id === userId ||
        saved.has(r.id) ||
        shared.has(r.id) ||
        (r.visibility === 'friends' && friends.has(r.owner_id)),
    );
  }, [reviewersQuery.data, savedQuery.data, sharedQuery.data, friendsQuery.data, userId]);

  const options = useMemo<Option[]>(() => {
    if (!term) return [];
    const reviewerOptions: Option[] = accessible
      .filter((r) => matches(term, [r.title, r.subject, r.description, ...(r.tags ?? [])]))
      .slice(0, MAX_REVIEWERS)
      .map((r) => ({
        kind: 'reviewer',
        key: `r-${r.id}`,
        to: `/reviewers/${r.id}`,
        label: r.title,
        detail: r.subject ? `Reviewer · ${r.subject}` : 'Reviewer',
      }));
    const pageOptions: Option[] = navItems
      .filter((item) => matches(term, [item.label]))
      .map((item) => ({ kind: 'page', key: `p-${item.to}`, to: item.to, label: item.label, detail: 'Page' }));
    return [
      ...reviewerOptions,
      ...pageOptions,
      { kind: 'all', key: 'all', to: `/library?q=${encodeURIComponent(value.trim())}`, label: `Search all reviewers for “${value.trim()}”`, detail: 'Library' },
    ];
  }, [accessible, term, value]);

  const listOpen = open && term.length > 0;

  // Keep the highlighted row in range as results change.
  useEffect(() => {
    setActive(-1);
  }, [term]);

  // Close when the user clicks or taps outside the search.
  useEffect(() => {
    if (!listOpen) return;
    const onPointer = (event: MouseEvent | TouchEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('touchstart', onPointer);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('touchstart', onPointer);
    };
  }, [listOpen]);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  function go(option: Option) {
    setOpen(false);
    setValue(option.kind === 'all' ? value.trim() : '');
    navigate(option.to);
    onDone?.();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const chosen = active >= 0 ? options[active] : options.find((o) => o.kind === 'all');
    if (chosen) {
      go(chosen);
      return;
    }
    navigate(term ? `/library?q=${encodeURIComponent(value.trim())}` : '/library');
    setOpen(false);
    onDone?.();
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      if (listOpen) {
        setOpen(false);
      } else {
        onDone?.();
      }
      return;
    }
    if (!listOpen || options.length === 0) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((current) => (current + 1) % options.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((current) => (current <= 0 ? options.length - 1 : current - 1));
    }
  }

  function clear() {
    setValue('');
    setActive(-1);
    setOpen(false);
    inputRef.current?.focus();
  }

  const isMobile = variant === 'mobile';
  const activeId = active >= 0 ? `${listId}-${active}` : undefined;

  return (
    <form
      ref={rootRef}
      role="search"
      onSubmit={handleSubmit}
      className={isMobile ? 'relative w-full' : 'relative hidden min-w-0 flex-1 md:mx-2 md:flex md:max-w-md'}
    >
      <label htmlFor={`${listId}-input`} className="sr-only">
        Search reviewers and pages
      </label>
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
      <input
        ref={inputRef}
        id={`${listId}-input`}
        type="search"
        enterKeyHint="search"
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        role="combobox"
        aria-expanded={listOpen}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={activeId}
        value={value}
        onChange={(event) => {
          setValue(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder="Search reviewers and pages"
        className="h-11 w-full rounded-control border border-border bg-background pl-10 pr-10 text-base text-foreground placeholder:text-muted focus:border-lavender focus:outline-none focus:ring-2 focus:ring-brand sm:h-10 sm:text-sm [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          onClick={clear}
          aria-label="Clear search"
          className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-control text-muted hover:bg-surface-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
        </button>
      )}

      {listOpen && (
        <div
          id={listId}
          role="listbox"
          aria-label="Search results"
          className="absolute left-0 right-0 top-full z-40 mt-2 max-h-[min(60dvh,420px)] overflow-y-auto rounded-card border border-border bg-surface p-1.5 shadow-lg"
        >
          {options.map((option, index) => {
            const selected = index === active;
            return (
              <div
                key={option.key}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={selected}
                onMouseEnter={() => setActive(index)}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => go(option)}
                className={`flex cursor-pointer items-center gap-3 rounded-control px-3 py-2.5 ${
                  selected ? 'bg-surface-muted' : ''
                } ${option.kind === 'all' ? 'border-t border-border mt-1 pt-3' : ''}`}
              >
                {option.kind === 'reviewer' && <BookOpen className="h-4 w-4 shrink-0 text-muted" aria-hidden />}
                {option.kind === 'all' && <Search className="h-4 w-4 shrink-0 text-muted" aria-hidden />}
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{option.label}</p>
                  <p className="truncate text-xs text-muted">{option.detail}</p>
                </div>
              </div>
            );
          })}
          {options.length === 1 && options[0].kind === 'all' && (
            <p className="px-3 pb-2 pt-1 text-xs text-muted">No reviewers or pages match yet.</p>
          )}
        </div>
      )}
    </form>
  );
}
