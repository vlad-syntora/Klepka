-- ============================================================================
-- Combined apply script: migrations 0005 → 0017, made idempotent so it is safe
-- to run in the Supabase SQL Editor even if some parts were already applied.
-- Run this whole file once. It replaces running 0005…0017 separately.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0005 — Stage-driven portal (resources / intake / hours + phase helpers)
-- ---------------------------------------------------------------------------

create table if not exists portal_resources (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references portal_accounts(id) on delete cascade,
  title text not null,
  description text not null default '',
  kind text not null default 'link'
    check (kind in ('presentation','document','video','link','article')),
  url text,
  file_path text,
  article_id uuid references articles(id) on delete cascade,
  phase text not null default 'onboarding'
    check (phase in ('onboarding','discovery','proposal','delivery','any')),
  position integer not null default 0,
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists portal_resources_account_idx on portal_resources (account_id, position);

create table if not exists portal_intake_items (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references portal_accounts(id) on delete cascade,
  name text not null,
  description text not null default '',
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
create index if not exists portal_intake_account_idx on portal_intake_items (account_id, position);

create table if not exists portal_time_entries (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references portal_projects(id) on delete cascade,
  milestone_id uuid references portal_milestones(id) on delete set null,
  user_id uuid references portal_users(id) on delete set null,
  entry_date date not null default current_date,
  hours numeric(6,2) not null check (hours > 0 and hours <= 24),
  description text not null default '',
  billable boolean not null default true,
  visible_to_client boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists portal_time_entries_project_idx on portal_time_entries (project_id, entry_date desc);

drop trigger if exists portal_resources_set_updated_at on portal_resources;
create trigger portal_resources_set_updated_at before update on portal_resources
  for each row execute function set_updated_at();
drop trigger if exists portal_intake_items_set_updated_at on portal_intake_items;
create trigger portal_intake_items_set_updated_at before update on portal_intake_items
  for each row execute function set_updated_at();

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

create or replace function portal_my_phase()
returns text language sql stable security definer set search_path = public as $$
  select portal_account_phase(portal_my_account_id());
$$;

alter table portal_resources enable row level security;
alter table portal_intake_items enable row level security;
alter table portal_time_entries enable row level security;

revoke all on portal_resources, portal_intake_items, portal_time_entries from anon;

drop policy if exists "portal read resources" on portal_resources;
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
drop policy if exists "portal write resources" on portal_resources;
create policy "portal write resources" on portal_resources
  for all to authenticated
  using (portal_is_admin() or (account_id is not null and portal_can_manage(account_id)))
  with check (portal_is_admin() or (account_id is not null and portal_can_manage(account_id)));

drop policy if exists "portal read intake" on portal_intake_items;
create policy "portal read intake" on portal_intake_items
  for select to authenticated using (portal_can_read(account_id));
drop policy if exists "portal write intake" on portal_intake_items;
create policy "portal write intake" on portal_intake_items
  for all to authenticated using (portal_can_manage(account_id)) with check (portal_can_manage(account_id));

drop policy if exists "portal read time entries" on portal_time_entries;
create policy "portal read time entries" on portal_time_entries
  for select to authenticated using (
    exists (
      select 1 from portal_projects p
      where p.id = project_id
        and (portal_is_internal() or (p.account_id = portal_my_account_id() and visible_to_client))
    )
  );
drop policy if exists "portal write time entries" on portal_time_entries;
create policy "portal write time entries" on portal_time_entries
  for all to authenticated using (
    exists (select 1 from portal_projects p where p.id = project_id and portal_can_manage(p.account_id))
  ) with check (
    exists (select 1 from portal_projects p where p.id = project_id and portal_can_manage(p.account_id))
  );

drop policy if exists "portal read invoices" on portal_invoices;
create policy "portal read invoices" on portal_invoices
  for select to authenticated using (
    portal_can_read(account_id)
    and portal_can_view_module('payments')
    and (portal_is_internal() or portal_account_unlocked(account_id))
  );

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

-- ---------------------------------------------------------------------------
-- 0006 — Google Drive pointers
-- ---------------------------------------------------------------------------

alter table portal_accounts
  add column if not exists drive_folder_id text,
  add column if not exists drive_web_link text,
  add column if not exists drive_folders jsonb not null default '{}';

alter table portal_documents
  add column if not exists drive_file_id text,
  add column if not exists drive_web_link text;

-- ---------------------------------------------------------------------------
-- 0007 — Account-level internal team (pre-sale team)
-- ---------------------------------------------------------------------------

create table if not exists portal_account_team (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references portal_accounts(id) on delete cascade,
  user_id uuid not null references portal_users(id) on delete cascade,
  team_role text not null default 'Pre-sale',
  added_at timestamptz not null default now(),
  active boolean not null default true,
  unique (account_id, user_id)
);
create index if not exists portal_account_team_account_idx on portal_account_team (account_id);

alter table portal_account_team enable row level security;
revoke all on portal_account_team from anon;

drop policy if exists "portal read account team" on portal_account_team;
create policy "portal read account team" on portal_account_team
  for select to authenticated using (portal_can_read(account_id));
drop policy if exists "portal write account team" on portal_account_team;
create policy "portal write account team" on portal_account_team
  for all to authenticated using (portal_can_manage(account_id)) with check (portal_can_manage(account_id));

-- ---------------------------------------------------------------------------
-- 0008 — Per-employee Calendly link
-- ---------------------------------------------------------------------------

alter table portal_users add column if not exists calendly_url text;

-- ---------------------------------------------------------------------------
-- 0009 — "Implementer" employee role (account-scoped, no finance)
-- ---------------------------------------------------------------------------

alter table portal_users drop constraint if exists portal_users_role_check;
alter table portal_users drop constraint if exists portal_users_check;
alter table portal_users drop constraint if exists portal_users_staff_account_check;
alter table portal_users
  add constraint portal_users_role_check
    check (role in ('prospect','client_admin','client_collaborator','sales_rep','delivery_lead','ops_finance','portal_admin','implementor'));
alter table portal_users
  add constraint portal_users_staff_account_check
    check (role in ('sales_rep','delivery_lead','ops_finance','portal_admin','implementor') or account_id is not null);

create or replace function portal_staffed_on(target_account uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select target_account is not null and (
    exists (
      select 1 from portal_account_team at
      where at.account_id = target_account and at.user_id = portal_my_user_id() and at.active
    )
    or exists (
      select 1 from portal_project_team pt
      join portal_projects p on p.id = pt.project_id
      where p.account_id = target_account and pt.user_id = portal_my_user_id() and pt.active
    )
  );
$$;

create or replace function portal_is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select role in ('sales_rep','delivery_lead','ops_finance','portal_admin','implementor')
     from portal_users where auth_user_id = auth.uid() and status <> 'disabled' limit 1),
    false);
$$;

create or replace function portal_can_read(target_account uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select portal_is_internal()
    or (target_account is not null and target_account = portal_my_account_id())
    or (portal_my_role() = 'implementor' and portal_staffed_on(target_account));
$$;

create or replace function portal_can_manage(target_account uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select portal_is_admin()
    or (
      portal_is_staff()
      and target_account is not null
      and (
        exists (select 1 from portal_accounts a where a.id = target_account and a.owner_id = portal_my_user_id())
        or portal_staffed_on(target_account)
        or exists (select 1 from portal_meetings m where m.account_id = target_account and m.host_user_id = portal_my_user_id())
      )
    );
$$;

create or replace function portal_can_view_module(p_module text)
returns boolean language sql stable security definer set search_path = public as $$
  select case portal_my_role()
    when 'client_admin' then true
    when 'prospect' then p_module in ('pipeline','calls','documents','feedback','project')
    when 'client_collaborator' then
      p_module in ('pipeline','calls','feedback')
      or exists (
        select 1 from portal_users u
        where u.auth_user_id = auth.uid() and p_module = any (u.module_access)
      )
    when 'implementor' then p_module <> 'payments'
    else portal_is_internal()
  end;
$$;

create or replace function portal_can_read_doc_path(p_first text)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare acct uuid;
begin
  if portal_is_internal() then return true; end if;
  if p_first = portal_my_account_id()::text then return true; end if;
  begin
    acct := p_first::uuid;
  exception when others then
    return false;
  end;
  return portal_staffed_on(acct);
end $$;

grant execute on function
  portal_staffed_on(uuid), portal_is_staff(), portal_can_read_doc_path(text),
  portal_can_read(uuid), portal_can_manage(uuid), portal_can_view_module(text)
to authenticated;

drop policy if exists "portal read users" on portal_users;
create policy "portal read users" on portal_users
  for select to authenticated using (
    portal_is_internal() or account_id is null or portal_can_read(account_id)
  );

drop policy if exists "portal read offers" on portal_offers;
create policy "portal read offers" on portal_offers
  for select to authenticated using (
    portal_can_read(account_id) and portal_can_view_module('pipeline') and (portal_is_staff() or status <> 'draft')
  );

drop policy if exists "portal read projects" on portal_projects;
create policy "portal read projects" on portal_projects
  for select to authenticated using (
    portal_can_read(account_id) and portal_can_view_module('project') and (portal_is_staff() or published)
  );

drop policy if exists "portal read documents" on portal_documents;
create policy "portal read documents" on portal_documents
  for select to authenticated using (
    portal_can_read(account_id) and portal_can_view_module('documents') and (portal_is_staff() or status <> 'draft')
  );

drop policy if exists "portal read activity" on portal_activity;
create policy "portal read activity" on portal_activity
  for select to authenticated using (
    portal_can_read(account_id) and (portal_is_staff() or client_visible)
  );

drop policy if exists "portal write invoices" on portal_invoices;
create policy "portal write invoices" on portal_invoices
  for all to authenticated
  using (portal_can_manage(account_id) and portal_can_view_module('payments'))
  with check (portal_can_manage(account_id) and portal_can_view_module('payments'));

drop policy if exists "portal read documents storage" on storage.objects;
create policy "portal read documents storage" on storage.objects
  for select to authenticated using (
    bucket_id = 'portal-documents' and portal_can_read_doc_path((storage.foldername(name))[1])
  );
drop policy if exists "portal upload documents storage" on storage.objects;
create policy "portal upload documents storage" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'portal-documents' and portal_can_read_doc_path((storage.foldername(name))[1])
  );

-- ---------------------------------------------------------------------------
-- 0010 — Opportunity → Offer → Documents → Project → Payments
-- ---------------------------------------------------------------------------

alter table portal_documents
  add column if not exists opportunity_id uuid references portal_opportunities(id) on delete set null;
create index if not exists portal_documents_opportunity_idx on portal_documents (opportunity_id);

create or replace function portal_opportunity_won() returns trigger
  language plpgsql security definer set search_path = public as $$
declare new_project uuid;
begin
  if new.stage = 'closed_won'
     and (tg_op = 'INSERT' or old.stage is distinct from 'closed_won')
     and not exists (select 1 from portal_projects where opportunity_id = new.id) then
    insert into portal_projects (account_id, opportunity_id, name, status, published)
      values (new.account_id, new.id, new.name, 'planned', false)
      returning id into new_project;
    update portal_documents d set related_project_id = new_project
      where d.related_project_id is null
        and (
          d.opportunity_id = new.id
          or d.related_offer_id in (select id from portal_offers where opportunity_id = new.id)
        );
    perform portal_log_activity(new.account_id, 'project', 'Project created from won opportunity', new.name, null);
  end if;
  return new;
end $$;

drop trigger if exists portal_opportunity_won_trg on portal_opportunities;
create trigger portal_opportunity_won_trg
  after insert or update of stage on portal_opportunities
  for each row execute function portal_opportunity_won();

create or replace function portal_can_view_module(p_module text)
returns boolean language sql stable security definer set search_path = public as $$
  select case portal_my_role()
    when 'client_admin' then true
    when 'prospect' then p_module in ('pipeline','calls','documents','feedback','project')
    when 'client_collaborator' then
      p_module in ('pipeline','calls','feedback')
      or exists (
        select 1 from portal_users u
        where u.auth_user_id = auth.uid() and p_module = any (u.module_access)
      )
    when 'implementor' then p_module <> 'payments'
    else case
      when p_module = 'payments' then portal_my_role() in ('sales_rep','ops_finance','portal_admin')
      else portal_is_internal()
    end
  end;
$$;

grant execute on function portal_can_view_module(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 0011 — active/inactive user lifecycle (inactive default = no access)
-- ---------------------------------------------------------------------------

alter table portal_users alter column status set default 'inactive';
update portal_users set status = 'inactive' where status = 'disabled';
alter table portal_users drop constraint if exists portal_users_status_check;
alter table portal_users
  add constraint portal_users_status_check check (status in ('inactive','invited','active'));

create or replace function portal_my_user_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from portal_users where auth_user_id = auth.uid() and status in ('active','invited') limit 1;
$$;

create or replace function portal_my_role()
returns text language sql stable security definer set search_path = public as $$
  select role from portal_users where auth_user_id = auth.uid() and status in ('active','invited') limit 1;
$$;

create or replace function portal_my_account_id()
returns uuid language sql stable security definer set search_path = public as $$
  select account_id from portal_users where auth_user_id = auth.uid() and status in ('active','invited') limit 1;
$$;

create or replace function portal_is_internal()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select role in ('sales_rep','delivery_lead','ops_finance','portal_admin')
     from portal_users where auth_user_id = auth.uid() and status in ('active','invited') limit 1),
    false);
$$;

create or replace function portal_is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select role = 'portal_admin'
     from portal_users where auth_user_id = auth.uid() and status in ('active','invited') limit 1),
    false);
