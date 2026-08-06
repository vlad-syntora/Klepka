-- 0029_org_settings.sql — org-wide Sales Process defaults that aren't per-template.
--
-- Currently holds the default Account Owner picked on the Sales Process Settings page. This is a
-- stored preference only: account creation still assigns the running user as owner (see
-- adminCreateAccount). Wiring this default into that flow is deliberately out of scope for now.
--
-- Single-row (singleton) table gated to the four internal roles via portal_is_internal(), matching
-- the sales-process templates in 0028. Fully idempotent.

create table if not exists portal_org_settings (
  id boolean primary key default true check (id),
  default_account_owner_id uuid references portal_users(id) on delete set null,
  updated_at timestamptz not null default now()
);

-- Seed the single row so the settings page can always update in place.
insert into portal_org_settings (id) values (true) on conflict (id) do nothing;

drop trigger if exists portal_org_settings_set_updated_at on portal_org_settings;
create trigger portal_org_settings_set_updated_at before update on portal_org_settings
  for each row execute function set_updated_at();

alter table portal_org_settings enable row level security;
revoke all on portal_org_settings from anon;

drop policy if exists "portal read org settings" on portal_org_settings;
create policy "portal read org settings" on portal_org_settings
  for select to authenticated using (portal_is_internal());
drop policy if exists "portal write org settings" on portal_org_settings;
create policy "portal write org settings" on portal_org_settings
  for all to authenticated using (portal_is_internal()) with check (portal_is_internal());
