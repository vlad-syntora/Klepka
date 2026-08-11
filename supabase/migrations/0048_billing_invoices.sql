-- 0048_billing_invoices.sql — client billing invoices computed from approved worklogs.
--
-- The mirror of salaries (0044), but the *client* side of the ledger:
--   * Salary counts the internal Employee (user_id), ACTUAL hours, at the frozen internal pay rate.
--   * A billing invoice counts the client-facing Reporter (reporter_id), BILLING hours (`hours`), at
--     that reporter's client billing rate on the project (portal_project_team.rate, 0036).
--
-- Model:
--   * portal_billing_invoices      — one row per (project, month). open = accruing; approved = signed
--                                    off; sent = frozen (recompute skips it).
--   * portal_billing_invoice_lines — the per-reporter summary of that invoice: hours, the rate used,
--                                    and hours × rate. Rebuilt on every recompute (until 'sent').
--
-- Only APPROVED, BILLABLE logs count (billable = has billing hours; approval already gates client
-- visibility, 0045), so an invoice sums exactly what the client already sees on the Hours report.
--
-- Visibility: admin only (finance) plus the client of that project — and the client sees an invoice
-- only once it is 'sent'. Internal non-admin staff never read these (unlike hours, the *amount* is
-- finance data). RLS enforces it; the admin UI also gates.
--
-- Distinct from portal_invoices (0004), which is the manually-managed *payment schedule* (contracted
-- amounts, due dates, PDF links). These are the itemised time-and-materials bill behind that.
--
-- Standalone + idempotent, matching the migration convention. Apply manually.

-- ---------------------------------------------------------------------------
-- a. Tables
-- ---------------------------------------------------------------------------

create table if not exists portal_billing_invoices (
  id uuid primary key default gen_random_uuid(),
  -- account_id is denormalised from the project so the client read policy is a plain account match.
  account_id uuid not null references portal_accounts(id) on delete cascade,
  project_id uuid not null references portal_projects(id) on delete cascade,
  -- First day of the month the invoice covers.
  period date not null,
  currency text not null default 'USD',
  total_hours numeric(12, 2) not null default 0,
  total_amount numeric(14, 2) not null default 0,
  -- open = accruing; approved = signed off internally; sent = issued to the client (frozen).
  status text not null default 'open' check (status in ('open', 'approved', 'sent')),
  computed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, period)
);

create index if not exists portal_billing_invoices_account_idx on portal_billing_invoices (account_id);
create index if not exists portal_billing_invoices_period_idx on portal_billing_invoices (period);

drop trigger if exists portal_billing_invoices_set_updated_at on portal_billing_invoices;
create trigger portal_billing_invoices_set_updated_at before update on portal_billing_invoices
  for each row execute function set_updated_at();

-- One summary line per reporter on an invoice.
create table if not exists portal_billing_invoice_lines (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references portal_billing_invoices(id) on delete cascade,
  -- The client-facing reporter the work is credited to (may be null on legacy logs).
  reporter_id uuid references portal_users(id) on delete set null,
  hours numeric(12, 2) not null default 0,
  -- The reporter's billing rate frozen into this line at recompute time.
  rate numeric(12, 2),
  amount numeric(14, 2) not null default 0
);

create index if not exists portal_billing_invoice_lines_invoice_idx
  on portal_billing_invoice_lines (invoice_id);

-- ---------------------------------------------------------------------------
-- b. RLS — admin manages; the client reads only its own SENT invoices
-- ---------------------------------------------------------------------------

alter table portal_billing_invoices enable row level security;
alter table portal_billing_invoice_lines enable row level security;
revoke all on portal_billing_invoices from anon;
revoke all on portal_billing_invoice_lines from anon;

drop policy if exists "portal read billing invoices" on portal_billing_invoices;
create policy "portal read billing invoices" on portal_billing_invoices
  for select to authenticated using (
    portal_is_admin()
    or (portal_can_read(account_id) and portal_can_view_module('payments') and status = 'sent')
  );

drop policy if exists "portal write billing invoices" on portal_billing_invoices;
create policy "portal write billing invoices" on portal_billing_invoices
  for all to authenticated using (portal_is_admin()) with check (portal_is_admin());

drop policy if exists "portal read billing invoice lines" on portal_billing_invoice_lines;
create policy "portal read billing invoice lines" on portal_billing_invoice_lines
  for select to authenticated using (
    exists (
      select 1 from portal_billing_invoices i
      where i.id = invoice_id
        and (
          portal_is_admin()
          or (portal_can_read(i.account_id) and portal_can_view_module('payments') and i.status = 'sent')
        )
    )
  );