$$;

create or replace function portal_is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select role in ('sales_rep','delivery_lead','ops_finance','portal_admin','implementor')
     from portal_users where auth_user_id = auth.uid() and status in ('active','invited') limit 1),
    false);
$$;

-- ---------------------------------------------------------------------------
-- 0012 — optional headshot URL per user
-- ---------------------------------------------------------------------------

alter table portal_users add column if not exists photo_url text;

-- ---------------------------------------------------------------------------
-- 0013 — optional account logo/icon URL
-- ---------------------------------------------------------------------------

alter table portal_accounts add column if not exists logo_url text;

-- ---------------------------------------------------------------------------
-- 0014 — account source (picklist) + source subtype (text)
-- ---------------------------------------------------------------------------

alter table portal_accounts add column if not exists source text;
alter table portal_accounts add column if not exists source_subtype text;

-- ---------------------------------------------------------------------------
-- 0015 — candidate shortlist (internal staff) the client confirms / declines.
--        Feature not yet shipped, so the table is (re)created cleanly.
-- ---------------------------------------------------------------------------

drop table if exists portal_candidates cascade;

create table portal_candidates (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references portal_accounts(id) on delete cascade,
  user_id uuid not null references portal_users(id) on delete cascade,
  title text,
  cv_url text,
  hourly_rate numeric(12, 2),
  status text not null default 'proposed' check (status in ('proposed','confirmed','declined')),
  client_note text,
  decided_at timestamptz,
  decided_by uuid references portal_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_id, user_id)
);

