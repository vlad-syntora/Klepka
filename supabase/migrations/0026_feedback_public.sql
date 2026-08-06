-- 0026_feedback_public.sql — public (cross-client) feedback about staff + per-staff ratings.
--
-- Clients can now mark feedback about a specific person as "OK to share publicly". Such feedback
-- becomes visible to OTHER clients only after a Klepka staffer approves it (moderation gate).
-- Approved public reviews are shown anonymised (no account, no author). A per-staff AVERAGE rating
-- is also exposed to clients — computed over ALL feedback (public and private) so it stays honest,
-- and recomputed on the fly, so deleting a feedback row on the backend updates the average.

-- ---------------------------------------------------------------------------
-- Columns
-- ---------------------------------------------------------------------------

alter table portal_feedback
  add column if not exists is_public boolean not null default false,          -- client consent to share
  add column if not exists public_approved_at timestamptz,                     -- set by staff on approval
  add column if not exists public_approved_by uuid references portal_users(id) on delete set null;

-- Fast lookup of approved public reviews per staff member.
create index if not exists portal_feedback_public_idx
  on portal_feedback (about_user_id)
  where is_public and public_approved_at is not null;

-- ---------------------------------------------------------------------------
-- Submit: gains the "make public" flag. Only meaningful when the feedback is about a person;
-- general feedback about Klepka can't be published cross-client. Stays pending until approved.
-- ---------------------------------------------------------------------------

drop function if exists portal_submit_feedback(integer, text, uuid, boolean, text);

create or replace function portal_submit_feedback(
  p_rating integer, p_comment text, p_about_user uuid default null,
  p_is_urgent boolean default false, p_context text default null,
  p_is_public boolean default false
) returns portal_feedback language plpgsql security definer set search_path = public as $$
declare
  acct uuid := portal_my_account_id();
  created portal_feedback;
  proj uuid;
  v_public boolean := coalesce(p_is_public, false) and p_about_user is not null;
begin
  if acct is null then
    raise exception 'no account for current user';
  end if;
  if p_rating < 1 or p_rating > 5 then
    raise exception 'rating must be between 1 and 5';
  end if;
  if p_about_user is not null and not exists (
    select 1 from portal_feedback_targets() t where t.user_id = p_about_user
  ) then
    raise exception 'that person is not on your project team';
  end if;

  select id into proj from portal_projects
    where account_id = acct and published order by created_at desc limit 1;

  insert into portal_feedback (account_id, project_id, about_user_id, submitted_by, rating, comment, context, is_urgent, is_public)
  values (acct, proj, p_about_user, portal_my_user_id(), p_rating, coalesce(p_comment, ''), p_context, coalesce(p_is_urgent, false), v_public)
  returning * into created;

  perform portal_log_activity(
    acct, 'feedback',
    case when created.is_urgent then 'Urgent feedback submitted' else 'Feedback submitted' end,
    created.rating || '/5', '/portal/feedback');

  return created;
end $$;

-- ---------------------------------------------------------------------------
-- Read paths for clients (SECURITY DEFINER — the underlying rows stay private cross-account).
-- ---------------------------------------------------------------------------

-- Average rating + count per staff member, over ALL feedback about them. Non-sensitive aggregate;
-- exposed so clients see how each person is rated overall. Recomputed each call.
create or replace function portal_staff_feedback_summary(p_user_ids uuid[])
returns table (user_id uuid, avg_rating numeric, rating_count bigint)
language sql stable security definer set search_path = public as $$
  select f.about_user_id, round(avg(f.rating)::numeric, 2), count(*)
  from portal_feedback f
  where f.about_user_id = any(p_user_ids)
  group by f.about_user_id;
$$;

-- Approved public reviews about the given staff, anonymised: rating + comment + date only. No
-- account, no author — other clients can read these across account boundaries.
create or replace function portal_staff_public_reviews(p_user_ids uuid[])
returns table (id uuid, about_user_id uuid, rating integer, comment text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select f.id, f.about_user_id, f.rating, f.comment, f.created_at
  from portal_feedback f
  where f.about_user_id = any(p_user_ids)
    and f.is_public
    and f.public_approved_at is not null
  order by f.created_at desc;
$$;

grant execute on function
  portal_submit_feedback(integer, text, uuid, boolean, text, boolean),
  portal_staff_feedback_summary(uuid[]),
  portal_staff_public_reviews(uuid[])
to authenticated;
