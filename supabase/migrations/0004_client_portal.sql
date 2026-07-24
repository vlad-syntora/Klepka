-- Klepka Client Portal + Admin Console.
-- Implements the entity model from portal-design/ (§8 of the design doc): accounts, portal
-- users, opportunities, offers, meetings, documents, invoices, projects, milestones,
-- project team members, feedback and an activity/notification feed.
--
-- Access model:
--   * Every portal person (client-side and Klepka-internal) is a row in portal_users, linked
--     to an auth.users row on first login (portal_bootstrap_user).
--   * Internal staff read every account; write access is scoped by role + account ownership.
--   * Client users read only their own account, filtered further by module access.
--   * Client-side *writes* never touch tables directly — they go through the security-definer
--     RPCs at the bottom of this file, so a client can only make the specific transitions the
--     portal offers (accept an offer, request changes, book a call, approve a milestone, ...).

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table portal_accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  industry text,
  -- Client lifecycle stage (design doc §7).
  lifecycle text not null default 'lead'
    check (lifecycle in ('lead','qualified','proposal','negotiation','closed_won','delivery','live','churned')),
  health text not null default 'on_track'
    check (health in ('on_track','at_risk','delayed')),
  owner_id uuid,
  internal_notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table portal_users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  email text not null unique,
  full_name text not null,
  role text not null
    check (role in ('prospect','client_admin','client_collaborator','sales_rep','delivery_lead','ops_finance','portal_admin')),
  -- Null for Klepka-internal staff; required for client-side users.
  account_id uuid references portal_accounts(id) on delete cascade,
  -- Extra module grants for client_collaborator, e.g. '{payments}'. Ignored for other roles.
  module_access text[] not null default '{}',
  title text,
  status text not null default 'invited'
    check (status in ('invited','active','disabled')),
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint portal_users_client_needs_account
    check (role in ('sales_rep','delivery_lead','ops_finance','portal_admin') or account_id is not null)
);

alter table portal_accounts
  add constraint portal_accounts_owner_fkey
  foreign key (owner_id) references portal_users(id) on delete set null;

create index portal_users_account_idx on portal_users (account_id);
create index portal_accounts_owner_idx on portal_accounts (owner_id);

