-- 0052_log_hours_fix_dropped_columns.sql — repair portal_log_hours after 0050 regressed it.
--
-- 0045 dropped portal_time_entries.visible_to_client and made `billable` a STORED GENERATED column,
-- and rewrote portal_log_hours to match (no billable/visible_to_client in the insert, optional billing
-- hours, pay_rate snapshot). 0050 then re-created portal_log_hours from the OLD 0041 body to add the
-- "reporter must be a public team member" guard — but that body still inserts into `billable` and
-- `visible_to_client`, so since 0050 every log-hours call errors:
--     column "visible_to_client" of relation "portal_time_entries" does not exist
--
-- This re-creates portal_log_hours combining BOTH: 0045's schema-correct body (optional billing hours,
-- pay_rate snapshot, insert without billable/visible_to_client) AND 0050's public-reporter guard.
--
-- Idempotent (create or replace, same 9-arg signature). Apply manually.

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

  -- Billing hours are optional (blank = non-billable work); validate the range only when given.
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
  -- Only admins may credit the log to a different (client-facing) reporter; it defaults to the employee.
  v_reporter := case when v_is_admin then coalesce(p_reporter, v_user) else v_user end;

  -- The client-facing reporter must be a public, active member of this project's team (the client only
  -- ever sees public members). Enforced for every admin log, including the default where the reporter
  -- is the employee — so a hidden member's work must be credited to a public reporter.
  if v_is_admin
     and not exists (
       select 1 from portal_project_team pt
       where pt.project_id = p_project
         and pt.user_id = v_reporter
         and coalesce(pt.active, true)
         and pt.is_public
     ) then
    raise exception 'reporter must be a public member of the project team';
  end if;

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
