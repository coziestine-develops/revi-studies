-- =============================================================================
-- REVI database schema (v4, complete)
-- Includes everything in revi_schema_v2.sql plus migrations 002 to 007:
--   - notification triggers and the reviewer visibility guard
--   - study chat history (ai_chat_messages)
--   - profile photo storage (avatars bucket)
--   - collaboration alerts and realtime notifications (005)
--   - 10 MB reviewer file limit (006)
--   - direct messages between friends (007)
--   - personal calendar with reminders (007)
--   - message notifications (008)
-- Target: a NEW Supabase project, or one that has no REVI tables yet.
-- Run once in the SQL Editor as the postgres role, from top to bottom.
-- Safe to rerun: statements use IF NOT EXISTS, CREATE OR REPLACE, and DROP ... IF EXISTS.
-- Do NOT run against a project that already has these tables with different data.
-- =============================================================================

-- =============================================================================
-- 0. PREFLIGHT: stop immediately if the session is read-only
-- =============================================================================

do $$
begin
  if current_setting('transaction_read_only') = 'on' then
    raise exception 'Session is read-only. Connect as the postgres role with write access, then rerun.';
  end if;
  if pg_is_in_recovery() then
    raise exception 'Connected to a replica. Use the primary (direct) connection.';
  end if;
end;
$$;


-- =============================================================================
-- 1. TABLES
-- =============================================================================

create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  username    text unique check (username ~ '^[a-z0-9_]{3,30}$'),
  full_name   text check (char_length(full_name) <= 100),
  school      text check (char_length(school) <= 150),
  course      text check (char_length(course) <= 150),
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.friendships (
  id            uuid primary key default gen_random_uuid(),
  requester_id  uuid not null references public.profiles (id) on delete cascade,
  addressee_id  uuid not null references public.profiles (id) on delete cascade,
  status        text not null default 'pending'
                  check (status in ('pending', 'accepted', 'rejected')),
  created_at    timestamptz not null default now(),
  responded_at  timestamptz,
  constraint friendships_no_self check (requester_id <> addressee_id),
  constraint friendships_unique_request unique (requester_id, addressee_id)
);

