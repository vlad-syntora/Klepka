-- 0027_products.sql — a shared Products catalog, plus product associations on staff (as "skills"),
-- accounts, opportunities and projects.
--
-- Model:
--   * portal_products — the global catalog. Staff-created entries are 'approved' immediately;
--     client-created ones land as 'pending' (waiting for a Klepka staffer to approve them).
--   * portal_user_products — products a staff member owns (their skills). Admin-managed only.
--   * portal_{account,opportunity,project}_products — products tagged on a record. Editable by
--     internal staff who can manage the account AND by any client user on that account.
--
-- Client-side writes never touch these tables directly — they go through the SECURITY DEFINER
-- RPCs at the bottom (portal_create_product, portal_set_products), matching the portal convention.

-- ---------------------------------------------------------------------------
-- Catalog
-- ---------------------------------------------------------------------------

create table if not exists portal_products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  -- 'approved' = vetted and freely usable; 'pending' = client-created, awaiting staff approval.
  status text not null default 'approved' check (status in ('pending', 'approved')),
  created_by uuid references portal_users(id) on delete set null,
  created_at timestamptz not null default now()
);
-- One row per product name (case-insensitive) — the create RPC reuses an existing match.
create unique index if not exists portal_products_name_key on portal_products (lower(name));

alter table portal_products enable row level security;
revoke all on portal_products from anon;

-- The catalog is a shared list of names; everyone signed in can read it (needed by the pickers).
create policy "portal read products" on portal_products
  for select to authenticated using (true);
-- Direct writes (approve / rename / delete) are staff-only; creation also flows through the RPC.
create policy "portal write products" on portal_products
  for all to authenticated using (portal_is_internal()) with check (portal_is_internal());

-- ---------------------------------------------------------------------------
-- Associations
-- ---------------------------------------------------------------------------

create table if not exists portal_user_products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references portal_users(id) on delete cascade,
  product_id uuid not null references portal_products(id) on delete cascade,
  added_by uuid references portal_users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (user_id, product_id)
);
create index if not exists portal_user_products_user_idx on portal_user_products (user_id);

create table if not exists portal_account_products (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references portal_accounts(id) on delete cascade,
  product_id uuid not null references portal_products(id) on delete cascade,
  added_by uuid references portal_users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (account_id, product_id)
);
create index if not exists portal_account_products_account_idx on portal_account_products (account_id);

create table if not exists portal_opportunity_products (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references portal_opportunities(id) on delete cascade,
  product_id uuid not null references portal_products(id) on delete cascade,
  added_by uuid references portal_users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (opportunity_id, product_id)
);
create index if not exists portal_opportunity_products_opp_idx on portal_opportunity_products (opportunity_id);

create table if not exists portal_project_products (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references portal_projects(id) on delete cascade,
  product_id uuid not null references portal_products(id) on delete cascade,
  added_by uuid references portal_users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (project_id, product_id)
);
create index if not exists portal_project_products_project_idx on portal_project_products (project_id);

alter table portal_user_products enable row level security;
alter table portal_account_products enable row level security;
alter table portal_opportunity_products enable row level security;
alter table portal_project_products enable row level security;
revoke all on portal_user_products, portal_account_products, portal_opportunity_products, portal_project_products from anon;

-- Skills: readable by anyone signed in (shown on staff profiles / team lists); only admins edit.
create policy "portal read user products" on portal_user_products
  for select to authenticated using (true);
create policy "portal write user products" on portal_user_products
  for all to authenticated using (portal_is_admin()) with check (portal_is_admin());

-- Account products: read by anyone who can see the account; staff who can manage it write directly
-- (clients write through portal_set_products).
create policy "portal read account products" on portal_account_products
  for select to authenticated using (portal_can_read(account_id));
create policy "portal write account products" on portal_account_products
  for all to authenticated using (portal_can_manage(account_id)) with check (portal_can_manage(account_id));

create policy "portal read opportunity products" on portal_opportunity_products
  for select to authenticated using (
    exists (select 1 from portal_opportunities o where o.id = opportunity_id and portal_can_read(o.account_id))
  );
create policy "portal write opportunity products" on portal_opportunity_products
  for all to authenticated using (
    exists (select 1 from portal_opportunities o where o.id = opportunity_id and portal_can_manage(o.account_id))
  ) with check (
    exists (select 1 from portal_opportunities o where o.id = opportunity_id and portal_can_manage(o.account_id))
  );

create policy "portal read project products" on portal_project_products
  for select to authenticated using (
    exists (select 1 from portal_projects p where p.id = project_id and portal_can_read(p.account_id))
  );
create policy "portal write project products" on portal_project_products
  for all to authenticated using (
    exists (select 1 from portal_projects p where p.id = project_id and portal_can_manage(p.account_id))
  ) with check (
    exists (select 1 from portal_projects p where p.id = project_id and portal_can_manage(p.account_id))
  );

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

-- Create a catalog product (or return the existing one with the same name). Staff creations are
-- approved on the spot; client creations are 'pending' until a staffer approves them.
create or replace function portal_create_product(p_name text, p_description text default null)
returns portal_products language plpgsql security definer set search_path = public as $$
declare
  v_existing portal_products;
  v_created portal_products;
begin
  if coalesce(trim(p_name), '') = '' then
    raise exception 'product name is required';
  end if;
  select * into v_existing from portal_products where lower(name) = lower(trim(p_name)) limit 1;
  if found then
    return v_existing;
  end if;
  insert into portal_products (name, description, status, created_by)
  values (
    trim(p_name),
    nullif(trim(p_description), ''),
    case when portal_is_staff() then 'approved' else 'pending' end,
    portal_my_user_id()
  )
  returning * into v_created;
  return v_created;
end $$;

-- Replace the full product set on an account / opportunity / project. Allowed for a client on
-- their own account, or any staffer who can manage the account.
create or replace function portal_set_products(p_entity text, p_entity_id uuid, p_product_ids uuid[])
returns void language plpgsql security definer set search_path = public as $$
declare
  v_account uuid;
begin
  if p_entity = 'account' then
    v_account := (select id from portal_accounts where id = p_entity_id);
  elsif p_entity = 'opportunity' then
    select account_id into v_account from portal_opportunities where id = p_entity_id;
  elsif p_entity = 'project' then
    select account_id into v_account from portal_projects where id = p_entity_id;
  else
    raise exception 'unknown entity %', p_entity;
  end if;
  if v_account is null then
    raise exception 'record not found';
  end if;
  if not (v_account = portal_my_account_id() or portal_can_manage(v_account)) then
    raise exception 'not allowed to edit products on this record';
  end if;

  if p_entity = 'account' then
    delete from portal_account_products where account_id = p_entity_id;
    insert into portal_account_products (account_id, product_id, added_by)
      select p_entity_id, pid, portal_my_user_id() from unnest(p_product_ids) as pid;
  elsif p_entity = 'opportunity' then
    delete from portal_opportunity_products where opportunity_id = p_entity_id;
    insert into portal_opportunity_products (opportunity_id, product_id, added_by)
      select p_entity_id, pid, portal_my_user_id() from unnest(p_product_ids) as pid;
  elsif p_entity = 'project' then
    delete from portal_project_products where project_id = p_entity_id;
    insert into portal_project_products (project_id, product_id, added_by)
      select p_entity_id, pid, portal_my_user_id() from unnest(p_product_ids) as pid;
  end if;
end $$;

grant execute on function
  portal_create_product(text, text),
  portal_set_products(text, uuid, uuid[])
to authenticated;
