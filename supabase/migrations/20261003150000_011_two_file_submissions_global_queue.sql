-- 011_two_file_submissions_global_queue
-- Submissions follow the ZipIt_ARIES contract: two files per submission.
--   submissions/{team_id}/{id}/search.py      (class Score)
--   submissions/{team_id}/{id}/tiebreaker.py  (class TieBreaker)
-- The scoring queue is capped at 3 queued/running rows across ALL teams, so the Mac mini
-- scorer never has more than three pending runs competing for CPU.
-- Orphaned storage objects (upload succeeded, row insert failed) are swept into storage_purge_queue.

do $$
begin
  if exists (select 1 from public.submissions) then
    raise exception '011 expects an empty submissions table (old single-file rows must be removed first)';
  end if;
end $$;

-- ── Columns + constraints ──
alter table public.submissions
  add column tiebreaker_path       text    not null,
  add column tiebreaker_size_bytes integer not null;

alter table public.submissions drop constraint submissions_path_matches_id;
alter table public.submissions
  add constraint submissions_path_matches_id
    check (file_path = team_id::text || '/' || id::text || '/search.py'),
  add constraint submissions_tiebreaker_path_matches_id
    check (tiebreaker_path = team_id::text || '/' || id::text || '/tiebreaker.py'),
  add constraint submissions_tiebreaker_size_bytes_check
    check (tiebreaker_size_bytes between 1 and 262144),
  add constraint submissions_tiebreaker_path_key unique (tiebreaker_path);

grant insert (tiebreaker_path, tiebreaker_size_bytes) on public.submissions to authenticated;
grant select (tiebreaker_path, tiebreaker_size_bytes) on public.submissions to authenticated;

-- ── Storage: a team may upload exactly search.py / tiebreaker.py under {uid}/{uuid}/ ──
alter policy subs_files_insert on storage.objects
  with check (bucket_id = 'submissions'
              and public.is_team()
              and name ~ ('^' || auth.uid()::text
                          || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/(search|tiebreaker)\.py$'));

-- ── Row insert: both files must already be uploaded by the caller ──
alter policy subs_insert on public.submissions
  with check (team_id = auth.uid()
              and public.is_team()
              and file_path       = auth.uid()::text || '/' || id::text || '/search.py'
              and tiebreaker_path = auth.uid()::text || '/' || id::text || '/tiebreaker.py'
              and public.own_submission_file_exists(file_path)
              and public.own_submission_file_exists(tiebreaker_path));

-- ── Delete: purge both files ──
create or replace function public.on_submission_delete() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into storage_purge_queue (bucket, path) values ('submissions', old.file_path);
  if old.tiebreaker_path is not null then
    insert into storage_purge_queue (bucket, path) values ('submissions', old.tiebreaker_path);
  end if;
  perform refresh_leaderboard();
  return null;
end $$;

-- ── Global queue cap (3 queued/running across all teams) ──
create or replace function public.enforce_queue_cap() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and new.team_id <> auth.uid() then
    return new;   -- not the caller's team: let RLS reject it
  end if;
  perform pg_advisory_xact_lock(hashtext('zipit.scoring_queue'));  -- serialise every insert
  if (select count(*) from submissions where status in ('queued','running')) >= 3 then
    raise exception 'queue_full: the scoring queue is full' using errcode = 'P0001';
  end if;
  return new;
end $$;

create or replace function public.scoring_queue_depth() returns integer
language sql stable security definer set search_path = '' as $$
  select count(*)::integer from public.submissions where status in ('queued','running')
$$;
revoke execute on function public.scoring_queue_depth() from public, anon;
grant  execute on function public.scoring_queue_depth() to authenticated;

-- ── Orphan sweep: objects with no submission row after 30 minutes ──
create or replace function public.enqueue_orphan_submission_files() returns integer
language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  insert into public.storage_purge_queue (bucket, path)
  select 'submissions', o.name
  from storage.objects o
  where o.bucket_id = 'submissions'
    and o.created_at < now() - interval '30 minutes'
    and not exists (select 1 from public.submissions s
                    where s.file_path = o.name or s.tiebreaker_path = o.name)
    and not exists (select 1 from public.storage_purge_queue q
                    where q.bucket = 'submissions' and q.path = o.name);
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function public.enqueue_orphan_submission_files() from public, anon, authenticated;

select cron.unschedule(jobid) from cron.job where jobname = 'zipit-orphan-sweep';
select cron.schedule('zipit-orphan-sweep', '*/15 * * * *', 'select public.enqueue_orphan_submission_files()');

-- ── Self-check ──
do $$
declare bad text;
begin
  if has_table_privilege('authenticated', 'public.submissions', 'UPDATE')
     or has_table_privilege('authenticated', 'public.submissions', 'DELETE') then
    raise exception 'authenticated must not update/delete submissions';
  end if;
  if has_column_privilege('authenticated', 'public.submissions', 'score', 'INSERT')
     or has_column_privilege('authenticated', 'public.submissions', 'status', 'INSERT')
     or has_column_privilege('authenticated', 'public.submissions', 'metrics', 'INSERT') then
    raise exception 'authenticated must not insert score/status/metrics';
  end if;
  if has_function_privilege('authenticated', 'public.enqueue_orphan_submission_files()', 'EXECUTE') then
    raise exception 'orphan sweep must be server-only';
  end if;
  select pg_get_functiondef('public.enforce_queue_cap()'::regprocedure) into bad;
  if bad ~ 'team_id = new\.team_id' then
    raise exception 'queue cap is still per team';
  end if;
end $$;
