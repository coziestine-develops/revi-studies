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
