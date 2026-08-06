-- 0028_sales_process_settings.sql — reusable "Sales Process Settings" defaults.
--
-- Staff maintain the defaults on the admin console; this migration adds the storage and the copy
-- logic that pushes them into accounts:
--   1. General onboarding materials  → copied into every NEW account on creation.
--   2. Product material              → a document URL held on the product record itself (Products
--                                       tab); copied onto the account when the product is tagged on
--                                       any of its records (account / opportunity / project).
--   3. Standard gathering checklist   → copied into an opportunity's intake on demand (a button).
--
-- Templates are internal-only config (read + write gated to the four internal roles via the existing
-- portal_is_internal() predicate — implementers and clients are excluded). Clients only ever see the
-- COPIES that land in portal_resources / portal_intake_items. Fully idempotent (matches the current
-- standalone-migration convention; the APPLY_0005_to_0017 bundle is frozen at 0017).

-- ---------------------------------------------------------------------------
-- a. Storage: onboarding-material templates, product material URL, checklist templates
-- ---------------------------------------------------------------------------

-- The general onboarding default materials — copied into every new account's Materials on creation.
create table if not exists portal_material_templates (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  kind text not null default 'link'
    check (kind in ('presentation','document','video','link','article')),
  url text,
  file_path text,
  article_id uuid references articles(id) on delete cascade,
  phase text not null default 'onboarding'
    check (phase in ('onboarding','discovery','proposal','delivery','any')),
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- A product carries a single document (its material), managed on the Products tab. When the product
-- is tagged on any of an account's records the document is copied onto that account's Materials.
alter table portal_products
  add column if not exists document_url text,
  add column if not exists document_name text;

create table if not exists portal_intake_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  owner_side text not null default 'client' check (owner_side in ('client','klepka')),
  position integer not null default 0,
  created_at timestamptz not null default now()
);

-- Provenance links, so a copied material can be found again (keeps the copy idempotent):
-- template_id = which onboarding template it came from; product_id = which product's document it is.
alter table portal_resources
  add column if not exists template_id uuid references portal_material_templates(id) on delete set null,
  add column if not exists product_id uuid references portal_products(id) on delete set null;

drop trigger if exists portal_material_templates_set_updated_at on portal_material_templates;
create trigger portal_material_templates_set_updated_at before update on portal_material_templates
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- b. RLS — internal-only config
-- ---------------------------------------------------------------------------

alter table portal_material_templates enable row level security;
alter table portal_intake_templates enable row level security;
revoke all on portal_material_templates, portal_intake_templates from anon;

drop policy if exists "portal read material templates" on portal_material_templates;
create policy "portal read material templates" on portal_material_templates
  for select to authenticated using (portal_is_internal());
drop policy if exists "portal write material templates" on portal_material_templates;
create policy "portal write material templates" on portal_material_templates
  for all to authenticated using (portal_is_internal()) with check (portal_is_internal());

drop policy if exists "portal read intake templates" on portal_intake_templates;
create policy "portal read intake templates" on portal_intake_templates
  for select to authenticated using (portal_is_internal());
drop policy if exists "portal write intake templates" on portal_intake_templates;
create policy "portal write intake templates" on portal_intake_templates
  for all to authenticated using (portal_is_internal()) with check (portal_is_internal());

-- ---------------------------------------------------------------------------
-- c. Copy logic (security definer — the copies bypass RLS on the destination tables)
-- ---------------------------------------------------------------------------

-- New account → seed its Materials from the general onboarding defaults.
create or replace function portal_seed_account_materials()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into portal_resources
      (account_id, title, description, kind, url, file_path, article_id, phase, position, published, template_id)
  select new.id, t.title, t.description, t.kind, t.url, t.file_path, t.article_id, t.phase, t.position, true, t.id
  from portal_material_templates t;
  return new;
end $$;

drop trigger if exists portal_accounts_seed_materials on portal_accounts;
create trigger portal_accounts_seed_materials after insert on portal_accounts
  for each row execute function portal_seed_account_materials();

