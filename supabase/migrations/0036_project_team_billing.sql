-- 0036_project_team_billing.sql — carry each offer line item's billing onto the project team member
-- it seeds. When a project is created from an accepted offer, every roster row (design decision:
-- "a project team member should have the same billing info as on the opportunity/offer") copies the
-- matching line's billing type, rate, overtime rate and monthly hours.
--
-- These are internal-only fields: the client-facing team roster never selects them (loadPortalSnapshot
-- requests only the display columns), so they stay on the admin side just like time-entry visibility
-- and account internal_notes do. Nullable throughout — manually-added staff rows carry no billing.

alter table portal_project_team
  add column if not exists billing_type text
    check (billing_type in ('fixed_price', 'time_materials')),
  -- Fixed-price line: the fixed monthly sum. Time & materials line: the quoted hourly rate.
  add column if not exists rate numeric,
  add column if not exists overtime_rate numeric,
  -- Fixed-price only: hours per month covered by the fixed sum (mirrors portal_offer_items).
  add column if not exists monthly_hours numeric;
