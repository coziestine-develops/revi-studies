-- REVI migration 007: direct messages between friends, and a personal calendar with reminders.
-- Safe to re-run. Does not change existing data.
-- Run as the postgres role in the SQL Editor, once.
do $$
begin
  if current_setting('transaction_read_only') = 'on' then
    raise exception 'Session is read-only. Connect as postgres with write access.';
  end if;
end;
$$;

-- =============================================================================
-- 1. DIRECT MESSAGES
-- Only accepted friends can message each other. Each person can read their own
-- conversations, mark incoming messages as read, and delete messages they sent.
-- =============================================================================

create table if not exists public.direct_messages (
  id            uuid primary key default gen_random_uuid(),
  sender_id     uuid not null references public.profiles (id) on delete cascade,
  recipient_id  uuid not null references public.profiles (id) on delete cascade,
  content       text not null check (char_length(btrim(content)) between 1 and 2000),
  read_at       timestamptz,
  created_at    timestamptz not null default now(),
  check (sender_id <> recipient_id)
);

create index if not exists direct_messages_sender_idx    on public.direct_messages (sender_id, recipient_id, created_at desc);
create index if not exists direct_messages_recipient_idx on public.direct_messages (recipient_id, created_at desc);
create index if not exists direct_messages_unread_idx    on public.direct_messages (recipient_id) where read_at is null;

alter table public.direct_messages enable row level security;

drop policy if exists "direct_messages_select_party" on public.direct_messages;
create policy "direct_messages_select_party" on public.direct_messages
  for select to authenticated
  using (sender_id = (select auth.uid()) or recipient_id = (select auth.uid()));

drop policy if exists "direct_messages_insert_friend" on public.direct_messages;
create policy "direct_messages_insert_friend" on public.direct_messages
  for insert to authenticated
  with check (sender_id = (select auth.uid()) and public.are_friends(sender_id, recipient_id));

drop policy if exists "direct_messages_mark_read" on public.direct_messages;
create policy "direct_messages_mark_read" on public.direct_messages
  for update to authenticated
  using (recipient_id = (select auth.uid()))
  with check (recipient_id = (select auth.uid()));

drop policy if exists "direct_messages_delete_sender" on public.direct_messages;
create policy "direct_messages_delete_sender" on public.direct_messages
  for delete to authenticated
  using (sender_id = (select auth.uid()));

-- Recipients may only set read_at. The message text and who it was sent to can't be edited.
create or replace function public.guard_direct_message_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (new.sender_id, new.recipient_id, new.content, new.created_at)
     is distinct from (old.sender_id, old.recipient_id, old.content, old.created_at) then
    raise exception 'Only the read time of a message can be changed';
  end if;
  return new;
end;
$$;

drop trigger if exists direct_messages_guard_update on public.direct_messages;
create trigger direct_messages_guard_update
  before update on public.direct_messages
  for each row execute function public.guard_direct_message_update();

revoke execute on function public.guard_direct_message_update() from public, anon, authenticated;

-- =============================================================================
-- 2. CALENDAR EVENTS WITH REMINDERS
-- Each person sees only their own events. reminder_minutes is how long before the
-- start to remind (0 = at start time, null = no reminder). remind_at is derived by trigger.
-- =============================================================================

create table if not exists public.calendar_events (
  id                uuid primary key default gen_random_uuid(),
  owner_id          uuid not null references public.profiles (id) on delete cascade,
  title             text not null check (char_length(btrim(title)) between 1 and 120),
  description       text check (description is null or char_length(description) <= 1000),
  starts_at         timestamptz not null,
  reminder_minutes  integer check (reminder_minutes is null or reminder_minutes between 0 and 10080),
  remind_at         timestamptz,
  reminder_sent_at  timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists calendar_events_owner_start_idx on public.calendar_events (owner_id, starts_at);
create index if not exists calendar_events_due_idx on public.calendar_events (remind_at)
  where reminder_sent_at is null and remind_at is not null;

create or replace function public.prepare_calendar_event()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.remind_at := case
    when new.reminder_minutes is null then null
    else new.starts_at - make_interval(mins => new.reminder_minutes)
  end;

  -- Changing the time or the reminder means the reminder should fire again.
  if tg_op = 'INSERT'
     or new.starts_at is distinct from old.starts_at
     or new.reminder_minutes is distinct from old.reminder_minutes then
    new.reminder_sent_at := null;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists calendar_events_prepare on public.calendar_events;
create trigger calendar_events_prepare
  before insert or update on public.calendar_events
  for each row execute function public.prepare_calendar_event();

revoke execute on function public.prepare_calendar_event() from public, anon, authenticated;

alter table public.calendar_events enable row level security;

drop policy if exists "calendar_events_owner" on public.calendar_events;
create policy "calendar_events_owner" on public.calendar_events
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

-- =============================================================================
-- 3. REMINDERS AS NOTIFICATIONS
-- =============================================================================

alter table public.notifications
  add column if not exists calendar_event_id uuid references public.calendar_events (id) on delete cascade;

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in ('friend_request', 'friend_accepted', 'reviewer_shared', 'collaboration', 'event_reminder'));

-- Sends a reminder notification for every event whose reminder time has passed.
-- Only the database owner can call this directly; the app uses process_my_reminders().
create or replace function public.dispatch_due_reminders(p_owner uuid default null)
returns table (reminder_event_id uuid, reminder_owner_id uuid, reminder_title text, reminder_starts_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  with due as (
    update public.calendar_events e
    set reminder_sent_at = now()
    where e.reminder_sent_at is null
      and e.remind_at is not null
      and e.remind_at <= now()
      and (p_owner is null or e.owner_id = p_owner)
    returning e.id, e.owner_id, e.title, e.starts_at
  ),
  notified as (
    insert into public.notifications (recipient_id, type, calendar_event_id)
    select d.owner_id, 'event_reminder', d.id from due d
    returning recipient_id
  )
  select d.id, d.owner_id, d.title, d.starts_at from due d;
end;
$$;

-- The signed-in user processes only their own reminders. Anonymous calls return nothing.
create or replace function public.process_my_reminders()
returns table (reminder_event_id uuid, reminder_owner_id uuid, reminder_title text, reminder_starts_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    return;
  end if;
  return query select * from public.dispatch_due_reminders((select auth.uid()));
end;
$$;

revoke execute on function public.dispatch_due_reminders(uuid) from public, anon, authenticated;
revoke execute on function public.process_my_reminders() from public, anon;
grant execute on function public.process_my_reminders() to authenticated;

-- =============================================================================
-- 4. REALTIME
-- =============================================================================

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'direct_messages'
  ) then
    alter publication supabase_realtime add table public.direct_messages;
  end if;
end;
$$;
