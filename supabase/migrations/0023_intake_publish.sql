-- 0023_intake_publish.sql — the client sees an opportunity's Information gathering checklist only
-- once the team publishes it.
--
-- The team builds the checklist under the opportunity (Pipeline tab) and flips a switch when it's
-- ready. Until then the client's intake stays hidden — enforced in RLS, not just the UI.

alter table portal_opportunities
  add column if not exists intake_published boolean not null default false;

-- Clients read intake items only for opportunities whose checklist has been published; internal
-- staff still read everything (they build it before it goes live).
drop policy "portal read intake" on portal_intake_items;
create policy "portal read intake" on portal_intake_items
  for select to authenticated using (
    portal_can_read(account_id)
    and (
      portal_is_internal()
      or exists (
        select 1 from portal_opportunities o
        where o.id = opportunity_id and o.intake_published
      )
    )
  );
