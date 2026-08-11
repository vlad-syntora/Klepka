-- 0051_won_project_team.sql — when an opportunity is won, carry its team onto the auto-created
-- project.
--
-- Closing an opportunity (stage → 'closed_won') fires portal_opportunity_won() (0010), which creates
-- the project and links its documents — but it never seeded the team. Only the manual "Create Project
-- from Opportunity" wizard copied the roster (from the accepted offer's line items). So a plain
-- stage-flip produced a project with an empty team. This replaces the trigger function to also seed
-- portal_project_team from the accepted offer's line items, matching the wizard exactly:
--   display_name ← item.name, project_role ← item.detail (or 'Team member'), user_id ← employee_id,
--   and the billing/cost columns (billing_type, rate ← amount, overtime_rate, monthly_hours, pay_rate).
--
-- Standalone + idempotent. Apply manually.

create or replace function portal_opportunity_won() returns trigger
  language plpgsql security definer set search_path = public as $$
declare
  new_project uuid;
  v_offer uuid;
begin
  if new.stage = 'closed_won'
     and (tg_op = 'INSERT' or old.stage is distinct from 'closed_won')
     and not exists (select 1 from portal_projects where opportunity_id = new.id) then
    insert into portal_projects (account_id, opportunity_id, name, status, published)
      values (new.account_id, new.id, new.name, 'planned', false)
      returning id into new_project;

    -- Link to both: keep the opportunity link, also attach to the project. Covers documents
    -- tied straight to the opportunity and documents tied to one of its offers.
    update portal_documents d set related_project_id = new_project
      where d.related_project_id is null
        and (
          d.opportunity_id = new.id
          or d.related_offer_id in (select id from portal_offers where opportunity_id = new.id)
        );

    -- Seed the roster from the opportunity's accepted offer (latest accepted version), mirroring the
    -- manual "Create Project from Opportunity" wizard. Each offer line becomes a team row: linked to
    -- its staffed employee when one is named (so its worklogs feed salary), otherwise a text-only row.
    -- on conflict guards against two lines naming the same employee (unique project_id, user_id).
    select id into v_offer
    from portal_offers
    where opportunity_id = new.id and status = 'accepted'
    order by version desc
    limit 1;

    if v_offer is not null then
      insert into portal_project_team
        (project_id, user_id, display_name, project_role, is_public, active,
         billing_type, rate, overtime_rate, monthly_hours, pay_rate)
      select
        new_project,
        oi.employee_id,
        oi.name,
        coalesce(nullif(trim(oi.detail), ''), 'Team member'),
        true,
        true,
        oi.billing_type,
        oi.amount,
        oi.overtime_rate,
        oi.monthly_hours,
        oi.pay_rate
      from portal_offer_items oi
      where oi.offer_id = v_offer
        and coalesce(trim(oi.name), '') <> ''
      on conflict (project_id, user_id) do nothing;
    end if;

    perform portal_log_activity(new.account_id, 'project', 'Project created from won opportunity', new.name, null);
  end if;
  return new;
end $$;

drop trigger if exists portal_opportunity_won_trg on portal_opportunities;
create trigger portal_opportunity_won_trg
  after insert or update of stage on portal_opportunities
  for each row execute function portal_opportunity_won();

-- ---------------------------------------------------------------------------
-- Backfill: projects already auto-created from a won opportunity that ended up with an EMPTY team.
-- Only touches projects with zero team rows, so a roster edited by hand is never clobbered. Seeds
-- from each project's opportunity's latest accepted offer, exactly like the trigger above.
-- ---------------------------------------------------------------------------

insert into portal_project_team
  (project_id, user_id, display_name, project_role, is_public, active,
   billing_type, rate, overtime_rate, monthly_hours, pay_rate)
select
  p.id,
  oi.employee_id,
  oi.name,
  coalesce(nullif(trim(oi.detail), ''), 'Team member'),
  true,
  true,
  oi.billing_type,
  oi.amount,
  oi.overtime_rate,
  oi.monthly_hours,
  oi.pay_rate
from portal_projects p
join lateral (
  select id from portal_offers
  where opportunity_id = p.opportunity_id and status = 'accepted'
  order by version desc
  limit 1
) o on true
join portal_offer_items oi on oi.offer_id = o.id and coalesce(trim(oi.name), '') <> ''
where p.opportunity_id is not null
  and not exists (select 1 from portal_project_team pt where pt.project_id = p.id)
on conflict (project_id, user_id) do nothing;
