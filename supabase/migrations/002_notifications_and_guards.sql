-- REVI migration 002
-- Adds notification triggers, a visibility guard, and tightens function execution.
-- Safe to run on the schema from revi_schema_v2.sql. Does not drop or rewrite data.
-- Run as the postgres role in the SQL Editor, once.

do $$
begin
  if current_setting('transaction_read_only') = 'on' then
    raise exception 'Session is read-only. Connect as postgres with write access.';
  end if;
end;
$$;

-- Friend requests and acceptances create notifications automatically.
create or replace function public.notify_friendship_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' and new.status = 'pending' then
    insert into public.notifications (recipient_id, actor_id, type, friendship_id)
    values (new.addressee_id, new.requester_id, 'friend_request', new.id);
  elsif tg_op = 'UPDATE' and new.status = 'accepted' and old.status is distinct from 'accepted' then
    insert into public.notifications (recipient_id, actor_id, type, friendship_id)
    values (new.requester_id, new.addressee_id, 'friend_accepted', new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists friendships_notify on public.friendships;
create trigger friendships_notify
  after insert or update on public.friendships
  for each row execute function public.notify_friendship_change();

-- Sharing a reviewer notifies the person it was shared with.
create or replace function public.notify_reviewer_shared()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_uuid uuid;
begin
  select owner_id into owner_uuid from public.reviewers where id = new.reviewer_id;
  insert into public.notifications (recipient_id, actor_id, type, reviewer_id)
  values (new.shared_with, owner_uuid, 'reviewer_shared', new.reviewer_id);
  return new;
end;
$$;

drop trigger if exists reviewer_shares_notify on public.reviewer_shares;
create trigger reviewer_shares_notify
  after insert on public.reviewer_shares
  for each row execute function public.notify_reviewer_shared();

-- Only the owner can change visibility. Editors can change content but not who can see it.
create or replace function public.guard_reviewer_visibility()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.visibility is distinct from old.visibility and auth.uid() is distinct from old.owner_id then
    raise exception 'Only the owner can change who can see this reviewer';
  end if;
  return new;
end;
$$;

drop trigger if exists reviewers_guard_visibility on public.reviewers;
create trigger reviewers_guard_visibility
  before update on public.reviewers
  for each row execute function public.guard_reviewer_visibility();

-- Trigger-only functions don't need to be callable through the API.
revoke execute on function public.notify_friendship_change() from public, anon, authenticated;
revoke execute on function public.notify_reviewer_shared() from public, anon, authenticated;
revoke execute on function public.guard_reviewer_visibility() from public, anon, authenticated;