create table portal_opportunities (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references portal_accounts(id) on delete cascade,
  name text not null,
  stage text not null default 'discovery'
    check (stage in ('discovery','solutioning','proposal','negotiation','closed_won','closed_lost')),
  amount numeric(12,2),
  close_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index portal_opportunities_account_idx on portal_opportunities (account_id);

create table portal_offers (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references portal_accounts(id) on delete cascade,
  opportunity_id uuid references portal_opportunities(id) on delete set null,
  version integer not null default 1,
  title text not null,
  summary text not null default '',
  status text not null default 'draft'
    check (status in ('draft','sent','accepted','changes_requested','expired','superseded')),
  total numeric(12,2) not null default 0,
  currency text not null default 'USD',
  expires_on date,
  pdf_url text,
  change_note text,
  client_note text,
  sent_at timestamptz,
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index portal_offers_account_idx on portal_offers (account_id, version desc);

create table portal_offer_items (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references portal_offers(id) on delete cascade,
  position integer not null default 0,
  name text not null,
  detail text not null default '',
  amount numeric(12,2) not null default 0
);

create index portal_offer_items_offer_idx on portal_offer_items (offer_id, position);

create table portal_meetings (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references portal_accounts(id) on delete cascade,
  title text not null,
  meeting_type text not null default 'discovery'
    check (meeting_type in ('discovery','technical','proposal_walkthrough','project_checkin','escalation','other')),
  starts_at timestamptz not null,
  duration_minutes integer not null default 30,
  status text not null default 'requested'
    check (status in ('requested','confirmed','completed','cancelled')),
  host_user_id uuid references portal_users(id) on delete set null,
  attendees jsonb not null default '[]',
  location_url text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index portal_meetings_account_idx on portal_meetings (account_id, starts_at desc);

create table portal_projects (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references portal_accounts(id) on delete cascade,
  opportunity_id uuid references portal_opportunities(id) on delete set null,
  name text not null,
  summary text not null default '',
  health text not null default 'on_track'
    check (health in ('on_track','at_risk','delayed')),
  status text not null default 'planned'
    check (status in ('planned','active','on_hold','complete')),
  start_date date,
  target_date date,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index portal_projects_account_idx on portal_projects (account_id);

create table portal_milestones (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references portal_projects(id) on delete cascade,
  name text not null,
  description text not null default '',
  due_date date,
  status text not null default 'not_started'
    check (status in ('not_started','in_progress','complete','approved','delayed')),
  percent_complete integer not null default 0 check (percent_complete between 0 and 100),
  position integer not null default 0,
  approved_at timestamptz,
  approved_by uuid references portal_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index portal_milestones_project_idx on portal_milestones (project_id, position);

-- The feedback-scoping control point (design doc §8 / §11.4).
create table portal_project_team (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references portal_projects(id) on delete cascade,
  user_id uuid not null references portal_users(id) on delete cascade,
  project_role text not null default 'Consultant',
  assigned_at timestamptz not null default now(),
  active boolean not null default true,
  unique (project_id, user_id)
);

create index portal_project_team_project_idx on portal_project_team (project_id);

create table portal_documents (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references portal_accounts(id) on delete cascade,
  name text not null,
  doc_type text not null default 'other'
    check (doc_type in ('contract','msa','sow','nda','proposal','invoice','deliverable','reference','other')),
  status text not null default 'draft'
    check (status in ('draft','not_sent','sent','awaiting_signature','signed','acknowledged','superseded')),
  version integer not null default 1,
  file_url text,
  signers jsonb not null default '[]',
  signed_at timestamptz,
  related_offer_id uuid references portal_offers(id) on delete set null,
  related_project_id uuid references portal_projects(id) on delete set null,
  uploaded_by uuid references portal_users(id) on delete set null,
  uploaded_by_client boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index portal_documents_account_idx on portal_documents (account_id, updated_at desc);

create table portal_invoices (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references portal_accounts(id) on delete cascade,
  project_id uuid references portal_projects(id) on delete set null,
  milestone_id uuid references portal_milestones(id) on delete set null,
  number text,
  description text not null default '',
  amount numeric(12,2) not null default 0,
  currency text not null default 'USD',
  due_date date,
  due_label text,
  status text not null default 'not_issued'
    check (status in ('not_issued','upcoming','due','paid','overdue')),
  issued_at timestamptz,
  paid_at timestamptz,
  invoice_url text,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index portal_invoices_account_idx on portal_invoices (account_id, position);

create table portal_feedback (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references portal_accounts(id) on delete cascade,
  project_id uuid references portal_projects(id) on delete set null,
  -- Constrained at write time to the account's project team / assigned rep; null = about Klepka.
  about_user_id uuid references portal_users(id) on delete set null,
  submitted_by uuid references portal_users(id) on delete set null,
  rating integer not null check (rating between 1 and 5),
  comment text not null default '',
  context text,
  is_urgent boolean not null default false,
  status text not null default 'new'
    check (status in ('new','acknowledged','resolved')),
  response text,
  responded_by uuid references portal_users(id) on delete set null,
  responded_at timestamptz,
  created_at timestamptz not null default now()
);

create index portal_feedback_account_idx on portal_feedback (account_id, created_at desc);

create table portal_activity (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references portal_accounts(id) on delete cascade,
  category text not null default 'account'
    check (category in ('pipeline','calls','documents','payments','project','feedback','account')),
  title text not null,
  detail text not null default '',
  link text,
  -- false = internal-only entry, not surfaced in the client's feed.
  client_visible boolean not null default true,
  read_by uuid[] not null default '{}',
  created_at timestamptz not null default now()
);

create index portal_activity_account_idx on portal_activity (account_id, created_at desc);

-- updated_at triggers (set_updated_at() comes from 0001_articles_portal.sql).
create trigger portal_accounts_set_updated_at before update on portal_accounts
  for each row execute function set_updated_at();
create trigger portal_users_set_updated_at before update on portal_users
  for each row execute function set_updated_at();
create trigger portal_opportunities_set_updated_at before update on portal_opportunities
  for each row execute function set_updated_at();
create trigger portal_offers_set_updated_at before update on portal_offers
  for each row execute function set_updated_at();
create trigger portal_meetings_set_updated_at before update on portal_meetings
  for each row execute function set_updated_at();
create trigger portal_projects_set_updated_at before update on portal_projects
  for each row execute function set_updated_at();
create trigger portal_milestones_set_updated_at before update on portal_milestones
  for each row execute function set_updated_at();
create trigger portal_documents_set_updated_at before update on portal_documents
  for each row execute function set_updated_at();
create trigger portal_invoices_set_updated_at before update on portal_invoices
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Identity helpers (security definer: they read portal_users bypassing its own RLS)
-- ---------------------------------------------------------------------------

create or replace function portal_my_user_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from portal_users where auth_user_id = auth.uid() and status <> 'disabled' limit 1;
$$;

create or replace function portal_my_role()
returns text language sql stable security definer set search_path = public as $$
  select role from portal_users where auth_user_id = auth.uid() and status <> 'disabled' limit 1;
$$;

create or replace function portal_my_account_id()
returns uuid language sql stable security definer set search_path = public as $$
  select account_id from portal_users where auth_user_id = auth.uid() and status <> 'disabled' limit 1;
$$;

create or replace function portal_is_internal()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select role in ('sales_rep','delivery_lead','ops_finance','portal_admin')
     from portal_users where auth_user_id = auth.uid() and status <> 'disabled' limit 1),
    false);
$$;

create or replace function portal_is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select role = 'portal_admin'
     from portal_users where auth_user_id = auth.uid() and status <> 'disabled' limit 1),
    false);
$$;

-- Write access on an account: portal admins everywhere, other internal roles on accounts they
-- own or are staffed on (design doc §13).
create or replace function portal_can_manage(target_account uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select portal_is_admin()
    or (
      portal_is_internal()
      and target_account is not null
      and (
        exists (select 1 from portal_accounts a where a.id = target_account and a.owner_id = portal_my_user_id())
        or exists (
          select 1 from portal_project_team pt
          join portal_projects p on p.id = pt.project_id
          where p.account_id = target_account and pt.user_id = portal_my_user_id() and pt.active
        )
        or exists (
          select 1 from portal_meetings m
          where m.account_id = target_account and m.host_user_id = portal_my_user_id()
        )
      )
    );
$$;

-- Client-side module visibility. Client admins see everything on their account; prospects see
-- the pre-sale modules; collaborators see exactly what they were granted.
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
    else portal_is_internal()
  end;
$$;

-- Reads on an account: internal staff see all, client users see their own.
create or replace function portal_can_read(target_account uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select portal_is_internal() or (target_account is not null and target_account = portal_my_account_id());
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table portal_accounts enable row level security;
alter table portal_users enable row level security;
alter table portal_opportunities enable row level security;
alter table portal_offers enable row level security;
alter table portal_offer_items enable row level security;
alter table portal_meetings enable row level security;
alter table portal_projects enable row level security;
alter table portal_milestones enable row level security;
alter table portal_project_team enable row level security;
alter table portal_documents enable row level security;
alter table portal_invoices enable row level security;
alter table portal_feedback enable row level security;
alter table portal_activity enable row level security;

-- Nothing in the portal is public.
revoke all on portal_accounts, portal_users, portal_opportunities, portal_offers,
  portal_offer_items, portal_meetings, portal_projects, portal_milestones,
  portal_project_team, portal_documents, portal_invoices, portal_feedback,
  portal_activity from anon;

-- Accounts
create policy "portal read accounts" on portal_accounts
  for select to authenticated using (portal_can_read(id));
create policy "portal admin insert accounts" on portal_accounts
  for insert to authenticated with check (portal_is_admin());
create policy "portal manage accounts" on portal_accounts
  for update to authenticated using (portal_can_manage(id)) with check (portal_can_manage(id));
create policy "portal admin delete accounts" on portal_accounts
  for delete to authenticated using (portal_is_admin());

-- Users: internal staff are visible to everyone in the portal (they staff projects and receive
-- feedback); client users are visible to their own account and to internal staff.
create policy "portal read users" on portal_users
  for select to authenticated using (
    portal_is_internal()
    or account_id is null
    or account_id = portal_my_account_id()
  );
create policy "portal admin write users" on portal_users
  for all to authenticated
  using (portal_is_admin() or (account_id is not null and portal_can_manage(account_id)))
  with check (portal_is_admin() or (account_id is not null and portal_can_manage(account_id)));

-- Opportunities / offers
create policy "portal read opportunities" on portal_opportunities
  for select to authenticated using (portal_can_read(account_id) and portal_can_view_module('pipeline'));
create policy "portal write opportunities" on portal_opportunities
  for all to authenticated using (portal_can_manage(account_id)) with check (portal_can_manage(account_id));

create policy "portal read offers" on portal_offers
  for select to authenticated using (
    portal_can_view_module('pipeline')
    and (portal_is_internal() or (account_id = portal_my_account_id() and status <> 'draft'))
  );
create policy "portal write offers" on portal_offers
  for all to authenticated using (portal_can_manage(account_id)) with check (portal_can_manage(account_id));

create policy "portal read offer items" on portal_offer_items
  for select to authenticated using (
    exists (select 1 from portal_offers o where o.id = offer_id)
  );
create policy "portal write offer items" on portal_offer_items
  for all to authenticated using (
    exists (select 1 from portal_offers o where o.id = offer_id and portal_can_manage(o.account_id))
  ) with check (
    exists (select 1 from portal_offers o where o.id = offer_id and portal_can_manage(o.account_id))
  );

-- Meetings
create policy "portal read meetings" on portal_meetings
  for select to authenticated using (portal_can_read(account_id) and portal_can_view_module('calls'));
create policy "portal write meetings" on portal_meetings
  for all to authenticated using (portal_can_manage(account_id)) with check (portal_can_manage(account_id));

-- Projects / milestones / team
create policy "portal read projects" on portal_projects
  for select to authenticated using (
    portal_can_view_module('project')
    and (portal_is_internal() or (account_id = portal_my_account_id() and published))
  );
create policy "portal write projects" on portal_projects
  for all to authenticated using (portal_can_manage(account_id)) with check (portal_can_manage(account_id));

create policy "portal read milestones" on portal_milestones
  for select to authenticated using (
    exists (select 1 from portal_projects p where p.id = project_id)
  );
create policy "portal write milestones" on portal_milestones
  for all to authenticated using (
    exists (select 1 from portal_projects p where p.id = project_id and portal_can_manage(p.account_id))
  ) with check (
    exists (select 1 from portal_projects p where p.id = project_id and portal_can_manage(p.account_id))
  );

create policy "portal read project team" on portal_project_team
  for select to authenticated using (
    exists (select 1 from portal_projects p where p.id = project_id)
  );
create policy "portal write project team" on portal_project_team
  for all to authenticated using (
    exists (select 1 from portal_projects p where p.id = project_id and portal_can_manage(p.account_id))
  ) with check (
    exists (select 1 from portal_projects p where p.id = project_id and portal_can_manage(p.account_id))
  );

-- Documents
create policy "portal read documents" on portal_documents
  for select to authenticated using (
    portal_can_view_module('documents')
    and (portal_is_internal() or (account_id = portal_my_account_id() and status <> 'draft'))
  );
create policy "portal write documents" on portal_documents
  for all to authenticated using (portal_can_manage(account_id)) with check (portal_can_manage(account_id));

-- Invoices (client-side: Client Admin, or a collaborator granted 'payments')
create policy "portal read invoices" on portal_invoices
  for select to authenticated using (portal_can_read(account_id) and portal_can_view_module('payments'));
create policy "portal write invoices" on portal_invoices
  for all to authenticated using (portal_can_manage(account_id)) with check (portal_can_manage(account_id));

-- Feedback: clients see their own account's feedback, internal staff see everything.
create policy "portal read feedback" on portal_feedback
  for select to authenticated using (portal_can_read(account_id) and portal_can_view_module('feedback'));
create policy "portal write feedback" on portal_feedback
  for all to authenticated
  using (portal_is_admin() or portal_can_manage(account_id))
  with check (portal_is_admin() or portal_can_manage(account_id));

-- Activity feed
create policy "portal read activity" on portal_activity
  for select to authenticated using (
    portal_is_internal() or (account_id = portal_my_account_id() and client_visible)
  );
create policy "portal write activity" on portal_activity
  for all to authenticated using (portal_can_manage(account_id)) with check (portal_can_manage(account_id));

-- ---------------------------------------------------------------------------
-- Lock the existing articles admin down to Klepka-internal staff.
-- Before this migration every authenticated user was an admin, which stops being true the
-- moment client users can sign in. Existing auth users are all Klepka staff, so they are
-- seeded as portal admins below.
-- ---------------------------------------------------------------------------

insert into portal_users (auth_user_id, email, full_name, role, status)
select u.id, u.email, coalesce(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1)),
       'portal_admin', 'active'
from auth.users u
where u.email is not null
on conflict (email) do nothing;

drop policy "admin write authors" on authors;
create policy "admin write authors" on authors
  for all to authenticated using (portal_is_internal()) with check (portal_is_internal());

drop policy "admin full articles" on articles;
create policy "admin full articles" on articles
  for all to authenticated using (portal_is_internal()) with check (portal_is_internal());

drop policy "admin full comments" on comments;
create policy "admin full comments" on comments
  for all to authenticated using (portal_is_internal()) with check (portal_is_internal());

drop policy "admin upload article media" on storage.objects;
create policy "admin upload article media" on storage.objects
  for insert to authenticated with check (bucket_id = 'article-media' and portal_is_internal());
drop policy "admin update article media" on storage.objects;
create policy "admin update article media" on storage.objects
  for update to authenticated using (bucket_id = 'article-media' and portal_is_internal());
drop policy "admin delete article media" on storage.objects;
create policy "admin delete article media" on storage.objects
  for delete to authenticated using (bucket_id = 'article-media' and portal_is_internal());

-- ---------------------------------------------------------------------------
-- Storage bucket for portal documents (private — served via signed URLs)
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public) values ('portal-documents', 'portal-documents', false)
on conflict (id) do nothing;

-- Objects live under <account_id>/<uuid>.<ext>, so the first path segment is the tenant key.
create policy "portal read documents storage" on storage.objects
  for select to authenticated using (
    bucket_id = 'portal-documents'
    and (portal_is_internal() or (storage.foldername(name))[1] = portal_my_account_id()::text)
  );
create policy "portal upload documents storage" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'portal-documents'
    and (portal_is_internal() or (storage.foldername(name))[1] = portal_my_account_id()::text)
  );
create policy "portal delete documents storage" on storage.objects
  for delete to authenticated using (
    bucket_id = 'portal-documents' and portal_is_internal()
  );

-- ---------------------------------------------------------------------------
-- Activity helper
-- ---------------------------------------------------------------------------

create or replace function portal_log_activity(
  p_account uuid, p_category text, p_title text, p_detail text default '', p_link text default null
) returns void language sql security definer set search_path = public as $$
  insert into portal_activity (account_id, category, title, detail, link)
  values (p_account, p_category, p_title, coalesce(p_detail, ''), p_link);
$$;

-- Internal use only: it writes to any account without an ownership check, so it must not be
-- reachable as an RPC. The definer functions below still call it — they run as the owner.
revoke execute on function portal_log_activity(uuid, text, text, text, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Client-side action RPCs
-- Each one re-checks that the caller belongs to the record's account, so a client can only
-- perform the exact transitions the portal exposes.
-- ---------------------------------------------------------------------------

-- Links the signed-in auth user to their invited portal_users row on first login and stamps
-- the last-login time used by the admin "portal adoption" column.
create or replace function portal_bootstrap_user()
returns portal_users language plpgsql security definer set search_path = public as $$
declare
  me portal_users;
  my_email text;
begin
  select email into my_email from auth.users where id = auth.uid();
  if my_email is null then
    raise exception 'not authenticated';
  end if;

  update portal_users
    set auth_user_id = auth.uid(),
        status = case when status = 'invited' then 'active' else status end,
        last_login_at = now()
    where lower(email) = lower(my_email)
      and (auth_user_id is null or auth_user_id = auth.uid())
    returning * into me;

  return me;
end $$;

create or replace function portal_respond_to_offer(p_offer uuid, p_decision text, p_note text default null)
returns portal_offers language plpgsql security definer set search_path = public as $$
declare
  target portal_offers;
  acct uuid;
begin
  if p_decision not in ('accepted','changes_requested') then
    raise exception 'unsupported decision %', p_decision;
  end if;

  select account_id into acct from portal_offers where id = p_offer;
  if acct is null or acct is distinct from portal_my_account_id() then
    raise exception 'offer not available';
  end if;

  update portal_offers
    set status = p_decision,
        client_note = coalesce(p_note, client_note),
        responded_at = now()
    where id = p_offer and status in ('sent','changes_requested')
    returning * into target;

  if target.id is null then
    raise exception 'offer is not open for a response';
  end if;

  perform portal_log_activity(
    acct, 'pipeline',
    case when p_decision = 'accepted' then 'Offer accepted' else 'Changes requested on offer' end,
    target.title || ' (v' || target.version || ')', '/portal/pipeline');

  return target;
end $$;

create or replace function portal_request_meeting(
  p_title text, p_meeting_type text, p_starts_at timestamptz, p_duration_minutes integer default 30
) returns portal_meetings language plpgsql security definer set search_path = public as $$
declare
  acct uuid := portal_my_account_id();
  created portal_meetings;
  host uuid;
begin
  if acct is null then
    raise exception 'no account for current user';
  end if;
  if p_starts_at < now() then
    raise exception 'pick a time in the future';
  end if;

  select owner_id into host from portal_accounts where id = acct;

  insert into portal_meetings (account_id, title, meeting_type, starts_at, duration_minutes, status, host_user_id)
  values (acct, p_title, p_meeting_type, p_starts_at, greatest(p_duration_minutes, 15), 'requested', host)
  returning * into created;

  perform portal_log_activity(acct, 'calls', 'Call requested', p_title, '/portal/calls');
  return created;
end $$;

create or replace function portal_cancel_meeting(p_meeting uuid)
returns portal_meetings language plpgsql security definer set search_path = public as $$
declare
  updated portal_meetings;
begin
  update portal_meetings
    set status = 'cancelled'
    where id = p_meeting
      and account_id = portal_my_account_id()
      and status in ('requested','confirmed')
    returning * into updated;

  if updated.id is null then
    raise exception 'meeting not available';
  end if;

  perform portal_log_activity(updated.account_id, 'calls', 'Call cancelled', updated.title, '/portal/calls');
  return updated;
end $$;

create or replace function portal_approve_milestone(p_milestone uuid)
returns portal_milestones language plpgsql security definer set search_path = public as $$
declare
  updated portal_milestones;
  acct uuid;
begin
  select p.account_id into acct
  from portal_milestones m join portal_projects p on p.id = m.project_id
  where m.id = p_milestone;

  if acct is null or acct is distinct from portal_my_account_id() then
    raise exception 'milestone not available';
  end if;
  if portal_my_role() <> 'client_admin' then
    raise exception 'only a client admin can approve milestones';
  end if;

  update portal_milestones
    set status = 'approved', percent_complete = 100, approved_at = now(), approved_by = portal_my_user_id()
    where id = p_milestone and status = 'complete'
    returning * into updated;

  if updated.id is null then
    raise exception 'milestone is not ready for approval';
  end if;

  perform portal_log_activity(acct, 'project', 'Milestone approved', updated.name, '/portal/project');
  return updated;
end $$;

-- Feedback targets are constrained to the account's active project team plus the assigned rep
-- (design doc §11.4.5–6) — never a company-wide staff list.
create or replace function portal_feedback_targets()
returns table (user_id uuid, full_name text, project_role text)
language sql stable security definer set search_path = public as $$
  with acct as (select portal_my_account_id() as id)
  select u.id, u.full_name, pt.project_role
  from portal_project_team pt
  join portal_projects p on p.id = pt.project_id
  join portal_users u on u.id = pt.user_id
  where p.account_id = (select id from acct) and pt.active and p.published
  union
  select u.id, u.full_name, coalesce(u.title, 'Account Owner')
  from portal_accounts a join portal_users u on u.id = a.owner_id
  where a.id = (select id from acct);
$$;

create or replace function portal_submit_feedback(
  p_rating integer, p_comment text, p_about_user uuid default null,
  p_is_urgent boolean default false, p_context text default null
) returns portal_feedback language plpgsql security definer set search_path = public as $$
declare
  acct uuid := portal_my_account_id();
  created portal_feedback;
  proj uuid;
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

  insert into portal_feedback (account_id, project_id, about_user_id, submitted_by, rating, comment, context, is_urgent)
  values (acct, proj, p_about_user, portal_my_user_id(), p_rating, coalesce(p_comment, ''), p_context, coalesce(p_is_urgent, false))
  returning * into created;

  perform portal_log_activity(
    acct, 'feedback',
    case when created.is_urgent then 'Urgent feedback submitted' else 'Feedback submitted' end,
    created.rating || '/5', '/portal/feedback');

  return created;
end $$;

create or replace function portal_mark_activity_read(p_ids uuid[])
returns void language sql security definer set search_path = public as $$
  update portal_activity
    set read_by = array(select distinct unnest(read_by || portal_my_user_id()))
    where id = any(p_ids)
      and account_id = portal_my_account_id()
      and not (portal_my_user_id() = any(read_by));
$$;

-- Client-side document upload: the file already lives in storage, this records it.
create or replace function portal_register_document(p_name text, p_file_url text, p_doc_type text default 'reference')
returns portal_documents language plpgsql security definer set search_path = public as $$
declare
  acct uuid := portal_my_account_id();
  created portal_documents;
begin
  if acct is null then
    raise exception 'no account for current user';
  end if;
  if p_doc_type not in ('reference','deliverable','other') then
    raise exception 'clients can only upload reference documents';
  end if;

  insert into portal_documents (account_id, name, doc_type, status, file_url, uploaded_by, uploaded_by_client)
  values (acct, p_name, p_doc_type, 'acknowledged', p_file_url, portal_my_user_id(), true)
  returning * into created;

  perform portal_log_activity(acct, 'documents', 'Document uploaded by client', p_name, '/portal/documents');
  return created;
end $$;

-- A client admin inviting their own teammate (design doc §11.5.6). Creates the portal_users row;
-- the person still has to be given auth credentials, which the Klepka admin does.
create or replace function portal_invite_teammate(
  p_email text, p_full_name text, p_role text, p_modules text[] default '{}'
) returns portal_users language plpgsql security definer set search_path = public as $$
declare
  acct uuid := portal_my_account_id();
  created portal_users;
begin
  if portal_my_role() <> 'client_admin' then
    raise exception 'only a client admin can invite teammates';
  end if;
  if p_role not in ('client_admin','client_collaborator') then
    raise exception 'unsupported role %', p_role;
  end if;

  insert into portal_users (email, full_name, role, account_id, module_access, status)
  values (lower(p_email), p_full_name, p_role, acct, coalesce(p_modules, '{}'), 'invited')
  returning * into created;

  perform portal_log_activity(acct, 'account', 'Teammate invited', p_full_name || ' (' || p_email || ')', '/portal/settings');
  return created;
end $$;

grant execute on function
  portal_bootstrap_user(),
  portal_respond_to_offer(uuid, text, text),
  portal_request_meeting(text, text, timestamptz, integer),
  portal_cancel_meeting(uuid),
  portal_approve_milestone(uuid),
  portal_feedback_targets(),
  portal_submit_feedback(integer, text, uuid, boolean, text),
  portal_mark_activity_read(uuid[]),
  portal_register_document(text, text, text),
  portal_invite_teammate(text, text, text, text[]),
  portal_my_role(), portal_my_account_id(), portal_is_internal(), portal_is_admin()
to authenticated;
