-- 0008_calendly.sql — per-employee Calendly link.
--
-- Every internal staff member gets a personal booking link so the client can book a call
-- directly (the portal's Calls page), instead of only requesting a slot for manual confirmation.
-- Nullable in the DB (existing rows have none yet); the admin UI treats it as required for
-- internal users and flags anyone missing one.

alter table portal_users add column if not exists calendly_url text;
