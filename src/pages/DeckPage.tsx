import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Check, ChevronLeft, ChevronRight, Clock, Layers, Pencil, Plus, RotateCcw, Shuffle, Trash2 } from '../icons';
import { useAuth } from '../contexts/AuthContext';
import { createCard, deleteCard, getDeck, listCards, listProgress, setProgress, startSession, endSession, updateCard } from '../services/study';
import { errorMessage } from '../lib/format';
import { cardFormSchema, type CardFormValues } from '../schemas/forms';
import { Card } from '../components/common/Card';
import { Alert, Field, inputClass } from '../components/common/Forms';
import { Button, buttonClasses } from '../components/common/Button';
import { EmptyState } from '../components/common/EmptyState';
import { Skeleton } from '../components/common/Skeleton';
import { RevLoader } from '../components/common/RevLoader';
import type { Flashcard, ProgressStatus } from '../types/database';

export default function DeckPage() {
  const { deckId = '' } = useParams();
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'study' | 'edit'>('study');

  const deckQuery = useQuery({ queryKey: ['deck', deckId], queryFn: () => getDeck(deckId), enabled: !!deckId });
  const cardsQuery = useQuery({ queryKey: ['cards', deckId], queryFn: () => listCards(deckId), enabled: !!deckId });
  const cards = cardsQuery.data ?? [];
  const progressQuery = useQuery({
    queryKey: ['progress', userId, cards.map((c) => c.id).join(',')],
    queryFn: () => listProgress(userId, cards.map((c) => c.id)),
    enabled: !!userId && cards.length > 0,
  });
  const progress = progressQuery.data ?? {};

  const [order, setOrder] = useState<number[]>([]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    setOrder(cards.map((_, i) => i));
    setIndex(0);
    setFlipped(false);
  }, [cards.length, deckId]); // eslint-disable-line react-hooks/exhaustive-deps

  const current: Flashcard | undefined = cards[order[index] ?? -1];

  const counts = useMemo(() => {
    const result: Record<ProgressStatus, number> = { unknown: 0, known: 0, needs_review: 0 };
    for (const card of cards) result[progress[card.id] ?? 'unknown'] += 1;
    return result;
  }, [cards, progress]);

  const total = cards.length;
  const knownPercent = total > 0 ? Math.round((counts.known / total) * 100) : 0;

  function go(delta: number) {
    if (order.length === 0) return;
    setFlipped(false);
    setIndex((i) => (i + delta + order.length) % order.length);
  }

  function shuffle() {
    const next = [...order];
    for (let i = next.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [next[i], next[j]] = [next[j], next[i]];
    }
    setOrder(next);
    setIndex(0);
    setFlipped(false);
  }

  useEffect(() => {
    if (tab !== 'study') return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest('input, textarea, select')) return;
      if (event.key === 'ArrowRight') go(1);
      if (event.key === 'ArrowLeft') go(-1);
      if (event.key === ' ') {
        event.preventDefault();
        setFlipped((f) => !f);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  async function mark(status: ProgressStatus) {
    if (!current) return;
    setError(null);
    try {
      await setProgress(userId, current.id, status);
      queryClient.invalidateQueries({ queryKey: ['progress', userId] });
      go(1);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  const [studyStart, setStudyStart] = useState<{ id: string; startedAt: string } | null>(null);
  async function toggleStudySession() {
    try {
      if (studyStart) {
        await endSession(studyStart.id, studyStart.startedAt);
        setStudyStart(null);
      } else {
        const startedAt = new Date().toISOString();
        const id = await startSession(userId, deck?.reviewer_id ?? null, 'flashcards');
        setStudyStart({ id, startedAt });
      }
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  const deck = deckQuery.data;

  if (deckQuery.isLoading) return <RevLoader label="Opening deck" />;
  if (deckQuery.isError) return <Alert>Couldn't load this deck: {errorMessage(deckQuery.error)}</Alert>;
  if (!deck) {
    return (
      <Card>
        <h1 className="text-lg font-semibold">Deck not found</h1>
        <p className="mt-1 text-sm text-muted">It may have been deleted.</p>
        <Link to="/flashcards" className={`${buttonClasses('secondary')} mt-4`}>Back to flashcards</Link>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Link to="/flashcards" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Flashcards
      </Link>

      {/* Deck header: title, description, and a summary of how far along the deck is */}
      <section className="overflow-hidden rounded-card border border-border bg-surface text-foreground shadow-sm">
        <div className="h-1.5 bg-mint" aria-hidden />
        <div className="flex flex-col gap-5 p-5 sm:p-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">Flashcard deck</p>
            <h1 className="mt-1 break-words text-2xl font-semibold tracking-tight md:text-3xl">{deck.title}</h1>
            {deck.description && <p className="mt-1.5 break-words text-sm text-muted">{deck.description}</p>}
          </div>

          <div className="flex w-full flex-col gap-3 sm:w-auto sm:min-w-[260px]">
            <div className="flex rounded-control bg-surface-muted p-1" role="tablist" aria-label="Deck views">
              {(['study', 'edit'] as const).map((value) => (
                <button
                  key={value}
                  role="tab"
                  type="button"
                  aria-selected={tab === value}
                  onClick={() => setTab(value)}
                  className={`flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-[8px] px-3 py-2 text-sm font-semibold transition-colors sm:px-4 ${
                    tab === value ? 'bg-primary !text-primary-foreground shadow-sm' : 'text-foreground hover:bg-surface'
                  }`}
                >
                  {value === 'study' ? <Layers className="h-4 w-4" aria-hidden /> : <Pencil className="h-4 w-4" aria-hidden />}
                  {value === 'study' ? 'Study' : 'Edit cards'}
                </button>
              ))}
            </div>
            {total > 0 && (
              <div>
                <div className="mb-1.5 flex items-center justify-between text-xs text-muted">
                  <span>{total} {total === 1 ? 'card' : 'cards'}</span>
                  <span className="font-semibold text-foreground">{knownPercent}% known</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-surface-muted" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={knownPercent} aria-label="Known cards">
                  <div className="h-full rounded-full bg-mint transition-all duration-500 motion-reduce:transition-none" style={{ width: `${knownPercent}%` }} />
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {error && <Alert>{error}</Alert>}
      {cardsQuery.isError && <Alert>Couldn't load cards: {errorMessage(cardsQuery.error)}</Alert>}

      {tab === 'study' && cardsQuery.isLoading && <Skeleton className="h-72 w-full" />}

      {tab === 'study' && !cardsQuery.isLoading && cards.length === 0 && (
        <Card><EmptyState icon={Layers} title="No cards in this deck" description="Add cards in the Edit tab, then come back to study." /></Card>
      )}

      {tab === 'study' && current && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="min-w-0 space-y-4 xl:col-span-2">
            <button
              type="button"
              onClick={() => setFlipped((f) => !f)}
              aria-label={flipped ? 'Show question' : 'Show answer'}
              className="relative block h-64 w-full min-w-0 [perspective:1200px] focus-visible:outline-none sm:h-72 lg:h-80 xl:h-96"
            >
              <div className={`relative h-full w-full transition-transform duration-500 motion-reduce:transition-none [transform-style:preserve-3d] ${flipped ? '[transform:rotateY(180deg)]' : ''}`}>
                <div className="absolute inset-0 flex flex-col items-center justify-center overflow-hidden rounded-card border border-border bg-surface p-5 text-center text-foreground shadow-sm [backface-visibility:hidden] sm:p-8">
                  <span className="absolute inset-x-0 top-0 h-1.5 bg-mint" aria-hidden />
                  <span className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-mint-surface px-3 py-1 text-xs font-semibold uppercase tracking-wider text-foreground">Question</span>
                  <p className="min-h-0 max-h-full overflow-y-auto break-words text-base font-semibold leading-relaxed sm:text-lg xl:text-xl">{current.front}</p>
                  <span className="mt-4 text-xs text-muted sm:mt-6">Tap or press Space to reveal</span>
                </div>
                <div className="absolute inset-0 flex flex-col items-center justify-center overflow-hidden rounded-card border border-border bg-lavender-surface p-5 text-center text-foreground shadow-sm [backface-visibility:hidden] [transform:rotateY(180deg)] sm:p-8">
                  <span className="absolute inset-x-0 top-0 h-1.5 bg-lavender" aria-hidden />
                  <span className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-surface px-3 py-1 text-xs font-semibold uppercase tracking-wider text-foreground">Answer</span>
                  <p className="min-h-0 max-h-full overflow-y-auto break-words text-base leading-relaxed sm:text-lg xl:text-xl">{current.back}</p>
                </div>
              </div>
            </button>

            {/* Navigation: grouped controls on the left, position on the right */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-1 rounded-control border border-border bg-surface p-1">
                <button type="button" onClick={() => go(-1)} aria-label="Previous card" className="flex h-9 w-9 items-center justify-center rounded-control text-foreground hover:bg-surface-muted">
                  <ChevronLeft className="h-4 w-4" aria-hidden />
                </button>
                <button type="button" onClick={() => go(1)} aria-label="Next card" className="flex h-9 w-9 items-center justify-center rounded-control text-foreground hover:bg-surface-muted">
                  <ChevronRight className="h-4 w-4" aria-hidden />
                </button>
                <span className="mx-1 h-5 w-px bg-border" aria-hidden />
                <button type="button" onClick={shuffle} className="flex h-9 items-center gap-1.5 rounded-control px-3 text-sm font-medium text-foreground hover:bg-surface-muted">
                  <Shuffle className="h-4 w-4" aria-hidden /> Shuffle
                </button>
              </div>
              <p className="text-sm font-medium text-muted" aria-live="polite">Card {index + 1} of {total}</p>
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-surface-muted" aria-hidden>
              <div className="h-full rounded-full bg-lavender transition-all duration-300 motion-reduce:transition-none" style={{ width: `${((index + 1) / total) * 100}%` }} />
            </div>

            {/* Grading: large touch targets on phones */}
            <div className="grid grid-cols-2 gap-3">
              <Button variant="success" className="h-12 text-base" onClick={() => mark('known')}>
                <Check className="h-4 w-4" aria-hidden /> Got it
              </Button>
              <Button variant="secondary" className="h-12 text-base" onClick={() => mark('needs_review')}>
                <RotateCcw className="h-4 w-4" aria-hidden /> Needs review
              </Button>
            </div>
            <p className="hidden text-xs text-muted sm:block">Keyboard: ← → to move, Space to flip.</p>
          </div>

          <div className="min-w-0 space-y-6">
            <Card title="Progress" description="How your cards are doing">
              <div className="mb-4 flex h-3 overflow-hidden rounded-full bg-surface-muted" aria-hidden>
                {total > 0 && (
                  <>
                    <div className="bg-success transition-all duration-500 motion-reduce:transition-none" style={{ width: `${(counts.known / total) * 100}%` }} />
                    <div className="bg-warning transition-all duration-500 motion-reduce:transition-none" style={{ width: `${(counts.needs_review / total) * 100}%` }} />
                  </>
                )}
              </div>
              <dl className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-control bg-success/15 p-3"><dt className="text-xs text-muted">Known</dt><dd className="text-xl font-semibold">{counts.known}</dd></div>
                <div className="rounded-control bg-surface-muted p-3"><dt className="text-xs text-muted">Review</dt><dd className="text-xl font-semibold">{counts.needs_review}</dd></div>
                <div className="rounded-control bg-surface-muted p-3"><dt className="text-xs text-muted">New</dt><dd className="text-xl font-semibold">{counts.unknown}</dd></div>
              </dl>
              <Button variant={studyStart ? 'secondary' : 'mint'} className="mt-4 w-full" onClick={toggleStudySession}>
                <Clock className="h-4 w-4" aria-hidden />
                {studyStart ? 'Stop study timer' : 'Start study timer'}
              </Button>
            </Card>
          </div>
        </div>
      )}

      {tab === 'edit' && (
        <EditCards deckId={deckId} cards={cards} editingId={editingId} setEditingId={setEditingId} onChanged={() => {
          queryClient.invalidateQueries({ queryKey: ['cards', deckId] });
        }} />
      )}
    </div>
  );
}

function EditCards({ deckId, cards, editingId, setEditingId, onChanged }: {
  deckId: string;
  cards: Flashcard[];
  editingId: string | null;
  setEditingId: (id: string | null) => void;
  onChanged: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const editing = cards.find((c) => c.id === editingId) ?? null;
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<CardFormValues>({
    resolver: zodResolver(cardFormSchema),
    defaultValues: { front: '', back: '' },
  });

  useEffect(() => {
    reset(editing ? { front: editing.front, back: editing.back } : { front: '', back: '' });
  }, [editing?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function onSubmit(values: CardFormValues) {
    setError(null);
    try {
      if (editing) {
        await updateCard(editing.id, values.front, values.back);
        setEditingId(null);
      } else {
        await createCard(deckId, cards.length, values.front, values.back);
        reset({ front: '', back: '' });
      }
      onChanged();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function remove(id: string) {
    try {
      await deleteCard(id);
      if (editingId === id) setEditingId(null);
      onChanged();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
      <Card
        className="min-w-0 xl:sticky xl:top-6 xl:self-start"
        title={editing ? 'Edit card' : 'Add a card'}
        description={editing ? 'Update the question or answer' : 'New cards appear at the end of the deck'}
        action={editing ? <Button variant="ghost" onClick={() => setEditingId(null)}>Cancel</Button> : undefined}
      >
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          <Field id="front" label="Front" error={errors.front?.message}>
            <textarea id="front" rows={3} className={inputClass} placeholder="The question or term" aria-invalid={!!errors.front} {...register('front')} />
          </Field>
          <Field id="back" label="Back" error={errors.back?.message}>
            <textarea id="back" rows={3} className={inputClass} placeholder="The answer or definition" aria-invalid={!!errors.back} {...register('back')} />
          </Field>
          {error && <Alert>{error}</Alert>}
          <Button type="submit" variant="mint" className="w-full" loading={isSubmitting}>
            {editing ? 'Save card' : <><Plus className="h-4 w-4" aria-hidden /> Add card</>}
          </Button>
        </form>
      </Card>

      <div className="min-w-0 xl:col-span-2">
        <Card title="Cards" description={`${cards.length} ${cards.length === 1 ? 'card' : 'cards'} in this deck`}>
          {cards.length === 0 ? (
            <EmptyState icon={Layers} title="No cards yet" description="Use the form to add your first card." />
          ) : (
            <ul className="space-y-2">
              {cards.map((card, i) => {
                const isEditing = card.id === editingId;
                return (
                  <li
                    key={card.id}
                    className={`flex min-w-0 flex-col gap-2 rounded-control border p-3 transition-colors sm:flex-row sm:items-start sm:gap-3 ${
                      isEditing ? 'border-mint bg-mint-surface' : 'border-border bg-surface hover:bg-surface-muted'
                    }`}
                  >
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-muted text-xs font-semibold text-foreground" aria-hidden>
                        {i + 1}
                      </span>
                      <button type="button" onClick={() => setEditingId(card.id)} className="min-w-0 flex-1 text-left text-foreground">
                        <span className="block break-words text-sm font-semibold leading-snug line-clamp-3">{card.front}</span>
                        <span className="mt-1 block break-words text-sm text-muted line-clamp-2">{card.back}</span>
                      </button>
                    </div>
                    <div className="flex shrink-0 items-center justify-end gap-1 border-t border-border pt-2 sm:border-0 sm:pt-0">
                      <button type="button" onClick={() => setEditingId(card.id)} className="flex h-9 items-center gap-1.5 rounded-control px-2.5 text-sm font-medium text-muted hover:bg-surface hover:text-foreground" aria-label={`Edit card ${i + 1}`}>
                        <Pencil className="h-4 w-4" aria-hidden /> <span className="sm:sr-only">Edit</span>
                      </button>
                      <button type="button" onClick={() => remove(card.id)} className="flex h-9 items-center gap-1.5 rounded-control px-2.5 text-sm font-medium text-error hover:bg-error/10" aria-label={`Delete card ${i + 1}`}>
                        <Trash2 className="h-4 w-4" aria-hidden /> <span className="sm:sr-only">Delete</span>
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
