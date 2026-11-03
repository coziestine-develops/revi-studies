-- REVI migration 009: people can delete their own quiz attempts.
-- Safe to re-run. Does not change existing data.
-- Run as the postgres role in the SQL Editor, once.
do $$
begin
  if current_setting('transaction_read_only') = 'on' then
    raise exception 'Session is read-only. Connect as postgres with write access.';
  end if;
end;
$$;

-- Owners can delete only their own attempts. The attempt's answers are removed
-- automatically by the existing "on delete cascade" foreign key.
drop policy if exists "quiz_attempts_delete_own" on public.quiz_attempts;
create policy "quiz_attempts_delete_own" on public.quiz_attempts
  for delete to authenticated
  using (user_id = (select auth.uid()));
