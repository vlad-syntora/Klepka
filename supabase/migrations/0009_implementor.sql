-- 0009_implementor.sql — the "Implementer" employee role.
--
-- Implementers are Klepka staff (they sign into the admin console) but, unlike the existing
-- internal roles, they are NOT trusted with the whole book of business:
--   * account scope — they see only accounts where they are on the account team
--     (portal_account_team, 0007) or on a project team (portal_project_team).
--   * finance — no access to invoices/payments, read or write.
--
-- The mechanism: keep portal_is_internal() meaning the four full-access roles (they bypass
-- account scope everywhere), and add portal_is_staff() = internal + implementer for the
-- "staff can see drafts / non-client-visible rows" checks, always gated by portal_can_read so
-- the account scope still applies to implementers.

-- ---------------------------------------------------------------------------
-- Allow the new role value
-- ---------------------------------------------------------------------------

alter table portal_users drop constraint if exists portal_users_role_check;
alter table portal_users drop constraint if exists portal_users_check;
alter table portal_users drop constraint if exists portal_users_staff_account_check;

alter table portal_users
  add constraint portal_users_role_check
    check (role in ('prospect','client_admin','client_collaborator','sales_rep','delivery_lead','ops_finance','portal_admin','implementor'));
-- Staff roles may have a null account_id; client roles must be attached to an account.
alter table portal_users
  add constraint portal_users_staff_account_check
    check (role in ('sales_rep','delivery_lead','ops_finance','portal_admin','implementor') or account_id is not null);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- Is the current user staffed on this account — on its account team, or on one of its projects?
create or replace function portal_staffed_on(target_account uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select target_account is not null and (
    exists (
      select 1 from portal_account_team at
      where at.account_id = target_account and at.user_id = portal_my_user_id() and at.active
    )
    or exists (
      select 1 from portal_project_team pt
      join portal_projects p on p.id = pt.project_id
      where p.account_id = target_account and pt.user_id = portal_my_user_id() and pt.active
    )
  );
$$;

-- Any Klepka employee, including implementers. Distinct from portal_is_internal(), which stays
-- the set of full-access roles that bypass account scope.
create or replace function portal_is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select role in ('sales_rep','delivery_lead','ops_finance','portal_admin','implementor')
     from portal_users where auth_user_id = auth.uid() and status <> 'disabled' limit 1),
    false);
$$;

-- Reads: full-access staff see every account; clients see their own; implementers see only the
-- accounts they are staffed on.
create or replace function portal_can_read(target_account uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select portal_is_internal()
    or (target_account is not null and target_account = portal_my_account_id())
    or (portal_my_role() = 'implementor' and portal_staffed_on(target_account));
$$;

-- Writes: admins everywhere; any staff member on accounts they own, are staffed on, or host a
-- meeting for. Implementers reach the "staffed on" branch, so they can work their own accounts.
create or replace function portal_can_manage(target_account uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select portal_is_admin()
    or (
      portal_is_staff()
      and target_account is not null
      and (
        exists (select 1 from portal_accounts a where a.id = target_account and a.owner_id = portal_my_user_id())
        or portal_staffed_on(target_account)
        or exists (select 1 from portal_meetings m where m.account_id = target_account and m.host_user_id = portal_my_user_id())
      )
    );
$$;

-- Module visibility. Implementers get everything except finance (payments/invoices).
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
    else portal_is_internal()
  end;
$$;

-- Safe path check for the private documents bucket: objects live under <account_id>/... but
-- shared-library files sit under 'shared/...', so the first segment isn't always a uuid.
create or replace function portal_can_read_doc_path(p_first text)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare acct uuid;
begin
  if portal_is_internal() then return true; end if;
  if p_first = portal_my_account_id()::text then return true; end if;
  begin
    acct := p_first::uuid;
  exception when others then
    return false;
  end;
  return portal_staffed_on(acct);
end $$;

grant execute on function
  portal_staffed_on(uuid), portal_is_staff(), portal_can_read_doc_path(text),
  portal_can_read(uuid), portal_can_manage(uuid), portal_can_view_module(text)
to authenticated;

-- ---------------------------------------------------------------------------
-- Re-scope the policies that used a bare portal_is_internal() as the "staff sees all" bypass,
-- so implementers get the same view but only on accounts portal_can_read lets them see.
-- ---------------------------------------------------------------------------

drop policy "portal read users" on portal_users;
create policy "portal read users" on portal_users
  for select to authenticated using (
    portal_is_internal()
    or account_id is null
    or portal_can_read(account_id)
  );

drop policy "portal read offers" on portal_offers;
create policy "portal read offers" on portal_offers
  for select to authenticated using (
    portal_can_read(account_id)
    and portal_can_view_module('pipeline')
    and (portal_is_staff() or status <> 'draft')
  );

drop policy "portal read projects" on portal_projects;
create policy "portal read projects" on portal_projects
  for select to authenticated using (
    portal_can_read(account_id)
    and portal_can_view_module('project')
    and (portal_is_staff() or published)
  );

drop policy "portal read documents" on portal_documents;
create policy "portal read documents" on portal_documents
  for select to authenticated using (
    portal_can_read(account_id)
    and portal_can_view_module('documents')
    and (portal_is_staff() or status <> 'draft')
  );

drop policy "portal read activity" on portal_activity;
create policy "portal read activity" on portal_activity
  for select to authenticated using (
    portal_can_read(account_id)
    and (portal_is_staff() or client_visible)
  );

-- Finance stays off-limits to implementers on the write side too (reads are already blocked by
-- the payments module check above).
drop policy "portal write invoices" on portal_invoices;
create policy "portal write invoices" on portal_invoices
  for all to authenticated
  using (portal_can_manage(account_id) and portal_can_view_module('payments'))
  with check (portal_can_manage(account_id) and portal_can_view_module('payments'));

-- Storage: let implementers read/upload files in their staffed accounts' folders.
drop policy "portal read documents storage" on storage.objects;
create policy "portal read documents storage" on storage.objects
  for select to authenticated using (
    bucket_id = 'portal-documents'
    and portal_can_read_doc_path((storage.foldername(name))[1])
  );
drop policy "portal upload documents storage" on storage.objects;
create policy "portal upload documents storage" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'portal-documents'
    and portal_can_read_doc_path((storage.foldername(name))[1])
  );