create index if not exists portal_candidates_account_idx on portal_candidates (account_id);

alter table portal_candidates enable row level security;

create policy "portal read candidates" on portal_candidates
  for select to authenticated using (portal_can_read(account_id));

create policy "portal write candidates" on portal_candidates
  for all to authenticated using (portal_can_manage(account_id)) with check (portal_can_manage(account_id));

create or replace function portal_decide_candidate(p_candidate uuid, p_decision text, p_note text default null)
returns portal_candidates language plpgsql security definer set search_path = public as $$
declare
  target portal_candidates;
  acct uuid;
  who text;
begin
  if p_decision not in ('confirmed','declined') then
    raise exception 'unsupported decision %', p_decision;
  end if;

  select account_id into acct from portal_candidates where id = p_candidate;
  if acct is null or acct is distinct from portal_my_account_id() then
    raise exception 'candidate not available';
  end if;

  update portal_candidates
    set status = p_decision,
        client_note = coalesce(p_note, client_note),
        decided_at = now(),
        decided_by = portal_my_user_id(),
        updated_at = now()
    where id = p_candidate
    returning * into target;

  select full_name into who from portal_users where id = target.user_id;
  perform portal_log_activity(
    acct, 'project',
    case when p_decision = 'confirmed' then 'Candidate confirmed' else 'Candidate declined' end,
    coalesce(who, ''), null);

  return target;
