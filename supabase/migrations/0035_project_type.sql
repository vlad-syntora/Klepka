-- 0035_project_type.sql — Project Type, and text-only project team rows.
--
-- Project Type (Support / Health Check / Implementation) classifies an engagement. It is picked on
-- the opportunity first and carried onto its project (manually, and by the Closed-Won trigger). It
-- is nullable — "not picked yet" — and only the Support type hides the milestone tracker.
--
-- The project team can now hold text-only roster rows seeded from an accepted offer's line items,
-- so `user_id` becomes nullable and a `display_name` column carries the label for those rows.

alter table portal_opportunities
  add column if not exists project_type text
    check (project_type in ('support', 'health_check', 'implementation'));

alter table portal_projects
  add column if not exists project_type text
    check (project_type in ('support', 'health_check', 'implementation'));

alter table portal_project_team alter column user_id drop not null;
alter table portal_project_team add column if not exists display_name text;

-- Closed Won auto-creates the project (0010/0034). Carry the opportunity's project_type onto it so
-- the classification isn't re-entered by hand — manual "Create project from opportunity" copies it
-- in the API.
create or replace function portal_opportunity_won() returns trigger
  language plpgsql security definer set search_path = public as $$
declare new_project uuid;
begin
  if new.stage = 'closed_won'
     and (tg_op = 'INSERT' or old.stage is distinct from 'closed_won')
     and not exists (select 1 from portal_projects where opportunity_id = new.id) then
    insert into portal_projects (account_id, opportunity_id, name, status, published, bank_hours, notify_hours, project_type)
      values (new.account_id, new.id, new.name, 'planned', false, new.bank_hours, new.notify_hours, new.project_type)
      returning id into new_project;
    -- Link to both: keep the opportunity link, also attach to the project. Covers documents
    -- tied straight to the opportunity and documents tied to one of its offers.
    update portal_documents d set related_project_id = new_project
      where d.related_project_id is null
        and (
          d.opportunity_id = new.id
          or d.related_offer_id in (select id from portal_offers where opportunity_id = new.id)
        );
    perform portal_log_activity(new.account_id, 'project', 'Project created from won opportunity', new.name, null);
  end if;
  return new;
end $$;
