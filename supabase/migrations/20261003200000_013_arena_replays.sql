-- 013_arena_replays
-- Arena replays a team saves from its own browser: the current and the previous Zip for each
-- submission in its four slots (BEST, 2ND, 3RD, LATEST), so at most 8 rows per team.
--   replays/{team_id}/{submission_id}/{uuid}.bin   gzip of the engine's binary search log
-- Rows are written only through save_arena_replay(). Deleting a row (rotation, a slot change,
-- withdraw or admin delete through the cascade) queues its file in storage_purge_queue.
-- Kept apart from public.replays, which belongs to the scorer contract.

-- ── Bucket: private, binary, 20 MB per file ──
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('replays', 'replays', false, 20971520, array['application/octet-stream'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- ── Table ──
create table public.arena_replays (
  id            uuid primary key default gen_random_uuid(),
  team_id       uuid not null references public.teams (id) on delete cascade,
  submission_id uuid not null references public.submissions (id) on delete cascade,
  slot          text not null check (slot in ('current', 'previous')),
  trace_path    text not null unique,
  puzzle        jsonb not null check (pg_column_size(puzzle) <= 16384),
  summary       jsonb not null check (pg_column_size(summary) <= 65536),
  created_at    timestamptz not null default now(),
  unique (submission_id, slot),
  constraint arena_replays_path_matches check (
    trace_path ~ ('^' || team_id::text || '/' || submission_id::text
                  || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.bin$'))
);
create index arena_replays_team_idx on public.arena_replays (team_id);

alter table public.arena_replays enable row level security;
revoke all on public.arena_replays from public, anon, authenticated;
grant select on public.arena_replays to authenticated;
create policy arena_replays_select on public.arena_replays for select to authenticated
  using (team_id = (select auth.uid()) or (select public.is_admin()));

create or replace function public.on_arena_replay_delete() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.storage_purge_queue (bucket, path) values ('replays', old.trace_path);
  return null;
end $$;
revoke execute on function public.on_arena_replay_delete() from public, anon, authenticated;
create trigger arena_replays_after_delete after delete on public.arena_replays
  for each row execute function public.on_arena_replay_delete();

-- ── Storage: a team uploads {uid}/{own submission}/{uuid}.bin, at most 10 live files ──
-- 8 saved replays plus room for two uploads in flight. Files already queued for purge do not count.
create or replace function public.replay_upload_allowed(p_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select split_part(p_name, '/', 2) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     and exists (select 1 from public.submissions s
                 where s.id::text = split_part(p_name, '/', 2) and s.team_id = (select auth.uid()))
     and (select count(*) from storage.objects o
          where o.bucket_id = 'replays'
            and o.name like (select auth.uid())::text || '/%'
            and not exists (select 1 from public.storage_purge_queue q
                            where q.bucket = 'replays' and q.path = o.name)) < 10
$$;
revoke execute on function public.replay_upload_allowed(text) from public, anon;
grant  execute on function public.replay_upload_allowed(text) to authenticated;

create policy replays_files_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'replays'
              and public.is_team()
              and name ~ ('^' || auth.uid()::text
                          || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
                          || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.bin$')
              and public.replay_upload_allowed(name));

create policy replays_files_select on storage.objects for select to authenticated
  using (bucket_id = 'replays'
         and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.is_admin())));

-- ── Save: rotate current → previous, drop runs that left the four slots ──
create or replace function public.save_arena_replay(
  p_submission uuid, p_path text, p_puzzle jsonb, p_summary jsonb, p_keep uuid[]
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid  uuid := auth.uid();
  keep uuid[];
begin
  if uid is null or not public.is_team() then
    raise exception 'not_team: only team accounts save replays' using errcode = '42501';
  end if;
  if not exists (select 1 from public.submissions where id = p_submission and team_id = uid) then
    raise exception 'not_found: no such submission' using errcode = 'P0002';
  end if;
  select coalesce(array_agg(id), '{}') into keep
  from public.submissions where team_id = uid and id = any (coalesce(p_keep, '{}'));
  if not (p_submission = any (keep)) or cardinality(keep) > 4 then
    raise exception 'not_kept: replays are kept for at most 4 runs, this one included' using errcode = '22023';
  end if;
  if p_path !~ ('^' || uid::text || '/' || p_submission::text
                || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.bin$')
     or not exists (select 1 from storage.objects where bucket_id = 'replays' and name = p_path) then
    raise exception 'bad_path: upload the replay file first' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtext('zipit.arena_replays.' || uid::text));
  delete from public.arena_replays where team_id = uid and submission_id <> all (keep);
  delete from public.arena_replays where submission_id = p_submission and slot = 'previous';
  update public.arena_replays set slot = 'previous' where submission_id = p_submission and slot = 'current';
  insert into public.arena_replays (team_id, submission_id, slot, trace_path, puzzle, summary)
  values (uid, p_submission, 'current', p_path, p_puzzle, p_summary);
end $$;
revoke execute on function public.save_arena_replay(uuid, text, jsonb, jsonb, uuid[]) from public, anon;
grant  execute on function public.save_arena_replay(uuid, text, jsonb, jsonb, uuid[]) to authenticated;

-- ── Orphan sweep: uploaded files never saved, after 30 minutes ──
create or replace function public.enqueue_orphan_replay_files() returns integer
language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  insert into public.storage_purge_queue (bucket, path)
  select 'replays', o.name
  from storage.objects o
  where o.bucket_id = 'replays'
    and o.created_at < now() - interval '30 minutes'
    and not exists (select 1 from public.arena_replays r where r.trace_path = o.name)
    and not exists (select 1 from public.storage_purge_queue q where q.bucket = 'replays' and q.path = o.name);
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function public.enqueue_orphan_replay_files() from public, anon, authenticated;

select cron.unschedule(jobid) from cron.job where jobname = 'zipit-replay-orphan-sweep';
select cron.schedule('zipit-replay-orphan-sweep', '*/15 * * * *', 'select public.enqueue_orphan_replay_files()');

-- ── Self-check ──
do $$
begin
  if has_table_privilege('authenticated', 'public.arena_replays', 'INSERT')
     or has_table_privilege('authenticated', 'public.arena_replays', 'UPDATE')
     or has_table_privilege('authenticated', 'public.arena_replays', 'DELETE') then
    raise exception 'authenticated must write arena_replays only through save_arena_replay';
  end if;
  if has_table_privilege('anon', 'public.arena_replays', 'SELECT') then
    raise exception 'anon must not read arena_replays';
  end if;
  if has_function_privilege('anon', 'public.save_arena_replay(uuid, text, jsonb, jsonb, uuid[])', 'EXECUTE') then
    raise exception 'anon must not save replays';
  end if;
  if has_function_privilege('authenticated', 'public.enqueue_orphan_replay_files()', 'EXECUTE') then
    raise exception 'replay orphan sweep must be server-only';
  end if;
  if (select public from storage.buckets where id = 'replays') then
    raise exception 'replays bucket must be private';
  end if;
end $$;
