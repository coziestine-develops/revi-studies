import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, ClipboardCheck, Clock, Trash2, XCircle } from '../icons';
import { useAuth } from '../contexts/AuthContext';
import { deleteAttempt, listAttempts, listQuizQuestions, listQuizzes, startAttempt } from '../services/study';
import { FunctionError, invokeFunction } from '../lib/functions';
import { errorMessage, formatDateTime } from '../lib/format';
import type { Quiz, QuizAttempt, QuizQuestion } from '../types/database';
import { Card } from '../components/common/Card';
import { Alert } from '../components/common/Forms';
import { Button } from '../components/common/Button';
import { EmptyState } from '../components/common/EmptyState';
import { Skeleton } from '../components/common/Skeleton';
import { ConfirmDialog } from '../components/common/ConfirmDialog';

interface GradeResult {
  score: number;
  total: number;
  results: { questionId: string; selected: string | null; correct: boolean; correctAnswer?: string | null; explanation?: string | null }[];
}

interface ActiveQuiz {
  quiz: Quiz;
  questions: QuizQuestion[];
  attemptId: string;
  answers: Record<string, string>;
  index: number;
  remaining: number | null;
}

export default function QuizzesPage() {
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const queryClient = useQueryClient();
  const [active, setActive] = useState<ActiveQuiz | null>(null);
  const [result, setResult] = useState<{ quiz: Quiz; data: GradeResult; questions: QuizQuestion[] } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [starting, setStarting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<QuizAttempt | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [attemptError, setAttemptError] = useState<string | null>(null);

  const quizzesQuery = useQuery({ queryKey: ['quizzes'], queryFn: listQuizzes, enabled: !!userId });
  const attemptsQuery = useQuery({ queryKey: ['attempts', userId], queryFn: () => listAttempts(userId), enabled: !!userId });
  const quizzes = quizzesQuery.data ?? [];
  const quizTitle = useMemo(() => new Map(quizzes.map((q) => [q.id, q.title])), [quizzes]);

  async function confirmDeleteAttempt() {
    if (!pendingDelete) return;
    setDeleting(true);
    setAttemptError(null);
    try {
      await deleteAttempt(pendingDelete.id);
      setPendingDelete(null);
      queryClient.invalidateQueries({ queryKey: ['attempts', userId] });
    } catch (err) {
      setPendingDelete(null);
      setAttemptError(errorMessage(err));
    } finally {
      setDeleting(false);
    }
  }

  async function start(quiz: Quiz) {
    setError(null);
    setStarting(quiz.id);
    try {
      const questions = await listQuizQuestions(quiz.id);
      if (questions.length === 0) throw new Error('This quiz has no questions.');
      const attemptId = await startAttempt(userId, quiz.id);
      setResult(null);
      setActive({
        quiz,
        questions,
        attemptId,
        answers: {},
        index: 0,
        remaining: quiz.time_limit_seconds,
      });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setStarting(null);
    }
  }

  async function submit(current: ActiveQuiz) {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const data = await invokeFunction<GradeResult>('grade-quiz', {
        attemptId: current.attemptId,
        answers: Object.entries(current.answers).map(([questionId, selected]) => ({ questionId, selected })),
      });
      setResult({ quiz: current.quiz, data, questions: current.questions });
      setActive(null);
      queryClient.invalidateQueries({ queryKey: ['attempts', userId] });
    } catch (err) {
      // The server closed an expired attempt without scoring it, so leave the quiz.
      if (err instanceof FunctionError && err.code === 'TIME_EXPIRED') setActive(null);
      setError(errorMessage(err));
      queryClient.invalidateQueries({ queryKey: ['attempts', userId] });
    } finally {
      setSubmitting(false);
    }
  }

  useEffect(() => {
    if (!active || active.remaining === null) return;
    if (active.remaining <= 0) {
      submit(active);
      return;
    }
    const timer = window.setTimeout(() => {
      setActive((current) => (current && current.remaining !== null ? { ...current, remaining: current.remaining - 1 } : current));
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [active]); // eslint-disable-line react-hooks/exhaustive-deps

  if (result) {
    const pct = result.data.total ? Math.round((result.data.score / result.data.total) * 100) : 0;
    const questionById = new Map(result.questions.map((q) => [q.id, q]));
    return (
      <div className="space-y-6">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{result.quiz.title}</h1>
          <p className="mt-1 text-sm text-muted">Results</p>
        </header>
        <Card tone="mint">
          <p className="text-sm">Your score</p>
          <p className="mt-1 text-4xl font-semibold tracking-tight">{result.data.score} / {result.data.total}</p>
          <p className="mt-1 text-sm">{pct}% accuracy</p>
          <Button variant="primary" className="mt-6" onClick={() => setResult(null)}>Back to quizzes</Button>
        </Card>
        <Card title="Review your answers">
          <ol className="space-y-4">
            {result.data.results.map((item, i) => (
              <li key={item.questionId} className="rounded-control border border-border p-4">
                <div className="flex items-start gap-3">
                  {item.correct
                    ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" aria-hidden />
                    : <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-error" aria-hidden />}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{i + 1}. {questionById.get(item.questionId)?.prompt ?? 'Question'}</p>
                    <p className="mt-1 text-sm text-muted">
                      {item.correct ? 'Correct.' : 'Incorrect.'} Your answer: {item.selected ?? 'no answer'}
                    </p>
                    {item.correctAnswer && !item.correct && (
                      <p className="mt-1 text-sm">Correct answer: <span className="font-medium">{item.correctAnswer}</span></p>
                    )}
                    {item.explanation && <p className="mt-2 text-sm text-muted">{item.explanation}</p>}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </Card>
      </div>
    );
  }

  if (active) {
    const question = active.questions[active.index];
    const answered = Object.keys(active.answers).length;
    const minutes = active.remaining !== null ? Math.floor(active.remaining / 60) : 0;
    const seconds = active.remaining !== null ? String(active.remaining % 60).padStart(2, '0') : '';
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">{active.quiz.title}</h1>
            <p className="text-sm text-muted">Question {active.index + 1} of {active.questions.length} · {answered} answered</p>
          </div>
          {active.remaining !== null && (
            <span className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-sm font-medium" role="timer" aria-live="off">
              <Clock className="h-4 w-4" aria-hidden /> {minutes}:{seconds}
            </span>
          )}
        </header>

        <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-muted" aria-hidden>
          <div className="h-full bg-mint transition-all" style={{ width: `${((active.index + 1) / active.questions.length) * 100}%` }} />
        </div>

        <Card>
          <fieldset>
            <legend className="mb-4 text-base font-medium leading-relaxed">{question.prompt}</legend>
            <div className="grid gap-2">
              {question.options.map((option) => {
                const selected = active.answers[question.id] === option;
                return (
                  <label key={option} className={`flex cursor-pointer items-center gap-3 rounded-control border px-4 py-3 text-sm transition-colors ${selected ? 'border-lavender bg-lavender-surface' : 'border-border hover:bg-surface-muted'}`}>
                    <input
                      type="radio"
                      name={question.id}
                      value={option}
                      checked={selected}
                      onChange={() => setActive((current) => current && { ...current, answers: { ...current.answers, [question.id]: option } })}
                      className="h-4 w-4 accent-brand"
                    />
                    <span>{option}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        </Card>

        {error && <Alert>{error}</Alert>}

        <div className="flex flex-wrap justify-between gap-2">
          <Button variant="secondary" disabled={active.index === 0} onClick={() => setActive((c) => c && { ...c, index: c.index - 1 })}>Previous</Button>
          <div className="flex gap-2">
            {active.index < active.questions.length - 1 ? (
              <Button variant="secondary" onClick={() => setActive((c) => c && { ...c, index: c.index + 1 })}>Next</Button>
            ) : null}
            <Button variant="mint" loading={submitting} onClick={() => submit(active)}>Submit quiz</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Quizzes</h1>
        <p className="mt-1 text-sm text-muted">Answers are checked on the server after you submit.</p>
      </header>

      {error && <Alert>{error}</Alert>}
      {quizzesQuery.isLoading && <Skeleton className="h-32 w-full" />}
      {quizzesQuery.isError && <Alert>Couldn't load quizzes: {errorMessage(quizzesQuery.error)}</Alert>}

      {!quizzesQuery.isLoading && quizzes.length === 0 && (
        <Card>
          <EmptyState icon={ClipboardCheck} title="No quizzes yet" description="Generate a quiz from any reviewer using AI tools." />
        </Card>
      )}

      <div className="grid gap-4">
        {quizzes.map((quiz) => (
          <article key={quiz.id} className="flex flex-col gap-4 rounded-card border border-border bg-surface p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h2 className="truncate text-base font-semibold">{quiz.title}</h2>
              <p className="mt-1 text-xs text-muted">{quiz.time_limit_seconds ? `${Math.round(quiz.time_limit_seconds / 60)} minute limit` : 'No time limit'}</p>
            </div>
            <Button className="w-full sm:w-auto sm:min-w-40" loading={starting === quiz.id} onClick={() => start(quiz)}>Start quiz</Button>
          </article>
        ))}
      </div>

      <Card title="Recent Quizzes">
        {attemptError && <div className="mb-3"><Alert>{attemptError}</Alert></div>}
        {attemptsQuery.isLoading && <Skeleton className="h-16 w-full" />}
        {(attemptsQuery.data ?? []).length === 0 && !attemptsQuery.isLoading && (
          <p className="text-sm text-muted">Your scores will appear here after you submit a quiz.</p>
        )}
        <ul className="divide-y divide-border">
          {(attemptsQuery.data ?? []).map((attempt) => {
            const title = quizTitle.get(attempt.quiz_id) ?? 'Quiz';
            return (
              <li key={attempt.id} className="flex flex-col gap-2 py-3 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                <div className="min-w-0 flex-1">
                  <p className="break-words font-medium">{title}</p>
                  <p className="text-xs text-muted">{attempt.submitted_at ? formatDateTime(attempt.submitted_at) : ''}</p>
                </div>
                <div className="flex shrink-0 items-center justify-between gap-3 sm:justify-end">
                  <span className="font-semibold">
                    {attempt.total === null ? 'Timed out' : `${attempt.score ?? 0}/${attempt.total ?? 0}`}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPendingDelete(attempt)}
                    aria-label={`Delete attempt for ${title}`}
                    className="flex h-9 items-center gap-1.5 rounded-control px-2.5 text-sm font-medium text-error hover:bg-error/10"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden /> <span>Delete</span>
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </Card>

      <ConfirmDialog
        open={!!pendingDelete}
        title="Delete this attempt?"
        description="The score and your answers for this attempt will be removed. This can't be undone."
        confirmLabel="Delete attempt"
        danger
        loading={deleting}
        onConfirm={confirmDeleteAttempt}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
