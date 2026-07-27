-- 0025_implementor_fixes.sql — unblock creating Implementer staff and narrow what they can see.
--
-- Two problems this fixes:
--   1. Creating an internal Implementer (account_id null) failed. Migration 0009 added the
--      role and a new `portal_users_staff_account_check` that lets staff have a null account,
--      but the ORIGINAL `portal_users_client_needs_account` check from 0004 was never dropped —
--      and it doesn't list 'implementor', so it still rejected the insert. Drop it; the 0009
--      check already enforces the same "client roles need an account" rule with implementor.
--   2. Implementers should be a limited delivery role: no pipeline/opportunities, no offers and
--      no finance. Previously portal_can_view_module let them see everything except payments.

-- ---------------------------------------------------------------------------
-- 1. Remove the stale constraint that blocks Implementer (and any future staff role) creation.
-- ---------------------------------------------------------------------------

alter table portal_users drop constraint if exists portal_users_client_needs_account;

-- Belt-and-braces: ensure the 0009 staff/account rule (which includes implementor) is present.
alter table portal_users drop constraint if exists portal_users_staff_account_check;
alter table portal_users
  add constraint portal_users_staff_account_check
    check (role in ('sales_rep','delivery_lead','ops_finance','portal_admin','implementor') or account_id is not null);

-- ---------------------------------------------------------------------------
-- 2. Narrow Implementer module visibility: delivery-facing modules only. No pipeline (which is
--    where opportunities and offers live) and no payments/finance.
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
    when 'implementor' then p_module in ('calls','documents','feedback','project')
    else portal_is_internal()
  end;
$$;

grant execute on function portal_can_view_module(text) to authenticated;
