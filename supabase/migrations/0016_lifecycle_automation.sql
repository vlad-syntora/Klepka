-- 0016_lifecycle_automation.sql — new account lifecycle set + the automations that drive it.
--
-- New lifecycle: lead → qualified → proposal_sent → live → stopped, plus lost (terminal).
-- Automations (all SECURITY DEFINER triggers):
--   * Account → Qualified            : auto-create an opportunity (if the account has none).
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
