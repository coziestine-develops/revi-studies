import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { useToast } from '../components/common/Toast';
import { BookOpen, LayoutGrid, List, Plus, Search } from '../icons';
import { useAuth } from '../contexts/AuthContext';
import { listAllReviewerFiles, listReviewers, listSavedIds, listSharedWithMeIds, setSaved, getProfiles } from '../services/reviewers';
import { listFriendships } from '../services/social';
import { errorMessage } from '../lib/format';
import { ReviewerCard } from '../components/reviewers/ReviewerCard';
import { EmptyState } from '../components/common/EmptyState';
import { Skeleton } from '../components/common/Skeleton';
import { Alert, inputClass, selectClass } from '../components/common/Forms';
import { buttonClasses } from '../components/common/Button';
import type { Reviewer } from '../types/database';

type Scope = 'all' | 'mine' | 'shared' | 'saved';
type Sort = 'updated' | 'created' | 'title';

const MIME_LABEL: Record<string, string> = {
  'application/pdf': 'PDF',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'PPTX',
  'image/png': 'PNG',
  'image/jpeg': 'JPG',
  'image/webp': 'WEBP',
  'text/plain': 'TXT',
};

interface LibraryPageProps {
  mode?: 'library' | 'discover';
}

export default function LibraryPage({ mode = 'library' }: LibraryPageProps) {
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState(() => searchParams.get('q') ?? '');
  const incomingQuery = searchParams.get('q');

  // Keep the box in sync when the header search changes ?q while this page is already open.
  useEffect(() => {
    setSearch(incomingQuery ?? '');
  }, [incomingQuery]);
  const [scope, setScope] = useState<Scope>('all');
  const [subject, setSubject] = useState('');
  const [fileType, setFileType] = useState('');
  const [sort, setSort] = useState<Sort>('updated');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [actionError, setActionError] = useState<string | null>(null);

  const reviewersQuery = useQuery({ queryKey: ['reviewers', userId], queryFn: listReviewers, enabled: !!userId });
  const filesQuery = useQuery({ queryKey: ['all-reviewer-files'], queryFn: listAllReviewerFiles, enabled: !!userId });
  const savedQuery = useQuery({ queryKey: ['saved', userId], queryFn: () => listSavedIds(userId), enabled: !!userId });

  const sharedQuery = useQuery({ queryKey: ['shared-with-me', userId], queryFn: () => listSharedWithMeIds(userId), enabled: !!userId });
  const friendsQuery = useQuery({ queryKey: ['friendships', userId], queryFn: () => listFriendships(userId), enabled: !!userId });

  const allReviewers = reviewersQuery.data ?? [];
  const savedSet = useMemo(() => new Set(savedQuery.data ?? []), [savedQuery.data]);
  const sharedIds = useMemo(() => new Set(sharedQuery.data ?? []), [sharedQuery.data]);
  const friendIds = useMemo(
    () => new Set((friendsQuery.data ?? []).filter((f) => f.direction === 'friend' && f.other).map((f) => f.other!.id)),
    [friendsQuery.data],
  );

  // The database lets you read every public reviewer, so "My Reviewers" has to narrow that down to
  // what actually belongs here: your own, ones shared with you, friends' reviewers, and ones you saved.
  const isSharedWithMe = (r: Reviewer) =>
    r.owner_id !== userId && (sharedIds.has(r.id) || (r.visibility === 'friends' && friendIds.has(r.owner_id)));
  const reviewers = useMemo(
    () =>
      mode === 'discover'
        ? allReviewers.filter((r) => r.visibility === 'public' && r.owner_id !== userId)
        : allReviewers.filter((r) => r.owner_id === userId || savedSet.has(r.id) || isSharedWithMe(r)),
    [allReviewers, mode, userId, savedSet, sharedIds, friendIds], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const ownerIds = useMemo(
    () => [...new Set(reviewers.filter((r) => r.owner_id !== userId).map((r) => r.owner_id))],
    [reviewers, userId],
  );
  const ownersQuery = useQuery({
    queryKey: ['owner-profiles', ownerIds.join(',')],
    queryFn: () => getProfiles(ownerIds),
    enabled: ownerIds.length > 0,
  });
  const ownerNames = new Map((ownersQuery.data ?? []).map((p) => [p.id, p.full_name || p.username || 'a classmate']));

  const fileTypesByReviewer = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const row of filesQuery.data ?? []) {
      const set = map.get(row.reviewer_id) ?? new Set<string>();
      set.add(MIME_LABEL[row.mime_type] ?? row.mime_type);
      map.set(row.reviewer_id, set);
    }
    return map;
  }, [filesQuery.data]);

  const fileCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of filesQuery.data ?? []) map.set(row.reviewer_id, (map.get(row.reviewer_id) ?? 0) + 1);
    return map;
  }, [filesQuery.data]);

  const mineCount = reviewers.filter((r) => r.owner_id === userId).length;
  const sharedCount = reviewers.filter(isSharedWithMe).length;

  const subjects = useMemo(
    () => [...new Set(reviewers.map((r) => r.subject).filter((s): s is string => !!s))].sort(),
    [reviewers],
  );
  const fileTypes = useMemo(() => [...new Set([...fileTypesByReviewer.values()].flatMap((s) => [...s]))].sort(), [fileTypesByReviewer]);

  const visible = useMemo(() => {
    let list: Reviewer[] = reviewers;
    if (mode === 'library') {
      if (scope === 'mine') list = list.filter((r) => r.owner_id === userId);
      if (scope === 'shared') list = list.filter(isSharedWithMe);
      if (scope === 'saved') list = list.filter((r) => savedSet.has(r.id));
    }
    if (subject) list = list.filter((r) => r.subject === subject);
    if (fileType) list = list.filter((r) => fileTypesByReviewer.get(r.id)?.has(fileType));
    const term = search.trim().toLowerCase();
    if (term) {
      list = list.filter((r) =>
        [r.title, r.subject ?? '', r.description ?? '', ...r.tags].some((field) => field.toLowerCase().includes(term)),
      );
    }
    const sorted = [...list];
    if (sort === 'title') sorted.sort((a, b) => a.title.localeCompare(b.title));
    if (sort === 'created') sorted.sort((a, b) => b.created_at.localeCompare(a.created_at));
    if (sort === 'updated') sorted.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    return sorted;
  }, [reviewers, mode, scope, subject, fileType, search, sort, savedSet, fileTypesByReviewer, userId, sharedIds, friendIds]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveMutation = useMutation({
    mutationFn: ({ reviewerId, save }: { reviewerId: string; save: boolean }) => setSaved(userId, reviewerId, save),
    onSuccess: (_data, variables) => {
      setActionError(null);
      toast(variables.save ? 'Saved to your library.' : 'Removed from your saved reviewers.');
      queryClient.invalidateQueries({ queryKey: ['saved', userId] });
      queryClient.invalidateQueries({ queryKey: ['reviewers'] });
    },
    onError: (error) => setActionError(errorMessage(error)),
  });

  const isLoading = reviewersQuery.isLoading || filesQuery.isLoading;
  const scopes: { value: Scope; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'mine', label: 'Mine' },
    { value: 'shared', label: 'Shared with me' },
    { value: 'saved', label: 'Saved' },
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{mode === 'discover' ? 'Discover' : 'My Reviewers'}</h1>
          <p className="mt-1 text-sm text-muted">
            {mode === 'discover'
              ? 'Public reviewers shared by other students.'
              : `${reviewers.length} total · ${mineCount} yours · ${sharedCount} shared with you · ${savedSet.size} saved`}
          </p>
        </div>
        {mode === 'library' && (
          <Link to="/upload" className={buttonClasses('primary')}>
            <Plus className="h-4 w-4" aria-hidden /> Upload
          </Link>
        )}
      </header>

      {(reviewersQuery.isError || filesQuery.isError) && (
        <Alert>Couldn't load reviewers: {errorMessage(reviewersQuery.error ?? filesQuery.error)}</Alert>
      )}
      {actionError && <Alert>{actionError}</Alert>}

      <div className="grid gap-3 rounded-card border border-border bg-surface p-4 shadow-sm lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center sm:p-4">
        <label className="relative block min-w-0">
          <span className="sr-only">Search reviewers</span>
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title, subject, or tag"
            className={`${inputClass} h-11 pl-10 sm:h-10`}
          />
        </label>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center lg:justify-end">
          <select aria-label="Filter by subject" value={subject} onChange={(e) => setSubject(e.target.value)} className={`${selectClass} h-11 w-full sm:h-10 sm:w-auto`}>
            <option value="">All subjects</option>
            {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select aria-label="Filter by file type" value={fileType} onChange={(e) => setFileType(e.target.value)} className={`${selectClass} h-11 w-full sm:h-10 sm:w-auto`}>
            <option value="">All file types</option>
            {fileTypes.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <div className="col-span-2 flex items-center gap-2 sm:contents">
          <select aria-label="Sort reviewers" value={sort} onChange={(e) => setSort(e.target.value as Sort)} className={`${selectClass} h-11 min-w-0 flex-1 sm:h-10 sm:flex-none`}>
            <option value="updated">Recently updated</option>
            <option value="created">Recently created</option>
            <option value="title">Title A–Z</option>
          </select>
          <div className="flex h-11 shrink-0 items-center gap-0.5 rounded-control border border-border p-1 sm:h-10" role="group" aria-label="View">
            <button type="button" onClick={() => setView('grid')} aria-pressed={view === 'grid'} aria-label="Grid view" className={`flex h-full w-10 items-center justify-center rounded-control sm:w-9 ${view === 'grid' ? 'bg-primary text-primary-foreground' : 'text-muted'}`}>
              <LayoutGrid className="h-4 w-4" aria-hidden />
            </button>
            <button type="button" onClick={() => setView('list')} aria-pressed={view === 'list'} aria-label="List view" className={`flex h-full w-10 items-center justify-center rounded-control sm:w-9 ${view === 'list' ? 'bg-primary text-primary-foreground' : 'text-muted'}`}>
              <List className="h-4 w-4" aria-hidden />
            </button>
          </div>
          </div>
        </div>
      </div>

      {mode === 'library' && (
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Library scope">
          {scopes.map((item) => (
            <button
              key={item.value}
              role="tab"
              type="button"
              aria-selected={scope === item.value}
              onClick={() => setScope(item.value)}
              className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
                scope === item.value ? 'border-transparent bg-primary text-primary-foreground' : 'border-border bg-surface text-foreground hover:bg-surface-muted'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}

      {isLoading && (
        <div className={`grid gap-4 ${view === 'grid' ? 'md:grid-cols-2 xl:grid-cols-3' : ''}`} role="status" aria-label="Loading reviewers">
          <Skeleton className="h-36 w-full" /><Skeleton className="h-36 w-full" /><Skeleton className="h-36 w-full" />
        </div>
      )}

      {!isLoading && visible.length === 0 && (
        <EmptyState
          icon={BookOpen}
          title={reviewers.length === 0 ? (mode === 'discover' ? 'Nothing public yet' : 'No reviewers yet') : 'No matches'}
          description={
            reviewers.length === 0
              ? mode === 'discover' ? 'Public reviewers from other students will appear here.' : 'Upload your first study file to start your library.'
              : 'Try a different search or clear the filters.'
          }
          action={reviewers.length === 0 && mode === 'library' ? <Link to="/upload" className={buttonClasses('primary')}>Upload a reviewer</Link> : undefined}
        />
      )}

      {!isLoading && visible.length > 0 && (
        <div className={view === 'grid' ? 'grid gap-4 md:grid-cols-2 xl:grid-cols-3' : 'flex flex-col gap-3'}>
          {visible.map((reviewer) => {
            const isOwner = reviewer.owner_id === userId;
            return (
              <ReviewerCard
                key={reviewer.id}
                reviewer={reviewer}
                view={view}
                isOwner={isOwner}
                fileCount={fileCounts.get(reviewer.id) ?? 0}
                ownerLabel={ownerNames.get(reviewer.owner_id)}
                saved={savedSet.has(reviewer.id)}
                savePending={saveMutation.isPending && saveMutation.variables?.reviewerId === reviewer.id}
                onToggleSave={() => saveMutation.mutate({ reviewerId: reviewer.id, save: !savedSet.has(reviewer.id) })}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