end $$;

grant execute on function portal_decide_candidate(uuid, text, text) to authenticated;


-- ---------------------------------------------------------------------------
-- 0016 — new account lifecycle set + automations (qualified/proposal/live/stopped)
-- ---------------------------------------------------------------------------

--   * Opportunity → Proposal         : account becomes Proposal Sent.
--   * Project → Active (live)         : account becomes Live.
--   * Project → Complete (closed)     : if no other open project remains, account becomes Stopped.

-- ---------------------------------------------------------------------------
-- a. Migrate existing lifecycle values, then swap the check constraint.
-- ---------------------------------------------------------------------------

alter table portal_accounts drop constraint if exists portal_accounts_lifecycle_check;

update portal_accounts set lifecycle = case lifecycle
  when 'proposal' then 'proposal_sent'
  when 'negotiation' then 'proposal_sent'
  when 'closed_won' then 'live'
  when 'delivery' then 'live'
  when 'churned' then 'stopped'
  else lifecycle            -- lead / qualified / live keep their value
end;

alter table portal_accounts add constraint portal_accounts_lifecycle_check
  check (lifecycle in ('lead','qualified','proposal_sent','live','stopped','lost'));

-- ---------------------------------------------------------------------------
-- b. Phase helpers (0005) referenced the old values — realign them so client
--    module gating keeps matching the UI (portal-phase.ts).
-- ---------------------------------------------------------------------------

