-- 0020_intake_documents.sql — let the client attach documents to a specific intake item.
--
-- Discovery is a back-and-forth: each checklist item ("your side" of the intake) often needs a
-- supporting file — an org chart, a data sample, a process doc. This lets the client upload a file
-- straight under the item it belongs to. The file lands in the account's "01 Discovery" Drive
-- folder (chosen client-side), and the row is tagged with the intake item so both the client and
-- Klepka see it in context.

alter table portal_documents
  add column if not exists intake_item_id uuid references portal_intake_items(id) on delete set null;

create index if not exists portal_documents_intake_idx on portal_documents (intake_item_id);

-- Extend the client upload RPC with an optional intake-item link. The item must belong to the
-- caller's own account, otherwise the link is refused.
drop function if exists portal_register_document(text, text, text);

create or replace function portal_register_document(
  p_name text,
  p_file_url text,
  p_doc_type text default 'reference',
  p_intake_item uuid default null
)
returns portal_documents language plpgsql security definer set search_path = public as $$
declare
  acct uuid := portal_my_account_id();
  created portal_documents;
begin
  if acct is null then
    raise exception 'no account for current user';
  end if;
  if p_doc_type not in ('reference','deliverable','other') then
    raise exception 'clients can only upload reference documents';
  end if;
  if p_intake_item is not null
     and not exists (select 1 from portal_intake_items where id = p_intake_item and account_id = acct) then
    raise exception 'intake item not available';
  end if;

  insert into portal_documents (account_id, name, doc_type, status, file_url, intake_item_id, uploaded_by, uploaded_by_client)
  values (acct, p_name, p_doc_type, 'acknowledged', p_file_url, p_intake_item, portal_my_user_id(), true)
  returning * into created;

  perform portal_log_activity(acct, 'documents', 'Document uploaded by client', p_name, '/portal/documents');
  return created;
end $$;

grant execute on function portal_register_document(text, text, text, uuid) to authenticated;
