-- 0013_account_logo.sql — optional account logo/icon (external URL). Shown as the account avatar
-- in the client portal top bar and in the admin account list. No storage bucket involved.

alter table portal_accounts add column if not exists logo_url text;
