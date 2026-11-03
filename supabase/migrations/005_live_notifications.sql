-- REVI migration 005
-- 1. Notify collaborators when a shared reviewer's content changes.
-- 2. Publish notifications to Supabase Realtime so the app can show them live.
-- Safe to re-run. Does not change existing data.
-- Run as the postgres role in the SQL Editor, once.

-- Editing or uploading to a reviewer notifies the owner and everyone it's shared with,
-- except the person who made the change. Visibility changes don't count as edits.
create or replace function public.notify_reviewer_collaboration()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  rev_id uuid;
  actor uuid;
  owner_uuid uuid;
begin
  if tg_table_name = 'reviewer_files' then
    rev_id := new.reviewer_id;
    actor := new.uploaded_by;
  else
    if (new.title, new.subject, new.description, new.tags)
       is not distinct from (old.title, old.subject, old.description, old.tags) then
      return new;
    end if;
    rev_id := new.id;
    actor := auth.uid();
  end if;

  select owner_id into owner_uuid from public.reviewers where id = rev_id;

  insert into public.notifications (recipient_id, actor_id, type, reviewer_id)
  select distinct recipient, actor, 'collaboration', rev_id
  from (
    select owner_uuid as recipient
    union all
    select shared_with from public.reviewer_shares where reviewer_id = rev_id
  ) as recipients
  where recipient is not null and recipient is distinct from actor;

  return new;
end;
$$;

drop trigger if exists reviewer_files_notify_collaboration on public.reviewer_files;
create trigger reviewer_files_notify_collaboration
  after insert on public.reviewer_files
  for each row execute function public.notify_reviewer_collaboration();

drop trigger if exists reviewers_notify_collaboration on public.reviewers;
create trigger reviewers_notify_collaboration
  after update on public.reviewers
  for each row execute function public.notify_reviewer_collaboration();

revoke execute on function public.notify_reviewer_collaboration() from public, anon, authenticated;

-- Publish notifications so the app receives new rows live. RLS still limits each user to their own.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end;
$$;
