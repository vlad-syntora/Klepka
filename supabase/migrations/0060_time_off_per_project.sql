-- 0060_time_off_per_project.sql — make client time-off responses per PROJECT (not per account) and give
-- team leads the same approval power as admins over their own team.
--
-- Why:
--   • A staffer can be on several projects across several clients. Each client must confirm the leave
--     and say whether they need a replacement *for that project* — coverage is a per-project concern.
--     0058 stored one response per (leave, account), which cannot distinguish two projects of the same
--     client. We move responses to per (leave, project) and let the admin / team lead see exactly which
--     project requested a replacement.
--   • Team leads (portal_teams.lead_id) can now approve/reject the internal sign-off for members of the
--     team(s) they lead; admins still cover everyone.
--
-- Also adds two staff-facing feeds for the Time Off page widgets:
--   • portal_time_off_review_queue()         — pending leave the caller may approve (admin: all;
--                                              team lead: their team's members).
--   • portal_time_off_replacement_requests() — approved leave for which a client asked for a
--                                              replacement, with the exact project + client, scoped the
--                                              same way.
--
-- Standalone + idempotent, matching the migration convention. Apply manually. (Extends 0058; the time-off
-- feature shipped the same day, so there is no meaningful historical response data to preserve — the
-- account-level rows are dropped when moving to the project-level unique key.)

-- ---------------------------------------------------------------------------
-- a. Responses become per (leave, project)
-- ---------------------------------------------------------------------------

alter table portal_time_off_responses
  add column if not exists project_id uuid references portal_projects(id) on delete cascade;

-- Swap the account-level unique for a project-level one. Clear any pre-existing account-only rows first
-- (the feature is < 1 day old; these carry no history worth keeping and would violate the NOT NULL).
alter table portal_time_off_responses
  drop constraint if exists portal_time_off_responses_time_off_id_account_id_key;
delete from portal_time_off_responses where project_id is null;
alter table portal_time_off_responses alter column project_id set not null;

create unique index if not exists portal_time_off_responses_leave_project_key
  on portal_time_off_responses (time_off_id, project_id);
create index if not exists portal_time_off_responses_project_idx
  on portal_time_off_responses (project_id);

-- ---------------------------------------------------------------------------
-- b. "Do I lead this employee's team?" — used to widen the review permission
-- ---------------------------------------------------------------------------

create or replace function portal_leads_user(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from portal_teams tm
    join portal_users u on u.team_id = tm.id
    where tm.lead_id = portal_my_user_id()
      and u.id = p_user
  );
$$;

grant execute on function portal_leads_user(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- c. Internal sign-off — admin OR the employee's team lead
-- ---------------------------------------------------------------------------

create or replace function portal_set_time_off_status(p_id uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_user uuid;
begin
  select user_id into v_user from portal_time_off where id = p_id;
  if v_user is null then
    raise exception 'time off not found';
  end if;
  if not (portal_is_admin() or portal_leads_user(v_user)) then
    raise exception 'only an admin or the employee''s team lead can review time off';
  end if;
  if p_status not in ('pending', 'approved', 'rejected') then
    raise exception 'invalid time off status';
  end if;
  update portal_time_off
     set status = p_status,
         reviewed_by = portal_my_user_id(),
         reviewed_at = now(),
         updated_at = now()
   where id = p_id;
end $$;

grant execute on function portal_set_time_off_status(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- d. Client feed: approved leave, ONE ROW PER shared project
-- ---------------------------------------------------------------------------

-- Return shape changes (adds project_id/project_name), so the old definition must be dropped first —
-- CREATE OR REPLACE cannot alter a function's OUT columns.
drop function if exists portal_my_team_time_off();

create or replace function portal_my_team_time_off()
returns table (
  id uuid,
  project_id uuid,
  project_name text,
  user_id uuid,
  full_name text,
  kind text,
  start_date date,
  end_date date,
  note text,
  days integer,
  approved boolean,
  replacement_requested boolean
) language plpgsql security definer set search_path = public as $$
declare
  v_account uuid := portal_my_account_id();
begin
  if v_account is null then
    return;
  end if;

  return query
    select
      t.id,
      pr.id as project_id,
      pr.name as project_name,
      t.user_id,
      u.full_name,
      t.kind,
      t.start_date,
      t.end_date,
      t.note,
      (t.end_date - t.start_date + 1)::int as days,
      coalesce(r.approved, false) as approved,
      coalesce(r.replacement_requested, false) as replacement_requested
    from portal_time_off t
    join portal_users u on u.id = t.user_id
    -- The staffer must be a visible member of the project, and the project must be on my account.
    join portal_project_team pt
      on pt.user_id = t.user_id and pt.is_public = true and pt.active = true
    join portal_projects pr
      on pr.id = pt.project_id and pr.account_id = v_account
    left join portal_time_off_responses r
      on r.time_off_id = t.id and r.project_id = pr.id
    where t.status = 'approved'
      and t.end_date >= current_date
    order by t.start_date, pr.name;
end $$;

grant execute on function portal_my_team_time_off() to authenticated;

-- ---------------------------------------------------------------------------
-- e. Client responds for a SPECIFIC project
-- ---------------------------------------------------------------------------

-- Drop the old 3-arg signature (replaced by the 4-arg, project-scoped one).
drop function if exists portal_client_respond_time_off(uuid, boolean, boolean);

create or replace function portal_client_respond_time_off(
  p_time_off uuid,
  p_project uuid,
  p_approve boolean,
  p_request_replacement boolean
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_account uuid := portal_my_account_id();
  v_start date;
  v_end date;
begin
  if v_account is null then
    raise exception 'only clients can respond to time off';
  end if;

  -- The leave must be approved internally, and its author must be a visible member of THIS project,
  -- which in turn must belong to my account.
  select t.start_date, t.end_date into v_start, v_end
  from portal_time_off t
  join portal_project_team pt
    on pt.user_id = t.user_id and pt.is_public = true and pt.active = true and pt.project_id = p_project
  join portal_projects pr
    on pr.id = p_project and pr.account_id = v_account
  where t.id = p_time_off
    and t.status = 'approved';

  if v_start is null then
    raise exception 'time off not found or not visible to you';
  end if;

  if p_request_replacement and (v_end - v_start + 1) <= 2 then
    raise exception 'a replacement can only be requested for leave longer than 2 days';
  end if;

  insert into portal_time_off_responses as r
    (time_off_id, account_id, project_id, approved, approved_at, replacement_requested, replacement_requested_at, responded_by)
  values (
    p_time_off,
    v_account,
    p_project,
    coalesce(p_approve, false),
    case when coalesce(p_approve, false) then now() end,
    coalesce(p_request_replacement, false),
    case when coalesce(p_request_replacement, false) then now() end,
    portal_my_user_id()
  )
  on conflict (time_off_id, project_id) do update set
    approved = coalesce(p_approve, r.approved),
    approved_at = case
      when coalesce(p_approve, false) and not r.approved then now()
      when not coalesce(p_approve, r.approved) then null
      else r.approved_at end,
    replacement_requested = coalesce(p_request_replacement, r.replacement_requested),
    replacement_requested_at = case
      when coalesce(p_request_replacement, false) and not r.replacement_requested then now()
      when not coalesce(p_request_replacement, r.replacement_requested) then null
      else r.replacement_requested_at end,
    responded_by = portal_my_user_id(),
    updated_at = now();
end $$;

grant execute on function portal_client_respond_time_off(uuid, uuid, boolean, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- f. Staff review queue: pending leave I may approve (admin: all; lead: my team)
-- ---------------------------------------------------------------------------

create or replace function portal_time_off_review_queue()
returns table (
  id uuid,
  user_id uuid,
  full_name text,
  team_name text,
  kind text,
  start_date date,
  end_date date,
  note text,
  days integer,
  status text
) language plpgsql security definer set search_path = public as $$
declare
  v_admin boolean := portal_is_admin();
begin
  if not portal_is_staff() then
    return;
  end if;

  return query
    select
      t.id,
      t.user_id,
      u.full_name,
      tm.name as team_name,
      t.kind,
      t.start_date,
      t.end_date,
      t.note,
      (t.end_date - t.start_date + 1)::int as days,
      t.status
    from portal_time_off t
    join portal_users u on u.id = t.user_id
    left join portal_teams tm on tm.id = u.team_id
    where t.status = 'pending'
      and t.end_date >= current_date
      and (
        v_admin
        or exists (select 1 from portal_teams l where l.lead_id = portal_my_user_id() and l.id = u.team_id)
      )
    order by t.start_date;
end $$;

grant execute on function portal_time_off_review_queue() to authenticated;

-- ---------------------------------------------------------------------------
-- g. Staff replacement requests: which project/client asked for cover
-- ---------------------------------------------------------------------------

create or replace function portal_time_off_replacement_requests()
returns table (
  id uuid,
  user_id uuid,
  full_name text,
  kind text,
  start_date date,
  end_date date,
  days integer,
  project_id uuid,
  project_name text,
  account_id uuid,
  account_name text,
  approved boolean,
  replacement_requested_at timestamptz
) language plpgsql security definer set search_path = public as $$
declare
  v_admin boolean := portal_is_admin();
begin
  if not portal_is_staff() then
    return;
  end if;

  return query
    select
      t.id,
      t.user_id,
      u.full_name,
      t.kind,
      t.start_date,
      t.end_date,
      (t.end_date - t.start_date + 1)::int as days,
      pr.id as project_id,
      pr.name as project_name,
      acc.id as account_id,
      acc.name as account_name,
      r.approved,
      r.replacement_requested_at
    from portal_time_off_responses r
    join portal_time_off t on t.id = r.time_off_id
    join portal_users u on u.id = t.user_id
    join portal_projects pr on pr.id = r.project_id
    join portal_accounts acc on acc.id = pr.account_id
    where r.replacement_requested = true
      and t.end_date >= current_date
      and (
        v_admin
        or exists (select 1 from portal_teams l where l.lead_id = portal_my_user_id() and l.id = u.team_id)
      )
    order by t.start_date, acc.name, pr.name;
end $$;

grant execute on function portal_time_off_replacement_requests() to authenticated;
