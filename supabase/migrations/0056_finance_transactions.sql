-- 0056_finance_transactions.sql — a unified realised-money ledger for the finance module.
--
-- Why: salaries (0044) and billing invoices (0048/0050) compute what a month *should* cost or bill,
-- in each entity's own currency. This adds the other half: when an admin actually PAYS a salary or
-- RECEIVES payment for an invoice, they record the exact amount paid — in whatever currency, with a
-- manual FX rate into the base currency (same pattern as overhead, 0055) — as a realised transaction.
-- That gives a single, currency-normalised stream of expenses (salaries) and income (invoices) to
-- drive company profitability analytics later, distinct from the computed reference totals.
--
-- Model:
--   • portal_finance_transactions — one row per paid source. kind = expense | income; source_type =
--     salary | invoice (extensible to overhead/manual later); base_amount = amount × fx_rate stored in
--     base_currency. unique (source_type, source_id) → exactly one transaction per salary/invoice, so
--     re-paying UPSERTs and reverting off 'paid' DELETES it. occurred_on is the payment date.
--
-- Flow change: marking a salary/invoice 'paid' now goes through portal_pay_salary / portal_pay_billing
-- _invoice, which set status = 'paid' AND upsert the transaction atomically. The existing status RPCs
-- (portal_set_salary_status, portal_set_billing_invoice_status) are updated to (a) refuse to set 'paid'
-- directly — it must carry an amount via the pay RPC — and (b) delete the recorded transaction whenever
-- the status moves to a non-paid state (a revert), keeping the ledger consistent with the lifecycle.
--
-- Access model: finance is admin-only for now (mirrors 0044/0055) — read AND write require
-- portal_is_admin(). RLS enforces it; the UI also gates. Never exposed to clients.
--
-- Standalone + idempotent, matching the migration convention. Apply manually.

-- ---------------------------------------------------------------------------
-- a. The ledger table
-- ---------------------------------------------------------------------------

create table if not exists portal_finance_transactions (
  id uuid primary key default gen_random_uuid(),
  -- Direction: an expense (money out, e.g. a paid salary) or income (money in, e.g. a settled invoice).
  kind text not null check (kind in ('expense', 'income')),
  -- What produced it. Kept as (type, id) rather than a hard FK so it can grow (overhead/manual) without
  -- schema churn; the unique constraint below still guarantees one transaction per source row.
  source_type text not null check (source_type in ('salary', 'invoice')),
  source_id uuid not null,
  -- The exact amount paid/received, in its own currency, with a manual FX rate INTO the base currency.
  amount numeric(14, 2) not null,
  currency text not null default 'USD',
  fx_rate numeric(14, 6) not null default 1,
  -- Denormalised base-currency figure (amount × fx_rate) so analytics never re-derive it. base_currency
  -- is snapshotted from portal_finance_settings at record time — a later base-currency change does not
  -- silently rewrite past transactions.
  base_amount numeric(14, 2) not null,
  base_currency text not null default 'USD',
  -- The date the money actually moved (may differ from when it was recorded).
  occurred_on date not null default current_date,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Exactly one transaction per source row → pay = upsert, revert = delete.
  unique (source_type, source_id)
);

create index if not exists portal_finance_transactions_occurred_idx
  on portal_finance_transactions (occurred_on);

drop trigger if exists portal_finance_transactions_set_updated_at on portal_finance_transactions;
create trigger portal_finance_transactions_set_updated_at before update on portal_finance_transactions
  for each row execute function set_updated_at();

alter table portal_finance_transactions enable row level security;
revoke all on portal_finance_transactions from anon;

drop policy if exists "portal admin finance transactions" on portal_finance_transactions;
create policy "portal admin finance transactions" on portal_finance_transactions
  for all to authenticated using (portal_is_admin()) with check (portal_is_admin());

-- ---------------------------------------------------------------------------
-- b. Internal helper: upsert a transaction for a source
-- ---------------------------------------------------------------------------
-- Called by the two pay RPCs. Snapshots base_currency from finance settings and computes base_amount.

