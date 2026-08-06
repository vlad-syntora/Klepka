-- 0042_public_holidays.sql — a shared calendar of public holidays surfaced on the admin and client
-- dashboards.
--
-- Why: delivery teams and clients both want visibility of upcoming public holidays (when Klepka is
-- off / responses may be slower). The list is global — not per-account — and maintained by admins.
--
-- Access model:
--   • read  — all internal staff (including implementers), plus clients whose account has reached at
--             least "qualified" (so leads and closed/lost accounts don't see it).
--   • write — portal_admins only. Implementers get read-only (they are staff but not admins).
--
-- Fully idempotent, matching the standalone-migration convention (the APPLY_0005_to_0017 bundle is
-- frozen at 0017). Apply manually.

create table if not exists portal_public_holidays (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  holiday_date date not null,
  description text not null default '',
  -- Optional ISO country code (e.g. 'PL', 'US'); null = applies everywhere.
  country text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists portal_public_holidays_date_idx on portal_public_holidays (holiday_date);

drop trigger if exists portal_public_holidays_set_updated_at on portal_public_holidays;
create trigger portal_public_holidays_set_updated_at before update on portal_public_holidays
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table portal_public_holidays enable row level security;
revoke all on portal_public_holidays from anon;

drop policy if exists "portal read public holidays" on portal_public_holidays;
create policy "portal read public holidays" on portal_public_holidays
  for select to authenticated using (
    portal_is_staff()
    or exists (
      select 1 from portal_accounts a
      where a.id = portal_my_account_id()
        and a.lifecycle in ('qualified', 'proposal_sent', 'live')
    )
  );

drop policy if exists "portal write public holidays" on portal_public_holidays;
create policy "portal write public holidays" on portal_public_holidays
  for all to authenticated using (portal_is_admin()) with check (portal_is_admin());
