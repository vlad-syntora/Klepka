-- 0057_manual_finance_transactions.sql — ad-hoc expenses/income in the finance ledger.
--
-- Why: 0056 records realised money only when a salary or invoice is marked paid. A real company also
-- has one-off costs and income with no planned source row — bank fees, a refund, a grant, misc revenue.
-- This lets an admin add a standalone transaction straight into the ledger so the P&L is complete.
--
-- Model: a third source_type, 'manual', whose rows have no originating row (source_id NULL — the
-- unique(source_type, source_id) constraint treats NULLs as distinct, so many manual rows coexist).
-- They are created and deleted directly (unlike salary/invoice rows, which are driven by their
-- lifecycle), so this adds two RPCs: portal_record_manual_transaction (insert) and
-- portal_delete_finance_transaction (delete, restricted to manual rows so a lifecycle-managed row can
-- never be orphaned from its salary/invoice).
--
-- Admin-only — the RLS policy from 0056 already enforces it; the SECURITY DEFINER RPCs re-check too.
-- Standalone + idempotent, matching the migration convention. Apply manually.

-- ---------------------------------------------------------------------------
-- a. Allow the 'manual' source and a null source_id (manual rows have no originating row)
-- ---------------------------------------------------------------------------

alter table portal_finance_transactions
  drop constraint if exists portal_finance_transactions_source_type_check;
alter table portal_finance_transactions
  add constraint portal_finance_transactions_source_type_check
  check (source_type in ('salary', 'invoice', 'manual'));

alter table portal_finance_transactions
  alter column source_id drop not null;

-- ---------------------------------------------------------------------------
-- b. Insert a standalone (manual) transaction — returns the new row id
-- ---------------------------------------------------------------------------
-- Mirrors portal_record_finance_transaction's currency/FX handling, but always inserts a fresh row
-- (no upsert): manual entries have no natural key, so each "Add" is a new line the admin can delete.

create or replace function portal_record_manual_transaction(
  p_kind text,
  p_amount numeric,
  p_currency text,
  p_fx_rate numeric,
  p_occurred_on date default null,
  p_note text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_base_currency text;
  v_fx numeric := coalesce(p_fx_rate, 1);
  v_id uuid;
begin
  if not portal_is_admin() then
    raise exception 'only admins can record a transaction';
  end if;
  if p_kind not in ('expense', 'income') then
    raise exception 'invalid transaction kind';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'amount must be a positive number';
  end if;
  if v_fx <= 0 then
    raise exception 'fx rate must be a positive number';
  end if;

  select base_currency into v_base_currency from portal_finance_settings where id = true;
  v_base_currency := coalesce(v_base_currency, 'USD');

  insert into portal_finance_transactions
    (kind, source_type, source_id, amount, currency, fx_rate, base_amount, base_currency, occurred_on, note)
  values
    (p_kind, 'manual', null, p_amount, coalesce(nullif(upper(trim(p_currency)), ''), v_base_currency),
     v_fx, round(p_amount * v_fx, 2), v_base_currency, coalesce(p_occurred_on, current_date),
     nullif(trim(p_note), ''))
  returning id into v_id;

  return v_id;
end $$;

grant execute on function portal_record_manual_transaction(text, numeric, text, numeric, date, text) to authenticated;

-- ---------------------------------------------------------------------------
-- c. Delete a transaction — manual rows only
-- ---------------------------------------------------------------------------
-- Salary/invoice rows are removed by reverting the source off 'paid' (0056), never here, so they stay
-- in lockstep with the lifecycle. This guards against deleting one out from under its source.

create or replace function portal_delete_finance_transaction(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_source text;
begin
  if not portal_is_admin() then
    raise exception 'only admins can delete a transaction';
  end if;

  select source_type into v_source from portal_finance_transactions where id = p_id;
  if v_source is null then
    raise exception 'transaction not found';
  end if;
  if v_source <> 'manual' then
    raise exception 'only manual transactions can be deleted here; revert the salary or invoice instead';
  end if;

  delete from portal_finance_transactions where id = p_id;
end $$;

grant execute on function portal_delete_finance_transaction(uuid) to authenticated;
