-- 0050_billing_invoice_client_flow.sql — extend the billing-invoice lifecycle so the client can
-- confirm an invoice and the admin can mark it paid, plus attach a viewable invoice file.
--
-- Builds on 0048. New statuses after 'sent':
--   * client_approved — the client confirmed the invoice from the portal.
--   * paid            — an admin confirmed payment was received.
-- Lifecycle: open → approved → sent → client_approved → paid. Everything from 'sent' onward is
-- client-visible and frozen (recompute never rewrites it).
--
-- Also adds portal_billing_invoices.document_id — an optional link to a portal_documents row (the
-- issued invoice PDF, which lands in the account's 04_invoices Drive folder and is viewable from the
-- portal like any other document).
--
-- Standalone + idempotent. Apply manually.

-- ---------------------------------------------------------------------------
-- a. Widen the status domain and add the document link
-- ---------------------------------------------------------------------------

alter table portal_billing_invoices drop constraint if exists portal_billing_invoices_status_check;
alter table portal_billing_invoices
  add constraint portal_billing_invoices_status_check
  check (status in ('open', 'approved', 'sent', 'client_approved', 'paid'));

alter table portal_billing_invoices
  add column if not exists document_id uuid references portal_documents(id) on delete set null;

-- ---------------------------------------------------------------------------
-- b. RLS — the client now sees its invoices from 'sent' onward (sent / client_approved / paid)
-- ---------------------------------------------------------------------------

drop policy if exists "portal read billing invoices" on portal_billing_invoices;
create policy "portal read billing invoices" on portal_billing_invoices
  for select to authenticated using (
    portal_is_admin()
    or (
      portal_can_read(account_id)
      and portal_can_view_module('payments')
      and status in ('sent', 'client_approved', 'paid')
    )
  );

drop policy if exists "portal read billing invoice lines" on portal_billing_invoice_lines;
create policy "portal read billing invoice lines" on portal_billing_invoice_lines
  for select to authenticated using (
    exists (
      select 1 from portal_billing_invoices i
      where i.id = invoice_id
        and (
          portal_is_admin()
          or (
            portal_can_read(i.account_id)
            and portal_can_view_module('payments')
            and i.status in ('sent', 'client_approved', 'paid')
          )
        )
    )
  );

-- ---------------------------------------------------------------------------
-- c. Recompute now freezes from 'sent' onward
-- ---------------------------------------------------------------------------
-- Same body as 0048 but the freeze guard covers the three issued states instead of only 'sent'.

create or replace function portal_recompute_billing_invoice(p_project uuid, p_period date)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_month date := date_trunc('month', p_period)::date;
  v_account uuid;
  v_invoice uuid;
  v_status text;
  v_has_work boolean;
  v_hours numeric;
  v_amount numeric;
begin
  if p_project is null or p_period is null then
    return;
  end if;

  select account_id into v_account from portal_projects where id = p_project;
  if v_account is null then
    return;
  end if;

  select id, status into v_invoice, v_status
  from portal_billing_invoices
  where project_id = p_project and period = v_month;

  -- An issued invoice is frozen — leave it exactly as it was issued to the client.
  if v_status in ('sent', 'client_approved', 'paid') then
    return;
  end if;

  select exists (
    select 1 from portal_time_entries te
    where te.project_id = p_project
      and date_trunc('month', te.entry_date)::date = v_month
      and te.approved
      and te.hours is not null and te.hours > 0
  ) into v_has_work;

  -- Nothing to bill and no invoice yet — don't create an empty one.
  if v_invoice is null and not v_has_work then
    return;
  end if;

  if v_invoice is null then
    insert into portal_billing_invoices (account_id, project_id, period, currency)
    values (v_account, p_project, v_month, 'USD')
    returning id into v_invoice;
  end if;

  -- Rebuild the per-reporter summary from scratch.
  delete from portal_billing_invoice_lines where invoice_id = v_invoice;

  insert into portal_billing_invoice_lines (invoice_id, reporter_id, hours, rate, amount)
  select
    v_invoice,
    te.reporter_id,
    sum(coalesce(te.hours, 0)) as hours,
    r.rate,
    sum(coalesce(te.hours, 0)) * coalesce(r.rate, 0) as amount
  from portal_time_entries te
  left join lateral (
    select pt.rate
    from portal_project_team pt
    where pt.project_id = p_project
      and pt.user_id = te.reporter_id
      and pt.rate is not null
    order by pt.assigned_at desc
    limit 1
  ) r on true
  where te.project_id = p_project
    and date_trunc('month', te.entry_date)::date = v_month
    and te.approved
    and te.hours is not null and te.hours > 0
  group by te.reporter_id, r.rate;

  select coalesce(sum(hours), 0), coalesce(sum(amount), 0)
  into v_hours, v_amount
  from portal_billing_invoice_lines
  where invoice_id = v_invoice;

  update portal_billing_invoices
  set total_hours = v_hours, total_amount = v_amount, computed_at = now()
  where id = v_invoice;
