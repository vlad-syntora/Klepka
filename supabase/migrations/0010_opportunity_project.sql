-- 0010_opportunity_project.sql — make the Opportunity → Offer → Documents → Project → Payments
-- hierarchy explicit end to end.
--
-- The schema already had the foreign keys; this migration adds the two missing pieces:
--   * documents can hang directly off an opportunity (contracts/MSA/NDA with no single offer);
--   * winning an opportunity auto-creates its project and carries its documents forward.
-- Plus it narrows finance visibility to the roles that actually own it.

-- ---------------------------------------------------------------------------
-- a. Documents can attach directly to an opportunity
-- ---------------------------------------------------------------------------

alter table portal_documents
  add column if not exists opportunity_id uuid references portal_opportunities(id) on delete set null;
create index if not exists portal_documents_opportunity_idx on portal_documents (opportunity_id);

-- ---------------------------------------------------------------------------
-- b. Closed Won → create the project and link the opportunity's documents to it
-- ---------------------------------------------------------------------------

create or replace function portal_opportunity_won() returns trigger
  language plpgsql security definer set search_path = public as $$
declare new_project uuid;
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
    perform portal_log_activity(new.account_id, 'project', 'Project created from won opportunity', new.name, null);
  end if;
  return new;
end $$;

drop trigger if exists portal_opportunity_won_trg on portal_opportunities;
create trigger portal_opportunity_won_trg
  after insert or update of stage on portal_opportunities
  for each row execute function portal_opportunity_won();

-- ---------------------------------------------------------------------------
-- c. Finance is visible to Sales Rep, Ops/Finance and Portal Admin only.
--    (Delivery Lead and Implementer keep everything except payments.)
--    Invoice writes already gate on portal_can_view_module('payments') from 0009, so this one
--    change restricts finance on both read and write.
-- ---------------------------------------------------------------------------

create or replace function portal_can_view_module(p_module text)
returns boolean language sql stable security definer set search_path = public as $$
  select case portal_my_role()
    when 'client_admin' then true
    when 'prospect' then p_module in ('pipeline','calls','documents','feedback','project')
    when 'client_collaborator' then
      p_module in ('pipeline','calls','feedback')
      or exists (
        select 1 from portal_users u
        where u.auth_user_id = auth.uid() and p_module = any (u.module_access)
      )
    when 'implementor' then p_module <> 'payments'
    else case
      when p_module = 'payments' then portal_my_role() in ('sales_rep','ops_finance','portal_admin')
      else portal_is_internal()
    end
  end;
$$;

grant execute on function portal_can_view_module(text) to authenticated;
