import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useAuth } from '../contexts/AuthContext';
import { listAttempts, listSessions } from '../services/study';
import { listReviewers } from '../services/reviewers';
import { errorMessage, formatDuration } from '../lib/format';
import { Card } from '../components/common/Card';
import { Alert } from '../components/common/Forms';
import { EmptyState } from '../components/common/EmptyState';
import { Skeleton } from '../components/common/Skeleton';
import { BarChart3 } from '../icons';

const tooltipStyle = {
  background: 'rgb(var(--surface))',
  border: '1px solid rgb(var(--border))',
  borderRadius: 12,
  color: 'rgb(var(--foreground))',
  fontSize: 12,
};

export default function AnalyticsPage() {
  const { user } = useAuth();
  const userId = user?.id ?? '';

  const sessionsQuery = useQuery({ queryKey: ['sessions', userId], queryFn: () => listSessions(userId), enabled: !!userId });
  const attemptsQuery = useQuery({ queryKey: ['attempts', userId], queryFn: () => listAttempts(userId), enabled: !!userId });
  const reviewersQuery = useQuery({ queryKey: ['reviewers', userId], queryFn: listReviewers, enabled: !!userId });

  const sessions = sessionsQuery.data ?? [];
  const attempts = attemptsQuery.data ?? [];
  const reviewers = reviewersQuery.data ?? [];
  const loading = sessionsQuery.isLoading || attemptsQuery.isLoading;
  const failed = sessionsQuery.error ?? attemptsQuery.error;

  const totalSeconds = sessions.reduce((sum, s) => sum + s.duration_seconds, 0);
  const scored = attempts.filter((a) => a.total && a.total > 0);
  const averagePct = scored.length
    ? Math.round(scored.reduce((sum, a) => sum + ((a.score ?? 0) / (a.total ?? 1)) * 100, 0) / scored.length)
    : null;

  const weekly = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, i) => {
      const day = new Date();
      day.setHours(0, 0, 0, 0);
      day.setDate(day.getDate() - (6 - i));
      return day;
    });
    return days.map((day) => {
      const next = new Date(day);
      next.setDate(day.getDate() + 1);
      const seconds = sessions
        .filter((s) => {
          const t = new Date(s.started_at);
          return t >= day && t < next;
        })
        .reduce((sum, s) => sum + s.duration_seconds, 0);
      return { day: day.toLocaleDateString(undefined, { weekday: 'short' }), minutes: Math.round(seconds / 60) };
    });
  }, [sessions]);

  const trend = useMemo(
    () =>
      [...scored]
        .sort((a, b) => (a.submitted_at ?? '').localeCompare(b.submitted_at ?? ''))
        .map((a, i) => ({ attempt: i + 1, pct: Math.round(((a.score ?? 0) / (a.total ?? 1)) * 100) })),
    [scored],
  );

  const subjects = useMemo(() => {
    const subjectById = new Map(reviewers.map((r) => [r.id, r.subject || 'No subject']));
    const totals = new Map<string, number>();
    for (const s of sessions) {
      const subject = s.reviewer_id ? subjectById.get(s.reviewer_id) ?? 'Unknown' : 'No reviewer';
      totals.set(subject, (totals.get(subject) ?? 0) + s.duration_seconds);
    }
    return [...totals.entries()]
      .map(([name, seconds]) => ({ name, minutes: Math.round(seconds / 60) }))
      .sort((a, b) => b.minutes - a.minutes)
      .slice(0, 6);
  }, [sessions, reviewers]);

  if (failed) return <Alert>Couldn't load analytics: {errorMessage(failed)}</Alert>;

  const hasData = sessions.length > 0 || attempts.length > 0;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Analytics</h1>
        <p className="mt-1 text-sm text-muted">Based only on sessions and quizzes you've completed.</p>
      </header>

      {loading && <div className="grid gap-4 md:grid-cols-4"><Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" /></div>}

      {!loading && !hasData && (
        <Card>
          <EmptyState icon={BarChart3} title="No activity yet" description="Study a reviewer or finish a quiz to see your progress here." />
        </Card>
      )}

      {!loading && hasData && (
        <>
          <section className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4" aria-label="Summary">
            <Stat label="Study time" value={formatDuration(totalSeconds)} tone="mint" />
            <Stat label="Sessions" value={String(sessions.length)} />
            <Stat label="Quizzes completed" value={String(attempts.length)} />
            <Stat label="Average score" value={averagePct === null ? '—' : `${averagePct}%`} tone="lavender" />
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card title="This week" description="Minutes studied per day">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weekly}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--border))" vertical={false} />
                    <XAxis dataKey="day" stroke="rgb(var(--foreground-muted))" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="rgb(var(--foreground-muted))" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgb(var(--surface-muted))' }} />
                    <Bar dataKey="minutes" name="Minutes" fill="rgb(var(--accent-mint))" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card title="Quiz scores" description="Accuracy across your attempts">
              {trend.length === 0 ? (
                <p className="py-16 text-center text-sm text-muted">Complete a quiz to see your score trend.</p>
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--border))" vertical={false} />
                      <XAxis dataKey="attempt" stroke="rgb(var(--foreground-muted))" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis domain={[0, 100]} stroke="rgb(var(--foreground-muted))" fontSize={12} tickLine={false} axisLine={false} unit="%" />
                      <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => `${v}%`} />
                      <Line type="monotone" dataKey="pct" name="Score" stroke="rgb(var(--accent-lavender))" strokeWidth={2.5} dot={{ r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>

            <Card title="Most studied subjects" description="Minutes per subject" className="lg:col-span-2">
              {subjects.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted">Start a study session on a reviewer to see subjects here.</p>
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={subjects} layout="vertical" margin={{ left: 16 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--border))" horizontal={false} />
                      <XAxis type="number" stroke="rgb(var(--foreground-muted))" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis type="category" dataKey="name" width={96} stroke="rgb(var(--foreground-muted))" fontSize={12} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgb(var(--surface-muted))' }} />
                      <Bar dataKey="minutes" name="Minutes" fill="rgb(var(--accent-lavender))" radius={[0, 8, 8, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, tone = 'default' }: { label: string; value: string; tone?: 'default' | 'mint' | 'lavender' }) {
  const toneClass = tone === 'mint' ? 'bg-mint-surface' : tone === 'lavender' ? 'bg-lavender-surface' : 'bg-surface';
  return (
    <div className={`rounded-card border border-border p-5 shadow-sm ${toneClass}`}>
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">{value}</p>
    </div>
  );
}
