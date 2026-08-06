-- 0030_product_material_cleanup.sql — remove a product's copied document when the product is
-- untagged from an account.
--
-- 0028 copies a product's document onto an account's Materials (portal_resources.product_id set)
-- when the product is tagged on any of the account's records. This migration does the reverse:
-- when the product is removed, its copied document is removed too.
--
-- Why a DEFERRED CONSTRAINT trigger and not a plain AFTER DELETE:
-- portal_set_products (0027) replaces a record's product set with a full DELETE followed by a
-- re-INSERT of the kept products in one transaction. A plain per-row AFTER DELETE would drop the
-- material for a product that is actually being kept (and the re-INSERT would then recreate a fresh
-- copy, losing any staff edits). Deferring the check to commit time lets it see the FINAL state, so
-- a kept product still resolves as "referenced" and its document is left untouched. A document is
-- deleted only when the product is no longer tagged on the account via ANY of its records.
--
-- Idempotent, matching the standalone-migration convention.

-- Reconcile one (account, product): if the product is no longer tagged on the account through any of
-- its account / opportunity / project records, drop the document that was copied from that product.
-- Only product-derived copies are touched (product_id set) — staff-authored materials are untouched.
create or replace function portal_reconcile_product_material(p_account uuid, p_product uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_account is null or p_product is null then
    return;
  end if;
  if exists (
    select 1 from portal_account_products
      where account_id = p_account and product_id = p_product
    union all
    select 1 from portal_opportunity_products op
      join portal_opportunities o on o.id = op.opportunity_id
      where o.account_id = p_account and op.product_id = p_product
    union all
    select 1 from portal_project_products pp
      join portal_projects pr on pr.id = pp.project_id
      where pr.account_id = p_account and pp.product_id = p_product
  ) then
    return; -- still tagged somewhere on the account — keep its document.
  end if;

  delete from portal_resources
    where account_id = p_account and product_id = p_product;
end $$;

-- One trigger per association table — each resolves the owning account, then defers to the helper.
create or replace function portal_account_products_cleanup_materials()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform portal_reconcile_product_material(old.account_id, old.product_id);
  return old;
end $$;

create or replace function portal_opportunity_products_cleanup_materials()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_account uuid;
begin
  select account_id into v_account from portal_opportunities where id = old.opportunity_id;
  perform portal_reconcile_product_material(v_account, old.product_id);
  return old;
end $$;

create or replace function portal_project_products_cleanup_materials()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_account uuid;
begin
  select account_id into v_account from portal_projects where id = old.project_id;
  perform portal_reconcile_product_material(v_account, old.product_id);
  return old;
end $$;

-- Constraint triggers so the reconciliation runs at COMMIT, after portal_set_products' re-INSERT.
drop trigger if exists portal_account_products_cleanup on portal_account_products;
create constraint trigger portal_account_products_cleanup
  after delete on portal_account_products
  deferrable initially deferred
  for each row execute function portal_account_products_cleanup_materials();

drop trigger if exists portal_opportunity_products_cleanup on portal_opportunity_products;
create constraint trigger portal_opportunity_products_cleanup
  after delete on portal_opportunity_products
  deferrable initially deferred
  for each row execute function portal_opportunity_products_cleanup_materials();

drop trigger if exists portal_project_products_cleanup on portal_project_products;
create constraint trigger portal_project_products_cleanup
  after delete on portal_project_products
  deferrable initially deferred
  for each row execute function portal_project_products_cleanup_materials();
