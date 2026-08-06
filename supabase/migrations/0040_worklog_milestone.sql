-- 0039_worklog_milestone.sql — let the "Log hours" flow tag a worklog with a milestone.
--
-- portal_log_hours gains an optional p_milestone. When set, it must belong to the same project
-- (otherwise the log is rejected). Adding a parameter changes the function signature, so the old
-- 7-arg version is dropped first to avoid leaving an ambiguous overload behind.

drop function if exists portal_log_hours(uuid, uuid, date, text, numeric, numeric, boolean);

create or replace function portal_log_hours(
  p_project uuid,
  p_user uuid,
  p_entry_date date,
  p_description text,
  p_billing_hours numeric,
  p_actual_hours numeric,
  p_approved boolean,
  p_milestone uuid default null
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

  -- A milestone, when given, must belong to this project.
  if p_milestone is not null
     and not exists (select 1 from portal_milestones where id = p_milestone and project_id = p_project) then
    raise exception 'milestone does not belong to this project';
  end if;

  -- Non-admins can only log for themselves and can never mark a log approved.
  v_user := case when v_is_admin then coalesce(p_user, portal_my_user_id()) else portal_my_user_id() end;
  v_approved := case when v_is_admin then coalesce(p_approved, false) else false end;

  insert into portal_time_entries
    (project_id, milestone_id, user_id, entry_date, hours, actual_hours, description, billable, visible_to_client, approved)
  values
    (p_project, p_milestone, v_user, coalesce(p_entry_date, current_date), p_billing_hours,
     coalesce(p_actual_hours, p_billing_hours), coalesce(nullif(trim(p_description), ''), 'Delivery work'),
     true, true, v_approved);
end $$;

grant execute on function portal_log_hours(uuid, uuid, date, text, numeric, numeric, boolean, uuid) to authenticated;
