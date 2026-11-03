import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Comments } from '../../icons';
import { errorMessage } from '../../lib/format';
import { listFriendships } from '../../services/social';
import { buildConversations, friendProfilesOf, listClearedFriendIds, listMyMessages, messagePreview, profileName } from '../../services/messages';
import { Card } from '../common/Card';
import { EmptyState } from '../common/EmptyState';
import { Alert } from '../common/Forms';
import { Skeleton } from '../common/Skeleton';
import { UserAvatar } from '../common/UserAvatar';

const MAX_CONVERSATIONS = 3;

/** Latest conversations with friends, with unread counts. */
export function MessagesCard({ userId }: { userId: string }) {
  const friendsQuery = useQuery({
    queryKey: ['friendships', userId],
    queryFn: () => listFriendships(userId),
    enabled: !!userId,
  });
  const messagesQuery = useQuery({
    queryKey: ['messages', userId],
    queryFn: () => listMyMessages(userId),
    enabled: !!userId,
  });

  const clearedQuery = useQuery({
    queryKey: ['messages', userId, 'cleared'],
    queryFn: () => listClearedFriendIds(userId),
    enabled: !!userId,
  });

  const conversations = useMemo(
    () => buildConversations(friendProfilesOf(friendsQuery.data ?? []), messagesQuery.data ?? [], userId, clearedQuery.data),
    [friendsQuery.data, messagesQuery.data, clearedQuery.data, userId],
  );
  const totalUnread = conversations.reduce((sum, c) => sum + c.unread, 0);
  const loading = friendsQuery.isLoading || messagesQuery.isLoading;
  const error = friendsQuery.error ?? messagesQuery.error;

  return (
    <Card
      title="Messages"
      description={totalUnread > 0 ? `${totalUnread} unread` : 'Chat with your friends'}
      action={<Link to="/messages" className="text-sm font-medium underline-offset-4 hover:underline">Open</Link>}
    >
      {loading && <Skeleton className="h-20 w-full" />}
      {error && <Alert>{errorMessage(error)}</Alert>}

      {!loading && !error && conversations.length === 0 && (
        <EmptyState
          icon={Comments}
          title="No friends to message yet"
          description="Add a classmate, and your chats will show up here."
          action={<Link to="/friends" className="text-sm font-medium underline-offset-4 hover:underline">Find people</Link>}
        />
      )}

      {!loading && !error && conversations.length > 0 && (
        <ul className="divide-y divide-border">
          {conversations.slice(0, MAX_CONVERSATIONS).map(({ friend, last, unread }) => (
            <li key={friend.id}>
              <Link
                to={`/messages?with=${friend.id}`}
                className="flex items-center gap-3 rounded-control px-2 py-2.5 transition-colors hover:bg-surface-muted"
              >
                <UserAvatar url={friend.avatar_url} name={profileName(friend)} size="h-9 w-9" />
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-sm ${unread > 0 ? 'font-semibold' : 'font-medium'}`}>{profileName(friend)}</p>
                  <p className="truncate text-xs text-muted">
                    {last ? messagePreview(last, userId) : 'No messages yet'}
                  </p>
                </div>
                {unread > 0 && (
                  <span className="shrink-0 rounded-full bg-lavender px-1.5 text-xs font-semibold text-on-accent">
                    {unread}<span className="sr-only"> unread</span>
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}