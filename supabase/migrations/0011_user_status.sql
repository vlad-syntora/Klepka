-- 0011_user_status.sql — explicit active/inactive account lifecycle.
--
-- New model for portal_users.status:
--   inactive  default; NO portal access. A freshly created profile sits here.
--   invited   an auth user has been provisioned and an invite emailed; has access. On first
--             sign-in portal_bootstrap_user() flips this to 'active'.
--   active    signed-in, full access.
--
-- Access is granted only to 'active' and 'invited'; 'inactive' (and any legacy 'disabled') is
-- locked out everywhere via the identity helpers below. The old 'disabled' value is migrated to
-- 'inactive' so there is a single "no access" state.

alter table portal_users alter column status set default 'inactive';
update portal_users set status = 'inactive' where status = 'disabled';
alter table portal_users drop constraint if exists portal_users_status_check;
alter table portal_users
  add constraint portal_users_status_check check (status in ('inactive','invited','active'));

-- ---------------------------------------------------------------------------
-- Identity helpers: an inactive user resolves to nothing, so every RLS check that flows through
-- these (portal_can_read/manage/view_module, is_internal, is_admin, is_staff) denies access.
-- ---------------------------------------------------------------------------

create or replace function portal_my_user_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from portal_users where auth_user_id = auth.uid() and status in ('active','invited') limit 1;
$$;

create or replace function portal_my_role()
returns text language sql stable security definer set search_path = public as $$
  select role from portal_users where auth_user_id = auth.uid() and status in ('active','invited') limit 1;
$$;

create or replace function portal_my_account_id()
returns uuid language sql stable security definer set search_path = public as $$
  select account_id from portal_users where auth_user_id = auth.uid() and status in ('active','invited') limit 1;
$$;

create or replace function portal_is_internal()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select role in ('sales_rep','delivery_lead','ops_finance','portal_admin')
     from portal_users where auth_user_id = auth.uid() and status in ('active','invited') limit 1),
    false);
$$;

create or replace function portal_is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select role = 'portal_admin'
     from portal_users where auth_user_id = auth.uid() and status in ('active','invited') limit 1),
    false);
$$;

create or replace function portal_is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select role in ('sales_rep','delivery_lead','ops_finance','portal_admin','implementor')
     from portal_users where auth_user_id = auth.uid() and status in ('active','invited') limit 1),
    false);
$$;
