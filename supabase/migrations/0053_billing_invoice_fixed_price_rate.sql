-- 0053_billing_invoice_fixed_price_rate.sql — bill fixed-price team members at their HOURLY rate.
--
-- portal_recompute_billing_invoice (0048, last changed in 0050) builds each per-reporter line as
-- hours * pt.rate. For a time_materials member pt.rate IS the hourly rate, so that's correct. But for
-- a fixed_price member pt.rate is the fixed MONTHLY sum (0036) — the hourly rate is derived as
-- rate / monthly_hours everywhere the app shows it (OfferDetail.tsx, offer items). The compute skipped
-- that derivation, so a fixed-price reporter was billed the whole monthly sum for every single hour.
--
-- This re-creates the function with only the rate expression changed: the lateral now resolves an
-- effective hourly rate — rate / monthly_hours for fixed_price (null when monthly_hours is missing or
-- zero, so we never divide by zero), pt.rate as-is for time_materials. Line rate + amount then use it,
-- matching the derived hourly rate shown elsewhere. Everything else (freeze guard, empty-invoice
-- handling, totals) is unchanged from 0050.
--
-- Idempotent (create or replace). Apply manually.

create or replace function portal_recompute_billing_invoice(p_project uuid, p_period date)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_month date := date_trunc('month', p_period)::date;
  v_account uuid;
  v_invoice uuid;
  v_status text;
  v_has_work boolean;
  v_hours numeric;
  v_amount numeric;
begin
  if p_project is null or p_period is null then
    return;
  end if;

  select account_id into v_account from portal_projects where id = p_project;
  if v_account is null then
    return;
  end if;

  select id, status into v_invoice, v_status
  from portal_billing_invoices
  where project_id = p_project and period = v_month;

  -- An issued invoice is frozen — leave it exactly as it was issued to the client.
  if v_status in ('sent', 'client_approved', 'paid') then
    return;
  end if;

  select exists (
    select 1 from portal_time_entries te
    where te.project_id = p_project
      and date_trunc('month', te.entry_date)::date = v_month
      and te.approved
      and te.hours is not null and te.hours > 0
  ) into v_has_work;

  -- Nothing to bill and no invoice yet — don't create an empty one.
  if v_invoice is null and not v_has_work then
    return;
  end if;

  if v_invoice is null then
    insert into portal_billing_invoices (account_id, project_id, period, currency)
    values (v_account, p_project, v_month, 'USD')
    returning id into v_invoice;
  end if;

  -- Rebuild the per-reporter summary from scratch.
  delete from portal_billing_invoice_lines where invoice_id = v_invoice;

  insert into portal_billing_invoice_lines (invoice_id, reporter_id, hours, rate, amount)
  select
    v_invoice,
    te.reporter_id,
    sum(coalesce(te.hours, 0)) as hours,
    r.eff_rate as rate,
    sum(coalesce(te.hours, 0)) * coalesce(r.eff_rate, 0) as amount
  from portal_time_entries te
  left join lateral (
    -- Effective HOURLY rate for this reporter on this project. Fixed-price stores a monthly sum, so
    -- divide it across the covered monthly_hours (matching the app's derived hourly rate); time &
    -- materials already stores an hourly rate. Null monthly_hours/0 yields a null rate (no divide).
    select
      case
        when pt.billing_type = 'fixed_price'
          then case when coalesce(pt.monthly_hours, 0) > 0 then pt.rate / pt.monthly_hours end
        else pt.rate
      end as eff_rate
    from portal_project_team pt
    where pt.project_id = p_project
      and pt.user_id = te.reporter_id
      and pt.rate is not null
    order by pt.assigned_at desc
    limit 1
  ) r on true
  where te.project_id = p_project
    and date_trunc('month', te.entry_date)::date = v_month
    and te.approved
    and te.hours is not null and te.hours > 0
  group by te.reporter_id, r.eff_rate;

  select coalesce(sum(hours), 0), coalesce(sum(amount), 0)
  into v_hours, v_amount
  from portal_billing_invoice_lines
  where invoice_id = v_invoice;

  update portal_billing_invoices
  set total_hours = v_hours, total_amount = v_amount, computed_at = now()
  where id = v_invoice;
end $$;
