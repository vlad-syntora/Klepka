-- 0046_salary_self_read.sql — let each internal employee read their OWN salary rows.
--
-- Salaries (0044) are otherwise admin-only: writing, and reading everyone's pay, still require
-- portal_is_admin(). This adds a NARROW self-read so the new "My Salary" page can show a non-admin
-- staffer (Implementer, Sales Rep, Delivery Lead, Ops/Finance) only their own monthly pay.
--
-- RLS SELECT policies are OR'd, so the existing admin read/write policies are untouched; this simply
-- widens read to also include rows the caller owns. The worklog drill-down needs no change — internal
-- staff can already read portal_time_entries (0045), so a person can see the logs behind their salary.
--
-- Standalone + idempotent, matching the migration convention. Apply manually.

drop policy if exists "portal self read salaries" on portal_salaries;
create policy "portal self read salaries" on portal_salaries
  for select using (user_id = portal_my_user_id());
