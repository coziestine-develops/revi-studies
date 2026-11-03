-- REVI migration 008: a notification when someone sends you a message.
-- Safe to re-run. Does not change existing data.
-- Run as the postgres role in the SQL Editor, once.
do $$
begin
  if current_setting('transaction_read_only') = 'on' then
    raise exception 'Session is read-only. Connect as postgres with write access.';
  end if;
end;
$$;

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in ('friend_request', 'friend_accepted', 'reviewer_shared', 'collaboration', 'event_reminder', 'new_message'));

-- One unread alert per sender. Further messages from the same person don't add alerts
-- until the existing one is read, so the bell doesn't fill up during a conversation.
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

revoke execute on function public.notify_new_message() from public, anon, authenticated;
