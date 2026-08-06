-- 0033_dashboard_layout.sql — a client's personal dashboard layout (widget order + which are hidden).
--
-- Customers with at least one active project can reorder and hide/show the widgets on their portal
-- dashboard; the arrangement is stored per user so it follows them across browsers and devices.
-- Shape is a small JSON object { "order": [widgetId…], "hidden": [widgetId…] }; the client validates
-- and falls back to the standard layout when it's null or unrecognised. "Set default view" simply
-- clears these back to the standard order with nothing hidden.
--
-- Read/write go through SECURITY DEFINER helpers scoped to the caller's own row (portal_my_user_id),
-- so a user can only ever change their own layout — no table-level grant on portal_users needed.

alter table portal_users add column if not exists dashboard_layout jsonb;

create or replace function portal_get_dashboard_layout()
returns jsonb language sql stable security definer set search_path = public as $$
  select dashboard_layout from portal_users where id = portal_my_user_id();
$$;

create or replace function portal_set_dashboard_layout(p_layout jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  update portal_users set dashboard_layout = p_layout where id = portal_my_user_id();
end $$;

grant execute on function portal_get_dashboard_layout() to authenticated;
grant execute on function portal_set_dashboard_layout(jsonb) to authenticated;
