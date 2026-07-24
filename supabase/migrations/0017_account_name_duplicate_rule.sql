-- 0017_account_name_duplicate_rule.sql — block duplicate accounts by name.
--
-- Salesforce-style "duplicate rule" with a Block action: two accounts may not
-- share the same name, compared case- and whitespace-insensitively
-- ("Acme", " acme " and "ACME" all collide). Enforced with a unique index so
-- the rule holds even under concurrent inserts, not just in the UI.

-- ---------------------------------------------------------------------------
-- a. Surface any pre-existing duplicates so applying this is not a silent fail.
--    (The create index below will error if duplicates exist — this NOTICE tells
--     you which names to merge first.)
-- ---------------------------------------------------------------------------
do $$
declare dupes text;
begin
  select string_agg(name || ' (' || cnt || ')', ', ')
    into dupes
  from (
    select min(name) as name, count(*) as cnt
    from portal_accounts
    group by lower(btrim(name))
    having count(*) > 1
  ) d;
  if dupes is not null then
    raise exception 'Cannot enforce the account duplicate rule — merge these duplicate names first: %', dupes;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- b. The rule itself: a case-/whitespace-insensitive unique index on the name.
-- ---------------------------------------------------------------------------
create unique index if not exists portal_accounts_name_unique
  on portal_accounts (lower(btrim(name)));