create table if not exists public.reviewers (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references public.profiles (id) on delete cascade,
  title        text not null check (char_length(title) between 1 and 200),
  description  text check (char_length(description) <= 2000),
  subject      text check (char_length(subject) <= 100),
  tags         text[] not null default '{}',
  visibility   text not null default 'private'
                 check (visibility in ('private', 'friends', 'shared', 'public')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.reviewer_shares (
  id           uuid primary key default gen_random_uuid(),
  reviewer_id  uuid not null references public.reviewers (id) on delete cascade,
  shared_with  uuid not null references public.profiles (id) on delete cascade,
  permission   text not null default 'viewer' check (permission in ('viewer', 'editor')),
  created_at   timestamptz not null default now(),
  unique (reviewer_id, shared_with)
);

create table if not exists public.reviewer_files (
  id           uuid primary key default gen_random_uuid(),
  reviewer_id  uuid not null references public.reviewers (id) on delete cascade,
  uploaded_by  uuid references public.profiles (id) on delete set null,
  storage_path text not null unique,
  file_name    text not null check (char_length(file_name) between 1 and 255),
  mime_type    text not null,
  size_bytes   bigint not null check (size_bytes > 0 and size_bytes <= 10485760),
  created_at   timestamptz not null default now(),
  constraint reviewer_files_path_matches_reviewer
    check (storage_path like (reviewer_id::text || '/%'))
);

create table if not exists public.saved_reviewers (
  user_id      uuid not null references public.profiles (id) on delete cascade,
  reviewer_id  uuid not null references public.reviewers (id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (user_id, reviewer_id)
);

create table if not exists public.collections (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.profiles (id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 100),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.collection_items (
  collection_id  uuid not null references public.collections (id) on delete cascade,
  reviewer_id    uuid not null references public.reviewers (id) on delete cascade,
  added_at       timestamptz not null default now(),
  primary key (collection_id, reviewer_id)
);

create table if not exists public.ai_generations (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles (id) on delete cascade,
  reviewer_id    uuid not null references public.reviewers (id) on delete cascade,
  kind           text not null
                   check (kind in ('summary', 'key_concepts', 'flashcards', 'quiz', 'explanation')),
  status         text not null default 'queued'
                   check (status in ('queued', 'running', 'succeeded', 'failed')),
  result         jsonb,
  error_message  text,
  model          text,
  created_at     timestamptz not null default now(),
  completed_at   timestamptz
);

create table if not exists public.flashcard_decks (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references public.profiles (id) on delete cascade,
  reviewer_id  uuid references public.reviewers (id) on delete set null,
  title        text not null check (char_length(title) between 1 and 200),
  description  text check (char_length(description) <= 1000),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.flashcards (
  id          uuid primary key default gen_random_uuid(),
  deck_id     uuid not null references public.flashcard_decks (id) on delete cascade,
  position    integer not null default 0 check (position >= 0),
  front       text not null check (char_length(front) between 1 and 2000),
  back        text not null check (char_length(back) between 1 and 2000),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.flashcard_progress (
  user_id       uuid not null references public.profiles (id) on delete cascade,
  flashcard_id  uuid not null references public.flashcards (id) on delete cascade,
  status        text not null default 'unknown'
                  check (status in ('unknown', 'known', 'needs_review')),
  updated_at    timestamptz not null default now(),
  primary key (user_id, flashcard_id)
);

create table if not exists public.quizzes (
  id                        uuid primary key default gen_random_uuid(),
  owner_id                  uuid not null references public.profiles (id) on delete cascade,
  reviewer_id               uuid not null references public.reviewers (id) on delete cascade,
  title                     text not null check (char_length(title) between 1 and 200),
  time_limit_seconds        integer check (time_limit_seconds is null or time_limit_seconds > 0),
  show_explanations_after   boolean not null default true,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

-- Question text and choices only. Correct answers live in quiz_answer_keys.
create table if not exists public.quiz_questions (
  id             uuid primary key default gen_random_uuid(),
  quiz_id        uuid not null references public.quizzes (id) on delete cascade,
  position       integer not null check (position >= 0),
  question_type  text not null check (question_type in ('multiple_choice', 'true_false')),
  prompt         text not null check (char_length(prompt) between 1 and 2000),
  options        jsonb not null default '[]'::jsonb check (jsonb_typeof(options) = 'array'),
  unique (quiz_id, position)
);

-- SERVICE ROLE ONLY. RLS is on with no policies, and grants are revoked below.
create table if not exists public.quiz_answer_keys (
  question_id     uuid primary key references public.quiz_questions (id) on delete cascade,
  correct_answer  text not null,
  explanation     text
);

create table if not exists public.quiz_attempts (
  id            uuid primary key default gen_random_uuid(),
  quiz_id       uuid not null references public.quizzes (id) on delete cascade,
  user_id       uuid not null references public.profiles (id) on delete cascade,
  started_at    timestamptz not null default now(),
  submitted_at  timestamptz,
  score         integer check (score is null or score >= 0),
  total         integer check (total is null or total >= 0)
);

-- Written only by the grading function (service role).
create table if not exists public.quiz_answers (
  attempt_id       uuid not null references public.quiz_attempts (id) on delete cascade,
  question_id      uuid not null references public.quiz_questions (id) on delete cascade,
  selected_answer  text,
  is_correct       boolean not null,
  primary key (attempt_id, question_id)
);

create table if not exists public.study_sessions (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.profiles (id) on delete cascade,
  reviewer_id       uuid references public.reviewers (id) on delete set null,
  activity          text not null default 'reviewing'
                      check (activity in ('reviewing', 'flashcards', 'quiz', 'other')),
  started_at        timestamptz not null default now(),
  ended_at          timestamptz,
  duration_seconds  integer not null default 0 check (duration_seconds >= 0),
  constraint study_sessions_end_after_start
    check (ended_at is null or ended_at >= started_at)
);

-- Direct messages. Only accepted friends can message each other (enforced by RLS below).
create table if not exists public.direct_messages (
  id            uuid primary key default gen_random_uuid(),
  sender_id     uuid not null references public.profiles (id) on delete cascade,
  recipient_id  uuid not null references public.profiles (id) on delete cascade,
  content       text not null check (char_length(btrim(content)) between 1 and 2000),
  read_at       timestamptz,
  created_at    timestamptz not null default now(),
  check (sender_id <> recipient_id)
);

-- Personal calendar events. reminder_minutes is how long before the start to remind
-- (0 = at start time, null = no reminder). remind_at is derived by trigger.
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

create table if not exists public.notifications (
  id             uuid primary key default gen_random_uuid(),
  recipient_id   uuid not null references public.profiles (id) on delete cascade,
  actor_id       uuid references public.profiles (id) on delete set null,
  type           text not null
                   check (type in ('friend_request', 'friend_accepted', 'reviewer_shared', 'collaboration', 'event_reminder', 'new_message')),
  reviewer_id    uuid references public.reviewers (id) on delete cascade,
  friendship_id  uuid references public.friendships (id) on delete cascade,
  calendar_event_id  uuid references public.calendar_events (id) on delete cascade,
  read_at        timestamptz,
  created_at     timestamptz not null default now()
);


-- =============================================================================
-- 2. INDEXES
-- =============================================================================

create index if not exists friendships_addressee_status_idx on public.friendships (addressee_id, status);
create index if not exists friendships_requester_idx        on public.friendships (requester_id);
create index if not exists reviewers_owner_idx              on public.reviewers (owner_id);
create index if not exists reviewer_shares_shared_with_idx  on public.reviewer_shares (shared_with);
create index if not exists reviewer_files_reviewer_idx      on public.reviewer_files (reviewer_id);
create index if not exists saved_reviewers_reviewer_idx     on public.saved_reviewers (reviewer_id);
create index if not exists collections_owner_idx            on public.collections (owner_id);
create index if not exists collection_items_reviewer_idx    on public.collection_items (reviewer_id);
create index if not exists ai_generations_user_idx          on public.ai_generations (user_id, created_at desc);
create index if not exists ai_generations_reviewer_idx      on public.ai_generations (reviewer_id);
create index if not exists flashcard_decks_owner_idx        on public.flashcard_decks (owner_id);
create index if not exists flashcard_decks_reviewer_idx     on public.flashcard_decks (reviewer_id);
create index if not exists flashcards_deck_idx              on public.flashcards (deck_id, position);
create index if not exists flashcard_progress_card_idx      on public.flashcard_progress (flashcard_id);
create index if not exists quizzes_reviewer_idx             on public.quizzes (reviewer_id);
create index if not exists quizzes_owner_idx                on public.quizzes (owner_id);
create index if not exists quiz_questions_quiz_idx          on public.quiz_questions (quiz_id);
create index if not exists quiz_attempts_user_quiz_idx      on public.quiz_attempts (user_id, quiz_id);
create index if not exists quiz_answers_question_idx        on public.quiz_answers (question_id);
create index if not exists study_sessions_user_started_idx  on public.study_sessions (user_id, started_at desc);
create index if not exists study_sessions_reviewer_idx      on public.study_sessions (reviewer_id);
create index if not exists notifications_recipient_idx      on public.notifications (recipient_id, read_at, created_at desc);
create index if not exists direct_messages_sender_idx        on public.direct_messages (sender_id, recipient_id, created_at desc);
create index if not exists direct_messages_recipient_idx     on public.direct_messages (recipient_id, created_at desc);
create index if not exists direct_messages_unread_idx        on public.direct_messages (recipient_id) where read_at is null;
create index if not exists calendar_events_owner_start_idx   on public.calendar_events (owner_id, starts_at);
create index if not exists calendar_events_due_idx           on public.calendar_events (remind_at)
  where reminder_sent_at is null and remind_at is not null;


-- =============================================================================
-- 3. TRIGGER FUNCTIONS AND TRIGGERS
-- =============================================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Blocks ownership changes so records can't be handed off or taken over.
create or replace function public.prevent_owner_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.owner_id is distinct from old.owner_id then
    raise exception 'owner_id cannot be changed';
  end if;
  return new;
end;
$$;

-- Blocks a friend request when the reverse request already exists.
create or replace function public.prevent_reverse_friendship()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.friendships f
    where f.requester_id = new.addressee_id
      and f.addressee_id = new.requester_id
  ) then
    raise exception 'A friendship between these users already exists';
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

drop trigger if exists friendships_prevent_reverse on public.friendships;
create trigger friendships_prevent_reverse
  before insert on public.friendships
  for each row execute function public.prevent_reverse_friendship();

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists reviewers_set_updated_at on public.reviewers;
create trigger reviewers_set_updated_at before update on public.reviewers
  for each row execute function public.set_updated_at();

drop trigger if exists collections_set_updated_at on public.collections;
create trigger collections_set_updated_at before update on public.collections
  for each row execute function public.set_updated_at();

drop trigger if exists flashcard_decks_set_updated_at on public.flashcard_decks;
create trigger flashcard_decks_set_updated_at before update on public.flashcard_decks
  for each row execute function public.set_updated_at();

drop trigger if exists flashcards_set_updated_at on public.flashcards;
create trigger flashcards_set_updated_at before update on public.flashcards
  for each row execute function public.set_updated_at();

drop trigger if exists quizzes_set_updated_at on public.quizzes;
create trigger quizzes_set_updated_at before update on public.quizzes
  for each row execute function public.set_updated_at();

drop trigger if exists reviewers_prevent_owner_change on public.reviewers;
create trigger reviewers_prevent_owner_change before update on public.reviewers
  for each row execute function public.prevent_owner_change();

drop trigger if exists collections_prevent_owner_change on public.collections;
create trigger collections_prevent_owner_change before update on public.collections
  for each row execute function public.prevent_owner_change();

drop trigger if exists flashcard_decks_prevent_owner_change on public.flashcard_decks;
create trigger flashcard_decks_prevent_owner_change before update on public.flashcard_decks
  for each row execute function public.prevent_owner_change();

drop trigger if exists quizzes_prevent_owner_change on public.quizzes;
create trigger quizzes_prevent_owner_change before update on public.quizzes
  for each row execute function public.prevent_owner_change();


-- Calendar: derives remind_at from the start time and reminder setting, and
-- re-arms a reminder when its time or setting changes.
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

-- A new message creates one unread alert per sender. Later messages from the same person
-- don't add alerts until that alert is read.
create or replace function public.notify_new_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.notifications n
    where n.recipient_id = new.recipient_id
      and n.actor_id = new.sender_id
      and n.type = 'new_message'
      and n.read_at is null
  ) then
    insert into public.notifications (recipient_id, actor_id, type)
    values (new.recipient_id, new.sender_id, 'new_message');
  end if;
  return new;
end;
$$;

drop trigger if exists direct_messages_notify on public.direct_messages;
create trigger direct_messages_notify
  after insert on public.direct_messages
  for each row execute function public.notify_new_message();

-- Recipients may only change read_at. The text and the sender/recipient can't be edited.
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

-- =============================================================================
-- 4. ACCESS HELPER FUNCTIONS
-- SECURITY DEFINER with an empty search_path prevents search-path hijacking.
-- They bypass RLS internally, so each one checks permissions itself.
-- =============================================================================

create or replace function public.are_friends(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and (
        (f.requester_id = a and f.addressee_id = b)
        or (f.requester_id = b and f.addressee_id = a)
      )
  );
$$;

create or replace function public.is_reviewer_owner(p_reviewer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.reviewers r
    where r.id = p_reviewer_id
      and r.owner_id = (select auth.uid())
  );
$$;

create or replace function public.can_view_reviewer(p_reviewer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.reviewers r
    where r.id = p_reviewer_id
      and (
        r.owner_id = (select auth.uid())
        or r.visibility = 'public'
        or (r.visibility = 'friends' and public.are_friends(r.owner_id, (select auth.uid())))
        or exists (
          select 1 from public.reviewer_shares s
          where s.reviewer_id = r.id
            and s.shared_with = (select auth.uid())
        )
      )
  );
$$;

create or replace function public.can_edit_reviewer(p_reviewer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.reviewers r
    where r.id = p_reviewer_id
      and (
        r.owner_id = (select auth.uid())
        or exists (
          select 1 from public.reviewer_shares s
          where s.reviewer_id = r.id
            and s.shared_with = (select auth.uid())
            and s.permission = 'editor'
        )
      )
  );
$$;


-- Creates a reminder notification for every event whose reminder time has passed.
-- Only the database owner can call this directly; signed-in users go through process_my_reminders().
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

-- =============================================================================
-- 5. ROW LEVEL SECURITY
-- Each policy is dropped first so the file can be rerun.
-- =============================================================================

alter table public.profiles             enable row level security;
alter table public.friendships          enable row level security;
alter table public.reviewers            enable row level security;
alter table public.reviewer_shares      enable row level security;
alter table public.reviewer_files       enable row level security;
alter table public.saved_reviewers      enable row level security;
alter table public.collections          enable row level security;
alter table public.collection_items     enable row level security;
alter table public.ai_generations       enable row level security;
alter table public.flashcard_decks      enable row level security;
alter table public.flashcards           enable row level security;
alter table public.flashcard_progress   enable row level security;
alter table public.quizzes              enable row level security;
alter table public.quiz_questions       enable row level security;
alter table public.quiz_answer_keys     enable row level security;
alter table public.quiz_attempts        enable row level security;
alter table public.quiz_answers         enable row level security;
alter table public.study_sessions       enable row level security;
alter table public.notifications        enable row level security;
alter table public.direct_messages      enable row level security;
alter table public.calendar_events      enable row level security;

-- profiles
drop policy if exists "profiles_select_authenticated" on public.profiles;
create policy "profiles_select_authenticated" on public.profiles
  for select to authenticated using (true);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- friendships
drop policy if exists "friendships_select_party" on public.friendships;
create policy "friendships_select_party" on public.friendships
  for select to authenticated
  using (requester_id = (select auth.uid()) or addressee_id = (select auth.uid()));

drop policy if exists "friendships_insert_requester" on public.friendships;
create policy "friendships_insert_requester" on public.friendships
  for insert to authenticated
  with check (requester_id = (select auth.uid()) and status = 'pending');

drop policy if exists "friendships_update_addressee" on public.friendships;
create policy "friendships_update_addressee" on public.friendships
  for update to authenticated
  using (addressee_id = (select auth.uid()))
  with check (addressee_id = (select auth.uid()) and status in ('accepted', 'rejected'));

drop policy if exists "friendships_delete_party" on public.friendships;
create policy "friendships_delete_party" on public.friendships
  for delete to authenticated
  using (requester_id = (select auth.uid()) or addressee_id = (select auth.uid()));

-- reviewers
drop policy if exists "reviewers_select_viewable" on public.reviewers;
create policy "reviewers_select_viewable" on public.reviewers
  for select to authenticated
  using (public.can_view_reviewer(id));

drop policy if exists "reviewers_insert_owner" on public.reviewers;
create policy "reviewers_insert_owner" on public.reviewers
  for insert to authenticated
  with check (owner_id = (select auth.uid()));

drop policy if exists "reviewers_update_editor" on public.reviewers;
create policy "reviewers_update_editor" on public.reviewers
  for update to authenticated
  using (public.can_edit_reviewer(id))
  with check (public.can_edit_reviewer(id));

drop policy if exists "reviewers_delete_owner" on public.reviewers;
create policy "reviewers_delete_owner" on public.reviewers
  for delete to authenticated
  using (owner_id = (select auth.uid()));

-- reviewer_shares: recipients see their grant; only the owner manages grants
drop policy if exists "reviewer_shares_select_party" on public.reviewer_shares;
create policy "reviewer_shares_select_party" on public.reviewer_shares
  for select to authenticated
  using (shared_with = (select auth.uid()) or public.is_reviewer_owner(reviewer_id));

drop policy if exists "reviewer_shares_owner_manage" on public.reviewer_shares;
create policy "reviewer_shares_owner_manage" on public.reviewer_shares
  for all to authenticated
  using (public.is_reviewer_owner(reviewer_id))
  with check (public.is_reviewer_owner(reviewer_id));

-- reviewer_files
drop policy if exists "reviewer_files_select_viewable" on public.reviewer_files;
create policy "reviewer_files_select_viewable" on public.reviewer_files
  for select to authenticated
  using (public.can_view_reviewer(reviewer_id));

drop policy if exists "reviewer_files_edit" on public.reviewer_files;
create policy "reviewer_files_edit" on public.reviewer_files
  for all to authenticated
  using (public.can_edit_reviewer(reviewer_id))
  with check (public.can_edit_reviewer(reviewer_id));

-- saved_reviewers
drop policy if exists "saved_reviewers_own" on public.saved_reviewers;
create policy "saved_reviewers_own" on public.saved_reviewers
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and public.can_view_reviewer(reviewer_id));

-- collections
drop policy if exists "collections_owner" on public.collections;
create policy "collections_owner" on public.collections
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

-- collection_items
drop policy if exists "collection_items_owner" on public.collection_items;
create policy "collection_items_owner" on public.collection_items
  for all to authenticated
  using (exists (
    select 1 from public.collections c
    where c.id = collection_id and c.owner_id = (select auth.uid())
  ))
  with check (
    exists (
      select 1 from public.collections c
      where c.id = collection_id and c.owner_id = (select auth.uid())
    )
    and public.can_view_reviewer(reviewer_id)
  );

-- ai_generations
drop policy if exists "ai_generations_select_own" on public.ai_generations;
create policy "ai_generations_select_own" on public.ai_generations
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "ai_generations_insert_own" on public.ai_generations;
create policy "ai_generations_insert_own" on public.ai_generations
  for insert to authenticated
  with check (user_id = (select auth.uid()) and public.can_view_reviewer(reviewer_id));

drop policy if exists "ai_generations_delete_own" on public.ai_generations;
create policy "ai_generations_delete_own" on public.ai_generations
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- flashcard_decks
drop policy if exists "flashcard_decks_owner" on public.flashcard_decks;
create policy "flashcard_decks_owner" on public.flashcard_decks
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

-- flashcards
drop policy if exists "flashcards_owner" on public.flashcards;
create policy "flashcards_owner" on public.flashcards
  for all to authenticated
  using (exists (
    select 1 from public.flashcard_decks d
    where d.id = deck_id and d.owner_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.flashcard_decks d
    where d.id = deck_id and d.owner_id = (select auth.uid())
  ));

-- flashcard_progress
drop policy if exists "flashcard_progress_own" on public.flashcard_progress;
create policy "flashcard_progress_own" on public.flashcard_progress
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- quizzes
drop policy if exists "quizzes_select" on public.quizzes;
create policy "quizzes_select" on public.quizzes
  for select to authenticated
  using (owner_id = (select auth.uid()) or public.can_view_reviewer(reviewer_id));

drop policy if exists "quizzes_insert_owner" on public.quizzes;
create policy "quizzes_insert_owner" on public.quizzes
  for insert to authenticated
  with check (owner_id = (select auth.uid()) and public.can_view_reviewer(reviewer_id));

drop policy if exists "quizzes_update_owner" on public.quizzes;
create policy "quizzes_update_owner" on public.quizzes
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

drop policy if exists "quizzes_delete_owner" on public.quizzes;
create policy "quizzes_delete_owner" on public.quizzes
  for delete to authenticated
  using (owner_id = (select auth.uid()));

-- quiz_questions
drop policy if exists "quiz_questions_select" on public.quiz_questions;
create policy "quiz_questions_select" on public.quiz_questions
  for select to authenticated
  using (exists (
    select 1 from public.quizzes q
    where q.id = quiz_id
      and (q.owner_id = (select auth.uid()) or public.can_view_reviewer(q.reviewer_id))
  ));

drop policy if exists "quiz_questions_owner_manage" on public.quiz_questions;
create policy "quiz_questions_owner_manage" on public.quiz_questions
  for all to authenticated
  using (exists (
    select 1 from public.quizzes q
    where q.id = quiz_id and q.owner_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.quizzes q
    where q.id = quiz_id and q.owner_id = (select auth.uid())
  ));

-- quiz_attempts: scoring happens in the grading function (service role)
drop policy if exists "quiz_attempts_select_own" on public.quiz_attempts;
create policy "quiz_attempts_select_own" on public.quiz_attempts
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "quiz_attempts_insert_own" on public.quiz_attempts;
create policy "quiz_attempts_insert_own" on public.quiz_attempts
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.quizzes q
      where q.id = quiz_id and public.can_view_reviewer(q.reviewer_id)
    )
  );

-- quiz_answers: read-only for the attempt's owner
drop policy if exists "quiz_answers_select_own" on public.quiz_answers;
create policy "quiz_answers_select_own" on public.quiz_answers
  for select to authenticated
  using (exists (
    select 1 from public.quiz_attempts a
    where a.id = attempt_id and a.user_id = (select auth.uid())
  ));

-- study_sessions
drop policy if exists "study_sessions_own" on public.study_sessions;
create policy "study_sessions_own" on public.study_sessions
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- notifications: created server-side; users read and mark their own as read
drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own" on public.notifications
  for select to authenticated
  using (recipient_id = (select auth.uid()));

drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own" on public.notifications
  for update to authenticated
  using (recipient_id = (select auth.uid()))
  with check (recipient_id = (select auth.uid()));


-- direct_messages: friends only; recipients mark read; senders may delete their own
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

-- calendar_events: owner only
drop policy if exists "calendar_events_owner" on public.calendar_events;
create policy "calendar_events_owner" on public.calendar_events
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

-- =============================================================================
-- 6. GRANTS
-- Lock the answer keys table and restrict helper functions to signed-in users.
-- =============================================================================

revoke all on public.quiz_answer_keys from anon, authenticated;

revoke execute on function public.are_friends(uuid, uuid)  from public, anon;
revoke execute on function public.is_reviewer_owner(uuid)  from public, anon;
revoke execute on function public.can_view_reviewer(uuid)  from public, anon;
revoke execute on function public.can_edit_reviewer(uuid)  from public, anon;
revoke execute on function public.handle_new_user()        from public, anon, authenticated;
revoke execute on function public.set_updated_at()         from public, anon, authenticated;
revoke execute on function public.prevent_owner_change()   from public, anon, authenticated;
revoke execute on function public.prevent_reverse_friendship() from public, anon, authenticated;

grant execute on function public.are_friends(uuid, uuid)  to authenticated;
grant execute on function public.is_reviewer_owner(uuid)  to authenticated;
grant execute on function public.can_view_reviewer(uuid)  to authenticated;
grant execute on function public.can_edit_reviewer(uuid)  to authenticated;


-- =============================================================================
-- NOTIFICATIONS: collaboration alerts and realtime (migration 005)
-- =============================================================================

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
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'direct_messages'
  ) then
    alter publication supabase_realtime add table public.direct_messages;
  end if;
end;
$$;

revoke execute on function public.prepare_calendar_event()          from public, anon, authenticated;
revoke execute on function public.guard_direct_message_update()  from public, anon, authenticated;
revoke execute on function public.notify_new_message()            from public, anon, authenticated;
revoke execute on function public.dispatch_due_reminders(uuid)   from public, anon, authenticated;
revoke execute on function public.process_my_reminders()         from public, anon;
grant  execute on function public.process_my_reminders()         to authenticated;

-- =============================================================================
-- 7. STORAGE: private bucket for reviewer files
-- Files are stored at <reviewer_id>/<file>. Access is checked by reviewer.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'revi-reviewers',
  'revi-reviewers',
  false,
  10485760,
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'image/png',
    'image/jpeg',
    'image/webp',
    'text/plain'
  ]
)
on conflict (id) do nothing;

