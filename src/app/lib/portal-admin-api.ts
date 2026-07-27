import { z } from 'zod';
import { getSupabase } from '@/app/lib/supabase';
import {
  ActivitySchema,
  CandidateSchema,
  DocumentSchema,
  FeedbackSchema,
  IntakeItemSchema,
  InvoiceSchema,
  MeetingSchema,
  MilestoneSchema,
  OfferSchema,
  OpportunitySchema,
  PortalAccountSchema,
  PortalUserSchema,
  ProjectSchema,
  ProjectTeamMemberSchema,
  ResourceSchema,
  TimeEntrySchema,
  AccountTeamMemberSchema,
  type AccountTeamMember,
  type Activity,
  type Candidate,
  type Feedback,
  type Health,
  type IntakeItem,
  type Invoice,
  type Lifecycle,
  type Meeting,
  type Milestone,
  type Offer,
  type OfferBillingType,
  type Opportunity,
  type PortalAccount,
  type PortalDocument,
  type PortalResource,
  type PortalRole,
  type PortalUser,
  type Project,
  type ProjectTeamMember,
  type TimeEntry,
} from '@/app/lib/portal-types';

const ACCOUNT_COLUMNS =
  'id, name, logo_url, source, source_subtype, industry, lifecycle, health, owner_id, internal_notes, created_at, updated_at, drive_folder_id, drive_web_link, drive_folders, owner:portal_users!portal_accounts_owner_fkey(id, full_name, title, email, calendly_url, photo_url)';

const USER_COLUMNS =
  'id, auth_user_id, email, full_name, role, account_id, module_access, title, status, last_login_at, calendly_url, photo_url, created_at';

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

export async function adminListInternalUsers(): Promise<PortalUser[]> {
  const { data, error } = await getSupabase()
    .from('portal_users')
    .select(USER_COLUMNS)
    .is('account_id', null)
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
      'id, account_id, name, stage, amount, close_date, updated_at, intake_published, drive_folder_id, drive_web_link, drive_folders',
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
  'id, account_id, opportunity_id, version, title, summary, status, total, currency, expires_on, pdf_url, change_note, client_note, sent_at, responded_at, created_at, items:portal_offer_items(id, offer_id, position, name, detail, amount, billing_type, overtime_rate, monthly_hours)';

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
  items: OfferItemInput[];
  send: boolean;
}): Promise<void> {
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
}

export async function adminSendOffer(offerId: string, accountId: string, label: string): Promise<void> {
  const { error } = await getSupabase()
    .from('portal_offers')
    .update({ status: 'sent', sent_at: new Date().toISOString() })
    .eq('id', offerId);
  if (error) throw new Error(error.message);
  await logActivity(accountId, 'pipeline', 'Offer sent', label, '/portal/pipeline');
}

/* --------------------------------------------------------------- meetings */

const MEETING_COLUMNS =
  'id, account_id, title, meeting_type, starts_at, duration_minutes, status, host_user_id, attendees, location_url, notes, host:portal_users!portal_meetings_host_user_id_fkey(id, full_name)';

export async function adminListMeetings(accountId: string): Promise<Meeting[]> {
  const { data, error } = await getSupabase()
    .from('portal_meetings')
    .select(MEETING_COLUMNS)
    .eq('account_id', accountId)
    .order('starts_at', { ascending: false });
  if (error) throw new Error(error.message);
  return z.array(MeetingSchema).parse(data ?? []);
}

export async function adminUpdateMeeting(
  id: string,
  patch: Partial<{
    status: Meeting['status'];
    starts_at: string;
    location_url: string | null;
    notes: string | null;
    host_user_id: string | null;
  }>,
): Promise<void> {
  const { error } = await getSupabase().from('portal_meetings').update(patch).eq('id', id);
  if (error) throw new Error(error.message);
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
}): Promise<void> {
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

/* --------------------------------------------------------------- invoices */

export async function adminListInvoices(accountId: string): Promise<Invoice[]> {
  const { data, error } = await getSupabase()
    .from('portal_invoices')
    .select(
      'id, account_id, project_id, milestone_id, number, description, amount, currency, due_date, due_label, status, issued_at, paid_at, invoice_url, position',
    )
    .eq('account_id', accountId)
    .order('position');
  if (error) throw new Error(error.message);
  return z.array(InvoiceSchema).parse(data ?? []);
}

export async function adminUpsertInvoice(input: {
  id?: string;
  account_id: string;
  project_id: string | null;
  milestone_id: string | null;
  number: string | null;
  description: string;
  amount: number;
  due_date: string | null;
  due_label: string | null;
  status: Invoice['status'];
  position: number;
}): Promise<void> {
  const supabase = getSupabase();
  const { id, ...values } = input;
  const patch: Record<string, unknown> = { ...values };
  if (values.status === 'paid') patch.paid_at = new Date().toISOString();
  if (values.status !== 'not_issued' && !id) patch.issued_at = new Date().toISOString();

  const { error } = id
    ? await supabase.from('portal_invoices').update(patch).eq('id', id)
    : await supabase.from('portal_invoices').insert(patch);
  if (error) throw new Error(error.message);
}

export async function adminDeleteInvoice(id: string): Promise<void> {
  const { error } = await getSupabase().from('portal_invoices').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

/* -------------------------------------------------- projects, milestones, team */

const PROJECT_COLUMNS =
  'id, account_id, opportunity_id, name, summary, health, status, start_date, target_date, published, created_at, drive_folder_id, drive_web_link, drive_folders';

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
  milestones: { name: string; description: string; due_date: string | null }[];
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
    published: boolean;
  }>,
): Promise<void> {
  const { error } = await getSupabase().from('portal_projects').update(patch).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function adminListMilestones(projectId: string): Promise<Milestone[]> {
  const { data, error } = await getSupabase()
    .from('portal_milestones')
    .select('id, project_id, name, description, due_date, status, percent_complete, position, approved_at')
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

export async function adminListProjectTeam(projectId: string): Promise<ProjectTeamMember[]> {
  const { data, error } = await getSupabase()
    .from('portal_project_team')
    .select(
      'id, project_id, user_id, project_role, assigned_at, active, is_public, user:portal_users!portal_project_team_user_id_fkey(id, full_name, title, email, photo_url)',
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
  'id, account_id, project_id, about_user_id, submitted_by, rating, comment, context, is_urgent, status, response, responded_at, created_at, about:portal_users!portal_feedback_about_user_id_fkey(id, full_name), submitter:portal_users!portal_feedback_submitted_by_fkey(id, full_name), account:portal_accounts!portal_feedback_account_id_fkey(id, name)';

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

/* ---------------------------------------------------------- time entries */

export async function adminListTimeEntries(projectId: string): Promise<TimeEntry[]> {
  const { data, error } = await getSupabase()
    .from('portal_time_entries')
    .select(
      'id, project_id, milestone_id, user_id, entry_date, hours, description, billable, visible_to_client, user:portal_users!portal_time_entries_user_id_fkey(id, full_name)',
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
  hours: number;
  description: string;
  billable: boolean;
  visible_to_client: boolean;
}): Promise<void> {
  const { error } = await getSupabase().from('portal_time_entries').insert(input);
  if (error) throw new Error(error.message);
}

export async function adminDeleteTimeEntry(id: string): Promise<void> {
  const { error } = await getSupabase().from('portal_time_entries').delete().eq('id', id);
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
