import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Layers, Plus, Trash2 } from '../icons';
import { useAuth } from '../contexts/AuthContext';
import { createDeck, deleteDeck, listDecks } from '../services/study';
import { errorMessage, formatDate } from '../lib/format';
import { deckFormSchema, type DeckFormValues } from '../schemas/forms';
import { Card } from '../components/common/Card';
import { Alert, Field, inputClass } from '../components/common/Forms';
import { Button } from '../components/common/Button';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { EmptyState } from '../components/common/EmptyState';
import { Skeleton } from '../components/common/Skeleton';
import type { FlashcardDeck } from '../types/database';

export default function FlashcardsPage() {
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<FlashcardDeck | null>(null);
  const [deleting, setDeleting] = useState(false);

  const decksQuery = useQuery({ queryKey: ['decks', userId], queryFn: listDecks, enabled: !!userId });
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<DeckFormValues>({
    resolver: zodResolver(deckFormSchema),
    defaultValues: { title: '', description: '' },
  });

  async function onCreate(values: DeckFormValues) {
    setError(null);
    try {
      await createDeck(userId, values.title, values.description);
      reset({ title: '', description: '' });
      queryClient.invalidateQueries({ queryKey: ['decks'] });
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function onDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await deleteDeck(pendingDelete.id);
      setPendingDelete(null);
      queryClient.invalidateQueries({ queryKey: ['decks'] });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setDeleting(false);
    }
  }

  const decks = decksQuery.data ?? [];

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Flashcards</h1>
          <p className="mt-1 text-sm text-muted">Study decks you create or generate from your reviewers.</p>
        </div>
        {decks.length > 0 && (
          <p className="text-sm font-medium text-muted">{decks.length} {decks.length === 1 ? 'deck' : 'decks'}</p>
        )}
      </header>

      {error && <Alert>{error}</Alert>}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card title="New deck" description="Start an empty deck and add cards yourself">
          <form onSubmit={handleSubmit(onCreate)} noValidate className="space-y-4">
            <Field id="deck-title" label="Title" error={errors.title?.message}>
              <input id="deck-title" className={inputClass} placeholder="e.g. Chapter 3 terms" aria-invalid={!!errors.title} {...register('title')} />
            </Field>
            <Field id="deck-description" label="Description" error={errors.description?.message}>
              <textarea id="deck-description" rows={3} className={inputClass} placeholder="What is this deck for?" aria-invalid={!!errors.description} {...register('description')} />
            </Field>
            <Button type="submit" variant="mint" className="w-full" loading={isSubmitting}>
              <Plus className="h-4 w-4" aria-hidden /> Create deck
            </Button>
          </form>
        </Card>

        <div className="min-w-0 xl:col-span-2">
          {decksQuery.isLoading && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Skeleton className="h-40" />
              <Skeleton className="h-40" />
            </div>
          )}
          {decksQuery.isError && <Alert>Couldn't load decks: {errorMessage(decksQuery.error)}</Alert>}
          {!decksQuery.isLoading && decks.length === 0 && (
            <Card>
              <EmptyState icon={Layers} title="No decks yet" description="Create a deck, or generate flashcards from a reviewer's AI tools." action={<Link to="/ai" className={buttonLink}>Open AI tools</Link>} />
            </Card>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {decks.map((deck) => (
              <article key={deck.id} className="group relative flex min-w-0 flex-col overflow-hidden rounded-card border border-border bg-surface text-foreground shadow-sm transition-shadow hover:shadow-lg">
                <span className="absolute inset-x-0 top-0 h-1.5 bg-mint" aria-hidden />
                <div className="flex flex-1 flex-col p-5">
                  <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control bg-mint-surface text-foreground" aria-hidden>
                      <Layers className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <Link to={`/flashcards/${deck.id}`} className="block break-words text-base font-semibold text-foreground after:absolute after:inset-0 after:content-[''] focus-visible:outline-none">
                        {deck.title}
                      </Link>
                      <p className="mt-0.5 text-xs text-muted">Updated {formatDate(deck.updated_at)}</p>
                    </div>
                  </div>
                  {deck.description && <p className="mt-3 line-clamp-2 break-words text-sm text-muted">{deck.description}</p>}
                </div>
                <div className="relative z-10 flex items-center justify-between gap-2 border-t border-border px-5 py-3">
                  <Link to={`/flashcards/${deck.id}`} className="relative z-10 text-sm font-medium text-foreground hover:underline">Open deck</Link>
                  <Button variant="ghost" className="text-error hover:text-error" onClick={() => setPendingDelete(deck)} aria-label={`Delete ${deck.title}`}>
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </Button>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={!!pendingDelete}
        title="Delete this deck?"
        description="All cards and your progress in this deck will be deleted."
        confirmLabel="Delete deck"
        danger
        loading={deleting}
        onConfirm={onDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}

const buttonLink = 'inline-flex items-center justify-center gap-2 rounded-control border border-border bg-surface px-4 py-2.5 text-sm font-medium hover:bg-surface-muted';
