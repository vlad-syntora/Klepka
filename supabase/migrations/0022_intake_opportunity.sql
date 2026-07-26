-- 0022_intake_opportunity.sql — move the Information gathering checklist under the opportunity.
--
-- Discovery is per-deal, so intake items now belong to an opportunity rather than the account.
-- Existing account-level rows are removed (user decision) so opportunity_id can be NOT NULL, and
-- the client upload RPC carries the item's opportunity onto the document it registers.

-- ---------------------------------------------------------------------------
-- a. Intake items belong to an opportunity. Old account-level rows are dropped.
-- ---------------------------------------------------------------------------

alter table portal_intake_items
  add column if not exists opportunity_id uuid references portal_opportunities(id) on delete cascade;
delete from portal_intake_items where opportunity_id is null;
alter table portal_intake_items alter column opportunity_id set not null;
create index if not exists portal_intake_opportunity_idx on portal_intake_items (opportunity_id, position);

-- ---------------------------------------------------------------------------
-- b. Client upload RPC also stamps the document's opportunity from the intake item, so an
--    intake-attached file shows under the same opportunity as its checklist item.
--    (Re-creates the function from 0020; signature is unchanged.)
-- ---------------------------------------------------------------------------

create or replace function portal_register_document(
  p_name text,
  p_file_url text,
  p_doc_type text default 'reference',
  p_intake_item uuid default null
)
returns portal_documents language plpgsql security definer set search_path = public as $$
declare
  acct uuid := portal_my_account_id();
  opp uuid;
  created portal_documents;
begin
  if acct is null then
    raise exception 'no account for current user';
  end if;
  if p_doc_type not in ('reference','deliverable','other') then
    raise exception 'clients can only upload reference documents';
  end if;
  if p_intake_item is not null then
    select opportunity_id into opp
      from portal_intake_items
      where id = p_intake_item and account_id = acct;
    if not found then
      raise exception 'intake item not available';
    end if;
  end if;

  insert into portal_documents
      (account_id, opportunity_id, name, doc_type, status, file_url, intake_item_id, uploaded_by, uploaded_by_client)
  values
      (acct, opp, p_name, p_doc_type, 'acknowledged', p_file_url, p_intake_item, portal_my_user_id(), true)
  returning * into created;

  perform portal_log_activity(acct, 'documents', 'Document uploaded by client', p_name, '/portal/documents');
  return created;
end $$;

grant execute on function portal_register_document(text, text, text, uuid) to authenticated;
