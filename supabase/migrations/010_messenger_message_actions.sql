-- REVI migration 010: Messenger-style message actions.
--   * Reply: a message can quote another message in the same conversation.
--   * Unsend: the sender can take a message back for both people. Its text is removed
--     and it shows as "Message unsent", the way Messenger does.
--   * Delete for me: each person can hide a message from their own view only.
-- Safe to re-run. Does not remove existing messages.
-- Run as the postgres role in the SQL Editor, once. Run it after schema v4 or migration 007.

do $$
begin
  if current_setting('transaction_read_only') = 'on' then
    raise exception 'Session is read-only. Connect as postgres with write access.';
  end if;
end;
$$;

-- =============================================================================
-- 1. NEW COLUMNS ON direct_messages
-- =============================================================================

alter table public.direct_messages
  add column if not exists reply_to_id uuid references public.direct_messages (id) on delete set null;

alter table public.direct_messages
  add column if not exists unsent_at timestamptz;

-- Unsent messages keep their row but have no text. Other messages still need text.
alter table public.direct_messages drop constraint if exists direct_messages_content_check;
alter table public.direct_messages
  add constraint direct_messages_content_check check (
    char_length(content) <= 2000
    and (unsent_at is not null or char_length(btrim(content)) >= 1)
  );

create index if not exists direct_messages_reply_idx on public.direct_messages (reply_to_id);

-- True when the replied-to message is part of the same two-person conversation.
create or replace function public.message_in_thread(p_message uuid, p_a uuid, p_b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.direct_messages m
    where m.id = p_message
      and ((m.sender_id = p_a and m.recipient_id = p_b) or (m.sender_id = p_b and m.recipient_id = p_a))
  );
$$;

revoke execute on function public.message_in_thread(uuid, uuid, uuid) from public, anon;
grant execute on function public.message_in_thread(uuid, uuid, uuid) to authenticated;

-- =============================================================================
-- 2. POLICIES
-- Insert: a reply may only point at a message in the same conversation.
-- Update: the sender may unsend. The recipient may still set read_at.
-- =============================================================================

drop policy if exists "direct_messages_insert_friend" on public.direct_messages;
create policy "direct_messages_insert_friend" on public.direct_messages
  for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and public.are_friends(sender_id, recipient_id)
    and (
      reply_to_id is null
      or public.message_in_thread(reply_to_id, sender_id, recipient_id)
    )
  );

drop policy if exists "direct_messages_unsend" on public.direct_messages;
create policy "direct_messages_unsend" on public.direct_messages
  for update to authenticated
  using (sender_id = (select auth.uid()))
  with check (sender_id = (select auth.uid()));

-- Tighter guard. Only the read time and the unsend state can change, and an unsent
-- message can never get its text back.
create or replace function public.guard_direct_message_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (new.sender_id, new.recipient_id, new.reply_to_id, new.created_at)
     is distinct from (old.sender_id, old.recipient_id, old.reply_to_id, old.created_at) then
    raise exception 'Only the read time or the unsent state of a message can be changed';
  end if;

  if old.unsent_at is not null then
    if new.unsent_at is distinct from old.unsent_at or new.content is distinct from old.content then
      raise exception 'This message was unsent';
    end if;
  elsif new.unsent_at is not null then
    if (select auth.uid()) is distinct from old.sender_id then
      raise exception 'Only the sender can unsend a message';
    end if;
    if new.content <> '' then
      raise exception 'An unsent message cannot keep its text';
    end if;
  elsif new.content is distinct from old.content then
    raise exception 'The text of a message cannot be edited';
  end if;

  return new;
end;
$$;

revoke execute on function public.guard_direct_message_update() from public, anon, authenticated;

-- =============================================================================
-- 3. DELETE FOR ME
-- A hidden row only affects the person who hid it. The message stays for the other person.
-- =============================================================================

create table if not exists public.direct_message_hides (
  message_id  uuid not null references public.direct_messages (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  hidden_at   timestamptz not null default now(),
  primary key (message_id, user_id)
);

create index if not exists direct_message_hides_user_idx on public.direct_message_hides (user_id);

alter table public.direct_message_hides enable row level security;

drop policy if exists "direct_message_hides_select_own" on public.direct_message_hides;
create policy "direct_message_hides_select_own" on public.direct_message_hides
  for select to authenticated
  using (user_id = (select auth.uid()));

-- You can only hide a message from your own conversations.
drop policy if exists "direct_message_hides_insert_own" on public.direct_message_hides;
create policy "direct_message_hides_insert_own" on public.direct_message_hides
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.direct_messages m
      where m.id = message_id
        and (m.sender_id = (select auth.uid()) or m.recipient_id = (select auth.uid()))
    )
  );

-- =============================================================================
-- 4. REALTIME
-- Lets other open chats update when a message is unsent or hidden.
-- =============================================================================

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'direct_message_hides'
  ) then
    alter publication supabase_realtime add table public.direct_message_hides;
  end if;
end;
$$;
