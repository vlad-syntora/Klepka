-- 0019_intake_client_due_date.sql — let the client set/adjust the target date on their own
-- intake items.
--
-- The client owns the "your side" discovery checklist, so they can say when they expect each item
-- to be ready. Klepka-side items stay read-only to the client (guarded as before).
--
-- The client UI pre-fills the date picker with the current value, so a normal status update carries
-- the same date back untouched — a null only reaches here when the client deliberately clears it.

drop function if exists portal_update_intake_item(uuid, text, text);

create or replace function portal_update_intake_item(
  p_item uuid,
  p_status text,
  p_note text default null,
  p_due_date date default null
)
returns portal_intake_items language plpgsql security definer set search_path = public as $$
declare
  updated portal_intake_items;
  acct uuid;
  side text;
begin
  if p_status not in ('in_progress','submitted') then
    raise exception 'unsupported status %', p_status;
  end if;

  select account_id, owner_side into acct, side from portal_intake_items where id = p_item;
  if acct is null or acct is distinct from portal_my_account_id() then
    raise exception 'item not available';
  end if;
  if side <> 'client' then
    raise exception 'this item is on the Klepka side';
  end if;

  update portal_intake_items
    set status = p_status,
        client_note = coalesce(p_note, client_note),
        due_date = p_due_date,
        submitted_at = case when p_status = 'submitted' then now() else submitted_at end
    where id = p_item
    returning * into updated;

  perform portal_log_activity(
    acct, 'account',
    case when p_status = 'submitted' then 'Information submitted for review' else 'Information gathering updated' end,
    updated.name, '/portal/intake');

  return updated;
end $$;

grant execute on function portal_update_intake_item(uuid, text, text, date) to authenticated;
