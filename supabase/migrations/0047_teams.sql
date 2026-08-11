-- 0047_teams.sql — employee teams: a named group of internal staff with a lead + project manager.
--
-- Why: internal staff are otherwise a flat "Klepka team" list. Grouping them into teams (each with a
-- team lead and a project manager) is the structure future reports roll up on — salaries, logged hours
-- and delivery per team all join through portal_users.team_id.
--
-- Model:
--   • portal_teams — one row per team. lead_id / pm_id are any internal staff (references only; they
--     need not be members of the team). Both nullable = "not assigned yet".
--   • portal_users.team_id — one team per employee (nullable = unassigned). Cleared if the team is
--     deleted. Assigned via the existing admin write path on portal_users (no new user-table policy).
--
-- Access model (mirrors 0042 public holidays — a global, admin-managed directory):
--   • read  — any internal staff.
--   • write — portal_admins only. RLS enforces it; the admin UI also gates the page to portal_admin.
--
-- Standalone + idempotent, matching the migration convention (the APPLY_0005_to_0017 bundle is frozen
-- at 0017). Apply manually.

create table if not exists portal_teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  -- Team lead and project manager — any internal staff, referenced (not membership). Cleared if the
  -- referenced person is removed.
  lead_id uuid references portal_users(id) on delete set null,
  pm_id   uuid references portal_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists portal_teams_set_updated_at on portal_teams;
create trigger portal_teams_set_updated_at before update on portal_teams
  for each row execute function set_updated_at();

-- One team per employee (nullable = unassigned); clear the link if the team is deleted.
alter table portal_users
  add column if not exists team_id uuid references portal_teams(id) on delete set null;

create index if not exists portal_users_team_idx on portal_users (team_id);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table portal_teams enable row level security;
revoke all on portal_teams from anon;

drop policy if exists "portal read teams" on portal_teams;
create policy "portal read teams" on portal_teams
  for select to authenticated using (portal_is_staff());

drop policy if exists "portal write teams" on portal_teams;
create policy "portal write teams" on portal_teams
  for all to authenticated using (portal_is_admin()) with check (portal_is_admin());
