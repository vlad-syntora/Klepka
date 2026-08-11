-- 0059_team_time_off_internal.sql — an internal (staff-facing) upcoming-leave feed for the dashboard.
--
-- Why: 0058 gave clients a "Team time off" widget, but internal staff had nowhere on their own dashboard
-- to see their upcoming leave, or that of their teammates, without opening the full Time Off page. This
-- adds one SECURITY DEFINER feed the dashboard widget reads:
--   • my own upcoming leave        — pending OR approved (so I can see requests awaiting sign-off);
--   • my teammates' upcoming leave — approved only (people sharing my portal_users.team_id).
-- Rejected and past leave are excluded. A colleague's free-text note is withheld (only my own note is
-- returned) — a note can carry private detail (e.g. the reason for sick leave), and the widget only needs
-- who is away and when.
--
-- Team = portal_users.team_id (migration 0047). Reads are still gated to internal staff; a client (who
-- has no team_id and is not staff) gets nothing. No new tables or policies — the base portal_time_off
-- RLS already restricts direct reads to own-or-admin; this definer function is the only widened path and
-- it is deliberately narrow (own + same-team approved, upcoming).
--
-- Standalone + idempotent, matching the migration convention. Apply manually.

create or replace function portal_my_team_upcoming_time_off()
returns table (
  id uuid,
  user_id uuid,
  full_name text,
  kind text,
  start_date date,
  end_date date,
  note text,
  days integer,
  status text,
  is_me boolean
) language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := portal_my_user_id();
  v_team uuid;
begin
  if not portal_is_staff() then
    return;
  end if;

  select pu.team_id into v_team from portal_users pu where pu.id = v_me;

  return query
    select
      t.id,
      t.user_id,
      u.full_name,
      t.kind,
      t.start_date,
      t.end_date,
      -- Only surface my own note; a colleague's note may carry private detail.
      case when t.user_id = v_me then t.note else '' end as note,
      (t.end_date - t.start_date + 1)::int as days,
      t.status,
      (t.user_id = v_me) as is_me
    from portal_time_off t
    join portal_users u on u.id = t.user_id
    where t.end_date >= current_date
      and (
        -- Mine: pending or approved (rejected is hidden).
        (t.user_id = v_me and t.status in ('pending', 'approved'))
        -- Teammates: approved only, and only when I actually belong to a team.
        or (t.user_id <> v_me and v_team is not null and u.team_id = v_team and t.status = 'approved')
      )
    order by t.start_date;
end $$;

grant execute on function portal_my_team_upcoming_time_off() to authenticated;
