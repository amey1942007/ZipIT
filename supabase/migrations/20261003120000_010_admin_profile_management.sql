-- 010_admin_profile_management
-- Partly reverses 008_admin_view_only: the admin may edit team *profiles* (own row and any team):
--   * teams.team_name and teams.avatar_path (column grants already block id / username / role)
--   * storage avatars/{team_id}/avatar.webp (insert / replace / delete)
-- The admin still has NO write access to submissions, replays, scores, leaderboard or app_settings.
-- Team password resets by the admin go through the admin-manage-teams edge function (v3).
-- Every admin profile edit writes an admin_audit row.

-- ── Audit actions ──
alter table public.admin_audit drop constraint if exists admin_audit_action_check;
alter table public.admin_audit add  constraint admin_audit_action_check
  check (action in ('score_change','submission_delete','freeze','unfreeze',
                    'team_create','team_password_reset','team_delete','team_rename',
                    'team_avatar_clear','team_avatar_set'));

-- ── Helper: is this storage object name an existing team's avatar, and is the caller the admin? ──
create or replace function public.admin_avatar_target(p_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_admin()
     and exists (select 1 from public.teams t where t.id::text || '/avatar.webp' = p_name)
$$;
revoke execute on function public.admin_avatar_target(text) from public, anon;
grant  execute on function public.admin_avatar_target(text) to authenticated;

-- ── teams: own row (team) or any row (admin) ──
alter policy teams_update on public.teams
  using      (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

-- ── storage avatars ──
alter policy avatars_write on storage.objects
  with check (bucket_id = 'avatars'
              and ((name = auth.uid()::text || '/avatar.webp' and public.is_team())
                   or public.admin_avatar_target(name)));
alter policy avatars_update on storage.objects
  using      (bucket_id = 'avatars'
              and ((name = auth.uid()::text || '/avatar.webp' and public.is_team())
                   or public.admin_avatar_target(name)))
  with check (bucket_id = 'avatars'
              and ((name = auth.uid()::text || '/avatar.webp' and public.is_team())
                   or public.admin_avatar_target(name)));
alter policy avatars_delete on storage.objects
  using      (bucket_id = 'avatars'
              and ((name = auth.uid()::text || '/avatar.webp' and public.is_team())
                   or public.admin_avatar_target(name)));
alter policy avatars_select on storage.objects
  using      (bucket_id = 'avatars'
              and ((name = auth.uid()::text || '/avatar.webp' and (public.is_team() or public.is_admin()))
                   or public.admin_avatar_target(name)));

-- ── Audit admin profile edits ──
create or replace function public.audit_admin_team_name() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if public.is_admin() and old.team_name is distinct from new.team_name then
    insert into public.admin_audit (action, team_id, details, actor, actor_kind, actor_label)
    values ('team_rename', new.id,
            jsonb_build_object('username', new.username, 'old_team_name', old.team_name,
                               'new_team_name', new.team_name, 'via', 'admin'),
            auth.uid(), 'admin', 'admin');
  end if;
  return null;
end $$;

create or replace function public.audit_admin_team_avatar() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if public.is_admin() then
    insert into public.admin_audit (action, team_id, details, actor, actor_kind, actor_label)
    values (case when new.avatar_path is null then 'team_avatar_clear' else 'team_avatar_set' end, new.id,
            jsonb_build_object('username', new.username, 'old_avatar_path', old.avatar_path,
                               'new_avatar_path', new.avatar_path, 'via', 'admin'),
            auth.uid(), 'admin', 'admin');
  end if;
  return null;
end $$;

revoke execute on function public.audit_admin_team_name()   from public, anon, authenticated;
revoke execute on function public.audit_admin_team_avatar() from public, anon, authenticated;

drop trigger if exists teams_audit_admin_name   on public.teams;
drop trigger if exists teams_audit_admin_avatar on public.teams;
create trigger teams_audit_admin_name   after update of team_name   on public.teams
  for each row execute function public.audit_admin_team_name();
create trigger teams_audit_admin_avatar after update of avatar_path on public.teams
  for each row execute function public.audit_admin_team_avatar();

-- ── Self-check: admin writes are limited to team profiles ──
do $$
declare bad text;
begin
  select string_agg(schemaname || '.' || tablename || '.' || policyname, ', ') into bad
  from pg_policies
  where cmd in ('INSERT','UPDATE','DELETE','ALL')
    and ((schemaname = 'public' and tablename <> 'teams')
         or (schemaname = 'storage' and policyname not in ('avatars_write','avatars_update','avatars_delete'))
         or schemaname = 'realtime')
    and (regexp_replace(coalesce(qual, ''),       'NOT is_admin\(\)', '', 'g') ~ 'is_admin\('
      or regexp_replace(coalesce(with_check, ''), 'NOT is_admin\(\)', '', 'g') ~ 'is_admin\('
      or coalesce(qual, '') ~ 'admin_avatar_target' or coalesce(with_check, '') ~ 'admin_avatar_target');
  if bad is not null then raise exception '010 self-check: admin write policy outside team profiles: %', bad; end if;
  if has_function_privilege('authenticated', 'public.admin_set_score(uuid, numeric, jsonb)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.admin_set_freeze(boolean)', 'EXECUTE') then
    raise exception '010 self-check: admin RPCs executable by API roles';
  end if;
  if has_table_privilege('authenticated', 'public.submissions', 'DELETE')
     or has_table_privilege('authenticated', 'public.submissions', 'UPDATE') then
    raise exception '010 self-check: authenticated can modify submissions';
  end if;
  if has_column_privilege('authenticated', 'public.teams', 'role', 'UPDATE')
     or has_column_privilege('authenticated', 'public.teams', 'username', 'UPDATE') then
    raise exception '010 self-check: authenticated can change team role or username';
  end if;
end $$;
