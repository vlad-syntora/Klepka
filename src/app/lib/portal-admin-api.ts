import { z } from 'zod';
import { getSupabase } from '@/app/lib/supabase';
import {
  ActivitySchema,
  CandidateSchema,
  DocumentSchema,
  FeedbackSchema,
  IntakeItemSchema,
  IntakeTemplateSchema,
  MaterialTemplateSchema,
  MilestoneSchema,
  OfferSchema,
  OpportunitySchema,
  OverheadExpenseSchema,
  FinanceSettingsSchema,
  PortalAccountSchema,
  PortalTeamSchema,
  PortalUserSchema,
  ProductSchema,
  ProjectSchema,
  ProjectTeamMemberSchema,
  PublicHolidaySchema,
  TimeOffSchema,
  TimeOffResponseSchema,
  MyTeamTimeOffSchema,
  TimeOffReviewSchema,
  TimeOffReplacementSchema,
  ResourceSchema,
  SalarySchema,
  BillingInvoiceSchema,
  FinanceTransactionSchema,
  TimeEntrySchema,
  AccountTeamMemberSchema,
  type AccountTeamMember,
  type BillingInvoice,
  type BillingInvoiceStatus,
  type Product,
  type ProductDocument,
  type Activity,
  type Candidate,
  type Feedback,
  type Health,
  type IntakeItem,
  type Lifecycle,
  type IntakeTemplate,
  type MaterialTemplate,
  type Milestone,
  type Offer,
  type OfferBillingType,
  type Opportunity,
  type PortalAccount,
  type PortalDocument,
  type PortalResource,
  type PortalRole,
  type PortalTeam,
  type OverheadExpense,
  type OverheadCadence,
  type OverheadScope,
  type FinanceSettings,
  type FinanceTransaction,
  type FinanceTransactionKind,
  type PortalUser,
  type Project,
  type ProjectTeamMember,
  type ProjectType,
  type PublicHoliday,
  type Salary,
  type SalaryStatus,
  type TimeEntry,
  type TimeOff,
  type TimeOffKind,
  type TimeOffResponse,
  type TimeOffStatus,
  type MyTeamTimeOff,
  type TimeOffReview,
  type TimeOffReplacement,
} from '@/app/lib/portal-types';

const ACCOUNT_COLUMNS =
  'id, name, logo_url, source, source_subtype, industry, lifecycle, health, owner_id, internal_notes, created_at, updated_at, drive_folder_id, drive_web_link, drive_folders, owner:portal_users!portal_accounts_owner_fkey(id, full_name, title, email, calendly_url, photo_url)';

const USER_COLUMNS =
  'id, auth_user_id, email, full_name, role, account_id, module_access, title, status, last_login_at, calendly_url, photo_url, pay_rate, pay_currency, team_id, counts_for_overhead, created_at';

export async function adminListAccounts(): Promise<PortalAccount[]> {
  const { data, error } = await getSupabase()
    .from('portal_accounts')
    .select(ACCOUNT_COLUMNS)
    .order('updated_at', { ascending: false });
  if (error) throw new Error(error.message);
  return z.array(PortalAccountSchema).parse(data ?? []);
}

export async function adminGetAccount(id: string): Promise<PortalAccount> {
  const { data, error } = await getSupabase().from('portal_accounts').select(ACCOUNT_COLUMNS).eq('id', id).single();
  if (error) throw new Error(error.message);
  return PortalAccountSchema.parse(data);
}

/** Raised when an account name collides with the duplicate rule (0017). */
export class DuplicateAccountError extends Error {
  constructor(name: string) {
    super(`An account named “${name.trim()}” already exists. Account names must be unique.`);
    this.name = 'DuplicateAccountError';
  }
}

/**
 * The account duplicate rule: names are unique, compared case- and
 * whitespace-insensitively. The unique index in migration 0017 is the race-safe
 * enforcement; this check just turns a hit into a clear message before we insert.
 */
