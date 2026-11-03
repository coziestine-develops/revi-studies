import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { BookOpen, Play, Plus } from '../icons';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { displayName } from '../lib/user';
import { formatDuration } from '../lib/format';
import { listAttempts, listDecks, listSessions } from '../services/study';
import type { CalendarEvent } from '../types/database';
import { Card } from '../components/common/Card';
import { EmptyState } from '../components/common/EmptyState';
import { Skeleton } from '../components/common/Skeleton';
import { buttonClasses } from '../components/common/Button';
import { Alert } from '../components/common/Forms';
import { EventEditor } from '../components/calendar/EventEditor';
import { NextUpCard } from '../components/dashboard/NextUpCard';
import { MessagesCard } from '../components/dashboard/MessagesCard';

interface ReviewerSummary {
  id: string;
  title: string;
  subject: string | null;
  updated_at: string;
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function DashboardPage() {
  const { user } = useAuth();
  const userId = user?.id;
  const queryClient = useQueryClient();
  const [editor, setEditor] = useState<{ event: CalendarEvent | null; day: Date } | null>(null);

  const countQuery = useQuery({
    queryKey: ['reviewers', 'count', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { count, error } = await supabase
        .from('reviewers')
        .select('id', { count: 'exact', head: true })
        .eq('owner_id', userId!);
      if (error) throw error;
      return count ?? 0;
    },
  });

  const recentQuery = useQuery({
    queryKey: ['reviewers', 'recent', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reviewers')
        .select('id, title, subject, updated_at')
        .eq('owner_id', userId!)
        .order('updated_at', { ascending: false })
        .limit(4);
      if (error) throw error;
      return (data ?? []) as ReviewerSummary[];
    },
  });

  const decksQuery = useQuery({ queryKey: ['decks', userId ?? ''], queryFn: listDecks, enabled: !!userId });
  const attemptsQuery = useQuery({ queryKey: ['attempts', userId ?? ''], queryFn: () => listAttempts(userId!), enabled: !!userId });
  const sessionsQuery = useQuery({ queryKey: ['sessions', userId ?? ''], queryFn: () => listSessions(userId!), enabled: !!userId });

  const decks = decksQuery.data ?? [];
  const attempts = attemptsQuery.data ?? [];
  const sessions = sessionsQuery.data ?? [];
  const scored = attempts.filter((a) => a.total && a.total > 0);
  const averagePct = scored.length
    ? Math.round(scored.reduce((sum, a) => sum + ((a.score ?? 0) / (a.total ?? 1)) * 100, 0) / scored.length)
    : null;
  const totalSeconds = sessions.reduce((sum, s) => sum + s.duration_seconds, 0);
  const lastReviewer = recentQuery.data?.[0];

  const handleEventSaved = () => {
    setEditor(null);
    if (userId) {
      queryClient.invalidateQueries({ queryKey: ['calendar', userId] });
      queryClient.invalidateQueries({ queryKey: ['calendar-upcoming', userId] });
    }
  };

  return (
    <div className="space-y-6">
      <section className="flex items-center gap-4">
        <img src="/revi-mascot.png" alt="" width={64} height={64} className="hidden h-16 w-16 shrink-0 object-contain sm:block" />
        <div className="min-w-0">
          <p className="text-sm text-muted">{greeting()}</p>
          <h1 className="mt-0.5 break-words text-2xl font-semibold tracking-tight md:text-3xl">
            Welcome back, {displayName(user)}
          </h1>
          <p className="mt-1 text-sm text-muted">Pick up where you left off, or add something new to review.</p>
        </div>
      </section>

      <section aria-label="Overview" className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        <StatCard
          label="Reviewers"
          tone="mint"
          isLoading={countQuery.isLoading}
          isError={countQuery.isError}
          value={countQuery.data !== undefined ? String(countQuery.data) : undefined}
          hint={countQuery.data === 0 ? 'Upload your first' : 'In your library'}
        />
        <StatCard
          label="Flashcard decks"
          isLoading={decksQuery.isLoading}
          isError={decksQuery.isError}
          value={decksQuery.data ? String(decks.length) : undefined}
          hint={decks.length === 0 ? 'None yet' : 'Ready to study'}
        />
        <StatCard
          label="Quiz average"
          isLoading={attemptsQuery.isLoading}
          isError={attemptsQuery.isError}
          value={averagePct === null ? '—' : `${averagePct}%`}
          hint={scored.length === 0 ? 'No attempts yet' : `${scored.length} ${scored.length === 1 ? 'quiz' : 'quizzes'} taken`}
        />
        <StatCard
          label="Study time"
          tone="lavender"
          isLoading={sessionsQuery.isLoading}
          isError={sessionsQuery.isError}
          value={totalSeconds > 0 ? formatDuration(totalSeconds) : '—'}
          hint={totalSeconds > 0 ? 'All sessions' : 'Starts once you study'}
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-4">
          <Card title="Continue studying">
            {recentQuery.isLoading && <Skeleton className="h-16 w-full" />}
            {recentQuery.data && !lastReviewer && (
              <EmptyState
                icon={BookOpen}
                title="Nothing to continue yet"
                description="Upload a PDF, slide deck, or note to start your first reviewer."
                action={<Link to="/upload" className={buttonClasses('primary')}><Plus className="h-4 w-4" aria-hidden />Upload a reviewer</Link>}
              />
            )}
            {lastReviewer && (
              <div className="flex flex-col gap-4 rounded-control bg-mint-surface p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold">{lastReviewer.title}</p>
                  <p className="mt-0.5 text-sm text-muted">
                    {lastReviewer.subject ?? 'No subject'} · Updated {new Date(lastReviewer.updated_at).toLocaleDateString()}
                  </p>
                </div>
                <Link to={`/reviewers/${lastReviewer.id}`} className={buttonClasses('primary', 'shrink-0')}>
                  <Play className="h-4 w-4" aria-hidden /> Continue
                </Link>
              </div>
            )}
          </Card>

          <Card
            title="Recent reviewers"
            action={<Link to="/library" className="text-sm font-medium underline-offset-4 hover:underline">View all</Link>}
          >
            {recentQuery.isLoading && <Skeleton className="h-28 w-full" />}
            {recentQuery.isError && <Alert>Couldn't load your reviewers: {(recentQuery.error as Error).message}</Alert>}
            {recentQuery.data && recentQuery.data.length === 0 && (
              <EmptyState
                icon={BookOpen}
                title="No reviewers yet"
                description="Upload a PDF, slide deck, or note to start building your library."
                action={<Link to="/upload" className={buttonClasses('primary')}><Plus className="h-4 w-4" aria-hidden />Upload a reviewer</Link>}
              />
            )}
            {recentQuery.data && recentQuery.data.length > 0 && (
              <ul className="divide-y divide-border">
                {recentQuery.data.map((reviewer) => (
                  <li key={reviewer.id}>
                    <Link to={`/reviewers/${reviewer.id}`} className="flex items-center justify-between gap-3 rounded-control px-2 py-3 transition-colors hover:bg-surface-muted">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{reviewer.title}</p>
                        <p className="text-xs text-muted">{reviewer.subject ?? 'No subject'}</p>
                      </div>
                      <time dateTime={reviewer.updated_at} className="shrink-0 text-xs text-muted">
                        {new Date(reviewer.updated_at).toLocaleDateString()}
                      </time>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <aside aria-label="Calendar and messages" className="min-w-0 space-y-4">
          {userId && (
            <NextUpCard
              userId={userId}
              onEdit={(event) => setEditor({ event, day: new Date(event.starts_at) })}
              onAdd={() => setEditor({ event: null, day: new Date() })}
            />
          )}
          {userId && <MessagesCard userId={userId} />}
        </aside>
      </div>

      {editor && userId && (
        <EventEditor
          userId={userId}
          event={editor.event}
          defaultDay={editor.day}
          onClose={() => setEditor(null)}
          onSaved={handleEventSaved}
        />
      )}
    </div>
  );
}

interface StatCardProps {
  label: string;
  value?: string;
  hint: string;
  tone?: 'default' | 'mint' | 'lavender';
  isLoading?: boolean;
  isError?: boolean;
}

function StatCard({ label, value, hint, tone = 'default', isLoading = false, isError = false }: StatCardProps) {
  return (
    <Card tone={tone} className="p-4 sm:p-5">
      <p className="text-sm text-muted">{label}</p>
      <div className="mt-1.5 text-xl font-semibold tracking-tight md:text-2xl">
        {isLoading ? <Skeleton className="h-7 w-14" /> : isError ? <span className="text-base text-error">Unavailable</span> : value ?? '—'}
      </div>
      <p className="mt-1 text-xs text-muted">{hint}</p>
    </Card>
  );
}