end $$;

-- ---------------------------------------------------------------------------
-- d. Admin status change — allow the two new states
-- ---------------------------------------------------------------------------

create or replace function portal_set_billing_invoice_status(p_id uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not portal_is_admin() then
    raise exception 'only admins can change invoice status';
  end if;
  if p_status not in ('open', 'approved', 'sent', 'client_approved', 'paid') then
    raise exception 'invalid invoice status';
  end if;
  update portal_billing_invoices set status = p_status, updated_at = now() where id = p_id;
end $$;

grant execute on function portal_set_billing_invoice_status(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- e. Client confirmation — the client approves (or revokes) a sent invoice
-- ---------------------------------------------------------------------------
-- The client can only toggle its own invoice between 'sent' and 'client_approved'; it can never move
-- an invoice to 'paid' (that is the admin's confirmation). Access mirrors the read policy: the caller
-- must be able to read the account and have the payments module.

create or replace function portal_client_approve_billing_invoice(p_id uuid, p_approve boolean)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_account uuid;
  v_status text;
begin
  select account_id, status into v_account, v_status
  from portal_billing_invoices where id = p_id;
  if v_account is null then
    raise exception 'invoice not found';
  end if;
  if not (portal_can_read(v_account) and portal_can_view_module('payments')) then
    raise exception 'not allowed to change this invoice';
  end if;

  if p_approve then
    if v_status <> 'sent' then
      raise exception 'only a sent invoice can be approved';
    end if;
    update portal_billing_invoices set status = 'client_approved', updated_at = now() where id = p_id;
  else
    if v_status <> 'client_approved' then
      raise exception 'only a client-approved invoice can be reverted';
    end if;
    update portal_billing_invoices set status = 'sent', updated_at = now() where id = p_id;
  end if;
end $$;

grant execute on function portal_client_approve_billing_invoice(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- f. Reporter on a worklog must be a PUBLIC member of that project's team
-- ---------------------------------------------------------------------------
-- Same body as 0041 plus a guard: the client-facing reporter must be a public, active member of the
-- project team. The client only ever sees public members, so a log can't be credited to a hidden
-- member — this holds even when the reporter defaults to the employee, so an admin logging a hidden
-- member's work must pick a public reporter. Non-admins log for themselves and are exempt.

create or replace function portal_log_hours(
  p_project uuid,
  p_user uuid,
  p_entry_date date,
  p_description text,
  p_billing_hours numeric,
  p_actual_hours numeric,
  p_approved boolean,
  p_milestone uuid default null,
  p_reporter uuid default null
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_account uuid;
  v_is_admin boolean := portal_is_admin();
  v_user uuid;
  v_reporter uuid;
  v_approved boolean;
begin
  if not portal_is_staff() then
    raise exception 'only staff can log hours';
  end if;

  select account_id into v_account from portal_projects where id = p_project;
  if v_account is null then
    raise exception 'project not found';
  end if;
  if not portal_can_manage(v_account) then
    raise exception 'not allowed to log hours on this project';
  end if;

  if coalesce(p_billing_hours, 0) <= 0 or p_billing_hours > 24 then
    raise exception 'billing hours must be between 0 and 24';
  end if;

  -- A milestone, when given, must belong to this project.
  if p_milestone is not null
     and not exists (select 1 from portal_milestones where id = p_milestone and project_id = p_project) then
    raise exception 'milestone does not belong to this project';
  end if;

  -- Non-admins can only log for themselves and can never mark a log approved.
  v_user := case when v_is_admin then coalesce(p_user, portal_my_user_id()) else portal_my_user_id() end;
  v_approved := case when v_is_admin then coalesce(p_approved, false) else false end;
  -- Only admins may credit the log to a different (client-facing) reporter; it defaults to the
  -- employee so ordinary logs are unchanged.
  v_reporter := case when v_is_admin then coalesce(p_reporter, v_user) else v_user end;

  -- The client-facing reporter must be a public, active member of this project's team (the client
  -- only ever sees public members). Enforced for every admin log, including the default where the
  -- reporter is the employee — so a hidden member's work must be credited to a public reporter.
  if v_is_admin
     and not exists (
       select 1 from portal_project_team pt
       where pt.project_id = p_project
         and pt.user_id = v_reporter
         and coalesce(pt.active, true)
         and pt.is_public
     ) then
    raise exception 'reporter must be a public member of the project team';
  end if;

  insert into portal_time_entries
    (project_id, milestone_id, user_id, reporter_id, entry_date, hours, actual_hours, description,
     billable, visible_to_client, approved)
  values
    (p_project, p_milestone, v_user, v_reporter, coalesce(p_entry_date, current_date), p_billing_hours,
     coalesce(p_actual_hours, p_billing_hours), coalesce(nullif(trim(p_description), ''), 'Delivery work'),
     true, true, v_approved);
end $$;

grant execute on function portal_log_hours(uuid, uuid, date, text, numeric, numeric, boolean, uuid, uuid) to authenticated;
