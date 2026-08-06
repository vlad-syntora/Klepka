-- 0034_hours_budget.sql — an hours budget that travels with a deal.
--
-- Two optional figures staff maintain per record and the client can see:
--   * bank_hours   — the total pool of hours allocated to the engagement.
--   * notify_hours — the consumed-hours mark at which the client should be flagged.
-- They are set on the opportunity first and carried onto its offers and (on Closed Won) its
-- project, where each copy stays independently editable. Blank fields are simply hidden from
-- the client. Nothing here fires a notification — the figures are stored and displayed only.

alter table portal_opportunities
  add column if not exists bank_hours numeric(12, 2),
  add column if not exists notify_hours numeric(12, 2);

alter table portal_offers
  add column if not exists bank_hours numeric(12, 2),
  add column if not exists notify_hours numeric(12, 2);

alter table portal_projects
  add column if not exists bank_hours numeric(12, 2),
  add column if not exists notify_hours numeric(12, 2);

-- Closed Won auto-creates the project (0010). Carry the opportunity's hours budget onto it so the
-- figure isn't re-entered by hand — manual "Create project from opportunity" copies it in the API.
create or replace function portal_opportunity_won() returns trigger
  language plpgsql security definer set search_path = public as $$
declare new_project uuid;
begin
  if new.stage = 'closed_won'
     and (tg_op = 'INSERT' or old.stage is distinct from 'closed_won')
     and not exists (select 1 from portal_projects where opportunity_id = new.id) then
    insert into portal_projects (account_id, opportunity_id, name, status, published, bank_hours, notify_hours)
      values (new.account_id, new.id, new.name, 'planned', false, new.bank_hours, new.notify_hours)
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