create or replace function portal_record_finance_transaction(
  p_kind text,
  p_source_type text,
  p_source_id uuid,
  p_amount numeric,
  p_currency text,
  p_fx_rate numeric,
  p_occurred_on date,
  p_note text
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_base_currency text;
  v_fx numeric := coalesce(p_fx_rate, 1);
begin
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
    (p_kind, p_source_type, p_source_id, p_amount, coalesce(nullif(upper(trim(p_currency)), ''), v_base_currency),
     v_fx, round(p_amount * v_fx, 2), v_base_currency, coalesce(p_occurred_on, current_date),
     nullif(trim(p_note), ''))
  on conflict (source_type, source_id) do update set
    kind = excluded.kind,
    amount = excluded.amount,
    currency = excluded.currency,
    fx_rate = excluded.fx_rate,
    base_amount = excluded.base_amount,
    base_currency = excluded.base_currency,
    occurred_on = excluded.occurred_on,
    note = excluded.note,
    updated_at = now();
end $$;

-- ---------------------------------------------------------------------------
-- c. Pay a salary — set status='paid' AND record the expense, atomically
-- ---------------------------------------------------------------------------

create or replace function portal_pay_salary(
  p_id uuid,
  p_amount numeric,
  p_currency text,
  p_fx_rate numeric,
  p_occurred_on date default null,
  p_note text default null
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_status text;
begin
  if not portal_is_admin() then
    raise exception 'only admins can pay a salary';
  end if;

  select status into v_status from portal_salaries where id = p_id;
  if v_status is null then
    raise exception 'salary not found';
  end if;

  perform portal_record_finance_transaction(
    'expense', 'salary', p_id, p_amount, p_currency, p_fx_rate, p_occurred_on, p_note);

  update portal_salaries set status = 'paid', updated_at = now() where id = p_id;
end $$;

grant execute on function portal_pay_salary(uuid, numeric, text, numeric, date, text) to authenticated;

-- ---------------------------------------------------------------------------
-- d. Pay a billing invoice — set status='paid' AND record the income, atomically
-- ---------------------------------------------------------------------------
-- An invoice must have been issued (frozen) before it can be paid, matching the lifecycle + the UI.

create or replace function portal_pay_billing_invoice(
  p_id uuid,
  p_amount numeric,
  p_currency text,
  p_fx_rate numeric,
  p_occurred_on date default null,
  p_note text default null
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_status text;
begin
  if not portal_is_admin() then
    raise exception 'only admins can mark an invoice paid';
  end if;

  select status into v_status from portal_billing_invoices where id = p_id;
  if v_status is null then
    raise exception 'invoice not found';
  end if;
  if v_status not in ('sent', 'client_approved') then
    raise exception 'only a sent or client-approved invoice can be marked paid';
  end if;

  perform portal_record_finance_transaction(
    'income', 'invoice', p_id, p_amount, p_currency, p_fx_rate, p_occurred_on, p_note);

  update portal_billing_invoices set status = 'paid', updated_at = now() where id = p_id;
end $$;

grant execute on function portal_pay_billing_invoice(uuid, numeric, text, numeric, date, text) to authenticated;

-- ---------------------------------------------------------------------------
-- e. Status RPCs now guard 'paid' and clean up on revert
-- ---------------------------------------------------------------------------
-- Direct 'paid' is refused (it must carry an amount via the pay RPCs). Any move to a non-paid status
-- deletes the recorded transaction — a no-op when none exists, and the correct cleanup on a revert.

create or replace function portal_set_salary_status(p_id uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not portal_is_admin() then
    raise exception 'only admins can change salary status';
  end if;
  if p_status not in ('open', 'approved', 'paid') then
    raise exception 'invalid salary status';
  end if;
  if p_status = 'paid' then
    raise exception 'use portal_pay_salary to mark a salary paid';
  end if;

  delete from portal_finance_transactions where source_type = 'salary' and source_id = p_id;
  update portal_salaries set status = p_status, updated_at = now() where id = p_id;
end $$;

grant execute on function portal_set_salary_status(uuid, text) to authenticated;

create or replace function portal_set_billing_invoice_status(p_id uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not portal_is_admin() then
    raise exception 'only admins can change invoice status';
  end if;
  if p_status not in ('open', 'approved', 'sent', 'client_approved', 'paid') then
    raise exception 'invalid invoice status';
  end if;
  if p_status = 'paid' then
    raise exception 'use portal_pay_billing_invoice to mark an invoice paid';
  end if;

  delete from portal_finance_transactions where source_type = 'invoice' and source_id = p_id;
  update portal_billing_invoices set status = p_status, updated_at = now() where id = p_id;
end $$;

grant execute on function portal_set_billing_invoice_status(uuid, text) to authenticated;
