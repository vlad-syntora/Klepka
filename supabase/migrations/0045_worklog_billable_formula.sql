-- 0045_worklog_billable_formula.sql — two worklog simplifications.
--
--   1. "Billable hours" (portal_time_entries.hours) becomes OPTIONAL. A worklog can now record only
--      the actual hours worked (for salary) without billing the client. `billable` stops being a
--      manual checkbox and becomes a DERIVED marker: a log is billable when it has billable hours.
--      It has no computational effect (neither the client budget draw-down nor salary read it) — it
--      is purely an analytics label.
--   2. Client visibility follows APPROVAL, not a separate flag. A client sees a worklog once it is
--      approved. The `visible_to_client` column and its RLS branch are removed.
--
-- Idempotent and safe to re-run. Applied manually.

-- ---------------------------------------------------------------------------
-- 1. Billable hours optional + derived `billable`
-- ---------------------------------------------------------------------------

-- Allow NULL billing hours. The existing CHECK (hours > 0 and hours <= 24) is satisfied when hours
-- is NULL (a CHECK passes on unknown), so non-billable logs pass while billed logs keep their range.
alter table portal_time_entries alter column hours drop not null;

-- Replace the manual `billable` boolean with a stored generated column. Drop first (clears the old
-- default/values), then re-add derived from whether billable hours are present.
alter table portal_time_entries drop column if exists billable;
alter table portal_time_entries
  add column billable boolean generated always as (hours is not null and hours > 0) stored;

-- ---------------------------------------------------------------------------
-- 2. Client visibility follows approval; drop visible_to_client
-- ---------------------------------------------------------------------------

-- Rewrite the read policy to gate the client on `approved` instead of `visible_to_client`; internal
-- staff still see everything.
drop policy if exists "portal read time entries" on portal_time_entries;
create policy "portal read time entries" on portal_time_entries
  for select to authenticated using (
    exists (
      select 1 from portal_projects p
      where p.id = project_id
        and (portal_is_internal() or (p.account_id = portal_my_account_id() and approved))
    )
  );

alter table portal_time_entries drop column if exists visible_to_client;

-- ---------------------------------------------------------------------------
-- 3. portal_log_hours — billing hours optional; no longer writes billable/visible_to_client
-- ---------------------------------------------------------------------------
-- Same 9-arg signature as 0041/0044 (create-or-replace, no drop). Changes: billing hours may be NULL
-- (non-billable work), a log must carry some hours (actual or billing), and the insert no longer
-- lists `billable` (generated) or `visible_to_client` (dropped). Pay-rate snapshot logic unchanged.

create or replace function portal_log_hours(
  p_project uuid,
  p_user uuid,
  p_entry_date date,
  p_description text,
  p_billing_hours numeric,
  p_actual_hours numeric,
  p_approved boolean,
  p_milestone uuid default null,
  p_reporter uuid default null
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_account uuid;
  v_is_admin boolean := portal_is_admin();
  v_user uuid;
  v_reporter uuid;
  v_approved boolean;
  v_pay_rate numeric;
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

  -- Billing hours are optional now (blank = non-billable work); validate the range only when given.
  if p_billing_hours is not null and (p_billing_hours <= 0 or p_billing_hours > 24) then
    raise exception 'billing hours must be between 0 and 24';
  end if;

  -- A worklog still needs some hours: actual, or billing (which actual falls back to).
  if coalesce(p_actual_hours, p_billing_hours) is null then
    raise exception 'log some hours (actual or billing)';
  end if;

  if p_milestone is not null
     and not exists (select 1 from portal_milestones where id = p_milestone and project_id = p_project) then
    raise exception 'milestone does not belong to this project';
  end if;

  -- Non-admins can only log for themselves and can never mark a log approved.
  v_user := case when v_is_admin then coalesce(p_user, portal_my_user_id()) else portal_my_user_id() end;
  v_approved := case when v_is_admin then coalesce(p_approved, false) else false end;
  v_reporter := case when v_is_admin then coalesce(p_reporter, v_user) else v_user end;

  -- Freeze the pay rate: this employee's rate on this project, else their default. Stays put if the
  -- rate later changes, so salary history is stable.
  v_pay_rate := coalesce(
    (select pt.pay_rate from portal_project_team pt
       where pt.project_id = p_project and pt.user_id = v_user and pt.pay_rate is not null
       order by pt.assigned_at desc limit 1),
    (select pay_rate from portal_users where id = v_user));

  insert into portal_time_entries
    (project_id, milestone_id, user_id, reporter_id, entry_date, hours, actual_hours, description,
     approved, pay_rate)
  values
    (p_project, p_milestone, v_user, v_reporter, coalesce(p_entry_date, current_date), p_billing_hours,
     coalesce(p_actual_hours, p_billing_hours), coalesce(nullif(trim(p_description), ''), 'Delivery work'),
     v_approved, v_pay_rate);
end $$;

grant execute on function portal_log_hours(uuid, uuid, date, text, numeric, numeric, boolean, uuid, uuid) to authenticated;
