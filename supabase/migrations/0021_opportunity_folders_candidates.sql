-- 0021_opportunity_folders_candidates.sql — move the Drive folder tree and candidates under the
-- opportunity.
--
-- Until now every account got one flat Drive folder tree (0006) and candidates hung off the
-- account. Staffing and deal artefacts are really per-opportunity, so:
--   * opportunities (and their won projects) get their own Drive folder columns;
--   * candidates gain a required opportunity_id — old account-level rows are dropped;
--   * the Closed-Won trigger carries the opportunity's Drive folder onto the new project.

-- ---------------------------------------------------------------------------
-- a. Drive folder columns on opportunities and projects (mirrors portal_accounts, 0006)
-- ---------------------------------------------------------------------------

alter table portal_opportunities
  add column if not exists drive_folder_id text,
  add column if not exists drive_web_link text,
  add column if not exists drive_folders jsonb not null default '{}';

alter table portal_projects
  add column if not exists drive_folder_id text,
  add column if not exists drive_web_link text,
  add column if not exists drive_folders jsonb not null default '{}';

-- ---------------------------------------------------------------------------
-- b. Candidates are now per-opportunity. Existing account-level rows are removed (user decision)
--    so opportunity_id can be NOT NULL.
-- ---------------------------------------------------------------------------

alter table portal_candidates
  add column if not exists opportunity_id uuid references portal_opportunities(id) on delete cascade;
delete from portal_candidates where opportunity_id is null;
alter table portal_candidates alter column opportunity_id set not null;
create index if not exists portal_candidates_opportunity_idx on portal_candidates (opportunity_id);

-- ---------------------------------------------------------------------------
-- c. Closed Won → carry the opportunity's Drive folder onto the auto-created project
--    (re-creates the function from 0010; the trigger is unchanged).
-- ---------------------------------------------------------------------------

create or replace function portal_opportunity_won() returns trigger
  language plpgsql security definer set search_path = public as $$
declare new_project uuid;
begin
  if new.stage = 'closed_won'
     and (tg_op = 'INSERT' or old.stage is distinct from 'closed_won')
     and not exists (select 1 from portal_projects where opportunity_id = new.id) then
    insert into portal_projects
        (account_id, opportunity_id, name, status, published, drive_folder_id, drive_web_link, drive_folders)
      values
        (new.account_id, new.id, new.name, 'planned', false,
         new.drive_folder_id, new.drive_web_link, coalesce(new.drive_folders, '{}'::jsonb))
      returning id into new_project;
    -- Link to both: keep the opportunity link, also attach to the project. Covers documents
    -- tied straight to the opportunity and documents tied to one of its offers.
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
