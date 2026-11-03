import { supabase } from '../lib/supabase';
import type { DirectMessage, Profile } from '../types/database';

export interface Conversation {
  friend: Profile;
  last: DirectMessage | null;
  unread: number;
}

export const MESSAGE_MAX_LENGTH = 2000;

const MESSAGE_COLUMNS = 'id, sender_id, recipient_id, content, read_at, created_at, reply_to_id, unsent_at';

/** Profile name for display and sorting. */
export function profileName(profile: Profile): string {
  return profile.full_name || (profile.username ? `@${profile.username}` : 'Unknown user');
}

/**
 * The line shown for a message in a list or card. Unsent messages have no text,
 * so they get the same wording Messenger uses instead of an empty line.
 */
export function messagePreview(message: DirectMessage, userId: string): string {
  const mine = message.sender_id === userId;
  if (message.unsent_at) return mine ? 'You unsent a message' : 'Unsent a message';
  return mine ? `You: ${message.content}` : message.content;
}

/**
 * One entry per friend, newest conversation first. `messages` must be newest first,
 * as listMyMessages returns them. A friend whose chat was deleted and who has no newer
 * messages is left out, the way Messenger removes a deleted conversation from the list.
 */
export function buildConversations(
  friends: Profile[],
  messages: DirectMessage[],
  userId: string,
  clearedFriendIds: Set<string> = new Set(),
): Conversation[] {
  const byFriend = new Map<string, { last: DirectMessage | null; unread: number }>();
  for (const message of messages) {
    const otherId = message.sender_id === userId ? message.recipient_id : message.sender_id;
    const entry = byFriend.get(otherId) ?? { last: null, unread: 0 };
    if (!entry.last) entry.last = message;
    if (message.recipient_id === userId && !message.read_at) entry.unread += 1;
    byFriend.set(otherId, entry);
  }
  return friends
    .map((friend) => ({ friend, ...(byFriend.get(friend.id) ?? { last: null, unread: 0 }) }))
    .filter(({ friend, last }) => !(last === null && clearedFriendIds.has(friend.id)))
    .sort(
      (a, b) =>
        (b.last?.created_at ?? '').localeCompare(a.last?.created_at ?? '') ||
        profileName(a.friend).localeCompare(profileName(b.friend)),
    );
}

/** Accepted friends' profiles from a friendship list. */
export function friendProfilesOf(rows: { direction: string; other: Profile | undefined }[]): Profile[] {
  return rows.filter((row) => row.direction === 'friend' && row.other).map((row) => row.other as Profile);
}

function translateError(error: { code?: string; message: string }): Error {
  if (error.code === 'PGRST205' || /schema cache|could not find the table/i.test(error.message)) {
    return new Error(
      "Messaging isn't set up in this Supabase project yet. Run supabase/migrations/007_messages_and_calendar.sql, 010_messenger_message_actions.sql, and 011_delete_conversation.sql in the SQL Editor.",
    );
  }
  return new Error(error.message);
}

/** Message ids this person hid with "Remove for me". Those stay hidden only for them. */
async function listHiddenIds(userId: string): Promise<Set<string>> {
  const { data, error } = await supabase.from('direct_message_hides').select('message_id').eq('user_id', userId);
  if (error) throw translateError(error);
  return new Set((data ?? []).map((row: { message_id: string }) => row.message_id));
}

/**
 * When each person's chat was deleted for this user, keyed by friend id (ms since epoch).
 * Messages sent before that time are hidden. Newer messages show again.
 */
async function listClearTimes(userId: string): Promise<Map<string, number>> {
  const { data, error } = await supabase.from('direct_message_clears').select('friend_id, cleared_at').eq('user_id', userId);
  if (error) throw translateError(error);
  return new Map((data ?? []).map((row: { friend_id: string; cleared_at: string }) => [row.friend_id, new Date(row.cleared_at).getTime()]));
}

/** Friends whose chat this person has deleted. Used to hide deleted conversations from the list. */
export async function listClearedFriendIds(userId: string): Promise<Set<string>> {
  const { data, error } = await supabase.from('direct_message_clears').select('friend_id').eq('user_id', userId);
  if (error) throw translateError(error);
  return new Set((data ?? []).map((row: { friend_id: string }) => row.friend_id));
}

