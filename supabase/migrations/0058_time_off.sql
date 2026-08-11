-- 0058_time_off.sql — employee time off (vacation / sick leave) with an internal admin sign-off and a
-- client-visible availability feed.
--
-- Why: internal staff had no way to record vacations / sick leave, and clients had no visibility of when
-- a Klepka person on their project will be away. Flow:
--   1. an employee logs their own leave (self-service)  → status 'pending'
--   2. an admin approves it internally                   → status 'approved'  (only then is it exposed)
--   3. the client sees the approved leave of staff who are *visible members* of one of the client's
--      projects, and can Approve it (acknowledge) and — when the leave is longer than 2 days — Request
--      a replacement for the period.
--
-- Client responses are stored per (leave, account): the same staffer can be visible to several clients,
-- each of which responds independently. Clients never touch these tables directly — only through the
-- SECURITY DEFINER RPCs below, mirroring the rest of the portal's client-write model.
--
-- Access model:
--   • portal_time_off           read: own leave or admin; write: own leave (staff) or admin. A guard
--                               trigger pins non-admin writes to status 'pending' (no self-approval).
--   • portal_time_off_responses read: staff (admins/staff see client responses on the Time Off page);
--                               client writes go through portal_client_respond_time_off only.
--
-- Standalone + idempotent, matching the migration convention (APPLY_0005_to_0017 is frozen at 0017).
-- Apply manually.

-- ---------------------------------------------------------------------------
-- a. Leave records
-- ---------------------------------------------------------------------------

create table if not exists portal_time_off (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references portal_users(id) on delete cascade,
  kind text not null check (kind in ('vacation', 'sick')),
  start_date date not null,
  end_date date not null,
  note text not null default '',
  -- INTERNAL Klepka sign-off, distinct from the client's acknowledgement below.
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references portal_users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date)
);

create index if not exists portal_time_off_user_idx on portal_time_off (user_id);
create index if not exists portal_time_off_status_date_idx on portal_time_off (status, start_date);

drop trigger if exists portal_time_off_set_updated_at on portal_time_off;
create trigger portal_time_off_set_updated_at before update on portal_time_off
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- b. Client responses — one row per (leave, account)
-- ---------------------------------------------------------------------------

create table if not exists portal_time_off_responses (
  id uuid primary key default gen_random_uuid(),
  time_off_id uuid not null references portal_time_off(id) on delete cascade,
  account_id uuid not null references portal_accounts(id) on delete cascade,
  approved boolean not null default false,
  approved_at timestamptz,
  replacement_requested boolean not null default false,
  replacement_requested_at timestamptz,
  responded_by uuid references portal_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (time_off_id, account_id)
);

create index if not exists portal_time_off_responses_time_off_idx on portal_time_off_responses (time_off_id);

drop trigger if exists portal_time_off_responses_set_updated_at on portal_time_off_responses;
create trigger portal_time_off_responses_set_updated_at before update on portal_time_off_responses
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- c. Guard: non-admins can never approve their own (or anyone's) leave
-- ---------------------------------------------------------------------------

create or replace function portal_time_off_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not portal_is_admin() then
    new.status := 'pending';
    new.reviewed_by := null;
    new.reviewed_at := null;
  end if;
  return new;
end $$;

drop trigger if exists portal_time_off_guard on portal_time_off;
create trigger portal_time_off_guard before insert or update on portal_time_off
  for each row execute function portal_time_off_guard();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table portal_time_off enable row level security;
revoke all on portal_time_off from anon;

drop policy if exists "portal read time off" on portal_time_off;
create policy "portal read time off" on portal_time_off
  for select to authenticated using (portal_is_admin() or user_id = portal_my_user_id());

drop policy if exists "portal write time off" on portal_time_off;
create policy "portal write time off" on portal_time_off
  for all to authenticated
  using (portal_is_admin() or (portal_is_staff() and user_id = portal_my_user_id()))
  with check (portal_is_admin() or (portal_is_staff() and user_id = portal_my_user_id()));

alter table portal_time_off_responses enable row level security;
revoke all on portal_time_off_responses from anon;

-- Staff can read every client response (shown on the admin Time Off page). Clients read their own only
-- through portal_my_team_time_off(); they never write these rows except via the RPC below.
drop policy if exists "portal read time off responses" on portal_time_off_responses;
create policy "portal read time off responses" on portal_time_off_responses
  for select to authenticated using (portal_is_staff());

-- ---------------------------------------------------------------------------
-- d. Admin: set a leave's internal status
-- ---------------------------------------------------------------------------

create or replace function portal_set_time_off_status(p_id uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not portal_is_admin() then
    raise exception 'only admins can review time off';
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
-- e. Client feed: approved leave of visible members of my projects
-- ---------------------------------------------------------------------------
-- A staffer is "visible" to the client when they are an active, public member of a project on the
-- client's account (portal_project_team, is_public + active) — the same rule the snapshot roster uses.

create or replace function portal_my_team_time_off()
returns table (
  id uuid,
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
    left join portal_time_off_responses r
      on r.time_off_id = t.id and r.account_id = v_account
    where t.status = 'approved'
      and t.end_date >= current_date
      and exists (
        select 1
        from portal_project_team pt
        join portal_projects pr on pr.id = pt.project_id
        where pt.user_id = t.user_id
          and pt.is_public = true
          and pt.active = true
          and pr.account_id = v_account
      )
    order by t.start_date;
end $$;

grant execute on function portal_my_team_time_off() to authenticated;

-- ---------------------------------------------------------------------------
-- f. Client: approve a leave and/or request a replacement for it
-- ---------------------------------------------------------------------------

create or replace function portal_client_respond_time_off(
  p_time_off uuid,
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

  -- The leave must be approved internally and belong to a visible member of one of my projects.
  select t.start_date, t.end_date into v_start, v_end
  from portal_time_off t
  where t.id = p_time_off
    and t.status = 'approved'
    and exists (
      select 1
      from portal_project_team pt
      join portal_projects pr on pr.id = pt.project_id
      where pt.user_id = t.user_id
        and pt.is_public = true
        and pt.active = true
        and pr.account_id = v_account
    );

  if v_start is null then
    raise exception 'time off not found or not visible to you';
  end if;

  -- A replacement can only be requested for leave longer than 2 days.
  if p_request_replacement and (v_end - v_start + 1) <= 2 then
    raise exception 'a replacement can only be requested for leave longer than 2 days';
  end if;

  insert into portal_time_off_responses as r
    (time_off_id, account_id, approved, approved_at, replacement_requested, replacement_requested_at, responded_by)
  values (
    p_time_off,
    v_account,
    coalesce(p_approve, false),
    case when coalesce(p_approve, false) then now() end,
    coalesce(p_request_replacement, false),
    case when coalesce(p_request_replacement, false) then now() end,
    portal_my_user_id()
  )
  on conflict (time_off_id, account_id) do update set
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

grant execute on function portal_client_respond_time_off(uuid, boolean, boolean) to authenticated;
