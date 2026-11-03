import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Bell, Trash2 } from '../icons';
import { useAuth } from '../contexts/AuthContext';
import { deleteNotifications, listNotifications, markNotificationsRead } from '../services/social';
import { errorMessage, formatDateTime } from '../lib/format';
import { notificationMessage } from '../lib/notifications';
import { Card } from '../components/common/Card';
import { Alert } from '../components/common/Forms';
import { Button } from '../components/common/Button';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { EmptyState } from '../components/common/EmptyState';
import { Skeleton } from '../components/common/Skeleton';
import { useToast } from '../components/common/Toast';

export default function NotificationsPage() {
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const query = useQuery({ queryKey: ['notifications', userId], queryFn: () => listNotifications(userId), enabled: !!userId });
  const items = query.data ?? [];
  const unread = items.filter((n) => !n.read_at);

  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);

  function refreshNotifications() {
    queryClient.invalidateQueries({ queryKey: ['notifications', userId] });
    queryClient.invalidateQueries({ queryKey: ['notifications-unread', userId] });
  }

  async function markRead(ids?: string[]) {
    setActionError(null);
    try {
      await markNotificationsRead(userId, ids);
      refreshNotifications();
    } catch (err) {
      setActionError(errorMessage(err));
    }
  }

  const deleteMutation = useMutation({
    mutationFn: (ids?: string[]) => deleteNotifications(userId, ids),
    onSuccess: (removed, ids) => {
      setActionError(null);
      setConfirmDeleteAll(false);
      refreshNotifications();
      toast(ids ? 'Notification deleted.' : `${removed} ${removed === 1 ? 'notification' : 'notifications'} deleted.`);
    },
    onError: (err) => {
      setConfirmDeleteAll(false);
      setActionError(errorMessage(err));
    },
  });

  const markAll = () => markRead();
  const markOne = (id: string) => markRead([id]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Notifications</h1>
          <p className="mt-1 text-sm text-muted">{unread.length > 0 ? `${unread.length} unread` : "You're all caught up."}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {unread.length > 0 && <Button variant="secondary" onClick={markAll}>Mark all as read</Button>}
          {items.length > 0 && (
            <Button variant="danger-outline" onClick={() => setConfirmDeleteAll(true)}>
              <Trash2 className="h-4 w-4" aria-hidden /> Delete all
            </Button>
          )}
        </div>
      </header>

      {actionError && <Alert>{actionError}</Alert>}
      {query.isError && <Alert>Couldn't load notifications: {errorMessage(query.error)}</Alert>}
      {query.isLoading && <Skeleton className="h-40 w-full" />}

      {!query.isLoading && items.length === 0 && (
        <Card><EmptyState icon={Bell} title="No notifications" description="Friend requests and shared reviewers will show up here." /></Card>
      )}

      {items.length > 0 && (
        <Card>
          <ul className="divide-y divide-border">
            {items.map((n) => {
              const message = notificationMessage(n);
              return (
                <li key={n.id} className="flex items-center gap-3 py-3">
                  <span aria-hidden className={`h-2.5 w-2.5 shrink-0 rounded-full ${n.read_at ? 'bg-transparent' : 'bg-lavender'}`} />
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm ${n.read_at ? 'text-muted' : 'font-medium'}`}>
                      <span className="sr-only">{n.read_at ? 'Read: ' : 'Unread: '}</span>
                      {message.text}
                    </p>
                    <time dateTime={n.created_at} className="text-xs text-muted">{formatDateTime(n.created_at)}</time>
                  </div>
                  <Link to={message.to} onClick={() => !n.read_at && markOne(n.id)} className="shrink-0 text-sm font-medium underline-offset-4 hover:underline">
                    View
                  </Link>
                  <button
                    type="button"
                    onClick={() => deleteMutation.mutate([n.id])}
                    disabled={deleteMutation.isPending}
                    aria-label={`Delete notification: ${message.text}`}
                    title="Delete"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control text-muted hover:bg-surface-muted hover:text-error disabled:opacity-50"
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
        open={confirmDeleteAll}
        title="Delete all notifications?"
        description="All of your notifications will be removed. Friend requests stay in Friends, and shared reviewers stay in your library."
        confirmLabel="Delete all"
        danger
        loading={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate(undefined)}
        onCancel={() => setConfirmDeleteAll(false)}
      />
    </div>
  );
}