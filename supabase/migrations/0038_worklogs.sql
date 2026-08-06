-- 0038_worklogs.sql — a simple, reusable "log hours" flow for staff.
--
-- Adds two fields to the existing time entries and the RPCs the Log hours widget uses:
--   * actual_hours — hours actually worked, defaulting to the billed hours (the existing `hours`).
--   * approved     — a manager sign-off, editable by admins only.
--   * portal_log_hours()        — insert a worklog with the "non-admins can only log for themselves
--                                 and can't approve" rules enforced server-side.
--   * portal_projects_for_user()— the projects a given employee is staffed on (for the widget's
--                                 project picker when it isn't opened at a project level).

-- ---------------------------------------------------------------------------
-- a. Columns
-- ---------------------------------------------------------------------------

alter table portal_time_entries
  -- Hours actually worked; `hours` stays the billed figure the client budget draws down.
  add column if not exists actual_hours numeric(6,2),
  -- Manager sign-off. Admin-only to set (enforced in portal_log_hours + the widget).
  add column if not exists approved boolean not null default false;

-- ---------------------------------------------------------------------------
-- b. Log hours (security definer — enforces the per-user rules the UI mirrors)
-- ---------------------------------------------------------------------------

create or replace function portal_log_hours(
  p_project uuid,
  p_user uuid,
  p_entry_date date,
  p_description text,
  p_billing_hours numeric,
  p_actual_hours numeric,
  p_approved boolean
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_account uuid;
  v_is_admin boolean := portal_is_admin();
  v_user uuid;
  v_approved boolean;
begin
  if not portal_is_staff() then
    raise exception 'only staff can log hours';
  end if;

  select account_id into v_account from portal_projects where id = p_project;
  if v_account is null then
    raise exception 'project not found';
  end if;
  if not portal_can_manage(v_account) then
    raise exception 'not allowed to log hours on this project';
  end if;

  if coalesce(p_billing_hours, 0) <= 0 or p_billing_hours > 24 then
    raise exception 'billing hours must be between 0 and 24';
  end if;

  -- Non-admins can only log for themselves and can never mark a log approved.
  v_user := case when v_is_admin then coalesce(p_user, portal_my_user_id()) else portal_my_user_id() end;
  v_approved := case when v_is_admin then coalesce(p_approved, false) else false end;

  insert into portal_time_entries
    (project_id, user_id, entry_date, hours, actual_hours, description, billable, visible_to_client, approved)
  values
    (p_project, v_user, coalesce(p_entry_date, current_date), p_billing_hours,
     coalesce(p_actual_hours, p_billing_hours), coalesce(nullif(trim(p_description), ''), 'Delivery work'),
     true, true, v_approved);
end $$;

grant execute on function portal_log_hours(uuid, uuid, date, text, numeric, numeric, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- c. Projects an employee is staffed on (for the widget's project picker)
-- ---------------------------------------------------------------------------

create or replace function portal_projects_for_user(p_user uuid)
returns table (id uuid, name text, account_name text)
language sql stable security definer set search_path = public as $$
  select p.id, p.name, a.name
  from portal_project_team t
  join portal_projects p on p.id = t.project_id
  join portal_accounts a on a.id = p.account_id
  where t.user_id = p_user
    and t.active
    and portal_is_staff()
    -- Admins can look up anyone; other staff only their own projects.
    and (portal_is_admin() or p_user = portal_my_user_id())
  order by p.name;
$$;

grant execute on function portal_projects_for_user(uuid) to authenticated;
