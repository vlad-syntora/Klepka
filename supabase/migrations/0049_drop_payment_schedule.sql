-- 0049: Drop the legacy payment-schedule feature.
--
-- The old `portal_invoices` table (from 0004) was a manually-maintained payment SCHEDULE
-- (number, amount, due_date, invoice_url PDF, statuses not_issued/upcoming/due/paid/overdue).
-- It is superseded by the time-&-materials billing invoices introduced in 0048
-- (`portal_billing_invoices` / `portal_billing_invoice_lines`), which are computed from
-- approved billable hours. Nothing depends on `portal_invoices` any more.
--
-- CASCADE also removes its RLS policies (0004/0005/0009), indexes and the updated_at trigger.
-- Apply MANUALLY in Supabase.

drop table if exists portal_invoices cascade;
