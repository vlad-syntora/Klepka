-- 0015_candidates.sql — a shortlist of internal people the client reviews.
--
-- A candidate is one of Klepka's own staff (a portal_users row with account_id null) proposed to
-- work this account. Klepka attaches a position title, a CV link and an optional hourly rate; the
-- client confirms or declines each, and the decision is written straight back. This sits under the
-- "Klepka team" widget but is deliberately separate from portal_account_team (staffed pre-sale
-- team): a candidate is a proposal awaiting the client's yes/no.
--
-- The feature has not shipped yet, so this drops any earlier draft of the table and recreates it
-- cleanly (no production data to preserve).

drop table if exists portal_candidates cascade;

create table portal_candidates (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references portal_accounts(id) on delete cascade,
  user_id uuid not null references portal_users(id) on delete cascade,
  title text,                       -- position title shown for this candidate (overrides user.title)
  cv_url text,                      -- link the client opens to view the CV
  hourly_rate numeric(12, 2),       -- optional; hidden from the client when null
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

-- Clients read candidates on their own account; internal staff read all (account-scoped for
-- implementers via portal_can_read). Writes (create/edit/delete) are admin/staff-manage only.
create policy "portal read candidates" on portal_candidates
  for select to authenticated using (portal_can_read(account_id));

create policy "portal write candidates" on portal_candidates
  for all to authenticated using (portal_can_manage(account_id)) with check (portal_can_manage(account_id));

-- Client decision: confirm or decline a candidate on their own account. SECURITY DEFINER so the
-- status write is allowed even though clients have no direct write policy on the table.
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
