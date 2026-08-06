-- 0031_opportunity_products_to_account.sql — a product tagged on an opportunity (or project) also
-- shows on its account, without duplicates.
--
-- Opportunities and projects each keep their own product set, but staff and clients expect the
-- account's Products list to reflect everything in scope anywhere on the account. This mirrors any
-- opportunity/project product up onto portal_account_products (unique on account_id + product_id,
-- so re-tagging or tagging on several records adds it at most once). Removal is intentionally not
-- mirrored — a product can be scoped to one opportunity yet still belong to the account overall, so
-- it's dropped from the account only when a user removes it there.
--
-- SECURITY DEFINER so the mirror bypasses RLS on portal_account_products; the account is resolved
-- from the triggering row, never from caller input. Idempotent, matching the migration convention.

create or replace function portal_mirror_product_to_account(p_account uuid, p_product uuid, p_added_by uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_account is null or p_product is null then
    return;
  end if;
  insert into portal_account_products (account_id, product_id, added_by)
  values (p_account, p_product, p_added_by)
  on conflict (account_id, product_id) do nothing;
end $$;

create or replace function portal_opportunity_products_mirror()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_account uuid;
begin
  select account_id into v_account from portal_opportunities where id = new.opportunity_id;
  perform portal_mirror_product_to_account(v_account, new.product_id, new.added_by);
  return new;
end $$;

create or replace function portal_project_products_mirror()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_account uuid;
begin
  select account_id into v_account from portal_projects where id = new.project_id;
  perform portal_mirror_product_to_account(v_account, new.product_id, new.added_by);
  return new;
end $$;

drop trigger if exists portal_opportunity_products_mirror on portal_opportunity_products;
create trigger portal_opportunity_products_mirror after insert on portal_opportunity_products
  for each row execute function portal_opportunity_products_mirror();

drop trigger if exists portal_project_products_mirror on portal_project_products;
create trigger portal_project_products_mirror after insert on portal_project_products
  for each row execute function portal_project_products_mirror();
