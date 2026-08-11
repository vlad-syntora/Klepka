-- 0054_candidate_unique_per_opportunity.sql — scope the candidate uniqueness to the opportunity.
--
-- portal_candidates was created in 0015 with `unique (account_id, user_id)`, back when a candidate was
-- an account-level shortlist. 0021 then made candidates PER-OPPORTUNITY (added opportunity_id, NOT NULL)
-- but left the old account-level unique key in place. The result: proposing the same staff member on a
-- second opportunity of the same account fails with
--   duplicate key value violates unique constraint "portal_candidates_account_id_user_id_key"
-- even though that is a legitimate, distinct proposal.
--
-- This drops the stale account-level constraint and replaces it with the correct grain — one candidacy
-- per (opportunity, user). opportunity_id is NOT NULL and each opportunity belongs to exactly one
-- account, so this stays at least as strict within an opportunity while allowing the same person to be
-- a candidate across different opportunities.
--
-- Idempotent. Apply manually.

alter table portal_candidates
  drop constraint if exists portal_candidates_account_id_user_id_key;

-- Guard against a partially-applied run: only add the new constraint if it isn't already present.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'portal_candidates'::regclass
      and conname = 'portal_candidates_opportunity_id_user_id_key'
  ) then
    alter table portal_candidates
      add constraint portal_candidates_opportunity_id_user_id_key unique (opportunity_id, user_id);
  end if;
end $$;
