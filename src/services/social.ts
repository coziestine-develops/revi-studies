import { invokeFunction } from '../lib/functions';
import { supabase } from '../lib/supabase';
import { getProfiles } from './reviewers';
import type { AppNotification, Friendship, Profile } from '../types/database';

export interface FriendshipView {
  id: string;
  status: Friendship['status'];
  direction: 'incoming' | 'outgoing' | 'friend';
  other: Profile | undefined;
}

export async function searchProfiles(term: string, selfId: string): Promise<Profile[]> {
  const cleaned = term.replace(/[%_,()*\\]/g, '').trim();
  if (cleaned.length < 2) return [];
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, full_name, school, course, avatar_url')
    .or(`username.ilike.%${cleaned}%,full_name.ilike.%${cleaned}%`)
    .neq('id', selfId)
    .limit(10);
  if (error) throw error;
  return (data ?? []) as Profile[];
}

export async function listFriendships(userId: string): Promise<FriendshipView[]> {
  const { data, error } = await supabase
    .from('friendships')
    .select('*')
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
    .order('created_at', { ascending: false });
  if (error) throw error;

  const rows = ((data ?? []) as Friendship[]).filter((row) => row.status !== 'rejected');
  const otherIds = rows.map((row) => (row.requester_id === userId ? row.addressee_id : row.requester_id));
  const profiles = await getProfiles([...new Set(otherIds)]);
  const byId = new Map(profiles.map((profile) => [profile.id, profile]));

  return rows.map((row) => {
    const incoming = row.addressee_id === userId;
    const otherId = incoming ? row.requester_id : row.addressee_id;
    const direction: FriendshipView['direction'] =
      row.status === 'accepted' ? 'friend' : incoming ? 'incoming' : 'outgoing';
    return { id: row.id, status: row.status, direction, other: byId.get(otherId) };
  });
}

export async function sendFriendRequest(requesterId: string, addresseeId: string): Promise<void> {
  const { error } = await supabase
    .from('friendships')
    .insert({ requester_id: requesterId, addressee_id: addresseeId, status: 'pending' });
  if (error) {
    if (error.code === '23505') throw new Error('You already have a friend request with this person.');
    throw error;
  }
}

export async function respondToRequest(id: string, accept: boolean): Promise<void> {
  if (!accept) {
    // Declined requests are removed, otherwise they keep showing up as pending.
    const { error } = await supabase.from('friendships').delete().eq('id', id);
    if (error) throw error;
    return;
  }
  const { error } = await supabase
    .from('friendships')
    .update({ status: 'accepted', responded_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function removeFriendship(id: string): Promise<void> {
  const { error } = await supabase.from('friendships').delete().eq('id', id);
  if (error) throw error;
}

/** A notification with the names needed to write a readable message. */
export interface NotificationView extends AppNotification {
  actorName: string | null;
  reviewerTitle: string | null;
  eventTitle: string | null;
}

/**
 * Adds actor names and reviewer titles to notifications. Lookups are separate queries
 * and failures are ignored, so a missing name falls back to generic wording instead of
 * hiding the notification.
 */
export async function describeNotifications(rows: AppNotification[]): Promise<NotificationView[]> {
  const actorIds = [...new Set(rows.map((r) => r.actor_id).filter((id): id is string => !!id))];
  const reviewerIds = [...new Set(rows.map((r) => r.reviewer_id).filter((id): id is string => !!id))];
  const eventIds = [...new Set(rows.map((r) => r.calendar_event_id).filter((id): id is string => !!id))];

  const [profilesResult, reviewersResult, eventsResult] = await Promise.all([
    actorIds.length
      ? supabase.from('profiles').select('id, username, full_name').in('id', actorIds)
      : Promise.resolve({ data: [], error: null }),
    reviewerIds.length
      ? supabase.from('reviewers').select('id, title').in('id', reviewerIds)
      : Promise.resolve({ data: [], error: null }),
    eventIds.length
      ? supabase.from('calendar_events').select('id, title').in('id', eventIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (profilesResult.error) console.error('Notification actor lookup failed:', profilesResult.error.message);
  if (reviewersResult.error) console.error('Notification reviewer lookup failed:', reviewersResult.error.message);
  if (eventsResult.error) console.error('Notification event lookup failed:', eventsResult.error.message);

  const nameById = new Map<string, string>();
  for (const profile of (profilesResult.data ?? []) as { id: string; username: string | null; full_name: string | null }[]) {
    const name = profile.full_name?.trim() || profile.username?.trim();
    if (name) nameById.set(profile.id, name);
  }
  const titleById = new Map<string, string>();
  for (const reviewer of (reviewersResult.data ?? []) as { id: string; title: string }[]) {
    titleById.set(reviewer.id, reviewer.title);
  }
  const eventTitleById = new Map<string, string>();
  for (const event of (eventsResult.data ?? []) as { id: string; title: string }[]) {
    eventTitleById.set(event.id, event.title);
  }

  return rows.map((row) => ({
    ...row,
    actorName: row.actor_id ? nameById.get(row.actor_id) ?? null : null,
    reviewerTitle: row.reviewer_id ? titleById.get(row.reviewer_id) ?? null : null,
    eventTitle: row.calendar_event_id ? eventTitleById.get(row.calendar_event_id) ?? null : null,
  }));
}

export async function listNotifications(userId: string): Promise<NotificationView[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('recipient_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return describeNotifications((data ?? []) as AppNotification[]);
}

export async function markNotificationsRead(userId: string, ids?: string[]): Promise<void> {
  let query = supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('recipient_id', userId).is('read_at', null);
  if (ids && ids.length > 0) query = query.in('id', ids);
  const { error } = await query;
  if (error) throw error;
}

/**
 * Deletes selected notifications, or all of them when no ids are given.
 * Returns how many were removed. Row Level Security limits deletes to your own notifications.
 */
export async function deleteNotifications(userId: string, ids?: string[]): Promise<number> {
  let query = supabase.from('notifications').delete().eq('recipient_id', userId).select('id');
  if (ids && ids.length > 0) query = query.in('id', ids);
  const { data, error } = await query;
  if (error) throw error;
  return data?.length ?? 0;
}

export async function getMyProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, full_name, school, course, avatar_url')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return (data as Profile | null) ?? null;
}

export async function updateMyProfile(userId: string, values: { full_name: string; username: string; school: string; course: string }): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({
      full_name: values.full_name || null,
      username: values.username || null,
      school: values.school || null,
      course: values.course || null,
    })
    .eq('id', userId);
  if (error) {
    if (error.code === '23505') throw new Error('That username is already taken.');
    throw error;
  }
}

export async function deleteAccount(): Promise<void> {
  await invokeFunction<{ ok: boolean }>('delete-account', {});
}