-- 012_withdraw_queued_submission
-- A team may withdraw its own submission while it is still 'queued', freeing a slot in the
-- global scoring queue. Teams still have no DELETE privilege on submissions; the only path is
-- this function. The row is locked first, so a run the scorer has already claimed ('running')
-- cannot be withdrawn. Existing delete triggers purge both files, refresh the leaderboard and
-- broadcast to the team channel. Each withdraw is recorded in admin_audit.

alter table public.admin_audit drop constraint admin_audit_action_check;
alter table public.admin_audit add constraint admin_audit_action_check
  check (action = any (array['score_change', 'submission_delete', 'submission_withdraw', 'freeze', 'unfreeze',
                             'team_create', 'team_password_reset', 'team_delete', 'team_rename',
                             'team_avatar_clear', 'team_avatar_set']));

create or replace function public.withdraw_submission(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare r public.submissions%rowtype;
begin
  if auth.uid() is null or not public.is_team() then
    raise exception 'not_team: only team accounts can withdraw runs' using errcode = '42501';
  end if;
  select * into r from public.submissions where id = p_id and team_id = auth.uid() for update;
  if not found then
    raise exception 'not_found: no such submission' using errcode = 'P0002';
  end if;
  if r.status <> 'queued' then
    raise exception 'not_queued: submission is %', r.status using errcode = '55000';
  end if;
  delete from public.submissions where id = r.id;
  insert into public.admin_audit (action, team_id, target_id, details, actor, actor_kind, actor_label)
  values ('submission_withdraw', r.team_id, r.id,
          jsonb_build_object('status', r.status, 'file_name', r.file_name, 'source', r.source,
                             'created_at', r.created_at),
          auth.uid(), 'team', 'team');
end $$;
revoke execute on function public.withdraw_submission(uuid) from public, anon;
grant  execute on function public.withdraw_submission(uuid) to authenticated;

-- ── Self-check ──
do $$
begin
  if has_table_privilege('authenticated', 'public.submissions', 'DELETE') then
    raise exception 'authenticated must not delete submissions directly';
  end if;
  if has_function_privilege('anon', 'public.withdraw_submission(uuid)', 'EXECUTE') then
    raise exception 'anon must not withdraw submissions';
  end if;
end $$;
