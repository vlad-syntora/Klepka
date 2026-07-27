-- 0018_team_public.sql — mark which staffed people are shown to the client ("public members").
--
-- Both the account (pre-sale) team and each project team can now carry internal-only people the
-- client should never see. A per-row is_public flag governs two things:
--   1. whether the member shows up in the client's "Your Klepka team" roster, and
--   2. whether the client can leave feedback about them.
-- Existing rows default to public (true) so current rosters don't silently empty out.

alter table portal_account_team
  add column if not exists is_public boolean not null default true;

alter table portal_project_team
  add column if not exists is_public boolean not null default true;

-- Feedback targets = every public member staffed on the account (pre-sale team + project team),
-- plus the account owner (always contactable). Constrained to this account — never a company-wide
-- staff list (design doc §11.4.5–6).
create or replace function portal_feedback_targets()
returns table (user_id uuid, full_name text, project_role text)
language sql stable security definer set search_path = public as $$
  with acct as (select portal_my_account_id() as id)
  -- pre-sale / account team
  select u.id, u.full_name, at.team_role
  from portal_account_team at
  join portal_users u on u.id = at.user_id
  where at.account_id = (select id from acct) and at.active and at.is_public
  union
  -- project team (across all of the account's projects)
  select u.id, u.full_name, pt.project_role
  from portal_project_team pt
  join portal_projects p on p.id = pt.project_id
  join portal_users u on u.id = pt.user_id
  where p.account_id = (select id from acct) and pt.active and pt.is_public
  union
  -- account owner, always
  select u.id, u.full_name, coalesce(u.title, 'Account Owner')
  from portal_accounts a join portal_users u on u.id = a.owner_id
  where a.id = (select id from acct);
$$;