create or replace function portal_account_unlocked(p_account uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select a.lifecycle in ('live','stopped') from portal_accounts a where a.id = p_account),
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
         when 'proposal_sent' then 'proposal'
         else 'onboarding'
       end
       from portal_accounts a where a.id = p_account),
      'onboarding')
  end;
$$;

-- ---------------------------------------------------------------------------
-- c. Account → Qualified auto-creates an opportunity (only if it has none yet).
-- ---------------------------------------------------------------------------

create or replace function portal_account_qualified() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if new.lifecycle = 'qualified'
     and (tg_op = 'INSERT' or old.lifecycle is distinct from 'qualified')
     and not exists (select 1 from portal_opportunities where account_id = new.id) then
    insert into portal_opportunities (account_id, name, stage)
      values (new.id, new.name || ' — Opportunity', 'discovery');
    perform portal_log_activity(new.id, 'pipeline', 'Opportunity created', new.name, null);
  end if;
  return new;
end $$;

drop trigger if exists portal_account_qualified_trg on portal_accounts;
create trigger portal_account_qualified_trg
  after insert or update of lifecycle on portal_accounts
  for each row execute function portal_account_qualified();

-- ---------------------------------------------------------------------------
-- d. Opportunity → Proposal sets the account to Proposal Sent.
-- ---------------------------------------------------------------------------

create or replace function portal_opportunity_proposal() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if new.stage = 'proposal'
     and (tg_op = 'INSERT' or old.stage is distinct from 'proposal') then
    update portal_accounts set lifecycle = 'proposal_sent'
      where id = new.account_id and lifecycle <> 'proposal_sent';
  end if;
  return new;
end $$;

drop trigger if exists portal_opportunity_proposal_trg on portal_opportunities;
create trigger portal_opportunity_proposal_trg
  after insert or update of stage on portal_opportunities
  for each row execute function portal_opportunity_proposal();

-- ---------------------------------------------------------------------------
-- e. Project status → account lifecycle.
--    Active  → Live. Complete → Stopped, but only once no other project on the
--    account is still open (status <> 'complete').
-- ---------------------------------------------------------------------------

create or replace function portal_project_lifecycle_sync() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'active'
     and (tg_op = 'INSERT' or old.status is distinct from 'active') then
    update portal_accounts set lifecycle = 'live'
      where id = new.account_id and lifecycle <> 'live';
  elsif new.status = 'complete'
     and (tg_op = 'INSERT' or old.status is distinct from 'complete')
     and not exists (
       select 1 from portal_projects
       where account_id = new.account_id and id <> new.id and status <> 'complete'
     ) then
    update portal_accounts set lifecycle = 'stopped'
      where id = new.account_id and lifecycle <> 'stopped';
  end if;
  return new;
end $$;

drop trigger if exists portal_project_lifecycle_sync_trg on portal_projects;
create trigger portal_project_lifecycle_sync_trg
  after insert or update of status on portal_projects
  for each row execute function portal_project_lifecycle_sync();


-- ===== 0017_account_name_duplicate_rule.sql =====
-- the rule holds even under concurrent inserts, not just in the UI.

-- ---------------------------------------------------------------------------
-- a. Surface any pre-existing duplicates so applying this is not a silent fail.
--    (The create index below will error if duplicates exist — this NOTICE tells
--     you which names to merge first.)
-- ---------------------------------------------------------------------------
do $$
declare dupes text;
begin
  select string_agg(name || ' (' || cnt || ')', ', ')
    into dupes
  from (
    select min(name) as name, count(*) as cnt
    from portal_accounts
    group by lower(btrim(name))
    having count(*) > 1
  ) d;
  if dupes is not null then
    raise exception 'Cannot enforce the account duplicate rule — merge these duplicate names first: %', dupes;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- b. The rule itself: a case-/whitespace-insensitive unique index on the name.
-- ---------------------------------------------------------------------------
create unique index if not exists portal_accounts_name_unique
  on portal_accounts (lower(btrim(name)));