-- Copy a product's document onto an account's Materials, once (idempotent on account_id + product_id).
-- No document set on the product → nothing to do.
create or replace function portal_apply_product_materials(p_account uuid, p_product uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_url text;
  v_title text;
begin
  select document_url, coalesce(nullif(trim(document_name), ''), name)
    into v_url, v_title
    from portal_products where id = p_product;
  if v_url is null or trim(v_url) = '' then
    return;
  end if;

  insert into portal_resources
      (account_id, title, description, kind, url, file_path, article_id, phase, position, published, product_id)
  select p_account, v_title, '', 'document', v_url, null, null, 'any', 0, true, p_product
  where not exists (
    select 1 from portal_resources r where r.account_id = p_account and r.product_id = p_product
  );
end $$;

-- One trigger per association table — each resolves the owning account, then defers to the helper.
create or replace function portal_account_products_apply_materials()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform portal_apply_product_materials(new.account_id, new.product_id);
  return new;
end $$;

create or replace function portal_opportunity_products_apply_materials()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_account uuid;
begin
  select account_id into v_account from portal_opportunities where id = new.opportunity_id;
  if v_account is not null then
    perform portal_apply_product_materials(v_account, new.product_id);
  end if;
  return new;
end $$;

create or replace function portal_project_products_apply_materials()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_account uuid;
begin
  select account_id into v_account from portal_projects where id = new.project_id;
  if v_account is not null then
    perform portal_apply_product_materials(v_account, new.product_id);
  end if;
  return new;
end $$;

drop trigger if exists portal_account_products_materials on portal_account_products;
create trigger portal_account_products_materials after insert on portal_account_products
  for each row execute function portal_account_products_apply_materials();

drop trigger if exists portal_opportunity_products_materials on portal_opportunity_products;
create trigger portal_opportunity_products_materials after insert on portal_opportunity_products
  for each row execute function portal_opportunity_products_apply_materials();

drop trigger if exists portal_project_products_materials on portal_project_products;
create trigger portal_project_products_materials after insert on portal_project_products
  for each row execute function portal_project_products_apply_materials();

-- Manual "Use standard checklist": copy the template into an opportunity's intake, skipping names
-- already present (idempotent). Callable by staff who can manage the account.
create or replace function portal_apply_intake_template(p_opportunity uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_account uuid;
begin
  select account_id into v_account from portal_opportunities where id = p_opportunity;
  if v_account is null then
    raise exception 'opportunity not found';
  end if;
  if not portal_can_manage(v_account) then
    raise exception 'not allowed to edit this opportunity';
  end if;

  insert into portal_intake_items
      (account_id, opportunity_id, name, description, owner_side, status, position)
  select v_account, p_opportunity, t.name, t.description, t.owner_side, 'not_started', t.position
  from portal_intake_templates t
  where not exists (
    select 1 from portal_intake_items i
    where i.opportunity_id = p_opportunity and lower(i.name) = lower(t.name)
  );
end $$;

grant execute on function portal_apply_intake_template(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- d. Seed the standard checklist with the items that used to be hard-coded in WorkspaceIntake,
--    so "Use standard checklist" works out of the box. Only when the template is still empty.
-- ---------------------------------------------------------------------------

insert into portal_intake_templates (name, description, owner_side, position)
select v.name, v.description, v.owner_side, v.position
from (values
  ('Current CRM access',        'Read-only access or an export of the existing system.', 'client', 0),
  ('Sales process walkthrough', 'Stages, hand-offs and who owns what.',                  'client', 1),
  ('Data sample',               'Anonymised extract so we can assess quality and volume.', 'client', 2),
  ('Integration inventory',     'Systems that must talk to Salesforce.',                 'client', 3),
  ('Stakeholder list',          'Who signs off, who uses it daily.',                     'client', 4),
  ('Solution outline',          'Our first pass at the architecture.',                   'klepka', 5),
  ('Effort estimate',           'Sizing per workstream ahead of the proposal.',          'klepka', 6)
) as v(name, description, owner_side, position)
where not exists (select 1 from portal_intake_templates);
