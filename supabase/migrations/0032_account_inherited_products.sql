-- 0032_account_inherited_products.sql — a product tagged on an opportunity (or project) shows on
-- its account, deduplicated, and disappears from the account when its opportunity is Lost.
--
-- 0031 physically copied opportunity/project products into portal_account_products on insert. That
-- can't honour "hide a Lost opportunity's products": once copied, the row has no back-reference to
-- the opportunity, and portal_account_products is a user-editable set, so we can't tell a mirrored
-- row from one a user tagged directly. So we drop the copy and compute the inherited set at read
-- time instead — always current, never duplicated, and Lost opportunities fall out for free.
--
-- portal_account_products stays the account's own, editable set. portal_account_inherited_products
-- returns the extra products in scope via non-Lost opportunities and projects, minus anything the
-- account already tags directly (so the UI can list them read-only without duplicates). Rows already
-- copied by 0031 remain as ordinary account tags — harmless, just no longer auto-maintained.
--
-- SECURITY DEFINER so it can read across the association tables; the account is the caller's own
-- input but every returned row is still gated by portal_can_read(p_account).

-- Undo 0031's copy-on-insert mirror.
drop trigger if exists portal_opportunity_products_mirror on portal_opportunity_products;
drop trigger if exists portal_project_products_mirror on portal_project_products;
drop function if exists portal_opportunity_products_mirror();
drop function if exists portal_project_products_mirror();
drop function if exists portal_mirror_product_to_account(uuid, uuid, uuid);

create or replace function portal_account_inherited_products(p_account uuid)
returns setof portal_products
language sql stable security definer set search_path = public as $$
  select distinct p.*
  from portal_products p
  where portal_can_read(p_account)
    and not exists (
      select 1 from portal_account_products ap
      where ap.account_id = p_account and ap.product_id = p.id
    )
    and (
      exists (
        select 1
        from portal_opportunity_products op
        join portal_opportunities o on o.id = op.opportunity_id
        where o.account_id = p_account
          and o.stage <> 'closed_lost'
          and op.product_id = p.id
      )
      or exists (
        select 1
        from portal_project_products pp
        join portal_projects pr on pr.id = pp.project_id
        where pr.account_id = p_account
          and pp.product_id = p.id
      )
    );
$$;

grant execute on function portal_account_inherited_products(uuid) to authenticated;
