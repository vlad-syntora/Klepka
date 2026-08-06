-- 0037_product_documents.sql — let a product carry SEVERAL documents instead of just one.
--
-- Migration 0028 gave a product a single document (document_url / document_name) that gets copied
-- onto a client's Materials whenever the product is tagged on one of the account's records. This
-- replaces that single slot with a JSONB array of { name, url } so a product can carry any number of
-- documents, each behaving exactly as the single one did: copied onto the client's Materials, once,
-- when the product is tagged.
--
-- The old columns are kept (unused) so existing rows/queries never break; the data is migrated into
-- the array below and all copy logic now reads the array. Fully idempotent.

-- ---------------------------------------------------------------------------
-- a. Storage: a JSONB array of documents on the product
-- ---------------------------------------------------------------------------

alter table portal_products
  add column if not exists documents jsonb not null default '[]'::jsonb;

-- Seed the array from the legacy single-document columns, once (only when the array is still empty).
update portal_products
  set documents = jsonb_build_array(
    jsonb_build_object('name', coalesce(nullif(trim(document_name), ''), name), 'url', trim(document_url))
  )
  where document_url is not null
    and trim(document_url) <> ''
    and coalesce(documents, '[]'::jsonb) = '[]'::jsonb;

-- ---------------------------------------------------------------------------
-- b. Copy logic — copy EVERY document onto the account's Materials (idempotent per document url)
-- ---------------------------------------------------------------------------

-- Replaces the 0028 single-document version. For each { name, url } on the product, insert a Materials
-- row unless one for that product + url already exists on the account (so re-tagging is a no-op and a
-- newly added document is copied without duplicating the ones already there).
create or replace function portal_apply_product_materials(p_account uuid, p_product uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_product_name text;
  v_docs jsonb;
  v_item jsonb;
  v_url text;
  v_title text;
begin
  select name, coalesce(documents, '[]'::jsonb)
    into v_product_name, v_docs
    from portal_products where id = p_product;
  if v_docs is null then
    return;
  end if;

  for v_item in select * from jsonb_array_elements(v_docs)
  loop
    v_url := nullif(trim(v_item->>'url'), '');
    if v_url is null then
      continue;
    end if;
    v_title := coalesce(nullif(trim(v_item->>'name'), ''), v_product_name);

    insert into portal_resources
        (account_id, title, description, kind, url, file_path, article_id, phase, position, published, product_id)
    select p_account, v_title, '', 'document', v_url, null, null, 'any', 0, true, p_product
    where not exists (
      select 1 from portal_resources r
      where r.account_id = p_account and r.product_id = p_product and r.url = v_url
    );
  end loop;
end $$;
