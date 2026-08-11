-- 0044_salary_tracking.sql — first slice of portal finance: employee pay rates and monthly salaries.
--
-- Distinct from the *client billing* rate already on portal_offer_items (0024) and portal_project_team
-- (0036) — that is what the client pays. The columns added here are the internal *pay/cost* rate: what
-- Klepka pays the person. Keeping the two apart is what lets us compute margin (bill − cost) later.
--
-- Model (all admin-only for now; a `finance` grant can widen access later):
--   * portal_users.pay_rate / pay_currency — an employee's default hourly cost rate + currency.
--   * portal_offer_items.employee_id / pay_rate — the line's staffed employee and its cost rate,
--     defaulting from that employee but editable per offer.
--   * portal_project_team.pay_rate — the effective per-project cost rate (source of truth for salary).
--   * portal_time_entries.pay_rate — the rate FROZEN onto each worklog at log time (decision: history
--     is stable; changing a rate only affects future logs). Salary = Σ(actual_hours × frozen pay_rate).
--   * portal_salaries — one row per (employee, month). Recomputed by a trigger whenever a worklog is
--     created / changed / deleted. Frozen once status = 'paid'.
--
-- Salary counts hours where the person is the internal Employee (portal_time_entries.user_id), NOT the
-- client-facing reporter (0041), using actual_hours, bucketed by entry_date's month.
--
-- Standalone + idempotent, matching the migration convention (APPLY_0005_to_0017 is frozen at 0017).
-- Apply manually.

-- ---------------------------------------------------------------------------
-- a. Rate columns
-- ---------------------------------------------------------------------------

-- Employee default hourly cost rate. Internal staff only (account_id is null); nullable = not set.
alter table portal_users
  add column if not exists pay_rate numeric(12, 2),
  add column if not exists pay_currency text not null default 'USD';

-- Offer line: the employee it staffs and the cost rate quoted for it (defaults from the employee,
-- editable per offer). Copied onto the project team member when the project is created.
alter table portal_offer_items
  add column if not exists employee_id uuid references portal_users(id) on delete set null,
  add column if not exists pay_rate numeric(12, 2);

-- Project team: the effective per-project cost rate. Admin-only, like the billing columns (0036) —
-- the client roster never selects it.
alter table portal_project_team
  add column if not exists pay_rate numeric(12, 2);

-- Worklog: the pay rate frozen at log time. Salary sums this, so a later rate change never rewrites
-- pay for hours already logged.
alter table portal_time_entries
  add column if not exists pay_rate numeric(12, 2);

-- ---------------------------------------------------------------------------
-- b. Salaries object — one row per employee per month
-- ---------------------------------------------------------------------------

create table if not exists portal_salaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references portal_users(id) on delete cascade,
  -- First day of the month the salary covers.
  period date not null,
  currency text not null default 'USD',
  total_hours numeric(12, 2) not null default 0,
  total_amount numeric(14, 2) not null default 0,
  -- open = accruing; approved = signed off; paid = frozen (recompute skips it).
  status text not null default 'open' check (status in ('open', 'approved', 'paid')),
  computed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, period)
);

create index if not exists portal_salaries_period_idx on portal_salaries (period);

drop trigger if exists portal_salaries_set_updated_at on portal_salaries;
create trigger portal_salaries_set_updated_at before update on portal_salaries
  for each row execute function set_updated_at();

alter table portal_salaries enable row level security;

drop policy if exists "portal admin read salaries" on portal_salaries;
create policy "portal admin read salaries" on portal_salaries
  for select using (portal_is_admin());

drop policy if exists "portal admin write salaries" on portal_salaries;
create policy "portal admin write salaries" on portal_salaries
  for all using (portal_is_admin()) with check (portal_is_admin());

-- ---------------------------------------------------------------------------
-- c. Recompute a single (employee, month) salary from its frozen worklog rates
-- ---------------------------------------------------------------------------

create or replace function portal_recompute_salary(p_user uuid, p_period date)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_month date := date_trunc('month', p_period)::date;
  v_hours numeric;
  v_amount numeric;
  v_currency text;
  v_status text;
