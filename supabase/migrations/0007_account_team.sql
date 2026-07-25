-- 0007_account_team.sql — internal team at the account level (the "pre-sale team").
--
-- Until now internal staffing existed only per-project (portal_project_team) plus a single
-- account owner. Pre-sales needs a team on the account before any project exists — the people
-- working a lead/opportunity. Distinct from portal_users (clients) and from the project team.

create table portal_account_team (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references portal_accounts(id) on delete cascade,
  -- Must be an internal staff member (account_id is null on that row); enforced in the app.
  user_id uuid not null references portal_users(id) on delete cascade,
  team_role text not null default 'Pre-sale',
  added_at timestamptz not null default now(),
  active boolean not null default true,
  unique (account_id, user_id)
);
create index portal_account_team_account_idx on portal_account_team (account_id);

alter table portal_account_team enable row level security;
revoke all on portal_account_team from anon;

-- Managed by internal staff; readable by anyone who can read the account (so the client could
-- later be shown "your Klepka team" — no client UI queries it yet).
create policy "portal read account team" on portal_account_team
  for select to authenticated using (portal_can_read(account_id));
create policy "portal write account team" on portal_account_team
  for all to authenticated using (portal_can_manage(account_id)) with check (portal_can_manage(account_id));
