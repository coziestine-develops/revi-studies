import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Comments, Copy, Ellipsis, Reply, RotateCcw, Send, Trash2, Users, X } from '../icons';
import { useAuth } from '../contexts/AuthContext';
import { listFriendships } from '../services/social';
import {
  buildConversations,
  clearConversation,
  friendProfilesOf,
  hideMessageForMe,
  listClearedFriendIds,
  listMyMessages,
  listThread,
  markThreadRead,
  MESSAGE_MAX_LENGTH,
  messagePreview,
  profileName,
  sendMessage,
  unsendMessage,
} from '../services/messages';
import { errorMessage } from '../lib/format';
import { dayLabel } from '../lib/calendarDates';
import type { DirectMessage, Profile } from '../types/database';
import { Alert, inputClass } from '../components/common/Forms';
import { Button } from '../components/common/Button';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { EmptyState } from '../components/common/EmptyState';
import { Skeleton } from '../components/common/Skeleton';
import { UserAvatar } from '../components/common/UserAvatar';
import { menuItemClass } from '../components/common/Dropdown';
import { useToast } from '../components/common/Toast';

/** Messages closer together than this share one timestamp. */
const GROUP_GAP_MS = 5 * 60 * 1000;
/** Holding a message this long on a touch screen opens its actions. */
const LONG_PRESS_MS = 450;
/** A finger that moves this far is scrolling, not pressing. */
const PRESS_SLOP_PX = 10;
const MENU_WIDTH_PX = 224;