/** Whether this person should see a message, after "Remove for me" and "Delete chat". */
function isVisible(message: DirectMessage, userId: string, hidden: Set<string>, clears: Map<string, number>): boolean {
  if (hidden.has(message.id)) return false;
  const otherId = message.sender_id === userId ? message.recipient_id : message.sender_id;
  const clearedAt = clears.get(otherId);
  if (clearedAt !== undefined && new Date(message.created_at).getTime() <= clearedAt) return false;
  return true;
}

/** Recent messages in either direction, minus anything hidden or cleared. Used for previews and the dashboard. */
export async function listMyMessages(userId: string): Promise<DirectMessage[]> {
  const [{ data, error }, hidden, clears] = await Promise.all([
    supabase
      .from('direct_messages')
      .select(MESSAGE_COLUMNS)
      .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
      .order('created_at', { ascending: false })
      .limit(1000),
    listHiddenIds(userId),
    listClearTimes(userId),
  ]);
  if (error) throw translateError(error);
  return ((data ?? []) as DirectMessage[]).filter((message) => isVisible(message, userId, hidden, clears));
}

/** The conversation with one friend, oldest first, minus anything hidden or cleared for this person. */
export async function listThread(userId: string, otherId: string): Promise<DirectMessage[]> {
  const [{ data, error }, hidden, clears] = await Promise.all([
    supabase
      .from('direct_messages')
      .select(MESSAGE_COLUMNS)
      .or(`and(sender_id.eq.${userId},recipient_id.eq.${otherId}),and(sender_id.eq.${otherId},recipient_id.eq.${userId})`)
      .order('created_at', { ascending: false })
      .limit(200),
    listHiddenIds(userId),
    listClearTimes(userId),
  ]);
  if (error) throw translateError(error);
  return ((data ?? []) as DirectMessage[]).filter((message) => isVisible(message, userId, hidden, clears)).reverse();
}

export async function sendMessage(
  senderId: string,
  recipientId: string,
  content: string,
  replyToId: string | null = null,
): Promise<void> {
  const text = content.trim();
  if (!text) throw new Error('Write a message first.');
  if (text.length > MESSAGE_MAX_LENGTH) throw new Error(`Messages can be up to ${MESSAGE_MAX_LENGTH} characters.`);

  const { error } = await supabase.from('direct_messages').insert({
    sender_id: senderId,
    recipient_id: recipientId,
    content: text,
    reply_to_id: replyToId,
  });
  if (error) {
    // Row-level security refuses the insert when the two people aren't friends.
    if (error.code === '42501') throw new Error('You can only message people you are friends with.');
    throw translateError(error);
  }
}

/** Unsend a message you sent. It disappears for both people and shows as "Message unsent". */
export async function unsendMessage(id: string): Promise<void> {
  const { data, error } = await supabase
    .from('direct_messages')
    .update({ unsent_at: new Date().toISOString(), content: '' })
    .eq('id', id)
    .select('id');
  if (error) throw translateError(error);
  if (!data || data.length === 0) throw new Error("This message couldn't be unsent.");
}

/** Remove a message from your own view only. The other person still sees it. */
export async function hideMessageForMe(userId: string, id: string): Promise<void> {
  const { error } = await supabase.from('direct_message_hides').insert({ message_id: id, user_id: userId });
  if (error && error.code !== '23505') throw translateError(error); // 23505: already hidden
}

/**
 * Delete the whole chat with one friend, for this person only. The friend keeps their copy,
 * and messages sent after this point show up again.
 */
export async function clearConversation(friendId: string): Promise<void> {
  const { error } = await supabase.rpc('clear_conversation', { p_friend: friendId });
  if (error) throw translateError(error);
}

/** Marks everything a friend sent you as read. */
export async function markThreadRead(userId: string, otherId: string): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from('direct_messages')
    .update({ read_at: now })
    .eq('recipient_id', userId)
    .eq('sender_id', otherId)
    .is('read_at', null);
  if (error) throw translateError(error);

  // Opening the conversation also clears its message alert in the bell.
  const { error: alertError } = await supabase
    .from('notifications')
    .update({ read_at: now })
    .eq('recipient_id', userId)
    .eq('actor_id', otherId)
    .eq('type', 'new_message')
    .is('read_at', null);
  if (alertError) throw alertError;
}

/** Unread messages from friends, counting only what this person can still see. */
export async function countUnreadMessages(userId: string): Promise<number> {
  const messages = await listMyMessages(userId);
  return messages.filter((message) => message.recipient_id === userId && !message.read_at).length;
}