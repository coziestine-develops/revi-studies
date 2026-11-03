import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Check, Comments, Search, UserMinus, UserPlus, Users, X } from '../icons';
import { useAuth } from '../contexts/AuthContext';
import { listFriendships, removeFriendship, respondToRequest, searchProfiles, sendFriendRequest } from '../services/social';
import { errorMessage } from '../lib/format';
import { Card } from '../components/common/Card';
import { Alert, inputClass } from '../components/common/Forms';
import { Button, buttonClasses } from '../components/common/Button';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { EmptyState } from '../components/common/EmptyState';
import { Skeleton } from '../components/common/Skeleton';
import type { Profile } from '../types/database';

type Tab = 'friends' | 'requests' | 'find';

function nameOf(profile: Profile | undefined): string {
  return profile?.full_name || (profile?.username ? `@${profile.username}` : 'Unknown user');
}

export default function FriendsPage() {
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('friends');
  const [term, setTerm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<{ id: string; name: string } | null>(null);

  const friendsQuery = useQuery({ queryKey: ['friendships', userId], queryFn: () => listFriendships(userId), enabled: !!userId });
  const results = useQuery({
    queryKey: ['profile-search', userId, term],
    queryFn: () => searchProfiles(term, userId),
    enabled: !!userId && term.trim().length >= 2,
  });

  const all = friendsQuery.data ?? [];
  const friends = all.filter((f) => f.direction === 'friend');
  const incoming = all.filter((f) => f.direction === 'incoming');
  const outgoing = all.filter((f) => f.direction === 'outgoing');
  const relationById = new Map(all.filter((f) => f.other).map((f) => [f.other!.id, f]));

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['friendships', userId] });

  const actionMutation = useMutation({
    mutationFn: async (action: () => Promise<void>) => action(),
    onSuccess: () => { setError(null); refresh(); },
    onError: (err) => setError(errorMessage(err)),
  });

  const tabs: { value: Tab; label: string; count?: number }[] = [
    { value: 'friends', label: 'Friends', count: friends.length },
    { value: 'requests', label: 'Requests', count: incoming.length },
    { value: 'find', label: 'Find people' },
  ];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Friends</h1>
        <p className="mt-1 text-sm text-muted">Connect with classmates, then share reviewers with them.</p>
      </header>

      {error && <Alert>{error}</Alert>}

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Friends sections">
        {tabs.map((item) => (
          <button
            key={item.value}
            role="tab"
            type="button"
            aria-selected={tab === item.value}
            onClick={() => setTab(item.value)}
            className={`rounded-full border px-4 py-1.5 text-sm font-medium ${tab === item.value ? 'border-transparent bg-primary text-primary-foreground' : 'border-border bg-surface hover:bg-surface-muted'}`}
          >
            {item.label}
            {item.count !== undefined && item.count > 0 && (
              <span className={`ml-2 rounded-full px-1.5 text-xs ${item.value === 'requests' ? 'bg-lavender text-on-accent' : 'opacity-70'}`}>{item.count}</span>
            )}
          </button>
        ))}
      </div>

      {friendsQuery.isLoading && <Skeleton className="h-24 w-full" />}
      {friendsQuery.isError && <Alert>Couldn't load friends: {errorMessage(friendsQuery.error)}</Alert>}

      {tab === 'friends' && !friendsQuery.isLoading && (
        <Card>
          {friends.length === 0 ? (
            <EmptyState icon={Users} title="No friends yet" description="Find classmates by username to send a request." action={<Button variant="secondary" onClick={() => setTab('find')}>Find people</Button>} />
          ) : (
            <ul className="divide-y divide-border">
              {friends.map((f) => (
                <li key={f.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{nameOf(f.other)}</p>
                    {f.other?.username && <p className="text-xs text-muted">@{f.other.username}</p>}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {f.other && (
                      <Link to={`/messages?with=${f.other.id}`} aria-label={`Message ${nameOf(f.other)}`} className={buttonClasses('secondary')}>
                        <Comments className="h-4 w-4" aria-hidden /> Message
                      </Link>
                    )}
                    <Button variant="ghost" className="text-error" onClick={() => setConfirmRemove({ id: f.id, name: nameOf(f.other) })}>
                      <UserMinus className="h-4 w-4" aria-hidden /> Remove
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-4 text-xs text-muted">To share a reviewer with a friend, open it and use the Sharing panel. <Link to="/library" className="underline">Go to library</Link></p>
        </Card>
      )}

      {tab === 'requests' && !friendsQuery.isLoading && (
        <div className="grid gap-6 md:grid-cols-2">
          <Card title="Incoming" description="Requests waiting for your response">
            {incoming.length === 0 && <p className="text-sm text-muted">No incoming requests.</p>}
            <ul className="divide-y divide-border">
              {incoming.map((f) => (
                <li key={f.id} className="flex items-center justify-between gap-3 py-3">
                  <p className="truncate text-sm font-medium">{nameOf(f.other)}</p>
                  <div className="flex gap-2">
                    <Button variant="mint" onClick={() => actionMutation.mutate(() => respondToRequest(f.id, true))} aria-label={`Accept ${nameOf(f.other)}`}>
                      <Check className="h-4 w-4" aria-hidden /> Accept
                    </Button>
                    <Button variant="secondary" onClick={() => actionMutation.mutate(() => respondToRequest(f.id, false))} aria-label={`Decline ${nameOf(f.other)}`}>
                      <X className="h-4 w-4" aria-hidden /> Decline
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
          <Card title="Sent" description="Requests you've sent">
            {outgoing.length === 0 && <p className="text-sm text-muted">No pending requests.</p>}
            <ul className="divide-y divide-border">
              {outgoing.map((f) => (
                <li key={f.id} className="flex items-center justify-between gap-3 py-3">
                  <p className="truncate text-sm font-medium">{nameOf(f.other)}</p>
                  <Button variant="secondary" onClick={() => actionMutation.mutate(() => removeFriendship(f.id))}>Cancel</Button>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}

      {tab === 'find' && (
        <Card title="Find people" description="Search by username or name (at least 2 characters).">
          <label className="relative mb-4 block">
            <span className="sr-only">Search people</span>
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
            <input type="search" value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Search by username or name" className={`${inputClass} pl-10`} />
          </label>

          {results.isFetching && <Skeleton className="h-16 w-full" />}
          {results.isError && <Alert>{errorMessage(results.error)}</Alert>}
          {term.trim().length >= 2 && !results.isFetching && results.data?.length === 0 && (
            <p className="text-sm text-muted">No one matches that search.</p>
          )}
          <ul className="divide-y divide-border">
            {(results.data ?? []).map((profile) => {
              const relation = relationById.get(profile.id);
              return (
                <li key={profile.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{nameOf(profile)}</p>
                    {profile.username && <p className="text-xs text-muted">@{profile.username}</p>}
                  </div>
                  {!relation && (
                    <Button variant="lavender" onClick={() => actionMutation.mutate(() => sendFriendRequest(userId, profile.id))}>
                      <UserPlus className="h-4 w-4" aria-hidden /> Add
                    </Button>
                  )}
                  {relation && (
                    <span className="text-xs font-medium text-muted">
                      {relation.direction === 'friend' ? 'Friends' : relation.direction === 'outgoing' ? 'Request sent' : 'Respond in Requests'}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <ConfirmDialog
        open={!!confirmRemove}
        title="Remove this friend?"
        description={`${confirmRemove?.name ?? 'This person'} will be removed from your friends. Reviewers you shared with them directly stay shared until you revoke them.`}
        confirmLabel="Remove friend"
        danger
        onConfirm={() => {
          if (confirmRemove) actionMutation.mutate(() => removeFriendship(confirmRemove.id));
          setConfirmRemove(null);
        }}
        onCancel={() => setConfirmRemove(null)}
      />
    </div>
  );
}
