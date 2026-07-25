-- Stage-driven portal: the client sees a different portal depending on where they are in the
-- lifecycle, and everything unlocks permanently once a first opportunity is won.
--
--   onboarding  new lead        welcome kit, presentations, related articles, book a call
--   discovery   info gathering  intake checklist with owners, due dates and review states
--   proposal    open offer      pipeline & offers on top of the above
--   delivery    won            project tracker, milestones, hours, payments — everything
--
-- The unlock is sticky by design: an account that has ever had a Closed-Won opportunity keeps
-- the full portal, even if its only *current* opportunity is a brand-new open one.

-- ---------------------------------------------------------------------------
-- Onboarding / sales collateral
-- ---------------------------------------------------------------------------

create table portal_resources (
  id uuid primary key default gen_random_uuid(),
  -- Null = shared library shown to every account; set = specific to one client.
  account_id uuid references portal_accounts(id) on delete cascade,
  title text not null,
  description text not null default '',
  kind text not null default 'link'
    check (kind in ('presentation','document','video','link','article')),
  url text,
  file_path text,
  article_id uuid references articles(id) on delete cascade,
  -- Earliest phase this becomes relevant; 'any' shows it throughout.
  phase text not null default 'onboarding'
    check (phase in ('onboarding','discovery','proposal','delivery','any')),
  position integer not null default 0,
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index portal_resources_account_idx on portal_resources (account_id, position);

-- ---------------------------------------------------------------------------
-- Information-gathering checklist (the "discovery" phase)
-- ---------------------------------------------------------------------------

create table portal_intake_items (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references portal_accounts(id) on delete cascade,
  name text not null,
  description text not null default '',
  -- Who the ball is with.
  owner_side text not null default 'client' check (owner_side in ('client','klepka')),
  status text not null default 'not_started'
    check (status in ('not_started','in_progress','submitted','in_review','approved','blocked')),
  due_date date,
  position integer not null default 0,
  client_note text,
  review_note text,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index portal_intake_account_idx on portal_intake_items (account_id, position);

-- ---------------------------------------------------------------------------
-- Delivery hours
-- ---------------------------------------------------------------------------

create table portal_time_entries (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references portal_projects(id) on delete cascade,
  milestone_id uuid references portal_milestones(id) on delete set null,
  user_id uuid references portal_users(id) on delete set null,
  entry_date date not null default current_date,
  hours numeric(6,2) not null check (hours > 0 and hours <= 24),
  description text not null default '',
  billable boolean not null default true,
  -- Hours stay internal until a manager publishes them to the client.
  visible_to_client boolean not null default true,
  created_at timestamptz not null default now()
);

create index portal_time_entries_project_idx on portal_time_entries (project_id, entry_date desc);

create trigger portal_resources_set_updated_at before update on portal_resources
  for each row execute function set_updated_at();
create trigger portal_intake_items_set_updated_at before update on portal_intake_items
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Phase helpers
-- ---------------------------------------------------------------------------

-- Sticky unlock: has this account ever reached Closed Won?
create or replace function portal_account_unlocked(p_account uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select a.lifecycle in ('closed_won','delivery','live','churned') from portal_accounts a where a.id = p_account),
    false)
  or exists (
    select 1 from portal_opportunities o
    where o.account_id = p_account and o.stage = 'closed_won'
  );
$$;

create or replace function portal_account_phase(p_account uuid)
returns text language sql stable security definer set search_path = public as $$
  select case
    when portal_account_unlocked(p_account) then 'delivery'
    else coalesce(
      (select case a.lifecycle
         when 'lead' then 'onboarding'
         when 'qualified' then 'discovery'
         when 'proposal' then 'proposal'
         when 'negotiation' then 'proposal'
         else 'onboarding'
       end
       from portal_accounts a where a.id = p_account),
      'onboarding')
  end;
$$;

-- Convenience wrappers for the signed-in client.
create or replace function portal_my_phase()
returns text language sql stable security definer set search_path = public as $$
  select portal_account_phase(portal_my_account_id());
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table portal_resources enable row level security;
alter table portal_intake_items enable row level security;
alter table portal_time_entries enable row level security;

revoke all on portal_resources, portal_intake_items, portal_time_entries from anon;

-- Resources: shared library plus your own account's, published only, and only once the phase
-- they belong to has been reached.
create policy "portal read resources" on portal_resources
  for select to authenticated using (
    portal_is_internal()
    or (
      published
      and (account_id is null or account_id = portal_my_account_id())
      and (
        phase = 'any'
        or phase = portal_my_phase()
        or (portal_my_phase() = 'discovery' and phase = 'onboarding')
        or (portal_my_phase() = 'proposal' and phase in ('onboarding','discovery'))
        or (portal_my_phase() = 'delivery')
      )
    )
  );
create policy "portal write resources" on portal_resources
  for all to authenticated
  using (portal_is_admin() or (account_id is not null and portal_can_manage(account_id)))
  with check (portal_is_admin() or (account_id is not null and portal_can_manage(account_id)));

create policy "portal read intake" on portal_intake_items
  for select to authenticated using (portal_can_read(account_id));
create policy "portal write intake" on portal_intake_items
  for all to authenticated using (portal_can_manage(account_id)) with check (portal_can_manage(account_id));

create policy "portal read time entries" on portal_time_entries
  for select to authenticated using (
    exists (
      select 1 from portal_projects p
      where p.id = project_id
        and (portal_is_internal() or (p.account_id = portal_my_account_id() and visible_to_client))
    )
  );
create policy "portal write time entries" on portal_time_entries
  for all to authenticated using (
    exists (select 1 from portal_projects p where p.id = project_id and portal_can_manage(p.account_id))
  ) with check (
    exists (select 1 from portal_projects p where p.id = project_id and portal_can_manage(p.account_id))
  );

-- Payments become visible only once something has actually been won. Before that a client in
-- the onboarding/discovery/proposal phase has no business seeing a payment schedule, even a
-- draft one the team is preparing.
drop policy "portal read invoices" on portal_invoices;
create policy "portal read invoices" on portal_invoices
  for select to authenticated using (
    portal_can_read(account_id)
    and portal_can_view_module('payments')
    and (portal_is_internal() or portal_account_unlocked(account_id))
  );

-- ---------------------------------------------------------------------------
-- Client actions
-- ---------------------------------------------------------------------------

-- The client works their side of the intake checklist: mark in progress, submit for review,
-- and leave a note. Klepka-owned items and the review verdict stay out of their hands.
create or replace function portal_update_intake_item(p_item uuid, p_status text, p_note text default null)
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
        submitted_at = case when p_status = 'submitted' then now() else submitted_at end
    where id = p_item
    returning * into updated;

  perform portal_log_activity(
    acct, 'account',
    case when p_status = 'submitted' then 'Information submitted for review' else 'Information gathering updated' end,
    updated.name, '/portal/intake');

  return updated;
end $$;

grant execute on function
  portal_account_unlocked(uuid), portal_account_phase(uuid), portal_my_phase(),
  portal_update_intake_item(uuid, text, text)
to authenticated;
