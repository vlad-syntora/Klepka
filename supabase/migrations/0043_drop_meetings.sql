-- 0043_drop_meetings.sql — remove the unused meetings / scheduling feature.
--
-- Why: the portal_meetings table (introduced in 0004) and its request/cancel RPCs were never
-- surfaced in the UI. The client snapshot fetched the table on every load and threw the result away;
-- no component ever rendered a meeting. Dropping it removes a per-load query and dead schema.
--
-- Dependencies handled here:
--   • portal_request_meeting / portal_cancel_meeting return the portal_meetings rowtype, so they must
--     go before (or with) the table. Dropped explicitly.
--   • portal_can_manage() (current definition from 0009) references portal_meetings in its body. A SQL
--     function body does not create a hard dependency, so DROP TABLE would leave it referencing a
--     missing relation and failing at runtime. Redefined below without the meeting-host branch.
--   • The table's index, updated_at trigger and RLS policies drop with the table.
--
-- Fully idempotent, matching the standalone-migration convention (the APPLY_0005_to_0017 bundle is
-- frozen at 0017). Apply manually.

-- Redefine portal_can_manage() without the "hosts a meeting for the account" write branch. Matches
-- the 0009 body verbatim otherwise (admins everywhere; staff on accounts they own or are staffed on).
create or replace function portal_can_manage(target_account uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select portal_is_admin()
    or (
      portal_is_staff()
      and target_account is not null
      and (
        exists (select 1 from portal_accounts a where a.id = target_account and a.owner_id = portal_my_user_id())
        or portal_staffed_on(target_account)
      )
    );
$$;

-- Drop the meeting RPCs (they return the portal_meetings rowtype).
drop function if exists portal_request_meeting(text, text, timestamptz, integer);
drop function if exists portal_cancel_meeting(uuid);

-- Drop the table — its index, updated_at trigger and RLS policies go with it.
drop table if exists portal_meetings;
