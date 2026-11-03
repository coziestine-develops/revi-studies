import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { Sparkles } from '../icons';
import { useAuth } from '../contexts/AuthContext';
import { AI_KIND_OPTIONS, generateStudyContent, listGenerations, type GenerationResponse } from '../services/ai';
import { listReviewers } from '../services/reviewers';
import { errorMessage, formatDateTime } from '../lib/format';
import type { AIGeneration, AIKind } from '../types/database';
import { Card } from '../components/common/Card';
import { Alert, inputClass } from '../components/common/Forms';
import { Button } from '../components/common/Button';
import { FunctionError } from '../lib/functions';

interface Concept { term: string; definition: string }

export default function AIToolsPage() {
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const queryClient = useQueryClient();
  const [params] = useSearchParams();
  const [reviewerId, setReviewerId] = useState(params.get('reviewer') ?? '');
  const [kind, setKind] = useState<AIKind>('summary');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; notConfigured: boolean } | null>(null);
  const [output, setOutput] = useState<GenerationResponse | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  // On phones the result sits below a long form, so bring it into view when it changes.
  useEffect(() => {
    if (!output && !error) return;
    if (window.matchMedia('(min-width: 1024px)').matches) return;
    resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [output, error]);

  const reviewersQuery = useQuery({ queryKey: ['reviewers', userId], queryFn: listReviewers, enabled: !!userId });
  const historyQuery = useQuery({ queryKey: ['generations', userId], queryFn: () => listGenerations(userId), enabled: !!userId });
  const reviewers = reviewersQuery.data ?? [];
  const history = historyQuery.data ?? [];
  const selectedKind = AI_KIND_OPTIONS.find((o) => o.value === kind)!;

  async function generate() {
    if (!reviewerId) {
      setError({ message: 'Choose a reviewer first.', notConfigured: false });
      return;
    }
    setBusy(true);
    setError(null);
    setOutput(null);
    setSelectedId(null);
    try {
      const response = await generateStudyContent(reviewerId, kind);
      setOutput(response);
      setSelectedId(response.generationId);
      queryClient.invalidateQueries({ queryKey: ['generations', userId] });
      queryClient.invalidateQueries({ queryKey: ['decks'] });
      queryClient.invalidateQueries({ queryKey: ['quizzes'] });
    } catch (err) {
      const notConfigured = err instanceof FunctionError && err.code === 'AI_NOT_CONFIGURED';
      setError({ message: errorMessage(err), notConfigured });
    } finally {
      setBusy(false);
    }
  }

  /** Reopens a saved generation from the history list, so earlier answers stay available after new requests. */
  function openGeneration(item: AIGeneration) {
    setError(null);
    setSelectedId(item.id);
    if (item.status === 'succeeded' && item.result) {
      const saved = item.result as Record<string, unknown>;
      setOutput({
        generationId: item.id,
        kind: item.kind,
        result: item.result,
        deckId: typeof saved.deckId === 'string' ? saved.deckId : undefined,
        quizId: typeof saved.quizId === 'string' ? saved.quizId : undefined,
      });
      return;
    }
    setOutput(null);
    setError({
      message: item.status === 'failed'
        ? (item.error_message ?? 'This generation failed, so there is no result to show.')
        : 'This generation has not finished yet.',
      notConfigured: false,
    });
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">AI study tools</h1>
        <p className="mt-1 text-sm text-muted">Generate summaries, concepts, flashcards, and quizzes from a reviewer you can access.</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Generate" tone="lavender">
          <div className="space-y-5">
            <div>
              <label htmlFor="reviewer" className="mb-1.5 block text-sm font-medium">Reviewer</label>
              <select id="reviewer" value={reviewerId} onChange={(e) => setReviewerId(e.target.value)} className={inputClass}>
                <option value="">Choose a reviewer</option>
                {reviewers.map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}
              </select>
            </div>

            <fieldset>
              <legend className="mb-2 text-sm font-medium">What do you need?</legend>
              <div className="grid gap-2 min-[420px]:grid-cols-2 lg:grid-cols-1">
                {AI_KIND_OPTIONS.map((option) => (
                  <label key={option.value} className={`flex cursor-pointer items-start gap-3 rounded-control border px-3.5 py-2.5 text-sm ${kind === option.value ? 'border-brand bg-surface' : 'border-border bg-surface hover:bg-surface-muted'}`}>
                    <input type="radio" name="kind" value={option.value} checked={kind === option.value} onChange={() => setKind(option.value)} className="mt-1 accent-brand" />
                    <span>
                      <span className="block font-medium">{option.label}</span>
                      <span className="block text-xs text-muted">{option.hint}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <Button variant="primary" className="w-full" loading={busy} onClick={generate} disabled={reviewers.length === 0}>
              <Sparkles className="h-4 w-4" aria-hidden /> {busy ? 'Generating…' : `Generate ${selectedKind.label.toLowerCase()}`}
            </Button>
            {busy && <p className="text-xs text-muted" role="status">This can take up to a minute for longer reviewers.</p>}
            {reviewers.length === 0 && !reviewersQuery.isLoading && (
              <p className="text-sm text-muted">Upload a reviewer first. <Link to="/upload" className="underline">Upload one</Link></p>
            )}
          </div>
        </Card>

        <div ref={resultRef} className="scroll-mt-20 space-y-6 lg:col-span-2">
          {error && (
            <Alert>
              {error.notConfigured
                ? 'AI generation isn’t set up for this project yet. The project owner needs to add the AI provider key and model as Edge Function secrets. Nothing was generated.'
                : error.message}
            </Alert>
          )}

          {!output && !error && !busy && (
            <Card>
              <p className="text-sm text-muted">Your generated results appear here. Nothing is shown until the server confirms it was saved. Pick an item under Recent history to view it again.</p>
            </Card>
          )}

          {output && <ResultView response={output} />}

          <Card title="Recent History">
            {historyQuery.isLoading && <p className="text-sm text-muted">Loading…</p>}
            {history.length === 0 && !historyQuery.isLoading && <p className="text-sm text-muted">No generations yet.</p>}
            <ul className="divide-y divide-border">
              {history.map((g) => {
                const label = AI_KIND_OPTIONS.find((o) => o.value === g.kind)?.label ?? g.kind;
                const title = reviewers.find((r) => r.id === g.reviewer_id)?.title ?? 'Reviewer';
                const isSelected = selectedId === g.id;
                return (
                  <li key={g.id}>
                    <button
                      type="button"
                      onClick={() => openGeneration(g)}
                      aria-current={isSelected ? 'true' : undefined}
                      className={`flex w-full items-center justify-between gap-3 rounded-control px-2 py-3 text-left text-sm transition-colors hover:bg-surface-muted ${isSelected ? 'bg-surface-muted' : ''}`}
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium">{label} · {title}</p>
                        <p className="text-xs text-muted">{formatDateTime(g.created_at)}</p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        g.status === 'succeeded' ? 'bg-success/15 text-success'
                          : g.status === 'failed' ? 'bg-error/15 text-error'
                            : 'bg-surface text-muted'
                      }`}>
                        {g.status}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}

function ResultView({ response }: { response: GenerationResponse }) {
  const result = response.result as Record<string, unknown>;

  if (response.kind === 'summary' || response.kind === 'explanation') {
    const text = String(response.kind === 'summary' ? result.summary ?? '' : result.explanation ?? '');
    return (
      <Card title={response.kind === 'summary' ? 'Summary' : 'Explanation'} tone="mint">
        <p className="whitespace-pre-line text-sm leading-relaxed">{text}</p>
      </Card>
    );
  }

  if (response.kind === 'key_concepts') {
    const concepts = (result.concepts as Concept[] | undefined) ?? [];
    return (
      <Card title="Key concepts" tone="mint">
        <dl className="grid gap-3 md:grid-cols-2">
          {concepts.map((c) => (
            <div key={c.term} className="rounded-control bg-surface p-3.5">
              <dt className="text-sm font-semibold">{c.term}</dt>
              <dd className="mt-1 text-sm text-muted">{c.definition}</dd>
            </div>
          ))}
        </dl>
      </Card>
    );
  }

  if (response.kind === 'flashcards') {
    return (
      <Card title="Flashcards created" tone="mint">
        <p className="text-sm">Saved as a new deck in your library.</p>
        {response.deckId && <Link to={`/flashcards/${response.deckId}`} className="mt-4 inline-flex rounded-control bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground">Open deck</Link>}
      </Card>
    );
  }

  return (
    <Card title="Quiz created" tone="mint">
      <p className="text-sm">Saved as a new quiz. Answers stay on the server until you submit.</p>
      <Link to="/quizzes" className="mt-4 inline-flex rounded-control bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground">Go to quizzes</Link>
    </Card>
  );
}