drop policy if exists "portal write billing invoice lines" on portal_billing_invoice_lines;
create policy "portal write billing invoice lines" on portal_billing_invoice_lines
  for all to authenticated using (portal_is_admin()) with check (portal_is_admin());

-- ---------------------------------------------------------------------------
-- c. Recompute a single (project, month) invoice from its approved billable worklogs
-- ---------------------------------------------------------------------------
-- Groups approved billable logs by reporter, values each reporter's billing hours at their current
-- project billing rate (portal_project_team.rate), and rebuilds the summary lines. The header is
-- auto-created the first time a project has qualifying work in a month (mirrors how salary rows
-- appear on the first logged hour). A 'sent' invoice is frozen — never rewritten.

create or replace function portal_recompute_billing_invoice(p_project uuid, p_period date)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_month date := date_trunc('month', p_period)::date;
  v_account uuid;
  v_invoice uuid;
  v_status text;
  v_has_work boolean;
  v_hours numeric;
  v_amount numeric;
begin
  if p_project is null or p_period is null then
    return;
  end if;

  select account_id into v_account from portal_projects where id = p_project;
  if v_account is null then
    return;
  end if;

  select id, status into v_invoice, v_status
  from portal_billing_invoices
  where project_id = p_project and period = v_month;

  -- A sent invoice is frozen — leave it exactly as issued.
  if v_status = 'sent' then
    return;
  end if;

  select exists (
    select 1 from portal_time_entries te
    where te.project_id = p_project
      and date_trunc('month', te.entry_date)::date = v_month
      and te.approved
      and te.hours is not null and te.hours > 0
  ) into v_has_work;

  -- Nothing to bill and no invoice yet — don't create an empty one.
  if v_invoice is null and not v_has_work then
    return;
  end if;

  if v_invoice is null then
    insert into portal_billing_invoices (account_id, project_id, period, currency)
    values (v_account, p_project, v_month, 'USD')
    returning id into v_invoice;
  end if;

  -- Rebuild the per-reporter summary from scratch.
  delete from portal_billing_invoice_lines where invoice_id = v_invoice;

  insert into portal_billing_invoice_lines (invoice_id, reporter_id, hours, rate, amount)
  select
    v_invoice,
    te.reporter_id,
    sum(coalesce(te.hours, 0)) as hours,
    r.rate,
    sum(coalesce(te.hours, 0)) * coalesce(r.rate, 0) as amount
  from portal_time_entries te
  left join lateral (
    select pt.rate
    from portal_project_team pt
    where pt.project_id = p_project
      and pt.user_id = te.reporter_id
      and pt.rate is not null
    order by pt.assigned_at desc
    limit 1
  ) r on true
  where te.project_id = p_project
    and date_trunc('month', te.entry_date)::date = v_month
    and te.approved
    and te.hours is not null and te.hours > 0
  group by te.reporter_id, r.rate;

  select coalesce(sum(hours), 0), coalesce(sum(amount), 0)
  into v_hours, v_amount
  from portal_billing_invoice_lines
  where invoice_id = v_invoice;

  update portal_billing_invoices
  set total_hours = v_hours, total_amount = v_amount, computed_at = now()
  where id = v_invoice;
end $$;

-- ---------------------------------------------------------------------------
-- d. Keep invoices in sync with every worklog change
-- ---------------------------------------------------------------------------

create or replace function portal_billing_from_time_entry()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    perform portal_recompute_billing_invoice(old.project_id, old.entry_date);
    return old;
  end if;

  perform portal_recompute_billing_invoice(new.project_id, new.entry_date);

  -- If the log moved to another project or month, refresh the old bucket too.
  if tg_op = 'UPDATE'
     and (old.project_id is distinct from new.project_id
          or date_trunc('month', old.entry_date) is distinct from date_trunc('month', new.entry_date)) then
    perform portal_recompute_billing_invoice(old.project_id, old.entry_date);
  end if;

  return new;
end $$;

drop trigger if exists portal_time_entry_billing on portal_time_entries;
create trigger portal_time_entry_billing
  after insert or update or delete on portal_time_entries
  for each row execute function portal_billing_from_time_entry();

-- ---------------------------------------------------------------------------
-- e. Change an invoice's status (open / approved / sent)
-- ---------------------------------------------------------------------------

create or replace function portal_set_billing_invoice_status(p_id uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not portal_is_admin() then
    raise exception 'only admins can change invoice status';
  end if;
  if p_status not in ('open', 'approved', 'sent') then
    raise exception 'invalid invoice status';
  end if;
  update portal_billing_invoices set status = p_status, updated_at = now() where id = p_id;
end $$;

grant execute on function portal_set_billing_invoice_status(uuid, text) to authenticated;
