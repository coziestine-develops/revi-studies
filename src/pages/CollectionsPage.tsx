import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FolderOpen, Plus, Trash2, X } from '../icons';
import { useAuth } from '../contexts/AuthContext';
import {
  addToCollection, createCollection, deleteCollection, listCollectionItems, listCollections, removeFromCollection, renameCollection,
} from '../services/collections';
import { listReviewers } from '../services/reviewers';
import { errorMessage } from '../lib/format';
import { nameFormSchema, type NameFormValues } from '../schemas/forms';
import { Card } from '../components/common/Card';
import { Alert, Field, inputClass } from '../components/common/Forms';
import { Button } from '../components/common/Button';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { EmptyState } from '../components/common/EmptyState';
import { Skeleton } from '../components/common/Skeleton';
import { Link } from 'react-router-dom';

export default function CollectionsPage() {
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pickReviewer, setPickReviewer] = useState('');
  const [busy, setBusy] = useState(false);

  const collectionsQuery = useQuery({ queryKey: ['collections', userId], queryFn: listCollections, enabled: !!userId });
  const itemsQuery = useQuery({ queryKey: ['collection-items', userId], queryFn: listCollectionItems, enabled: !!userId });
  const reviewersQuery = useQuery({ queryKey: ['reviewers', userId], queryFn: listReviewers, enabled: !!userId });

  const collections = collectionsQuery.data ?? [];
  const items = itemsQuery.data ?? [];
  const reviewers = reviewersQuery.data ?? [];
  const selected = collections.find((c) => c.id === selectedId) ?? null;
  const selectedReviewerIds = new Set(items.filter((i) => i.collection_id === selectedId).map((i) => i.reviewer_id));
  const selectedReviewers = reviewers.filter((r) => selectedReviewerIds.has(r.id));
  const addable = reviewers.filter((r) => !selectedReviewerIds.has(r.id));

  const createForm = useForm<NameFormValues>({ resolver: zodResolver(nameFormSchema), defaultValues: { name: '' } });

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ['collections'] });
    queryClient.invalidateQueries({ queryKey: ['collection-items'] });
  }

  async function onCreate(values: NameFormValues) {
    setError(null);
    try {
      await createCollection(userId, values.name);
      createForm.reset({ name: '' });
      refresh();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function onRename(id: string) {
    const parsed = nameFormSchema.safeParse({ name: renameValue });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Enter a name.');
      return;
    }
    try {
      await renameCollection(id, parsed.data.name);
      setRenaming(null);
      refresh();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function onDelete() {
    if (!selected) return;
    setBusy(true);
    try {
      await deleteCollection(selected.id);
      setSelectedId(null);
      setConfirmDelete(false);
      refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function onAdd() {
    if (!selected || !pickReviewer) return;
    try {
      await addToCollection(selected.id, pickReviewer);
      setPickReviewer('');
      refresh();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function onRemove(reviewerId: string) {
    if (!selected) return;
    try {
      await removeFromCollection(selected.id, reviewerId);
      refresh();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Collections</h1>
        <p className="mt-1 text-sm text-muted">Group reviewers by course, exam, or topic.</p>
      </header>

      {error && <Alert>{error}</Alert>}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Your collections">
          <form
            onSubmit={createForm.handleSubmit(onCreate)}
            className="mb-4 flex gap-2"
            noValidate
          >
            <label htmlFor="collection-name" className="sr-only">New collection name</label>
            <input id="collection-name" placeholder="New collection" className={inputClass} aria-invalid={!!createForm.formState.errors.name} {...createForm.register('name')} />
            <Button type="submit" variant="mint" className="shrink-0" aria-label="Create collection"><Plus className="h-4 w-4" aria-hidden /></Button>
          </form>
          {createForm.formState.errors.name && <p role="alert" className="-mt-2 mb-3 text-xs text-error">{createForm.formState.errors.name.message}</p>}

          {collectionsQuery.isLoading && <Skeleton className="h-12 w-full" />}
          {!collectionsQuery.isLoading && collections.length === 0 && (
            <EmptyState icon={FolderOpen} title="No collections" description="Create one to start grouping your reviewers." />
          )}
          <ul className="space-y-2">
            {collections.map((collection) => {
              const count = items.filter((i) => i.collection_id === collection.id).length;
              const active = collection.id === selectedId;
              return (
                <li key={collection.id}>
                  <button
                    type="button"
                    onClick={() => { setSelectedId(collection.id); setRenaming(null); setError(null); }}
                    aria-current={active ? 'true' : undefined}
                    className={`flex w-full items-center justify-between rounded-control px-3.5 py-2.5 text-left text-sm transition-colors ${active ? 'bg-primary text-primary-foreground' : 'hover:bg-surface-muted'}`}
                  >
                    <span className="truncate font-medium">{collection.name}</span>
                    <span className={`shrink-0 text-xs ${active ? 'opacity-80' : 'text-muted'}`}>{count}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>

        <div className="lg:col-span-2">
          {!selected && (
            <Card>
              <EmptyState icon={FolderOpen} title="Select a collection" description="Pick a collection on the left to see and manage its reviewers." />
            </Card>
          )}

          {selected && (
            <div className="space-y-6">
              <Card
                title={renaming === selected.id ? 'Rename collection' : selected.name}
                description={`${selectedReviewers.length} ${selectedReviewers.length === 1 ? 'reviewer' : 'reviewers'}`}
                action={
                  <div className="flex gap-2">
                    {renaming === selected.id ? (
                      <>
                        <Button variant="secondary" onClick={() => setRenaming(null)}>Cancel</Button>
                        <Button onClick={() => onRename(selected.id)}>Save</Button>
                      </>
                    ) : (
                      <Button variant="secondary" onClick={() => { setRenaming(selected.id); setRenameValue(selected.name); }}>Rename</Button>
                    )}
                    <Button variant="danger" onClick={() => setConfirmDelete(true)} aria-label="Delete collection"><Trash2 className="h-4 w-4" aria-hidden /></Button>
                  </div>
                }
              >
                {renaming === selected.id && (
                  <Field id="rename" label="Name">
                    <input id="rename" className={inputClass} value={renameValue} onChange={(e) => setRenameValue(e.target.value)} maxLength={100} />
                  </Field>
                )}
              </Card>

              <Card title="Reviewers in this collection">
                <div className="mb-4 flex flex-col gap-2 sm:flex-row">
                  <select aria-label="Add a reviewer" value={pickReviewer} onChange={(e) => setPickReviewer(e.target.value)} className={inputClass}>
                    <option value="">Choose a reviewer to add</option>
                    {addable.map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}
                  </select>
                  <Button variant="lavender" onClick={onAdd} disabled={!pickReviewer} className="shrink-0">Add</Button>
                </div>

                {selectedReviewers.length === 0 && (
                  <p className="rounded-control border border-dashed border-border bg-surface-muted px-4 py-8 text-center text-sm text-muted">
                    This collection is empty.
                  </p>
                )}
                <ul className="divide-y divide-border">
                  {selectedReviewers.map((reviewer) => (
                    <li key={reviewer.id} className="flex items-center justify-between gap-3 py-3">
                      <Link to={`/reviewers/${reviewer.id}`} className="truncate text-sm font-medium hover:underline">{reviewer.title}</Link>
                      <button type="button" onClick={() => onRemove(reviewer.id)} className="shrink-0 text-xs font-medium text-error hover:underline">Remove</button>
                    </li>
                  ))}
                </ul>
              </Card>
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this collection?"
        description="The reviewers inside won't be deleted. Only the collection is removed."
        confirmLabel="Delete collection"
        danger
        loading={busy}
        onConfirm={onDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
