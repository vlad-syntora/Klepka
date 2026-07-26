-- 0024_offer_billing.sql — each offer line carries its own billing model.
--
-- Every line item records how that piece of work is billed:
--   * billing_type   — 'fixed_price' or 'time_materials'
--   * overtime_rate  — the hourly rate charged for work beyond the agreed scope (either type)
--   * monthly_hours  — fixed price only: the hours covered by the monthly retainer
--   * amount         — fixed price: the fixed sum charged per month for `monthly_hours` hours.
--                      time & materials: the quoted hourly rate (T&M lines are purely hourly).
--
-- The effective hourly rate for a fixed-price line is derived on the fly (amount / monthly_hours)
-- wherever it is shown, so no rate column is stored here.

alter table portal_offer_items
  add column if not exists billing_type text not null default 'time_materials'
    check (billing_type in ('fixed_price', 'time_materials')),
  add column if not exists overtime_rate numeric(12, 2),
  add column if not exists monthly_hours numeric(12, 2);