async function assertAccountNameFree(name: string, exceptId?: string): Promise<void> {
  const needle = name.trim().toLowerCase();
  if (!needle) return;
  let query = getSupabase().from('portal_accounts').select('id, name');
  if (exceptId) query = query.neq('id', exceptId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  if ((data ?? []).some((row) => (row.name ?? '').trim().toLowerCase() === needle)) {
    throw new DuplicateAccountError(name);
  }
}

export async function adminCreateAccount(input: {
  name: string;
  industry: string | null;
  owner_id: string | null;
  logo_url?: string | null;
  source?: string | null;
  source_subtype?: string | null;
}): Promise<PortalAccount> {
  await assertAccountNameFree(input.name);
  const { data, error } = await getSupabase()
    .from('portal_accounts')
    .insert(input)
    .select(ACCOUNT_COLUMNS)
    .single();
  if (error) {
    if (error.code === '23505') throw new DuplicateAccountError(input.name);
    throw new Error(error.message);
  }
  return PortalAccountSchema.parse(data);
}

export async function adminUpdateAccount(
  id: string,
  patch: Partial<{
    name: string;
    industry: string | null;
    lifecycle: Lifecycle;
    health: Health;
    owner_id: string | null;
    internal_notes: string;
    logo_url: string | null;
    source: string | null;
    source_subtype: string | null;
  }>,
): Promise<void> {
  if (patch.name !== undefined) await assertAccountNameFree(patch.name, id);
  const { error } = await getSupabase().from('portal_accounts').update(patch).eq('id', id);
  if (error) {
    if (error.code === '23505' && patch.name !== undefined) throw new DuplicateAccountError(patch.name);
    throw new Error(error.message);
  }
}

/**
 * Deletes an account and everything hanging off it (users, pipeline, documents, project,
 * invoices, resources, intake, activity all cascade — see 0004/0005/0007). Drive folders are
 * left untouched: we never destroy the client's files, only our index of them.
 */
export async function adminDeleteAccount(id: string): Promise<void> {
  const { error } = await getSupabase().from('portal_accounts').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

/* ----------------------------------------------------------------- users */

export async function adminListUsers(): Promise<PortalUser[]> {
  const { data, error } = await getSupabase().from('portal_users').select(USER_COLUMNS).order('full_name');
  if (error) throw new Error(error.message);
  return z.array(PortalUserSchema).parse(data ?? []);
}

// Internal staff for assignment pickers (owners, project/account teams, offer employees, worklog
// reporters, …). Every caller is a "pick a person to assign" dropdown, so only ACTIVE staff are
// returned — invited/inactive accounts can't yet be staffed. Management screens that must see every
// user (WorkspaceUsers, AdminPortalTeam) use adminListUsers/adminListAccountUsers instead.
export async function adminListInternalUsers(): Promise<PortalUser[]> {
  const { data, error } = await getSupabase()
    .from('portal_users')
    .select(USER_COLUMNS)
    .is('account_id', null)
    .eq('status', 'active')
    .order('full_name');
  if (error) throw new Error(error.message);
  return z.array(PortalUserSchema).parse(data ?? []);
}

export async function adminListAccountUsers(accountId: string): Promise<PortalUser[]> {
  const { data, error } = await getSupabase()
    .from('portal_users')
    .select(USER_COLUMNS)
    .eq('account_id', accountId)
    .order('created_at');
  if (error) throw new Error(error.message);
  return z.array(PortalUserSchema).parse(data ?? []);
}

export async function adminCreateUser(input: {
  email: string;
  full_name: string;
  role: PortalRole;
  account_id: string | null;
  module_access: string[];
  title: string | null;
  calendly_url?: string | null;
  photo_url?: string | null;
  // Finance (0044): default hourly cost rate + currency for internal staff.
  pay_rate?: number | null;
  pay_currency?: string;
  // Teams (0047): the internal employee's team, or null when unassigned.
  team_id?: string | null;
  // Overhead (0055): whether this person counts toward the company overhead headcount.
  counts_for_overhead?: boolean;
}): Promise<PortalUser> {
  const { data, error } = await getSupabase()
    .from('portal_users')
    .insert({ ...input, email: input.email.trim().toLowerCase() })
    .select(USER_COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return PortalUserSchema.parse(data);
}

export async function adminUpdateUser(
  id: string,
  patch: Partial<{
    full_name: string;
    email: string;
    role: PortalRole;
    module_access: string[];
    title: string | null;
    status: 'inactive' | 'invited' | 'active';
    calendly_url: string | null;
    photo_url: string | null;
    // Finance (0044): an internal employee's default hourly cost rate + currency.
    pay_rate: number | null;
    pay_currency: string;
    // Teams (0047): the internal employee's team, or null to unassign.
    team_id: string | null;
    // Overhead (0055): whether this person counts toward the company overhead headcount.
    counts_for_overhead: boolean;
    // Re-homing a client onto another account ("add existing client"). A client row is bound to
    // one account by schema, so attaching an existing person is a move, not a copy.
    account_id: string;
  }>,
): Promise<void> {
  const { error } = await getSupabase().from('portal_users').update(patch).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function adminDeleteUser(id: string): Promise<void> {
  const { error } = await getSupabase().from('portal_users').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

/**
 * Provisions a real Supabase Auth user for an invited profile and emails them the invite, then
 * marks the profile 'invited'. Runs server-side (service role) — see api/portal/invite.
 */
export interface InviteResult {
  emailed: boolean;
  alreadyRegistered: boolean;
  actionLink: string | null;
}

export async function portalInviteUser(userId: string): Promise<InviteResult> {
  const { data: session } = await getSupabase().auth.getSession();
  const token = session.session?.access_token;
  if (!token) throw new Error('Not signed in.');

  const response = await fetch('/api/portal/invite', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ userId }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error ?? 'Could not send the invite.');
  return {
    emailed: Boolean(payload.emailed),
    alreadyRegistered: Boolean(payload.alreadyRegistered),
    actionLink: payload.actionLink ?? null,
  };
}

/* ------------------------------------------------------- opportunities & offers */

export async function adminListOpportunities(accountId: string): Promise<Opportunity[]> {
  const { data, error } = await getSupabase()
    .from('portal_opportunities')
    .select(
      'id, account_id, name, stage, amount, close_date, bank_hours, notify_hours, project_type, updated_at, intake_published, drive_folder_id, drive_web_link, drive_folders',
    )
    .eq('account_id', accountId)
    .order('updated_at', { ascending: false });
  if (error) throw new Error(error.message);
  return z.array(OpportunitySchema).parse(data ?? []);
}

/** Returns the opportunity id (existing on update, freshly created on insert). */
export async function adminUpsertOpportunity(input: {
  id?: string;
  account_id: string;
  name: string;
  stage: Opportunity['stage'];
  amount: number | null;
  close_date: string | null;
  bank_hours?: number | null;
  notify_hours?: number | null;
  project_type?: Opportunity['project_type'];
}): Promise<string> {
  const supabase = getSupabase();
  const { id, ...values } = input;
  if (id) {
    const { error } = await supabase.from('portal_opportunities').update(values).eq('id', id);
    if (error) throw new Error(error.message);
    return id;
  }
  const { data, error } = await supabase
    .from('portal_opportunities')
    .insert(values)
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

export async function adminDeleteOpportunity(id: string): Promise<void> {
  const { error } = await getSupabase().from('portal_opportunities').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

/** Publish (or unpublish) an opportunity's Information gathering checklist to the client. */
export async function adminSetIntakePublished(opportunityId: string, published: boolean): Promise<void> {
  const { error } = await getSupabase()
    .from('portal_opportunities')
    .update({ intake_published: published })
    .eq('id', opportunityId);
  if (error) throw new Error(error.message);
}

const OFFER_COLUMNS =
  'id, account_id, opportunity_id, version, title, summary, status, total, currency, expires_on, pdf_url, change_note, client_note, sent_at, responded_at, created_at, bank_hours, notify_hours, items:portal_offer_items(id, offer_id, position, name, detail, amount, billing_type, overtime_rate, monthly_hours, employee_id, pay_rate)';

export async function adminListOffers(accountId: string): Promise<Offer[]> {
  const { data, error } = await getSupabase()
    .from('portal_offers')
    .select(OFFER_COLUMNS)
    .eq('account_id', accountId)
    .order('version', { ascending: false });
  if (error) throw new Error(error.message);
  return z.array(OfferSchema).parse(data ?? []);
}

export interface OfferItemInput {
  name: string;
  detail: string;
  // Fixed-price line: the fixed sum per month. Time & materials line: the quoted hourly rate.
  amount: number;
  billing_type: OfferBillingType;
  overtime_rate: number | null;
  // Fixed-price only: hours per month covered by the fixed sum (drives the derived hourly rate).
  monthly_hours: number | null;
  // Finance (0044): the internal employee this line staffs and its pay/cost rate (defaults from the
  // employee, editable per offer). Both seed the project team member on project creation.
  employee_id: string | null;
  pay_rate: number | null;
}

/**
 * Creates the next version of an offer and supersedes the previous one, so revisions never
 * overwrite history (design doc §12).
 */
export async function adminCreateOfferVersion(input: {
  account_id: string;
  opportunity_id: string | null;
  title: string;
  summary: string;
  expires_on: string | null;
  change_note: string | null;
  bank_hours: number | null;
  notify_hours: number | null;
  items: OfferItemInput[];
  send: boolean;
}): Promise<string> {
  const supabase = getSupabase();

  // The version chain is per opportunity, so each deal has its own v1, v2, … sequence. Offers
  // with no opportunity (legacy/account-level) form their own chain.
  let existingQuery = supabase
    .from('portal_offers')
    .select('id, version, status')
    .eq('account_id', input.account_id)
    .order('version', { ascending: false })
    .limit(1);
  existingQuery = input.opportunity_id
    ? existingQuery.eq('opportunity_id', input.opportunity_id)
    : existingQuery.is('opportunity_id', null);
  const { data: existing, error: existingError } = await existingQuery;
  if (existingError) throw new Error(existingError.message);

  const nextVersion = (existing?.[0]?.version ?? 0) + 1;
  // Only fixed-price lines carry a monetary amount; time & materials lines are purely hourly and
  // contribute nothing to the offer total (there is no upfront sum to quote).
  const total = input.items.reduce(
    (sum, item) => sum + (item.billing_type === 'fixed_price' ? Number(item.amount) || 0 : 0),
    0,
  );

  const { data: offer, error } = await supabase
    .from('portal_offers')
    .insert({
      account_id: input.account_id,
      opportunity_id: input.opportunity_id,
      version: nextVersion,
      title: input.title,
      summary: input.summary,
      expires_on: input.expires_on,
      change_note: input.change_note,
      bank_hours: input.bank_hours,
      notify_hours: input.notify_hours,
      total,
      status: input.send ? 'sent' : 'draft',
      sent_at: input.send ? new Date().toISOString() : null,
    })
    .select('id')
    .single();
  if (error) throw new Error(error.message);

  if (input.items.length > 0) {
    const { error: itemsError } = await supabase.from('portal_offer_items').insert(
      input.items.map((item, index) => {
        const isFixed = item.billing_type === 'fixed_price';
        return {
          offer_id: offer.id,
          position: index,
          name: item.name,
          detail: item.detail,
          // Fixed price: the monthly sum. T&M: the quoted hourly rate (both live in `amount`).
          amount: item.amount,
          billing_type: item.billing_type,
          overtime_rate: item.overtime_rate,
          // Hours only apply to fixed-price lines; clear them otherwise.
          monthly_hours: isFixed && item.monthly_hours && item.monthly_hours > 0 ? item.monthly_hours : null,
          // Internal cost rate + the employee it staffs (finance, 0044).
          employee_id: item.employee_id,
          pay_rate: item.pay_rate,
        };
      }),
    );
    if (itemsError) throw new Error(itemsError.message);
  }

  if (existing?.[0] && ['sent', 'changes_requested'].includes(existing[0].status)) {
    await supabase.from('portal_offers').update({ status: 'superseded' }).eq('id', existing[0].id);
  }

  if (input.send) {
    await logActivity(input.account_id, 'pipeline', `Offer v${nextVersion} sent`, input.title, '/portal/pipeline');
  }

  return offer.id;
}

export async function adminSendOffer(offerId: string, accountId: string, label: string): Promise<void> {
  const { error } = await getSupabase()
    .from('portal_offers')
    .update({ status: 'sent', sent_at: new Date().toISOString() })
    .eq('id', offerId);
  if (error) throw new Error(error.message);
  await logActivity(accountId, 'pipeline', 'Offer sent', label, '/portal/pipeline');
}

/**
 * Staff-side offer decision — lets an internal user accept (or request changes on) an offer on the
 * client's behalf, e.g. after a verbal sign-off. Mirrors the client's portal_respond_to_offer RPC
 * (0004), which only sets status + logs activity; accepting has no other DB side-effects.
 */
export async function adminSetOfferStatus(
  offerId: string,
  accountId: string,
  status: 'accepted' | 'changes_requested',
  label: string,
): Promise<void> {
  const { error } = await getSupabase()
    .from('portal_offers')
    .update({ status, responded_at: new Date().toISOString() })
    .eq('id', offerId);
  if (error) throw new Error(error.message);
  await logActivity(
    accountId,
    'pipeline',
    status === 'accepted' ? 'Offer accepted' : 'Changes requested on offer',
    label,
    '/portal/pipeline',
  );
}

/* -------------------------------------------------------------- documents */

const DOCUMENT_COLUMNS =
  'id, account_id, name, doc_type, status, version, file_url, drive_web_link, drive_file_id, signers, signed_at, opportunity_id, related_offer_id, related_project_id, intake_item_id, uploaded_by_client, updated_at';

export async function adminListDocuments(accountId: string): Promise<PortalDocument[]> {
  const { data, error } = await getSupabase()
    .from('portal_documents')
    .select(DOCUMENT_COLUMNS)
    .eq('account_id', accountId)
    .order('updated_at', { ascending: false });
  if (error) throw new Error(error.message);
  return z.array(DocumentSchema).parse(data ?? []);
}

export async function adminUploadDocument(input: {
  account_id: string;
  name: string;
  doc_type: PortalDocument['doc_type'];
  status: PortalDocument['status'];
  file: File | null;
  opportunity_id?: string | null;
  related_offer_id?: string | null;
  related_project_id?: string | null;
  intake_item_id?: string | null;
  // Override the Drive destination (e.g. attach an intake file to "01 Discovery" regardless of type).
  folder_key?: string;
}): Promise<string | null> {
  const supabase = getSupabase();
  let filePath: string | null = null;

  if (input.file) {
    const extension = input.file.name.split('.').pop()?.toLowerCase() || 'bin';
    filePath = `${input.account_id}/${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await supabase.storage
      .from('portal-documents')
      .upload(filePath, input.file, { contentType: input.file.type || undefined });
    if (uploadError) throw new Error(uploadError.message);
  }

  // A same-named document becomes a new version rather than overwriting the old one.
  const { data: previous } = await supabase
    .from('portal_documents')
    .select('id, version')
    .eq('account_id', input.account_id)
    .eq('name', input.name)
    .order('version', { ascending: false })
    .limit(1);

  const { data: inserted, error } = await supabase
    .from('portal_documents')
    .insert({
      account_id: input.account_id,
      name: input.name,
      doc_type: input.doc_type,
      status: input.status,
      version: (previous?.[0]?.version ?? 0) + 1,
      file_url: filePath,
      opportunity_id: input.opportunity_id ?? null,
      related_offer_id: input.related_offer_id ?? null,
      related_project_id: input.related_project_id ?? null,
      intake_item_id: input.intake_item_id ?? null,
    })
    .select('id')
    .single();
  if (error) throw new Error(error.message);

  if (previous?.[0]) {
    await supabase.from('portal_documents').update({ status: 'superseded' }).eq('id', previous[0].id);
  }

  // Move the file to Google Drive and make Drive its home (file_url is repointed and the temp
  // bucket copy dropped, server-side). Best-effort: if Drive isn't configured or the push fails,
  // the file stays in Supabase Storage and remains openable — the row is already saved.
  if (input.file && filePath && inserted?.id) {
    try {
      await driveUploadFromStorage({
        accountId: input.account_id,
        opportunityId: input.opportunity_id ?? undefined,
        storagePath: filePath,
        folderKey: input.folder_key ?? driveFolderForDocType(input.doc_type),
        name: input.name,
        documentId: inserted.id,
      });
    } catch (cause) {
      if (!(cause instanceof DriveNotConfiguredError)) {
        console.warn('Drive push failed — kept the file in Supabase Storage:', cause);
      }
    }
  }

  await logActivity(input.account_id, 'documents', `Document added: ${input.name}`, '', '/portal/documents');
  return inserted?.id ?? null;
}

export async function adminUpdateDocument(
  id: string,
  patch: Partial<{
    status: PortalDocument['status'];
    name: string;
    doc_type: PortalDocument['doc_type'];
    opportunity_id: string | null;
    related_project_id: string | null;
  }>,
): Promise<void> {
  const values: Record<string, unknown> = { ...patch };
  if (patch.status === 'signed') values.signed_at = new Date().toISOString();
  const { error } = await getSupabase().from('portal_documents').update(values).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function adminDeleteDocument(id: string): Promise<void> {
  const { error } = await getSupabase().from('portal_documents').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

/* -------------------------------------------------- projects, milestones, team */

const PROJECT_COLUMNS =
  'id, account_id, opportunity_id, name, summary, health, status, start_date, target_date, published, created_at, bank_hours, notify_hours, project_type, drive_folder_id, drive_web_link, drive_folders';

export async function adminListProjects(accountId: string): Promise<Project[]> {
  const { data, error } = await getSupabase()
    .from('portal_projects')
    .select(PROJECT_COLUMNS)
    .eq('account_id', accountId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return z.array(ProjectSchema).parse(data ?? []);
}

/**
 * "Create Project from Opportunity" (design doc §11.3): milestones are pre-filled from the
 * accepted offer's line items so nothing is re-entered by hand.
 */
export async function adminCreateProjectFromOpportunity(input: {
  account_id: string;
  opportunity_id: string | null;
  name: string;
  summary: string;
  target_date: string | null;
  bank_hours: number | null;
  notify_hours: number | null;
  project_type: ProjectType | null;
  milestones: { name: string; description: string; due_date: string | null }[];
  // Text-only roster rows seeded from the accepted offer's line items (no linked user account). Each
  // carries the seeding line's billing (migration 0036) so the team member mirrors the offer.
  team: {
    display_name: string;
    project_role: string;
    billing_type?: OfferBillingType | null;
    rate?: number | null;
    overtime_rate?: number | null;
    monthly_hours?: number | null;
    // Finance (0044): the internal employee the offer line staffs (links the roster row to a real
    // user so its worklogs feed salary) and the pay/cost rate carried from the line.
    employee_id?: string | null;
    pay_rate?: number | null;
  }[];
  // Products copied from the linked opportunity onto the new project.
  product_ids: string[];
  delivery_lead_id: string | null;
  publish: boolean;
}): Promise<string> {
  const supabase = getSupabase();

  // Carry the opportunity's Drive folder onto the project so its files live in one place. The
  // Closed-Won trigger does the same for auto-created projects, but a manually-created one is
  // inserted directly (bypassing the trigger), so copy the folder here.
  let driveFields: {
    drive_folder_id: string | null;
    drive_web_link: string | null;
    drive_folders: Record<string, string>;
  } = { drive_folder_id: null, drive_web_link: null, drive_folders: {} };
  if (input.opportunity_id) {
    const { data: opp } = await supabase
      .from('portal_opportunities')
      .select('drive_folder_id, drive_web_link, drive_folders')
      .eq('id', input.opportunity_id)
      .maybeSingle();
    if (opp) {
      driveFields = {
        drive_folder_id: opp.drive_folder_id ?? null,
        drive_web_link: opp.drive_web_link ?? null,
        drive_folders: opp.drive_folders ?? {},
      };
    }
  }

  const { data: project, error } = await supabase
    .from('portal_projects')
    .insert({
      account_id: input.account_id,
      opportunity_id: input.opportunity_id,
      name: input.name,
      summary: input.summary,
      target_date: input.target_date,
      bank_hours: input.bank_hours,
      notify_hours: input.notify_hours,
      project_type: input.project_type,
      start_date: new Date().toISOString().slice(0, 10),
      status: input.publish ? 'active' : 'planned',
      published: input.publish,
      ...driveFields,
    })
    .select('id')
    .single();
  if (error) throw new Error(error.message);

  if (input.milestones.length > 0) {
    const { error: milestoneError } = await supabase.from('portal_milestones').insert(
      input.milestones.map((milestone, index) => ({
        project_id: project.id,
        name: milestone.name,
        description: milestone.description,
        due_date: milestone.due_date,
        position: index,
      })),
    );
    if (milestoneError) throw new Error(milestoneError.message);
  }

  // Seed the roster from the accepted offer's line items — text-only rows (no linked user).
  const teamRows = input.team.filter((member) => member.display_name.trim().length > 0);
  if (teamRows.length > 0) {
    const { error: teamError } = await supabase.from('portal_project_team').insert(
      teamRows.map((member) => ({
        project_id: project.id,
        // Link to the real employee when the offer line named one, so the roster row's worklogs feed
        // salary; otherwise it stays a text-only row.
        user_id: member.employee_id ?? null,
        display_name: member.display_name.trim(),
        project_role: member.project_role.trim() || 'Team member',
        is_public: true,
        active: true,
        billing_type: member.billing_type ?? null,
        rate: member.rate ?? null,
        overtime_rate: member.overtime_rate ?? null,
        monthly_hours: member.monthly_hours ?? null,
        pay_rate: member.pay_rate ?? null,
      })),
    );
    if (teamError) throw new Error(teamError.message);
  }

  // Copy the linked opportunity's products onto the project (the opportunity keeps its own).
  if (input.product_ids.length > 0) {
    const { error: productError } = await supabase
      .from('portal_project_products')
      .insert(input.product_ids.map((productId) => ({ project_id: project.id, product_id: productId })));
    if (productError) throw new Error(productError.message);
  }

  if (input.delivery_lead_id) {
    await supabase.from('portal_project_team').insert({
      project_id: project.id,
      user_id: input.delivery_lead_id,
      project_role: 'Delivery Lead',
    });
  }

  if (input.publish) {
    await logActivity(input.account_id, 'project', 'Project Tracker activated', input.name, '/portal/project');
  }

  return project.id as string;
}

export async function adminUpdateProject(
  id: string,
  patch: Partial<{
    name: string;
    summary: string;
    health: Health;
    status: Project['status'];
    target_date: string | null;
    bank_hours: number | null;
    notify_hours: number | null;
    project_type: ProjectType | null;
    opportunity_id: string | null;
    published: boolean;
  }>,
): Promise<void> {
  const { error } = await getSupabase().from('portal_projects').update(patch).eq('id', id);
  if (error) throw new Error(error.message);
}

/**
 * Delete a project. Its milestones, team, worklogs and billing invoices cascade at the DB level;
 * documents keep their file but lose the project link (related_project_id set null). Admin/manager
 * only (the `portal write projects` RLS policy enforces it server-side).
 */
export async function adminDeleteProject(id: string): Promise<void> {
  const { error } = await getSupabase().from('portal_projects').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function adminListMilestones(projectId: string): Promise<Milestone[]> {
  const { data, error } = await getSupabase()
    .from('portal_milestones')
    .select('id, project_id, name, description, start_date, due_date, status, percent_complete, position, approved_at')
    .eq('project_id', projectId)
    .order('position');
  if (error) throw new Error(error.message);
  return z.array(MilestoneSchema).parse(data ?? []);
}

export async function adminUpsertMilestone(input: {
  id?: string;
  project_id: string;
  name: string;
  description: string;
  start_date: string | null;
  due_date: string | null;
  status: Milestone['status'];
  percent_complete: number;
  position: number;
}): Promise<void> {
  const supabase = getSupabase();
  const { id, ...values } = input;
  const { error } = id
    ? await supabase.from('portal_milestones').update(values).eq('id', id)
    : await supabase.from('portal_milestones').insert(values);
  if (error) throw new Error(error.message);
}

export async function adminDeleteMilestone(id: string): Promise<void> {
  const { error } = await getSupabase().from('portal_milestones').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

/** Persist a new milestone order: each id's position is set to its index in the array. */
export async function adminReorderMilestones(ids: string[]): Promise<void> {
  const supabase = getSupabase();
  const results = await Promise.all(
    ids.map((id, index) => supabase.from('portal_milestones').update({ position: index }).eq('id', id)),
  );
  const failed = results.find((result) => result.error);
  if (failed?.error) throw new Error(failed.error.message);
}

export async function adminListProjectTeam(projectId: string): Promise<ProjectTeamMember[]> {
  const { data, error } = await getSupabase()
    .from('portal_project_team')
    .select(
      'id, project_id, user_id, display_name, project_role, assigned_at, active, is_public, billing_type, rate, overtime_rate, monthly_hours, pay_rate, user:portal_users!portal_project_team_user_id_fkey(id, full_name, title, email, photo_url)',
    )
    .eq('project_id', projectId)
    .order('assigned_at');
  if (error) throw new Error(error.message);
  return z.array(ProjectTeamMemberSchema).parse(data ?? []);
}

export async function adminAddProjectTeamMember(input: {
  project_id: string;
  user_id: string;
  project_role: string;
  is_public?: boolean;
  // Finance (0044): seed the roster row's cost rate from the staff member's default pay_rate.
  pay_rate?: number | null;
}): Promise<void> {
  const { error } = await getSupabase()
    .from('portal_project_team')
    .upsert({ is_public: true, ...input, active: true }, { onConflict: 'project_id,user_id' });
  if (error) throw new Error(error.message);
}

/** Flip whether a project team member is shown to the client (and can receive feedback). */
export async function adminSetProjectTeamPublic(id: string, isPublic: boolean): Promise<void> {
  const { error } = await getSupabase().from('portal_project_team').update({ is_public: isPublic }).eq('id', id);
  if (error) throw new Error(error.message);
}

/**
 * Edit a project team member's role and (admin-only) billing — the fields seeded from the offer
 * line item (migration 0036). Used to correct an offer-derived roster row.
 */
export async function adminUpdateProjectTeamMember(
  id: string,
  patch: Partial<{
    display_name: string | null;
    project_role: string;
    billing_type: OfferBillingType | null;
    rate: number | null;
    overtime_rate: number | null;
    monthly_hours: number | null;
    // Finance (0044): the internal pay/cost rate for this member — what salary reads.
    pay_rate: number | null;
  }>,
): Promise<void> {
  const { error } = await getSupabase().from('portal_project_team').update(patch).eq('id', id);
  if (error) throw new Error(error.message);
}

/**
 * Soft-removes a staffing record: new feedback can no longer target this person, while the
 * feedback they already received stays intact (design doc §11.4.5).
 */
export async function adminRemoveProjectTeamMember(id: string): Promise<void> {
  const { error } = await getSupabase().from('portal_project_team').update({ active: false }).eq('id', id);
  if (error) throw new Error(error.message);
}

/* ------------------------------------------------- account team (pre-sale) */

const ACCOUNT_TEAM_COLUMNS =
  'id, account_id, user_id, team_role, active, is_public, added_at, user:portal_users!portal_account_team_user_id_fkey(id, full_name, title, email, calendly_url, photo_url)';

export async function adminListAccountTeam(accountId: string): Promise<AccountTeamMember[]> {
  const { data, error } = await getSupabase()
    .from('portal_account_team')
    .select(ACCOUNT_TEAM_COLUMNS)
    .eq('account_id', accountId)
    .order('added_at');
  if (error) throw new Error(error.message);
  return z.array(AccountTeamMemberSchema).parse(data ?? []);
}

export async function adminAddAccountTeamMember(input: {
  account_id: string;
  user_id: string;
  team_role: string;
  is_public?: boolean;
}): Promise<void> {
  const { error } = await getSupabase()
    .from('portal_account_team')
    .upsert({ is_public: true, ...input, active: true }, { onConflict: 'account_id,user_id' });
  if (error) throw new Error(error.message);
}

/** Flip whether an account team member is shown to the client (and can receive feedback). */
export async function adminSetAccountTeamPublic(id: string, isPublic: boolean): Promise<void> {
  const { error } = await getSupabase().from('portal_account_team').update({ is_public: isPublic }).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function adminRemoveAccountTeamMember(id: string): Promise<void> {
  const { error } = await getSupabase().from('portal_account_team').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

/* ------------------------------------------------------------- candidates */

const CANDIDATE_COLUMNS =
  'id, account_id, opportunity_id, user_id, title, cv_url, hourly_rate, status, client_note, decided_at, decided_by, created_at, updated_at, user:portal_users!portal_candidates_user_id_fkey(id, full_name, title, email, photo_url)';

/** Candidates are staffed per deal, so they are listed for one opportunity. */
export async function adminListCandidates(opportunityId: string): Promise<Candidate[]> {
  const { data, error } = await getSupabase()
    .from('portal_candidates')
    .select(CANDIDATE_COLUMNS)
    .eq('opportunity_id', opportunityId)
    .order('created_at');
  if (error) throw new Error(error.message);
  return z.array(CandidateSchema).parse(data ?? []);
}

export async function adminCreateCandidate(input: {
  account_id: string;
  opportunity_id: string;
  user_id: string;
  title: string | null;
  cv_url: string | null;
  hourly_rate: number | null;
}): Promise<void> {
  const { error } = await getSupabase().from('portal_candidates').insert(input);
  if (error) throw new Error(error.message);
  await logActivity(input.account_id, 'project', 'Candidate proposed', input.title ?? '', null);
}

export async function adminUpdateCandidate(
  id: string,
  patch: Partial<{
    title: string | null;
    cv_url: string | null;
    hourly_rate: number | null;
    status: Candidate['status'];
    client_note: string | null;
  }>,
): Promise<void> {
  const values: Record<string, unknown> = { ...patch, updated_at: new Date().toISOString() };
  const { error } = await getSupabase().from('portal_candidates').update(values).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function adminDeleteCandidate(id: string): Promise<void> {
  const { error } = await getSupabase().from('portal_candidates').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

/* --------------------------------------------------------------- feedback */

const FEEDBACK_COLUMNS =
  'id, account_id, project_id, about_user_id, submitted_by, rating, comment, context, is_urgent, is_public, public_approved_at, status, response, responded_at, created_at, about:portal_users!portal_feedback_about_user_id_fkey(id, full_name), submitter:portal_users!portal_feedback_submitted_by_fkey(id, full_name), account:portal_accounts!portal_feedback_account_id_fkey(id, name)';

export async function adminListFeedback(accountId?: string): Promise<Feedback[]> {
  let query = getSupabase().from('portal_feedback').select(FEEDBACK_COLUMNS).order('created_at', { ascending: false });
  if (accountId) query = query.eq('account_id', accountId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return z.array(FeedbackSchema).parse(data ?? []);
}

export async function adminRespondToFeedback(
  id: string,
  input: { response: string; status: Feedback['status'] },
): Promise<void> {
  const { error } = await getSupabase()
    .from('portal_feedback')
    .update({ ...input, responded_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

/**
 * Approve (or un-approve) a client's public feedback for cross-client display. Only feedback the
 * client already consented to share (is_public) can be surfaced to other clients — this is the
 * moderation gate. Setting public_approved_at makes it visible; clearing it hides it again.
 */
export async function adminSetFeedbackPublicApproval(id: string, approved: boolean): Promise<void> {
  const { error } = await getSupabase()
    .from('portal_feedback')
    .update({ public_approved_at: approved ? new Date().toISOString() : null })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

/** Permanently delete a feedback entry. Its rating drops out of the staff average automatically. */
export async function adminDeleteFeedback(id: string): Promise<void> {
  const { error } = await getSupabase().from('portal_feedback').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

/* --------------------------------------------------------------- products */

const PRODUCT_COLUMNS =
  'id, name, description, status, documents, document_url, document_name, created_by, created_at';

export async function adminListProducts(): Promise<Product[]> {
  const { data, error } = await getSupabase().from('portal_products').select(PRODUCT_COLUMNS).order('name');
  if (error) throw new Error(error.message);
  return z.array(ProductSchema).parse(data ?? []);
}

/** Approve a pending (client-created) product so it reads as vetted. */
export async function adminApproveProduct(id: string): Promise<void> {
  const { error } = await getSupabase().from('portal_products').update({ status: 'approved' }).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function adminUpdateProduct(
  id: string,
  patch: {
    name?: string;
    description?: string | null;
    // The documents that follow this product onto clients when tagged (0037).
    documents?: ProductDocument[];
    document_url?: string | null;
    document_name?: string | null;
  },
): Promise<void> {
  const { error } = await getSupabase().from('portal_products').update(patch).eq('id', id);
  if (error) throw new Error(error.message);
}

/** Delete a product; its associations cascade away. */
export async function adminDeleteProduct(id: string): Promise<void> {
  const { error } = await getSupabase().from('portal_products').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

/** Products a staff member owns (their skills). */
export async function adminListUserProducts(userId: string): Promise<Product[]> {
  const { data, error } = await getSupabase()
    .from('portal_user_products')
    .select('product:portal_products(id, name, description, status, created_by, created_at)')
    .eq('user_id', userId);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as { product: unknown }[];
  return z.array(ProductSchema).parse(rows.map((row) => row.product).filter(Boolean));
}

/** Replace a staff member's skills. Admin-only (RLS enforces it too). */
export async function adminSetUserProducts(userId: string, productIds: string[]): Promise<void> {
  const supabase = getSupabase();
  const { error: delError } = await supabase.from('portal_user_products').delete().eq('user_id', userId);
  if (delError) throw new Error(delError.message);
  if (productIds.length > 0) {
    const { error: insError } = await supabase
      .from('portal_user_products')
      .insert(productIds.map((productId) => ({ user_id: userId, product_id: productId })));
    if (insError) throw new Error(insError.message);
  }
}

/* --------------------------------------------------------------- activity */

export async function adminListActivity(accountId: string): Promise<Activity[]> {
  const { data, error } = await getSupabase()
    .from('portal_activity')
    .select('id, account_id, category, title, detail, link, client_visible, read_by, created_at')
    .eq('account_id', accountId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return z.array(ActivitySchema).parse(data ?? []);
}

export async function logActivity(
  accountId: string,
  category: Activity['category'],
  title: string,
  detail = '',
  link: string | null = null,
  clientVisible = true,
): Promise<void> {
  const { error } = await getSupabase()
    .from('portal_activity')
    .insert({ account_id: accountId, category, title, detail, link, client_visible: clientVisible });
  if (error) throw new Error(error.message);
}

/* ------------------------------------------------- resources & onboarding */

const RESOURCE_COLUMNS =
  'id, account_id, title, description, kind, url, file_path, article_id, phase, position, published, article:articles(id, title, slug, excerpt)';

/** Shared library (account_id is null) plus anything specific to this account. */
export async function adminListResources(accountId?: string): Promise<PortalResource[]> {
  let query = getSupabase().from('portal_resources').select(RESOURCE_COLUMNS).order('position');
  if (accountId) query = query.or(`account_id.is.null,account_id.eq.${accountId}`);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return z.array(ResourceSchema).parse(data ?? []);
}

export interface ResourceInput {
  id?: string;
  account_id: string | null;
  title: string;
  description: string;
  kind: PortalResource['kind'];
  url: string | null;
  file_path: string | null;
  article_id: string | null;
  phase: PortalResource['phase'];
  position: number;
  published: boolean;
}

export async function adminUpsertResource(input: ResourceInput): Promise<string> {
  const supabase = getSupabase();
  const { id, ...values } = input;
  const { data, error } = id
    ? await supabase.from('portal_resources').update(values).eq('id', id).select('id').single()
    : await supabase.from('portal_resources').insert(values).select('id').single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

export async function adminDeleteResource(id: string): Promise<void> {
  const { error } = await getSupabase().from('portal_resources').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

/** Uploads a presentation/document into the private bucket and returns its storage path. */
export async function adminUploadResourceFile(accountId: string | null, file: File): Promise<string> {
  const extension = file.name.split('.').pop()?.toLowerCase() || 'bin';
  const path = `${accountId ?? 'shared'}/${crypto.randomUUID()}.${extension}`;
  const { error } = await getSupabase().storage
    .from('portal-documents')
    .upload(path, file, { contentType: file.type || undefined });
  if (error) throw new Error(error.message);
  return path;
}

/* --------------------------------------------------------------- intake */

const INTAKE_COLUMNS =
  'id, account_id, opportunity_id, name, description, owner_side, status, due_date, position, client_note, review_note, submitted_at, reviewed_at';

/** Intake is per-opportunity, so the checklist is listed for one opportunity. */
export async function adminListIntake(opportunityId: string): Promise<IntakeItem[]> {
  const { data, error } = await getSupabase()
    .from('portal_intake_items')
    .select(INTAKE_COLUMNS)
    .eq('opportunity_id', opportunityId)
    .order('position');
  if (error) throw new Error(error.message);
  return z.array(IntakeItemSchema).parse(data ?? []);
}

export interface IntakeInput {
  id?: string;
  account_id: string;
  opportunity_id: string;
  name: string;
  description: string;
  owner_side: IntakeItem['owner_side'];
  status: IntakeItem['status'];
  due_date: string | null;
  position: number;
  review_note?: string | null;
}

export async function adminUpsertIntakeItem(input: IntakeInput): Promise<void> {
  const supabase = getSupabase();
  const { id, ...values } = input;
  const patch: Record<string, unknown> = { ...values };
  if (values.status === 'approved' || values.status === 'blocked') {
    patch.reviewed_at = new Date().toISOString();
  }
  const { error } = id
    ? await supabase.from('portal_intake_items').update(patch).eq('id', id)
    : await supabase.from('portal_intake_items').insert(patch);
  if (error) throw new Error(error.message);
}

export async function adminDeleteIntakeItem(id: string): Promise<void> {
  const { error } = await getSupabase().from('portal_intake_items').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

/* --------------------------------------------- sales process settings (templates) */

const MATERIAL_TEMPLATE_COLUMNS =
  'id, title, description, kind, url, file_path, article_id, phase, position';

/** The general onboarding-material templates, copied into every new account. */
export async function adminListMaterialTemplates(): Promise<MaterialTemplate[]> {
  const { data, error } = await getSupabase()
    .from('portal_material_templates')
    .select(MATERIAL_TEMPLATE_COLUMNS)
    .order('position');
  if (error) throw new Error(error.message);
  return z.array(MaterialTemplateSchema).parse(data ?? []);
}

export interface MaterialTemplateInput {
  id?: string;
  title: string;
  description: string;
  kind: PortalResource['kind'];
  url: string | null;
  file_path: string | null;
  article_id: string | null;
  phase: PortalResource['phase'];
  position: number;
}

export async function adminUpsertMaterialTemplate(input: MaterialTemplateInput): Promise<string> {
  const supabase = getSupabase();
  const { id, ...values } = input;
  const { data, error } = id
    ? await supabase.from('portal_material_templates').update(values).eq('id', id).select('id').single()
    : await supabase.from('portal_material_templates').insert(values).select('id').single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

export async function adminDeleteMaterialTemplate(id: string): Promise<void> {
  const { error } = await getSupabase().from('portal_material_templates').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function adminListIntakeTemplates(): Promise<IntakeTemplate[]> {
  const { data, error } = await getSupabase()
    .from('portal_intake_templates')
    .select('id, name, description, owner_side, position')
    .order('position');
  if (error) throw new Error(error.message);
  return z.array(IntakeTemplateSchema).parse(data ?? []);
}

export interface IntakeTemplateInput {
  id?: string;
  name: string;
  description: string;
  owner_side: IntakeTemplate['owner_side'];
  position: number;
}

export async function adminUpsertIntakeTemplate(input: IntakeTemplateInput): Promise<void> {
  const supabase = getSupabase();
  const { id, ...values } = input;
  const { error } = id
    ? await supabase.from('portal_intake_templates').update(values).eq('id', id)
    : await supabase.from('portal_intake_templates').insert(values);
  if (error) throw new Error(error.message);
}

export async function adminDeleteIntakeTemplate(id: string): Promise<void> {
  const { error } = await getSupabase().from('portal_intake_templates').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

/** Reorder: persist a single checklist item's position (callers swap two rows to move up/down). */
export async function adminSetIntakeTemplatePosition(id: string, position: number): Promise<void> {
  const { error } = await getSupabase().from('portal_intake_templates').update({ position }).eq('id', id);
  if (error) throw new Error(error.message);
}

/* ------------------------------------------- org settings (sales-process defaults) */

/** The org-wide default Account Owner (stored preference only — see 0029_org_settings.sql). */
export async function adminGetDefaultAccountOwner(): Promise<string | null> {
  const { data, error } = await getSupabase()
    .from('portal_org_settings')
    .select('default_account_owner_id')
    .eq('id', true)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data?.default_account_owner_id as string | null) ?? null;
}

export async function adminSetDefaultAccountOwner(userId: string | null): Promise<void> {
  const { error } = await getSupabase()
    .from('portal_org_settings')
    .update({ default_account_owner_id: userId })
    .eq('id', true);
  if (error) throw new Error(error.message);
}

/** Copy the standard checklist into an opportunity's intake (skips items already present). */
export async function adminApplyIntakeTemplate(opportunityId: string): Promise<void> {
  const { error } = await getSupabase().rpc('portal_apply_intake_template', { p_opportunity: opportunityId });
  if (error) throw new Error(error.message);
}

/* ---------------------------------------------------------- time entries */

export async function adminListTimeEntries(projectId: string): Promise<TimeEntry[]> {
  const { data, error } = await getSupabase()
    .from('portal_time_entries')
    .select(
      'id, project_id, milestone_id, user_id, reporter_id, entry_date, hours, actual_hours, approved, pay_rate, description, billable, user:portal_users!portal_time_entries_user_id_fkey(id, full_name), reporter:portal_users!portal_time_entries_reporter_id_fkey(id, full_name)',
    )
    .eq('project_id', projectId)
    .order('entry_date', { ascending: false });
  if (error) throw new Error(error.message);
  return z.array(TimeEntrySchema).parse(data ?? []);
}

export async function adminCreateTimeEntry(input: {
  project_id: string;
  milestone_id: string | null;
  user_id: string | null;
  entry_date: string;
  hours: number | null;
  description: string;
}): Promise<void> {
  const { error } = await getSupabase().from('portal_time_entries').insert(input);
  if (error) throw new Error(error.message);
}

export async function adminUpdateTimeEntry(
  id: string,
  patch: Partial<{
    entry_date: string;
    milestone_id: string | null;
    reporter_id: string | null;
    description: string;
    hours: number | null;
    actual_hours: number | null;
    approved: boolean;
  }>,
): Promise<void> {
  const { error } = await getSupabase().from('portal_time_entries').update(patch).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function adminDeleteTimeEntry(id: string): Promise<void> {
  const { error } = await getSupabase().from('portal_time_entries').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

/**
 * Approve several worklogs in one call — the bulk "Approve" action on the project Hours panel.
 * Gated in the UI to the account owner; RLS still enforces admin write server-side (approval also
 * gates client visibility, see 0045).
 */
export async function adminApproveTimeEntries(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await getSupabase()
    .from('portal_time_entries')
    .update({ approved: true })
    .in('id', ids);
  if (error) throw new Error(error.message);
}

/* ------------------------------------------------------------ salaries (finance) */

/** Normalise any date to the first day of its month, matching the portal_salaries.period key. */
export function salaryPeriod(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

/** All employee salaries for a month (first-of-month date). Admin-only (RLS). */
export async function adminListSalaries(period: string): Promise<Salary[]> {
  const { data, error } = await getSupabase()
    .from('portal_salaries')
    .select(
      'id, user_id, period, currency, total_hours, total_amount, status, computed_at, created_at, user:portal_users!portal_salaries_user_id_fkey(id, full_name, title)',
    )
    .eq('period', period)
    .order('total_amount', { ascending: false });
  if (error) throw new Error(error.message);
  return z.array(SalarySchema).parse(data ?? []);
}

/** Every salary across all months (admin, RLS). Powers the filterable "all months" list view. */
export async function adminListAllSalaries(): Promise<Salary[]> {
  const { data, error } = await getSupabase()
    .from('portal_salaries')
    .select(
      'id, user_id, period, currency, total_hours, total_amount, status, computed_at, created_at, user:portal_users!portal_salaries_user_id_fkey(id, full_name, title)',
    )
    .order('period', { ascending: false })
    .order('total_amount', { ascending: false });
  if (error) throw new Error(error.message);
  return z.array(SalarySchema).parse(data ?? []);
}

/**
 * The signed-in employee's own salaries across every month, newest first. Non-admin staff can read
 * only their own rows (self-read policy, migration 0046); admins get their own rows too. Powers the
 * "My Salary" page.
 */
export async function listMySalaries(userId: string): Promise<Salary[]> {
  const { data, error } = await getSupabase()
    .from('portal_salaries')
    .select(
      'id, user_id, period, currency, total_hours, total_amount, status, computed_at, created_at, user:portal_users!portal_salaries_user_id_fkey(id, full_name, title)',
    )
    .eq('user_id', userId)
    .order('period', { ascending: false });
  if (error) throw new Error(error.message);
  return z.array(SalarySchema).parse(data ?? []);
}

/**
 * The individual worklogs that make up one employee's monthly salary — the same rows the recompute
 * trigger sums (0044): every time entry where the person is the Employee (`user_id`) whose
 * `entry_date` falls in the period's month, valued at each log's frozen `pay_rate`. Admin-only (RLS).
 */
export async function adminListSalaryEntries(userId: string, period: string): Promise<TimeEntry[]> {
  const start = salaryPeriod(period); // first day of the salary's month (YYYY-MM-01)
  const startDate = new Date(`${start}T00:00:00`);
  const nextMonth = salaryPeriod(new Date(startDate.getFullYear(), startDate.getMonth() + 1, 1));
  const { data, error } = await getSupabase()
    .from('portal_time_entries')
    .select(
      'id, project_id, milestone_id, user_id, reporter_id, entry_date, hours, actual_hours, approved, pay_rate, description, billable, user:portal_users!portal_time_entries_user_id_fkey(id, full_name), reporter:portal_users!portal_time_entries_reporter_id_fkey(id, full_name), project:portal_projects!portal_time_entries_project_id_fkey(id, name)',
    )
    .eq('user_id', userId)
    .gte('entry_date', start)
    .lt('entry_date', nextMonth)
    .order('entry_date', { ascending: false });
  if (error) throw new Error(error.message);
  return z.array(TimeEntrySchema).parse(data ?? []);
}

/** Pre-create a zero salary row for every active internal employee for the month, then recompute. */
export async function adminOpenSalaryMonth(period: string): Promise<void> {
  const { error } = await getSupabase().rpc('portal_open_salary_month', { p_period: period });
  if (error) throw new Error(error.message);
}

export async function adminSetSalaryStatus(id: string, status: SalaryStatus): Promise<void> {
  const { error } = await getSupabase().rpc('portal_set_salary_status', { p_id: id, p_status: status });
  if (error) throw new Error(error.message);
}

/** Payload for recording a realised payment (0056): the exact amount paid + its FX into the base. */
export interface PaymentInput {
  amount: number;
  currency: string;
  fx_rate: number;
  occurred_on: string;
  note?: string | null;
}

/** Mark a salary paid AND record the expense in the ledger, atomically (0056). Admin-only (RLS). */
export async function adminPaySalary(id: string, payment: PaymentInput): Promise<void> {
  const { error } = await getSupabase().rpc('portal_pay_salary', {
    p_id: id,
    p_amount: payment.amount,
    p_currency: payment.currency,
    p_fx_rate: payment.fx_rate,
    p_occurred_on: payment.occurred_on,
    p_note: payment.note ?? null,
  });
  if (error) throw new Error(error.message);
}

/* ------------------------------------------------------------ billing invoices (finance) */

const BILLING_INVOICE_COLUMNS =
  'id, account_id, project_id, period, currency, total_hours, total_amount, status, computed_at, created_at, document_id, ' +
  'project:portal_projects!portal_billing_invoices_project_id_fkey(id, name), ' +
  'account:portal_accounts!portal_billing_invoices_account_id_fkey(id, name), ' +
  'document:portal_documents!portal_billing_invoices_document_id_fkey(id, name, file_url, drive_web_link, drive_file_id), ' +
  'lines:portal_billing_invoice_lines(id, invoice_id, reporter_id, hours, rate, amount, ' +
  'reporter:portal_users!portal_billing_invoice_lines_reporter_id_fkey(id, full_name))';

/** All billing invoices for a month (first-of-month date). Admin-only (RLS). */
export async function adminListBillingInvoices(period: string): Promise<BillingInvoice[]> {
  const { data, error } = await getSupabase()
    .from('portal_billing_invoices')
    .select(BILLING_INVOICE_COLUMNS)
    .eq('period', period)
    .order('total_amount', { ascending: false });
  if (error) throw new Error(error.message);
  return z.array(BillingInvoiceSchema).parse(data ?? []);
}

/** Every billing invoice across all months (admin, RLS). Powers the "all months" list view. */
export async function adminListAllBillingInvoices(): Promise<BillingInvoice[]> {
  const { data, error } = await getSupabase()
    .from('portal_billing_invoices')
    .select(BILLING_INVOICE_COLUMNS)
    .order('period', { ascending: false })
    .order('total_amount', { ascending: false });
  if (error) throw new Error(error.message);
  return z.array(BillingInvoiceSchema).parse(data ?? []);
}

/**
 * The individual worklogs that make up one project's monthly invoice — the same rows the recompute
 * sums (0048): approved billable time entries for the project whose `entry_date` falls in the
 * period's month. Client-facing, so only the reporter is embedded (never the internal employee).
 */
export async function adminListBillingInvoiceEntries(projectId: string, period: string): Promise<TimeEntry[]> {
  const start = salaryPeriod(period); // first day of the invoice's month (YYYY-MM-01)
  const startDate = new Date(`${start}T00:00:00`);
  const nextMonth = salaryPeriod(new Date(startDate.getFullYear(), startDate.getMonth() + 1, 1));
  const { data, error } = await getSupabase()
    .from('portal_time_entries')
    .select(
      'id, project_id, milestone_id, reporter_id, entry_date, hours, actual_hours, approved, description, billable, reporter:portal_users!portal_time_entries_reporter_id_fkey(id, full_name)',
    )
    .eq('project_id', projectId)
    .eq('approved', true)
    .not('hours', 'is', null)
    .gt('hours', 0)
    .gte('entry_date', start)
    .lt('entry_date', nextMonth)
    .order('entry_date', { ascending: false });
  if (error) throw new Error(error.message);
  return z.array(TimeEntrySchema).parse(data ?? []);
}

export async function adminSetBillingInvoiceStatus(id: string, status: BillingInvoiceStatus): Promise<void> {
  const { error } = await getSupabase().rpc('portal_set_billing_invoice_status', { p_id: id, p_status: status });
  if (error) throw new Error(error.message);
}

/** Mark an invoice paid AND record the income in the ledger, atomically (0056). Admin-only (RLS). */
export async function adminPayBillingInvoice(id: string, payment: PaymentInput): Promise<void> {
  const { error } = await getSupabase().rpc('portal_pay_billing_invoice', {
    p_id: id,
    p_amount: payment.amount,
    p_currency: payment.currency,
    p_fx_rate: payment.fx_rate,
    p_occurred_on: payment.occurred_on,
    p_note: payment.note ?? null,
  });
  if (error) throw new Error(error.message);
}

/**
 * Attach an issued invoice file to a billing invoice: uploads it as an 'invoice' document (so it lands
 * in the account's 04_invoices Drive folder and is viewable from the portal like any other file), then
 * links it on the invoice. Status 'sent' so the client can see it. Admin-only (RLS on both tables).
 */
export async function adminAttachBillingInvoiceDocument(
  invoice: Pick<BillingInvoice, 'id' | 'account_id' | 'project_id'>,
  file: File,
  name: string,
): Promise<void> {
  const documentId = await adminUploadDocument({
    account_id: invoice.account_id,
    name,
    doc_type: 'invoice',
    status: 'sent',
    file,
    related_project_id: invoice.project_id,
  });
  const { error } = await getSupabase()
    .from('portal_billing_invoices')
    .update({ document_id: documentId })
    .eq('id', invoice.id);
  if (error) throw new Error(error.message);
}

/** Delete a billing invoice (and its summary lines, via cascade). Admin-only (RLS). */
export async function adminDeleteBillingInvoice(id: string): Promise<void> {
  const { error } = await getSupabase().from('portal_billing_invoices').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

/* ------------------------------------------------------------ google drive */

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
  modifiedTime?: string;
  size?: string;
}

/** Distinct so the UI can show a "set up Drive" hint instead of a hard error. */
export class DriveNotConfiguredError extends Error {
  constructor() {
    super('Google Drive is not configured yet.');
    this.name = 'DriveNotConfiguredError';
  }
}

async function callDrive<T>(body: Record<string, unknown>): Promise<T> {
  const { data: session } = await getSupabase().auth.getSession();
  const token = session.session?.access_token;
  if (!token) throw new Error('Not signed in.');

  const response = await fetch('/api/google/drive', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (response.status === 503 && payload.error === 'DRIVE_NOT_CONFIGURED') {
    throw new DriveNotConfiguredError();
  }
  if (!response.ok) throw new Error(payload.error ?? 'Drive request failed');
  return payload as T;
}

/** Creates (or completes) the account's folder tree in the Shared Drive. Idempotent. */
export async function driveProvision(
  accountId: string,
): Promise<{ folderId: string; webLink: string | null; folders: Record<string, string> }> {
  return callDrive({ action: 'provision', accountId });
}

/**
 * Creates (or completes) an opportunity's own folder tree under the account root — the Discovery /
 * Proposal / Contract / Invoice / Delivery / Candidates subfolders. Idempotent; also back-fills the
 * tree for opportunities created before this structure existed.
 */
export async function driveProvisionOpportunity(
  accountId: string,
  opportunityId: string,
): Promise<{ folderId: string; webLink: string | null; folders: Record<string, string> }> {
  return callDrive({ action: 'provisionOpportunity', accountId, opportunityId });
}

/** Renames the account's Drive root folder to match the account's current name. */
export async function driveRenameFolder(accountId: string): Promise<{ webLink: string | null }> {
  return callDrive({ action: 'rename', accountId });
}

export async function driveListFiles(
  accountId: string,
  folderKey?: string,
  opportunityId?: string,
): Promise<DriveFile[]> {
  const { files } = await callDrive<{ files: DriveFile[] }>({
    action: 'list',
    accountId,
    folderKey,
    opportunityId,
  });
  return files;
}

export async function driveShareWithAccount(
  accountId: string,
): Promise<{ shared: string[]; skipped: string[] }> {
  return callDrive({ action: 'share', accountId });
}

/**
 * Maps a portal phase to its Drive subfolder key (SUBFOLDERS in api/google/drive). Phases without a
 * dedicated folder (e.g. 'any') are absent, so the lookup yields `undefined` → the account root.
 */
export const PHASE_TO_DRIVE_FOLDER: Record<string, string> = {
  onboarding: '00_onboarding',
  discovery: '01_discovery',
  proposal: '02_proposal',
  delivery: '05_delivery',
};

/**
 * Maps a document type to the phase-aligned Drive subfolder an upload should land in.
 * Returns `undefined` when the type has no matching category folder — the server then drops the
 * file in the account's root Drive folder.
 */
export function driveFolderForDocType(docType: string): string | undefined {
  switch (docType) {
    case 'contract':
    case 'msa':
    case 'sow':
    case 'nda':
      return '03_contracts';
    case 'invoice':
      return '04_invoices';
    case 'proposal':
      return '02_proposal';
    case 'deliverable':
      return '05_delivery';
    default: // reference, other, anything unmapped → account root folder
      return undefined;
  }
}

/**
 * Moves a file sitting in the portal-documents bucket into the account's Drive. `folderKey` picks a
 * phase subfolder; omit it (or pass an unknown key) to land in the account's root folder. When a
 * `documentId`/`resourceId` is given, the server repoints that row at the Drive link and deletes the
 * temporary bucket copy. The folder tree is auto-provisioned server-side if it doesn't exist yet.
 */
export async function driveUploadFromStorage(input: {
  accountId: string;
  /** When set, the file lands in this opportunity's own folder tree instead of the account root. */
  opportunityId?: string;
  storagePath: string;
  folderKey?: string;
  name?: string;
  documentId?: string;
  resourceId?: string;
}): Promise<{ fileId: string; webLink: string | null }> {
  return callDrive({ action: 'upload', ...input });
}

// ---------------------------------------------------------------------------
// Public holidays (migration 0042) — a shared calendar. Admins write; RLS blocks implementers.
// ---------------------------------------------------------------------------

const PUBLIC_HOLIDAY_COLUMNS = 'id, name, holiday_date, description, country, created_at, updated_at';

export async function adminListPublicHolidays(): Promise<PublicHoliday[]> {
  const { data, error } = await getSupabase()
    .from('portal_public_holidays')
    .select(PUBLIC_HOLIDAY_COLUMNS)
    .order('holiday_date');
  if (error) throw new Error(error.message);
  return z.array(PublicHolidaySchema).parse(data ?? []);
}

export async function adminUpsertPublicHoliday(input: {
  id?: string;
  name: string;
  holiday_date: string;
  description?: string;
  country?: string | null;
}): Promise<void> {
  const { error } = await getSupabase().from('portal_public_holidays').upsert({
    ...(input.id ? { id: input.id } : {}),
    name: input.name,
    holiday_date: input.holiday_date,
    description: input.description ?? '',
    country: input.country ?? null,
  });
  if (error) throw new Error(error.message);
}

export async function adminDeletePublicHoliday(id: string): Promise<void> {
  const { error } = await getSupabase().from('portal_public_holidays').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------------
// Time off (migration 0058) — vacation / sick leave. RLS returns own leave for staff, all for admins,
// so a single list call serves both. Non-admin writes are pinned to status 'pending' by a DB trigger;
// the internal approve/reject goes through the portal_set_time_off_status RPC (admin-only).
// ---------------------------------------------------------------------------

const TIME_OFF_COLUMNS =
  'id, user_id, kind, start_date, end_date, note, status, reviewed_by, reviewed_at, created_at, updated_at, ' +
  'user:portal_users!portal_time_off_user_id_fkey(id, full_name)';

export async function adminListTimeOff(): Promise<TimeOff[]> {
  const { data, error } = await getSupabase()
    .from('portal_time_off')
    .select(TIME_OFF_COLUMNS)
    .order('start_date', { ascending: false });
  if (error) throw new Error(error.message);
  return z.array(TimeOffSchema).parse(data ?? []);
}

export async function adminCreateTimeOff(input: {
  user_id: string;
  kind: TimeOffKind;
  start_date: string;
  end_date: string;
  note?: string;
}): Promise<void> {
  const { error } = await getSupabase().from('portal_time_off').insert({
    user_id: input.user_id,
    kind: input.kind,
    start_date: input.start_date,
    end_date: input.end_date,
    note: input.note ?? '',
  });
  if (error) throw new Error(error.message);
}

export async function adminUpdateTimeOff(
  id: string,
  patch: { kind?: TimeOffKind; start_date?: string; end_date?: string; note?: string },
): Promise<void> {
  const { error } = await getSupabase().from('portal_time_off').update(patch).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function adminDeleteTimeOff(id: string): Promise<void> {
  const { error } = await getSupabase().from('portal_time_off').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

/** Admin-only internal sign-off (pending / approved / rejected). Only approved leave reaches clients. */
export async function adminSetTimeOffStatus(id: string, status: TimeOffStatus): Promise<void> {
  const { error } = await getSupabase().rpc('portal_set_time_off_status', { p_id: id, p_status: status });
  if (error) throw new Error(error.message);
}

/** Client responses (approve / replacement requested) for the given leave ids, for the admin badges. */
export async function adminListTimeOffResponses(timeOffIds: string[]): Promise<TimeOffResponse[]> {
  if (timeOffIds.length === 0) return [];
  const { data, error } = await getSupabase()
    .from('portal_time_off_responses')
    .select('id, time_off_id, account_id, approved, replacement_requested, approved_at, replacement_requested_at')
    .in('time_off_id', timeOffIds);
  if (error) throw new Error(error.message);
  return z.array(TimeOffResponseSchema).parse(data ?? []);
}

/**
 * Internal upcoming-leave feed for the staff dashboard widget (migration 0059): my own pending/approved
 * leave plus my teammates' approved leave, all upcoming. `is_me` splits the two; teammate notes are
 * withheld server-side.
 */
export async function adminListMyTeamTimeOff(): Promise<MyTeamTimeOff[]> {
  const { data, error } = await getSupabase().rpc('portal_my_team_upcoming_time_off');
  if (error) throw new Error(error.message);
  return z.array(MyTeamTimeOffSchema).parse(data ?? []);
}

/**
 * Pending leave the signed-in staffer may approve (migration 0060): admins get everyone's, a team lead
 * gets their team members'. Approve/reject goes through adminSetTimeOffStatus (also lead-aware now).
 */
export async function adminListTimeOffReviewQueue(): Promise<TimeOffReview[]> {
  const { data, error } = await getSupabase().rpc('portal_time_off_review_queue');
  if (error) throw new Error(error.message);
  return z.array(TimeOffReviewSchema).parse(data ?? []);
}

/**
 * Approved leave a client asked to have covered, pinned to the exact project + client that requested it
 * (migration 0060). Scoped to admin (all) / team lead (their team).
 */
export async function adminListTimeOffReplacementRequests(): Promise<TimeOffReplacement[]> {
  const { data, error } = await getSupabase().rpc('portal_time_off_replacement_requests');
  if (error) throw new Error(error.message);
  return z.array(TimeOffReplacementSchema).parse(data ?? []);
}

// ---------------------------------------------------------------------------
// Teams (migration 0047) — internal staff grouped into teams with a lead + PM. Admins write; RLS
// blocks everyone else. Membership is portal_users.team_id, set via adminUpdateUser(id, { team_id }).
// ---------------------------------------------------------------------------

const TEAM_COLUMNS =
  'id, name, lead_id, pm_id, created_at, updated_at, ' +
  'lead:portal_users!portal_teams_lead_id_fkey(id, full_name), ' +
  'pm:portal_users!portal_teams_pm_id_fkey(id, full_name)';

export async function adminListTeams(): Promise<PortalTeam[]> {
  const { data, error } = await getSupabase().from('portal_teams').select(TEAM_COLUMNS).order('name');
  if (error) throw new Error(error.message);
  return z.array(PortalTeamSchema).parse(data ?? []);
}

export async function adminCreateTeam(input: {
  name: string;
  lead_id?: string | null;
  pm_id?: string | null;
}): Promise<PortalTeam> {
  const { data, error } = await getSupabase()
    .from('portal_teams')
    .insert({ name: input.name, lead_id: input.lead_id ?? null, pm_id: input.pm_id ?? null })
    .select(TEAM_COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return PortalTeamSchema.parse(data);
}

export async function adminUpdateTeam(
  id: string,
  patch: Partial<{ name: string; lead_id: string | null; pm_id: string | null }>,
): Promise<void> {
  const { error } = await getSupabase().from('portal_teams').update(patch).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function adminDeleteTeam(id: string): Promise<void> {
  const { error } = await getSupabase().from('portal_teams').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------------
// Overhead (migration 0055) — the company's fixed running costs + the finance settings the per-hour
// markup is derived against. Admin-only (RLS enforces it); never exposed to clients. The markup math
// itself is done client-side on the Overhead page from these rows + the counted headcount.
// ---------------------------------------------------------------------------

const OVERHEAD_COLUMNS =
  'id, name, category, note, amount, currency, fx_rate, cadence, amortize_months, scope, active, created_at, updated_at';

export async function adminListOverheadExpenses(): Promise<OverheadExpense[]> {
  const { data, error } = await getSupabase()
    .from('portal_overhead_expenses')
    .select(OVERHEAD_COLUMNS)
    .order('name');
  if (error) throw new Error(error.message);
  return z.array(OverheadExpenseSchema).parse(data ?? []);
}

export async function adminCreateOverheadExpense(input: {
  name: string;
  category?: string | null;
  note?: string | null;
  amount: number;
  currency: string;
  fx_rate: number;
  cadence: OverheadCadence;
  amortize_months?: number | null;
  scope: OverheadScope;
  active?: boolean;
}): Promise<OverheadExpense> {
  const { data, error } = await getSupabase()
    .from('portal_overhead_expenses')
    .insert({
      name: input.name,
      category: input.category ?? null,
      note: input.note ?? null,
      amount: input.amount,
      currency: input.currency,
      fx_rate: input.fx_rate,
      cadence: input.cadence,
      amortize_months: input.cadence === 'one_off' ? input.amortize_months ?? null : null,
      scope: input.scope,
      active: input.active ?? true,
    })
    .select(OVERHEAD_COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return OverheadExpenseSchema.parse(data);
}

export async function adminUpdateOverheadExpense(
  id: string,
  patch: Partial<{
    name: string;
    category: string | null;
    note: string | null;
    amount: number;
    currency: string;
    fx_rate: number;
    cadence: OverheadCadence;
    amortize_months: number | null;
    scope: OverheadScope;
    active: boolean;
  }>,
): Promise<void> {
  const { error } = await getSupabase().from('portal_overhead_expenses').update(patch).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function adminDeleteOverheadExpense(id: string): Promise<void> {
  const { error } = await getSupabase().from('portal_overhead_expenses').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

/** The singleton finance settings (base currency + the monthly-hours band). */
export async function adminGetFinanceSettings(): Promise<FinanceSettings> {
  const { data, error } = await getSupabase()
    .from('portal_finance_settings')
    .select('base_currency, overhead_hours_low, overhead_hours_high')
    .eq('id', true)
    .maybeSingle();
  if (error) throw new Error(error.message);
  // Fall back to the seeded defaults if the row is somehow absent, so the page always renders.
  return FinanceSettingsSchema.parse(
    data ?? { base_currency: 'USD', overhead_hours_low: 80, overhead_hours_high: 160 },
  );
}

export async function adminUpdateFinanceSettings(
  patch: Partial<{ base_currency: string; overhead_hours_low: number; overhead_hours_high: number }>,
): Promise<void> {
  const { error } = await getSupabase().from('portal_finance_settings').update(patch).eq('id', true);
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------------
// Finance transactions (migration 0056) — the realised-money ledger (paid salaries = expenses, settled
// invoices = income), recorded via portal_pay_salary / portal_pay_billing_invoice. Admin-only (RLS).
// ---------------------------------------------------------------------------

const FINANCE_TRANSACTION_COLUMNS =
  'id, kind, source_type, source_id, amount, currency, fx_rate, base_amount, base_currency, occurred_on, note, created_at, updated_at';

/** Every recorded transaction, newest payment first. Powers the P&L / Overview tab. */
export async function adminListFinanceTransactions(): Promise<FinanceTransaction[]> {
  const { data, error } = await getSupabase()
    .from('portal_finance_transactions')
    .select(FINANCE_TRANSACTION_COLUMNS)
    .order('occurred_on', { ascending: false });
  if (error) throw new Error(error.message);
  return z.array(FinanceTransactionSchema).parse(data ?? []);
}

/** A standalone ledger entry (0057): a payment plus its direction, with no salary/invoice behind it. */
export interface ManualTransactionInput extends PaymentInput {
  kind: FinanceTransactionKind;
}

/** Record an ad-hoc expense/income not tied to a salary or invoice (0057). Admin-only (RLS). */
export async function adminRecordManualTransaction(input: ManualTransactionInput): Promise<void> {
  const { error } = await getSupabase().rpc('portal_record_manual_transaction', {
    p_kind: input.kind,
    p_amount: input.amount,
    p_currency: input.currency,
    p_fx_rate: input.fx_rate,
    p_occurred_on: input.occurred_on,
    p_note: input.note ?? null,
  });
  if (error) throw new Error(error.message);
}

/** Delete a manual ledger entry (0057). Admin-only; the RPC refuses salary/invoice rows server-side. */
export async function adminDeleteFinanceTransaction(id: string): Promise<void> {
  const { error } = await getSupabase().rpc('portal_delete_finance_transaction', { p_id: id });
  if (error) throw new Error(error.message);
}
