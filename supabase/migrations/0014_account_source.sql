-- 0014_account_source.sql — where an account came from.
--   source          a picklist value (enforced in the UI, kept free-text here so options can
--                   change without a migration).
--   source_subtype  free text detail (e.g. the referrer, event or partner name).

alter table portal_accounts add column if not exists source text;
alter table portal_accounts add column if not exists source_subtype text;