function timeOf(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function dayKeyOf(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/** Where the action menu sits. Phones get a bottom sheet, larger screens a menu beside the message. */
interface MenuState {
  message: DirectMessage;
  anchor: DOMRect | null;
}

interface PendingAction {
  kind: 'unsend' | 'hide';
  message: DirectMessage;
}

export default function MessagesPage() {
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = searchParams.get('with');
  const [draft, setDraft] = useState('');
  const [replyTo, setReplyTo] = useState<DirectMessage | null>(null);
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [pending, setPending] = useState<PendingAction | null>(null);
  /** The conversation waiting for a delete confirmation, from the list or the chat header. */
  const [deleteTarget, setDeleteTarget] = useState<Profile | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const draftRef = useRef<HTMLTextAreaElement>(null);

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

  const friends = useMemo(() => friendProfilesOf(friendsQuery.data ?? []), [friendsQuery.data]);
  const conversations = useMemo(
    () => buildConversations(friends, messagesQuery.data ?? [], userId, clearedQuery.data),
    [friends, messagesQuery.data, clearedQuery.data, userId],
  );

  const selectedFriend = friends.find((friend) => friend.id === selectedId) ?? null;
  const friendName = selectedFriend ? profileName(selectedFriend) : 'them';

  const threadQuery = useQuery({
    queryKey: ['messages', userId, 'thread', selectedId],
    queryFn: () => listThread(userId, selectedId!),
    enabled: !!userId && !!selectedFriend,
  });
  const thread = threadQuery.data ?? [];

  const hasUnreadFromSelected = !!thread.some((m) => m.recipient_id === userId && !m.read_at);

  // Opening a conversation marks what the friend sent as read.
  useEffect(() => {
    if (!selectedId || !hasUnreadFromSelected) return;
    markThreadRead(userId, selectedId)
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ['messages', userId] });
        queryClient.invalidateQueries({ queryKey: ['messages-unread', userId] });
        queryClient.invalidateQueries({ queryKey: ['notifications', userId] });
        queryClient.invalidateQueries({ queryKey: ['notifications-unread', userId] });
      })
      .catch(() => {
        // The unread marker stays until the next attempt.
      });
  }, [selectedId, hasUnreadFromSelected, userId, queryClient]);

  // Switching conversations clears any half-finished reply and open menu.
  useEffect(() => {
    setReplyTo(null);
    setMenu(null);
    setDeleteTarget(null);
  }, [selectedId]);

  // Keep the newest message in view.
  const messageCount = thread.length;
  useEffect(() => {
    if (threadRef.current) threadRef.current.scrollTop = threadRef.current.scrollHeight;
  }, [messageCount, selectedId]);

  const refreshMessages = () => {
    queryClient.invalidateQueries({ queryKey: ['messages', userId] });
    queryClient.invalidateQueries({ queryKey: ['messages-unread', userId] });
  };

  const sendMutation = useMutation({
    mutationFn: (text: string) => sendMessage(userId, selectedId!, text, replyTo?.id ?? null),
    onSuccess: () => {
      setDraft('');
      setReplyTo(null);
      refreshMessages();
    },
  });

  const unsendMutation = useMutation({
    mutationFn: (id: string) => unsendMessage(id),
    onSuccess: refreshMessages,
  });

  const hideMutation = useMutation({
    mutationFn: (id: string) => hideMessageForMe(userId, id),
    onSuccess: refreshMessages,
  });

  // Deletes one conversation for this person. Used by the list row and the chat header.
  const deleteConversationMutation = useMutation({
    mutationFn: (friendId: string) => clearConversation(friendId),
    onSuccess: (_data, friendId) => {
      setDeleteTarget(null);
      if (friendId === selectedId) {
        // Like Messenger, the open chat closes once it's deleted.
        setReplyTo(null);
        setSearchParams({});
      }
      refreshMessages();
      toast('Conversation deleted.');
    },
    onError: (err) => {
      setDeleteTarget(null);
      toast(errorMessage(err), 'error');
    },
  });

  function submit(event?: FormEvent) {
    event?.preventDefault();
    if (!draft.trim() || sendMutation.isPending || !selectedId) return;
    sendMutation.mutate(draft);
  }

  // Enter sends. Shift+Enter adds a new line.
  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  }

  function startReply(message: DirectMessage) {
    setReplyTo(message);
    setMenu(null);
    draftRef.current?.focus();
  }

  async function copyText(message: DirectMessage) {
    setMenu(null);
    try {
      await navigator.clipboard.writeText(message.content);
      toast('Message copied.');
    } catch {
      toast("Couldn't copy this message.", 'error');
    }
  }

  function jumpTo(id: string) {
    const target = document.getElementById(`msg-${id}`);
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setHighlightId(id);
    window.setTimeout(() => setHighlightId((current) => (current === id ? null : current)), 1400);
  }

  async function confirmPending() {
    if (!pending) return;
    const { kind, message } = pending;
    try {
      if (kind === 'unsend') {
        await unsendMutation.mutateAsync(message.id);
        toast('Message unsent.');
      } else {
        await hideMutation.mutateAsync(message.id);
        toast('Message removed for you.');
      }
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setPending(null);
    }
  }

  const listError = messagesQuery.isError ? errorMessage(messagesQuery.error) : null;
  const inThread = !!selectedId;
  const busy = unsendMutation.isPending || hideMutation.isPending;

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Messages</h1>
        <p className="mt-1 text-sm text-muted">Chat with your friends.</p>
      </header>

      {listError && <Alert>{listError}</Alert>}
      {friendsQuery.isError && <Alert>Couldn't load friends: {errorMessage(friendsQuery.error)}</Alert>}
      {friendsQuery.isLoading && <Skeleton className="h-64 w-full" />}

      {!friendsQuery.isLoading && friends.length === 0 && (
        <div className="rounded-card border border-border bg-surface p-5 shadow-sm">
          <EmptyState
            icon={Users}
            title="No friends to message yet"
            description="Add a classmate as a friend first. Once they accept, you can chat here."
            action={<Link to="/friends" className="text-sm font-medium underline underline-offset-4">Find people</Link>}
          />
        </div>
      )}

      {friends.length > 0 && (
        <div className="grid h-[calc(100dvh-13rem)] min-h-[420px] overflow-hidden rounded-card border border-border bg-surface shadow-sm md:h-[calc(100dvh-12rem)] md:grid-cols-[minmax(200px,260px)_minmax(0,1fr)] lg:grid-cols-[280px_minmax(0,1fr)]">
          {/* Conversation list. On phones it hides while a chat is open. */}
          <nav
            aria-label="Conversations"
            className={`${inThread ? 'hidden md:block' : 'block'} min-h-0 overflow-y-auto border-r border-border`}
          >
            <ul className="p-2">
              {conversations.map(({ friend, last, unread }) => {
                const active = friend.id === selectedId;
                return (
                  <li key={friend.id} className="group flex items-center">
                    <Link
                      to={`/messages?with=${friend.id}`}
                      aria-current={active ? 'true' : undefined}
                      className={`flex min-w-0 flex-1 items-center gap-3 rounded-control px-3 py-2.5 transition-colors ${
                        active ? 'bg-surface-muted' : 'hover:bg-surface-muted'
                      }`}
                    >
                      <UserAvatar url={friend.avatar_url} name={profileName(friend)} size="h-10 w-10" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className={`truncate text-sm ${unread > 0 ? 'font-semibold' : 'font-medium'}`}>{profileName(friend)}</p>
                          {unread > 0 && (
                            <span className="shrink-0 rounded-full bg-lavender px-1.5 text-xs font-semibold text-on-accent">
                              {unread}<span className="sr-only"> unread</span>
                            </span>
                          )}
                        </div>
                        <p className="truncate text-xs text-muted">
                          {last ? messagePreview(last, userId) : 'No messages yet'}
                        </p>
                      </div>
                    </Link>
                    {/* Hover on desktop, always visible on touch screens. */}
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(friend)}
                      aria-label={`Delete conversation with ${profileName(friend)}`}
                      title="Delete conversation"
                      className="mr-1 shrink-0 rounded-control p-2 text-muted opacity-0 transition-opacity hover:bg-surface-muted hover:text-error focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Chat */}
          <section className={`${inThread ? 'flex' : 'hidden md:flex'} min-h-0 min-w-0 flex-col`} aria-label="Conversation">
            {!selectedFriend && (
              <div className="flex flex-1 items-center justify-center p-6">
                <EmptyState icon={Comments} title="Pick a conversation" description="Choose a friend to see your messages." />
              </div>
            )}

            {selectedFriend && (
              <>
                <header className="flex items-center gap-3 border-b border-border px-3 py-3">
                  <Link to="/messages" aria-label="Back to conversations" className="rounded-control p-2 text-muted hover:bg-surface-muted md:hidden">
                    <ArrowLeft className="h-4 w-4" aria-hidden />
                  </Link>
                  <UserAvatar url={selectedFriend.avatar_url} name={friendName} size="h-9 w-9" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{friendName}</p>
                    {selectedFriend.username && <p className="truncate text-xs text-muted">@{selectedFriend.username}</p>}
                  </div>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(selectedFriend)}
                    aria-label="Delete chat"
                    title="Delete chat"
                    className="shrink-0 rounded-control p-2 text-muted hover:bg-surface-muted hover:text-error"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                </header>

                <div ref={threadRef} className="min-h-0 flex-1 overflow-y-auto px-3 py-4 md:px-5" aria-live="polite">
                  {threadQuery.isLoading && <Skeleton className="h-24 w-full" />}
                  {threadQuery.isError && <Alert>Couldn't load messages: {errorMessage(threadQuery.error)}</Alert>}
                  {threadQuery.data?.length === 0 && (
                    <p className="py-10 text-center text-sm text-muted">No messages yet. Say hello.</p>
                  )}
                  <MessageList
                    messages={thread}
                    userId={userId}
                    friendName={friendName}
                    highlightId={highlightId}
                    onOpenMenu={(message, anchor) => setMenu({ message, anchor })}
                    onJumpTo={jumpTo}
                  />
                </div>

                <form onSubmit={submit} className="border-t border-border p-3">
                  {sendMutation.isError && <div className="mb-2"><Alert>{errorMessage(sendMutation.error)}</Alert></div>}
                  {replyTo && (
                    <div className="mb-2 flex items-start gap-2 rounded-control border-l-2 border-brand bg-surface-muted px-3 py-2 text-xs">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold">Replying to {replyTo.sender_id === userId ? 'yourself' : friendName}</p>
                        <p className="truncate text-muted">{replyTo.unsent_at ? 'Message unsent' : replyTo.content}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setReplyTo(null)}
                        aria-label="Cancel reply"
                        className="shrink-0 rounded-control p-1 text-muted hover:bg-surface"
                      >
                        <X className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    </div>
                  )}
                  <div className="flex items-end gap-2">
                    <label className="sr-only" htmlFor="message-draft">Message {friendName}</label>
                    <textarea
                      id="message-draft"
                      ref={draftRef}
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      onKeyDown={handleKeyDown}
                      rows={1}
                      maxLength={MESSAGE_MAX_LENGTH}
                      placeholder="Message"
                      className={`${inputClass} max-h-32 min-h-[44px] resize-none rounded-2xl py-2.5`}
                    />
                    <Button
                      type="submit"
                      variant="primary"
                      loading={sendMutation.isPending}
                      disabled={!draft.trim()}
                      aria-label="Send message"
                      className="h-11 w-11 shrink-0 rounded-full px-0"
                    >
                      <Send className="h-4 w-4" aria-hidden />
                    </Button>
                  </div>
                </form>
              </>
            )}
          </section>
        </div>
      )}

      {selectedId && !selectedFriend && friendsQuery.isSuccess && (
        <p className="text-sm text-muted">This conversation isn't available. You may no longer be friends with this person.</p>
      )}

      {menu && (
        <MessageMenu
          message={menu.message}
          mine={menu.message.sender_id === userId}
          anchor={menu.anchor}
          busy={busy}
          onClose={() => setMenu(null)}
          onReply={() => startReply(menu.message)}
          onCopy={() => copyText(menu.message)}
          onUnsend={() => {
            setPending({ kind: 'unsend', message: menu.message });
            setMenu(null);
          }}
          onHide={() => {
            setPending({ kind: 'hide', message: menu.message });
            setMenu(null);
          }}
        />
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete this conversation?"
        description={
          deleteTarget
            ? `All messages with ${profileName(deleteTarget)} will be removed from your chat. ${profileName(deleteTarget)} still has them. The conversation comes back when a new message arrives.`
            : ''
        }
        confirmLabel="Delete conversation"
        danger
        loading={deleteConversationMutation.isPending}
        onConfirm={() => deleteTarget && deleteConversationMutation.mutate(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
      />
      <ConfirmDialog
        open={pending?.kind === 'unsend'}
        title="Unsend this message?"
        description="It will be removed for everyone in this conversation. Its text can't be recovered."
        confirmLabel="Unsend"
        danger
        loading={unsendMutation.isPending}
        onConfirm={confirmPending}
        onCancel={() => setPending(null)}
      />
      <ConfirmDialog
        open={pending?.kind === 'hide'}
        title="Remove this message for you?"
        description={`Only you won't see it. ${friendName} will still have it in their chat.`}
        confirmLabel="Remove for me"
        danger
        loading={hideMutation.isPending}
        onConfirm={confirmPending}
        onCancel={() => setPending(null)}
      />
    </div>
  );
}

/**
 * Chat bubbles. Consecutive messages from the same person are grouped. A day divider
 * appears when the date changes, and a timestamp appears at the end of each group.
 * Touch: hold a bubble. Mouse: right-click it or use the ... button. Both open the same actions.
 */
function MessageList({
  messages,
  userId,
  friendName,
  highlightId,
  onOpenMenu,
  onJumpTo,
}: {
  messages: DirectMessage[];
  userId: string;
  friendName: string;
  highlightId: string | null;
  onOpenMenu: (message: DirectMessage, anchor: DOMRect | null) => void;
  onJumpTo: (id: string) => void;
}) {
  const byId = useMemo(() => new Map(messages.map((m) => [m.id, m])), [messages]);

  return (
    <div className="flex flex-col">
      {messages.map((message, index) => {
        const previous = messages[index - 1];
        const next = messages[index + 1];
        const mine = message.sender_id === userId;

        const newDay = !previous || dayKeyOf(previous.created_at) !== dayKeyOf(message.created_at);
        const startsGroup =
          newDay ||
          previous.sender_id !== message.sender_id ||
          new Date(message.created_at).getTime() - new Date(previous.created_at).getTime() > GROUP_GAP_MS;
        const endsGroup =
          !next ||
          next.sender_id !== message.sender_id ||
          new Date(next.created_at).getTime() - new Date(message.created_at).getTime() > GROUP_GAP_MS;

        return (
          <div key={message.id} id={`msg-${message.id}`}>
            {newDay && (
              <div className="my-4 flex justify-center">
                <span className="rounded-full bg-surface-muted px-3 py-0.5 text-xs text-muted">{dayLabel(new Date(message.created_at))}</span>
              </div>
            )}

            <div className={`group flex flex-col ${mine ? 'items-end' : 'items-start'} ${startsGroup && !newDay ? 'mt-3' : 'mt-0.5'}`}>
              <MessageBubble
                message={message}
                mine={mine}
                startsGroup={startsGroup}
                friendName={friendName}
                original={message.reply_to_id ? byId.get(message.reply_to_id) ?? null : null}
                hasOriginal={!!message.reply_to_id}
                userId={userId}
                highlighted={highlightId === message.id}
                onOpenMenu={onOpenMenu}
                onJumpTo={onJumpTo}
              />

              {endsGroup && (
                <time dateTime={message.created_at} className="mt-1 px-1 text-[11px] text-muted">
                  {timeOf(message.created_at)}
                  {mine && message.read_at && !message.unsent_at ? ' · Seen' : ''}
                </time>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MessageBubble({
  message,
  mine,
  startsGroup,
  friendName,
  original,
  hasOriginal,
  userId,
  highlighted,
  onOpenMenu,
  onJumpTo,
}: {
  message: DirectMessage;
  mine: boolean;
  startsGroup: boolean;
  friendName: string;
  original: DirectMessage | null;
  hasOriginal: boolean;
  userId: string;
  highlighted: boolean;
  onOpenMenu: (message: DirectMessage, anchor: DOMRect | null) => void;
  onJumpTo: (id: string) => void;
}) {
  const pressTimer = useRef<number | null>(null);
  const pressStart = useRef<{ x: number; y: number } | null>(null);
  const unsent = !!message.unsent_at;

  function cancelPress() {
    if (pressTimer.current !== null) window.clearTimeout(pressTimer.current);
    pressTimer.current = null;
    pressStart.current = null;
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType !== 'touch' || unsent) return;
    pressStart.current = { x: event.clientX, y: event.clientY };
    const element = event.currentTarget;
    pressTimer.current = window.setTimeout(() => {
      pressTimer.current = null;
      pressStart.current = null;
      navigator.vibrate?.(8);
      onOpenMenu(message, element.getBoundingClientRect());
    }, LONG_PRESS_MS);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const start = pressStart.current;
    if (!start) return;
    if (Math.abs(event.clientX - start.x) > PRESS_SLOP_PX || Math.abs(event.clientY - start.y) > PRESS_SLOP_PX) {
      cancelPress();
    }
  }

  const bubbleShape = mine
    ? startsGroup ? 'rounded-2xl rounded-br-md' : 'rounded-2xl rounded-r-md'
    : startsGroup ? 'rounded-2xl rounded-bl-md' : 'rounded-2xl rounded-l-md';

  const bubble = unsent ? (
    <div className="rounded-2xl border border-dashed border-border px-3.5 py-2 text-sm italic text-muted">
      {mine ? 'You unsent a message' : `${friendName} unsent a message`}
    </div>
  ) : (
    <div
      title={new Date(message.created_at).toLocaleString()}
      onContextMenu={(event) => {
        event.preventDefault();
        onOpenMenu(message, event.currentTarget.getBoundingClientRect());
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={cancelPress}
      onPointerLeave={cancelPress}
      onPointerCancel={cancelPress}
      className={`select-none whitespace-pre-wrap break-words px-3.5 py-2 text-sm leading-relaxed transition-shadow [-webkit-touch-callout:none] md:select-text ${bubbleShape} ${
        mine ? 'bg-primary text-primary-foreground' : 'border border-border bg-surface-muted'
      } ${highlighted ? 'ring-2 ring-brand ring-offset-2 ring-offset-background' : ''}`}
    >
      {hasOriginal && (
        <QuoteChip
          original={original}
          mine={mine}
          userId={userId}
          friendName={friendName}
          onJumpTo={onJumpTo}
        />
      )}
      {message.content}
    </div>
  );

  return (
    <div className={`flex max-w-[85%] items-center gap-1.5 md:max-w-[70%] ${mine ? 'flex-row-reverse' : ''}`}>
      {bubble}
      {!unsent && (
        <button
          type="button"
          onClick={(event) => {
            const bubble = event.currentTarget.previousElementSibling as HTMLElement | null;
            onOpenMenu(message, bubble?.getBoundingClientRect() ?? null);
          }}
          aria-label="Message options"
          className="hidden shrink-0 rounded-full p-1.5 text-muted opacity-0 transition-opacity hover:bg-surface-muted hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100 md:inline-flex"
        >
          <Ellipsis className="h-4 w-4" aria-hidden />
        </button>
      )}
    </div>
  );
}

/** The small quote above a reply. Tapping it scrolls to the message it quotes. */
function QuoteChip({
  original,
  mine,
  userId,
  friendName,
  onJumpTo,
}: {
  original: DirectMessage | null;
  mine: boolean;
  userId: string;
  friendName: string;
  onJumpTo: (id: string) => void;
}) {
  if (!original) {
    return <p className="mb-1 text-xs italic opacity-70">Original message unavailable</p>;
  }
  const author = original.sender_id === userId ? 'You' : friendName;
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onJumpTo(original.id);
      }}
      className={`mb-1.5 block w-full rounded-lg border-l-2 px-2.5 py-1 text-left text-xs ${
        mine ? 'border-primary-foreground/60 bg-primary-foreground/10' : 'border-brand bg-surface'
      }`}
    >
      <span className="block font-semibold">{author}</span>
      <span className="block truncate opacity-80">{original.unsent_at ? 'Message unsent' : original.content}</span>
    </button>
  );
}

/**
 * Action menu for one message. On phones it's a bottom sheet. On larger screens it
 * sits next to the message. It closes on Escape, on a tap outside, and after an action.
 */
function MessageMenu({
  message,
  mine,
  anchor,
  busy,
  onClose,
  onReply,
  onCopy,
  onUnsend,
  onHide,
}: {
  message: DirectMessage;
  mine: boolean;
  anchor: DOMRect | null;
  busy: boolean;
  onClose: () => void;
  onReply: () => void;
  onCopy: () => void;
  onUnsend: () => void;
  onHide: () => void;
}) {
  const isDesktop = typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches;
  // The finger that opened a long-press menu can lift onto the backdrop. Ignore taps that
  // land in the first moment so the menu doesn't close right after it opens.
  const openedAt = useRef(Date.now());

  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  let style: CSSProperties | undefined;
  if (isDesktop && anchor) {
    const estimatedHeight = 230;
    const below = anchor.bottom + 8;
    const top = below + estimatedHeight > window.innerHeight ? Math.max(8, anchor.top - estimatedHeight - 8) : below;
    const left = mine
      ? Math.max(8, anchor.right - MENU_WIDTH_PX)
      : Math.min(anchor.left, window.innerWidth - MENU_WIDTH_PX - 8);
    style = { top, left, width: MENU_WIDTH_PX };
  }

  return (
    <div
      className={`fixed inset-0 z-50 ${isDesktop ? '' : 'flex items-end bg-overlay/50'}`}
      onClick={() => {
        if (Date.now() - openedAt.current > 350) onClose();
      }}
    >
      <div
        role="menu"
        aria-label="Message options"
        style={style}
        onClick={(event) => event.stopPropagation()}
        className={
          isDesktop
            ? 'fixed rounded-control border border-border bg-surface-raised p-1.5 shadow-lg'
            : 'mx-3 mb-[calc(1rem+env(safe-area-inset-bottom))] w-full rounded-card border border-border bg-surface p-2 shadow-lg'
        }
      >
        {!isDesktop && (
          <p className="truncate px-3 pb-2 pt-1 text-xs text-muted">{message.content}</p>
        )}
        <button type="button" role="menuitem" onClick={onReply} disabled={busy} className={menuItemClass}>
          <Reply className="h-4 w-4" aria-hidden /> Reply
        </button>
        {message.content && (
          <button type="button" role="menuitem" onClick={onCopy} disabled={busy} className={menuItemClass}>
            <Copy className="h-4 w-4" aria-hidden /> Copy text
          </button>
        )}
        {mine && (
          <button type="button" role="menuitem" onClick={onUnsend} disabled={busy} className={`${menuItemClass} text-error`}>
            <RotateCcw className="h-4 w-4" aria-hidden /> Unsend
          </button>
        )}
        <button type="button" role="menuitem" onClick={onHide} disabled={busy} className={`${menuItemClass} text-error`}>
          <Trash2 className="h-4 w-4" aria-hidden /> Remove for me
        </button>
      </div>
    </div>
  );
}