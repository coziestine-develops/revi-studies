import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { History, ClipboardCheck, BookOpen, Trash2 } from '../icons';
import { useAuth } from '../contexts/AuthContext';
import { deleteAttempt, deleteSession, listAttempts, listQuizzes, listSessions } from '../services/study';
import { listReviewers } from '../services/reviewers';
import { errorMessage, formatDateTime, formatDuration } from '../lib/format';
import { Card } from '../components/common/Card';
import { Alert } from '../components/common/Forms';
import { EmptyState } from '../components/common/EmptyState';
import { Skeleton } from '../components/common/Skeleton';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { useToast } from '../components/common/Toast';

type Event =
  | { kind: 'session'; id: string; at: string; title: string; detail: string }
  | { kind: 'quiz'; id: string; at: string; title: string; detail: string };

export default function HistoryPage() {
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [pendingDelete, setPendingDelete] = useState<Event | null>(null);
  const sessionsQuery = useQuery({ queryKey: ['sessions', userId], queryFn: () => listSessions(userId), enabled: !!userId });
  const attemptsQuery = useQuery({ queryKey: ['attempts', userId], queryFn: () => listAttempts(userId), enabled: !!userId });
  const quizzesQuery = useQuery({ queryKey: ['quizzes'], queryFn: listQuizzes, enabled: !!userId });
  const reviewersQuery = useQuery({ queryKey: ['reviewers', userId], queryFn: listReviewers, enabled: !!userId });

  const events = useMemo<Event[]>(() => {
    const reviewerTitle = new Map((reviewersQuery.data ?? []).map((r) => [r.id, r.title]));
    const quizTitle = new Map((quizzesQuery.data ?? []).map((q) => [q.id, q.title]));
    const sessionEvents: Event[] = (sessionsQuery.data ?? []).map((s) => ({
      kind: 'session',
      id: s.id,
      at: s.started_at,
      title: s.reviewer_id ? reviewerTitle.get(s.reviewer_id) ?? 'Study session' : 'Study session',
      detail: `${s.activity} · ${formatDuration(s.duration_seconds)}`,
    }));
    const quizEvents: Event[] = (attemptsQuery.data ?? []).map((a) => ({
      kind: 'quiz',
      id: a.id,
      at: a.submitted_at ?? a.started_at,
      title: quizTitle.get(a.quiz_id) ?? 'Quiz',
      detail: a.total === null ? 'Timed out, not scored' : `Scored ${a.score ?? 0} of ${a.total ?? 0}`,
    }));
    return [...sessionEvents, ...quizEvents].sort((a, b) => b.at.localeCompare(a.at));
  }, [sessionsQuery.data, attemptsQuery.data, quizzesQuery.data, reviewersQuery.data]);

  const deleteMutation = useMutation({
    mutationFn: (event: Event) => (event.kind === 'session' ? deleteSession(event.id) : deleteAttempt(event.id)),
    onSuccess: (_data, event) => {
      // Dashboard and analytics read the same tables, so they refresh too.
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      queryClient.invalidateQueries({ queryKey: ['attempts'] });
      toast(event.kind === 'session' ? 'Study session deleted.' : 'Quiz attempt deleted.');
    },
    onError: (err) => toast(errorMessage(err), 'error'),
    onSettled: () => setPendingDelete(null),
  });

  const loading = sessionsQuery.isLoading || attemptsQuery.isLoading;
  const error = sessionsQuery.error ?? attemptsQuery.error;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Study history</h1>
        <p className="mt-1 text-sm text-muted">Your study sessions and quiz attempts, newest first.</p>
      </header>

      {error && <Alert>Couldn't load history: {errorMessage(error)}</Alert>}
      {loading && <Skeleton className="h-48 w-full" />}

      {!loading && !error && events.length === 0 && (
        <Card><EmptyState icon={History} title="No history yet" description="Study sessions and quiz attempts will be listed here." /></Card>
      )}

      {!loading && events.length > 0 && (
        <Card>
          <ul className="divide-y divide-border">
            {events.map((event) => {
              const Icon = event.kind === 'session' ? BookOpen : ClipboardCheck;
              return (
                <li key={`${event.kind}-${event.id}`} className="flex items-center gap-3 py-3 sm:gap-4">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-muted">
                    <Icon className="h-4 w-4" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{event.title}</p>
                    <p className="truncate text-xs text-muted">{event.detail}</p>
                    {/* Phones show the time under the details so the delete button always fits. */}
                    <time dateTime={event.at} className="mt-0.5 block text-xs text-muted sm:hidden">{formatDateTime(event.at)}</time>
                  </div>
                  <time dateTime={event.at} className="hidden shrink-0 text-xs text-muted sm:block">{formatDateTime(event.at)}</time>
                  <button
                    type="button"
                    onClick={() => setPendingDelete(event)}
                    aria-label={`Delete ${event.kind === 'session' ? 'study session' : 'quiz attempt'}: ${event.title}`}
                    title="Delete"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control text-muted hover:bg-surface-muted hover:text-error"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title={pendingDelete?.kind === 'session' ? 'Delete this study session?' : 'Delete this quiz attempt?'}
        description={
          pendingDelete?.kind === 'session'
            ? `This removes the time recorded for "${pendingDelete.title}" from your history and your study totals. This can't be undone.`
            : `This removes the score for "${pendingDelete?.title ?? 'this quiz'}" from your history and your results. This can't be undone.`
        }
        confirmLabel="Delete"
        danger
        loading={deleteMutation.isPending}
        onConfirm={() => pendingDelete && deleteMutation.mutate(pendingDelete)}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
