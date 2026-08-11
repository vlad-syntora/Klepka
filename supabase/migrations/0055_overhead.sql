-- 0055_overhead.sql — company overhead → minimum per-hour markup to cover fixed monthly costs.
--
-- Why: the finance module (0044 salaries) tracks what each employee COSTS. This adds the other side —
-- the company's fixed running costs (subscriptions, vendors) — so an admin can see how much of every
-- billable hour must go to overhead. The calc (done client-side, admin-only) is:
--
--   monthly(expense) = base / {monthly:1, quarterly:3, annual:12, one_off:amortize_months}
--                      × headcount   (only when scope = 'per_seat')
--   total            = Σ monthly(active expenses)
--   per_employee     = total / headcount            (headcount = active internal, counts_for_overhead)
--   markup / hour    = per_employee ÷ [hours_high … hours_low]   (a band → the min safe markup is the
--                      figure at the LOW hours end)
--
-- Model:
--   • portal_overhead_expenses — one row per fixed cost. Multi-currency: each row is stored in its own
--     currency with a manual fx_rate INTO the base currency (base = amount × fx_rate). one_off costs are
--     amortised across amortize_months. scope='per_seat' multiplies by the counted headcount.
--   • portal_finance_settings — singleton holding the base currency + the monthly-hours band the markup
--     is derived against.
--   • portal_users.counts_for_overhead — marks who COVERS (earns back) the overhead. These active
--     internal staff are the divisor. It does NOT govern seat consumption: every active internal person
--     consumes a license, so per_seat costs scale with ALL active staff — a non-covering active employee
--     still adds seat cost that the covering ones must absorb.
--
-- Access model: finance is admin-only for now (mirrors 0044 salaries) — read AND write require
-- portal_is_admin(). RLS enforces it; the admin UI also gates the page to portal_admin. Nothing here is
-- ever exposed to clients.
--
-- Standalone + idempotent, matching the migration convention. Apply manually.

-- ---------------------------------------------------------------------------
-- Expenses
-- ---------------------------------------------------------------------------

create table if not exists portal_overhead_expenses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  -- Free-text grouping tag (e.g. 'software', 'vendor', 'office'). Nullable = uncategorised.
  category text,
  note text,
  amount numeric(12, 2) not null,
  currency text not null default 'USD',
  -- Manual FX rate INTO the base currency (base = amount × fx_rate). 1 when already in the base currency.
  fx_rate numeric(14, 6) not null default 1,
  cadence text not null default 'monthly' check (cadence in ('monthly', 'quarterly', 'annual', 'one_off')),
  -- Only meaningful for cadence='one_off': spread the cost across this many months. Ignored otherwise.
  amortize_months integer check (amortize_months is null or amortize_months > 0),
  -- 'company' = flat cost for the whole company; 'per_seat' = multiplied by the counted headcount.
  scope text not null default 'company' check (scope in ('company', 'per_seat')),
  -- Turn a cost off without deleting it (e.g. once a one-off's amortisation window has passed).
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists portal_overhead_expenses_set_updated_at on portal_overhead_expenses;
create trigger portal_overhead_expenses_set_updated_at before update on portal_overhead_expenses
  for each row execute function set_updated_at();

alter table portal_overhead_expenses enable row level security;
revoke all on portal_overhead_expenses from anon;

drop policy if exists "portal admin overhead expenses" on portal_overhead_expenses;
create policy "portal admin overhead expenses" on portal_overhead_expenses
  for all to authenticated using (portal_is_admin()) with check (portal_is_admin());

-- ---------------------------------------------------------------------------
-- Finance settings (singleton) — base currency + the monthly-hours band
-- ---------------------------------------------------------------------------

create table if not exists portal_finance_settings (
  id boolean primary key default true check (id),
  base_currency text not null default 'USD',
  -- The assumed billable-hours band per counted employee per month. Low hours → higher required markup,
  -- so the min safe markup is the figure derived at overhead_hours_low.
  overhead_hours_low numeric(6, 1) not null default 80,
  overhead_hours_high numeric(6, 1) not null default 160,
  updated_at timestamptz not null default now()
);

-- Seed the single row so the settings panel can always update in place.
insert into portal_finance_settings (id) values (true) on conflict (id) do nothing;

drop trigger if exists portal_finance_settings_set_updated_at on portal_finance_settings;
create trigger portal_finance_settings_set_updated_at before update on portal_finance_settings
  for each row execute function set_updated_at();

alter table portal_finance_settings enable row level security;
revoke all on portal_finance_settings from anon;

drop policy if exists "portal admin finance settings" on portal_finance_settings;
create policy "portal admin finance settings" on portal_finance_settings
  for all to authenticated using (portal_is_admin()) with check (portal_is_admin());

-- ---------------------------------------------------------------------------
-- Headcount mark on the employee
-- ---------------------------------------------------------------------------

-- Whether this person COVERS overhead (earns it back) — i.e. is part of the divisor. It does NOT affect
-- seat consumption (all active internal staff consume per-seat costs regardless). Defaults true so
-- existing internal staff cover; admins untick anyone who doesn't earn it back (e.g. non-billable roles).
-- Only ever meaningful for internal staff (account_id is null); irrelevant for client users.
alter table portal_users
  add column if not exists counts_for_overhead boolean not null default true;