begin
  if p_user is null or p_period is null then
    return;
  end if;

  -- A paid salary is frozen — never rewrite it.
  select status into v_status from portal_salaries where user_id = p_user and period = v_month;
  if v_status = 'paid' then
    return;
  end if;

  select
    coalesce(sum(coalesce(actual_hours, hours, 0)), 0),
    coalesce(sum(coalesce(actual_hours, hours, 0) * coalesce(pay_rate, 0)), 0)
  into v_hours, v_amount
  from portal_time_entries
  where user_id = p_user
    and date_trunc('month', entry_date)::date = v_month;

  select coalesce(pay_currency, 'USD') into v_currency from portal_users where id = p_user;

  insert into portal_salaries (user_id, period, currency, total_hours, total_amount, computed_at)
  values (p_user, v_month, coalesce(v_currency, 'USD'), v_hours, v_amount, now())
  on conflict (user_id, period) do update set
    total_hours = excluded.total_hours,
    total_amount = excluded.total_amount,
    currency = excluded.currency,
    computed_at = now();
end $$;

-- ---------------------------------------------------------------------------
-- d. Keep salaries in sync with every worklog change
-- ---------------------------------------------------------------------------

create or replace function portal_salary_from_time_entry()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    perform portal_recompute_salary(old.user_id, old.entry_date);
    return old;
  end if;

  perform portal_recompute_salary(new.user_id, new.entry_date);

  -- On an update that moves the log to another employee or month, refresh the old bucket too.
  if tg_op = 'UPDATE'
     and (old.user_id is distinct from new.user_id
          or date_trunc('month', old.entry_date) is distinct from date_trunc('month', new.entry_date)) then
    perform portal_recompute_salary(old.user_id, old.entry_date);
  end if;

  return new;
end $$;

drop trigger if exists portal_time_entry_salary on portal_time_entries;
create trigger portal_time_entry_salary
  after insert or update or delete on portal_time_entries
  for each row execute function portal_salary_from_time_entry();

-- ---------------------------------------------------------------------------
-- e. Open a salary month — pre-create a zero row for every active internal employee
-- ---------------------------------------------------------------------------

create or replace function portal_open_salary_month(p_period date)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_month date := date_trunc('month', coalesce(p_period, current_date))::date;
  v_user uuid;
begin
  if not portal_is_admin() then
    raise exception 'only admins can open a salary month';
  end if;

  -- Internal staff = no client account. Zero rows for anyone not already opened.
  insert into portal_salaries (user_id, period, currency, total_hours, total_amount)
  select u.id, v_month, coalesce(u.pay_currency, 'USD'), 0, 0
  from portal_users u
  where u.account_id is null
    and u.status = 'active'
  on conflict (user_id, period) do nothing;

  -- Reflect any hours already logged this month.
  for v_user in
    select u.id from portal_users u where u.account_id is null and u.status = 'active'
  loop
    perform portal_recompute_salary(v_user, v_month);
  end loop;
end $$;

grant execute on function portal_open_salary_month(date) to authenticated;

-- ---------------------------------------------------------------------------
-- f. Change a salary's status (open / approved / paid)
-- ---------------------------------------------------------------------------

create or replace function portal_set_salary_status(p_id uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not portal_is_admin() then
    raise exception 'only admins can change salary status';
  end if;
  if p_status not in ('open', 'approved', 'paid') then
    raise exception 'invalid salary status';
  end if;
  update portal_salaries set status = p_status, updated_at = now() where id = p_id;
end $$;

grant execute on function portal_set_salary_status(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- g. Snapshot the pay rate onto each worklog at log time
-- ---------------------------------------------------------------------------
-- Same 9-arg signature as 0041, so create-or-replace (no drop needed). The only change is computing
-- v_pay_rate = the employee's project rate, falling back to their default rate, and storing it.

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

  if coalesce(p_billing_hours, 0) <= 0 or p_billing_hours > 24 then
    raise exception 'billing hours must be between 0 and 24';
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
     billable, visible_to_client, approved, pay_rate)
  values
    (p_project, p_milestone, v_user, v_reporter, coalesce(p_entry_date, current_date), p_billing_hours,
     coalesce(p_actual_hours, p_billing_hours), coalesce(nullif(trim(p_description), ''), 'Delivery work'),
     true, true, v_approved, v_pay_rate);
end $$;

grant execute on function portal_log_hours(uuid, uuid, date, text, numeric, numeric, boolean, uuid, uuid) to authenticated;
