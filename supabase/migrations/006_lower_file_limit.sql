-- REVI migration 006: lower the reviewer file limit from 50 MB to 10 MB.
-- New uploads over 10 MB are refused by the bucket and by reviewer_files.
-- Files already stored above 10 MB are kept; the check is added NOT VALID, so it applies to new rows only.
do $$
begin
  if current_setting('transaction_read_only') = 'on' then
    raise exception 'Session is read-only. Connect as postgres with write access.';
  end if;
end;
$$;

update storage.buckets
set file_size_limit = 10485760
where id = 'revi-reviewers';

alter table public.reviewer_files
  drop constraint if exists reviewer_files_size_bytes_check;

alter table public.reviewer_files
  add constraint reviewer_files_size_bytes_check
  check (size_bytes > 0 and size_bytes <= 10485760) not valid;