drop policy if exists "revi_storage_read_accessible" on storage.objects;
create policy "revi_storage_read_accessible" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'revi-reviewers'
    and public.can_view_reviewer(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists "revi_storage_insert_editor" on storage.objects;
create policy "revi_storage_insert_editor" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'revi-reviewers'
    and public.can_edit_reviewer(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists "revi_storage_update_editor" on storage.objects;
create policy "revi_storage_update_editor" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'revi-reviewers'
    and public.can_edit_reviewer(((storage.foldername(name))[1])::uuid)
  )
  with check (
    bucket_id = 'revi-reviewers'
    and public.can_edit_reviewer(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists "revi_storage_delete_editor" on storage.objects;
create policy "revi_storage_delete_editor" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'revi-reviewers'
    and public.can_edit_reviewer(((storage.foldername(name))[1])::uuid)
  );

-- =============================================================================
-- END OF SCHEMA
-- Next: configure email auth and redirect URLs, then deploy Edge Functions for
-- AI generation and quiz grading using the service role as a server secret.
-- =============================================================================


-- =============================================================================
-- NOTIFICATIONS, VISIBILITY GUARD
-- Merged from 002_notifications_and_guards.sql
-- =============================================================================

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


-- =============================================================================
-- STUDY CHAT HISTORY
-- Merged from 003_ai_chat.sql
-- =============================================================================

-- REVI migration 003: study chat history.
-- Each user sees and clears only their own messages. The ai-chat function writes rows with the service role.
do $$
begin
  if current_setting('transaction_read_only') = 'on' then
    raise exception 'Session is read-only. Connect as postgres with write access.';
  end if;
end;
$$;

create table if not exists public.ai_chat_messages (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  reviewer_id  uuid references public.reviewers (id) on delete set null,
  role         text not null check (role in ('user', 'assistant')),
  content      text not null check (char_length(content) between 1 and 8000),
  created_at   timestamptz not null default now()
);

create index if not exists ai_chat_messages_user_idx on public.ai_chat_messages (user_id, created_at);

alter table public.ai_chat_messages enable row level security;

drop policy if exists "ai_chat_select_own" on public.ai_chat_messages;
create policy "ai_chat_select_own" on public.ai_chat_messages
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "ai_chat_delete_own" on public.ai_chat_messages;
create policy "ai_chat_delete_own" on public.ai_chat_messages
  for delete to authenticated
  using (user_id = (select auth.uid()));


-- =============================================================================
-- PROFILE PHOTOS (AVATARS BUCKET)
-- Merged from 004_avatars.sql
-- =============================================================================

-- REVI migration 004: profile photos.
-- Public bucket for avatars. Anyone can view a photo by URL. Only the owner can upload, replace, or delete it.
do $$
begin
  if current_setting('transaction_read_only') = 'on' then
    raise exception 'Session is read-only. Connect as postgres with write access.';
  end if;
end;
$$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  2097152,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update set
  public = true,
  file_size_limit = 2097152,
  allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp'];

drop policy if exists "avatars_select_public" on storage.objects;
create policy "avatars_select_public" on storage.objects
  for select to public
  using (bucket_id = 'avatars');

drop policy if exists "avatars_insert_own" on storage.objects;
create policy "avatars_insert_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "avatars_update_own" on storage.objects;
create policy "avatars_update_own" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "avatars_delete_own" on storage.objects;
create policy "avatars_delete_own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);


-- =============================================================================
-- END OF SCHEMA (v4)
-- Next: configure Auth (email, Google, redirect URLs), then deploy the Edge
-- Functions: grade-quiz, generate-study-content, ai-chat, delete-account.
-- =============================================================================
