import { z } from 'zod';
import { getSupabase } from '@/app/lib/supabase';
import {
  AccountTeamMemberSchema,
  ActivitySchema,
  BillingInvoiceSchema,
  CandidateSchema,
  DocumentSchema,
  FeedbackSchema,
  FeedbackTargetSchema,
  IntakeItemSchema,
  MilestoneSchema,
  OfferSchema,
  OpportunitySchema,
  PortalAccountSchema,
  PortalUserSchema,
  ProductSchema,
  ProjectSchema,
  ProjectTeamMemberSchema,
  PublicHolidaySchema,
  PublicReviewSchema,
  ResourceSchema,
  StaffRatingSchema,
  TeamTimeOffSchema,
  TimeEntrySchema,
  type BillingInvoice,
  type TeamTimeOff,
  type PortalSnapshot,
  type PortalUser,
  type TimeEntry,
  type Product,
  type ProductEntity,
  type PublicHoliday,
  type PublicReview,
  type StaffRating,
} from '@/app/lib/portal-types';
import {
  DriveNotConfiguredError,
  driveFolderForDocType,
  driveUploadFromStorage,
} from '@/app/lib/portal-admin-api';

const ACCOUNT_COLUMNS =
  'id, name, logo_url, industry, lifecycle, health, owner_id, internal_notes, created_at, updated_at, owner:portal_users!portal_accounts_owner_fkey(id, full_name, title, email, calendly_url, photo_url)';

/** Links the signed-in auth user to their portal_users row; null if they were never invited. */
export async function bootstrapPortalUser(): Promise<PortalUser | null> {
  const { data, error } = await getSupabase().rpc('portal_bootstrap_user');
  if (error) throw new Error(error.message);
  // A deleted/never-invited user yields either null or an all-null composite row
  // (an empty portal_users record). Both mean "no portal identity" → show NoAccess.
  if (!data || (typeof data === 'object' && (data as { id: string | null }).id == null)) return null;
  return PortalUserSchema.parse(data);
}

/**
 * Loads the whole client-facing dataset for one account. Every query is RLS-scoped, so an
 * account id is never trusted from the browser — it comes from the caller's portal_users row.
 */
export async function loadPortalSnapshot(accountId: string): Promise<PortalSnapshot> {
  const supabase = getSupabase();

  const [
    account,
    opportunities,
    offers,
    documents,
    projects,
    feedback,
    activity,
    resources,
    intake,
    klepkaTeam,
    candidates,
  ] = await Promise.all([
      supabase.from('portal_accounts').select(ACCOUNT_COLUMNS).eq('id', accountId).single(),
      supabase
        .from('portal_opportunities')
        .select('id, account_id, name, stage, amount, close_date, bank_hours, notify_hours, project_type, updated_at, intake_published')
        .eq('account_id', accountId)
        .order('updated_at', { ascending: false }),
      supabase
        .from('portal_offers')
        .select(
          'id, account_id, opportunity_id, version, title, summary, status, total, currency, expires_on, pdf_url, change_note, client_note, sent_at, responded_at, created_at, bank_hours, notify_hours, items:portal_offer_items(id, offer_id, position, name, detail, amount, billing_type, overtime_rate, monthly_hours)',
        )
        .eq('account_id', accountId)
        .order('version', { ascending: false }),
      supabase
        .from('portal_documents')
        .select(
          'id, account_id, name, doc_type, status, version, file_url, drive_web_link, drive_file_id, signers, signed_at, opportunity_id, related_offer_id, related_project_id, intake_item_id, uploaded_by_client, updated_at',
        )
        .eq('account_id', accountId)
        .order('updated_at', { ascending: false }),
      supabase
        .from('portal_projects')
        .select(
          'id, account_id, opportunity_id, name, summary, health, status, start_date, target_date, published, created_at, bank_hours, notify_hours, project_type',
        )
        .eq('account_id', accountId)
        .order('created_at', { ascending: false }),
      supabase
        .from('portal_feedback')
        .select(
          'id, account_id, project_id, about_user_id, submitted_by, rating, comment, context, is_urgent, is_public, public_approved_at, status, response, responded_at, created_at, about:portal_users!portal_feedback_about_user_id_fkey(id, full_name)',
        )
        .eq('account_id', accountId)
        .order('created_at', { ascending: false }),
      supabase
        .from('portal_activity')
        .select('id, account_id, category, title, detail, link, client_visible, read_by, created_at')
        .eq('account_id', accountId)
        .order('created_at', { ascending: false })
        .limit(60),
      // Shared library (account_id is null) plus anything specific to this account.
      supabase
        .from('portal_resources')
        .select(
          'id, account_id, title, description, kind, url, file_path, article_id, phase, position, published, article:articles(id, title, slug, excerpt)',
        )
        .or(`account_id.is.null,account_id.eq.${accountId}`)
        .order('position'),
      supabase
        .from('portal_intake_items')
        .select(
          'id, account_id, opportunity_id, name, description, owner_side, status, due_date, position, client_note, review_note, submitted_at, reviewed_at',
        )
        .eq('account_id', accountId)
        .order('position'),
      // The account's Klepka people — surfaced on Calls for direct Calendly booking. Only members
      // the admin marked public are shown to the client.
      supabase
        .from('portal_account_team')
        .select(
          'id, account_id, user_id, team_role, active, is_public, added_at, user:portal_users!portal_account_team_user_id_fkey(id, full_name, title, email, calendly_url, photo_url)',
        )
        .eq('account_id', accountId)
        .eq('active', true)
        .eq('is_public', true)
        .order('added_at'),
      supabase
        .from('portal_candidates')
        .select(
          'id, account_id, opportunity_id, user_id, title, cv_url, hourly_rate, status, client_note, decided_at, decided_by, created_at, updated_at, user:portal_users!portal_candidates_user_id_fkey(id, full_name, title, email, calendly_url, photo_url)',
        )
        .eq('account_id', accountId)
        .order('created_at'),
    ]);

  // Modules the caller cannot see return an empty set rather than an error, so a scoped
  // collaborator still gets a working dashboard.
  if (account.error) throw new Error(account.error.message);

  const allProjects = z.array(ProjectSchema).parse(projects.data ?? []);
  const projectIds = allProjects.map((entry) => entry.id);

  // Load every project's children in one round each, then group by project_id — the client
  // shows all projects with a switcher, not just the first.
  const bundles: PortalSnapshot['projects'] = [];
  if (projectIds.length > 0) {
    const [milestoneRows, teamRows, timeRows] = await Promise.all([
      supabase
        .from('portal_milestones')
        .select('id, project_id, name, description, start_date, due_date, status, percent_complete, position, approved_at')
        .in('project_id', projectIds)
        .order('position'),
      supabase
        .from('portal_project_team')
        .select(
          'id, project_id, user_id, display_name, project_role, assigned_at, active, is_public, user:portal_users!portal_project_team_user_id_fkey(id, full_name, title, email, calendly_url, photo_url)',
        )
        .in('project_id', projectIds)
        .eq('active', true)
        .eq('is_public', true),
      supabase
        .from('portal_time_entries')
        // The client only ever sees the reporter, never the internal employee who did the work, so
        // `user` here is aliased to reporter_id (migration 0041). Rows logged before reporters
        // existed have a null reporter and show a generic label instead of a name.
        .select(
          'id, project_id, milestone_id, reporter_id, entry_date, hours, approved, description, billable, user:portal_users!portal_time_entries_reporter_id_fkey(id, full_name)',
        )
        .in('project_id', projectIds)
        .order('entry_date', { ascending: false }),
    ]);
    const allMilestones = z.array(MilestoneSchema).parse(milestoneRows.data ?? []);
    const allTeam = z.array(ProjectTeamMemberSchema).parse(teamRows.data ?? []);
    const allTime = z.array(TimeEntrySchema).parse(timeRows.data ?? []);
    for (const entry of allProjects) {
      bundles.push({
        project: entry,
        milestones: allMilestones.filter((row) => row.project_id === entry.id),
        team: allTeam.filter((row) => row.project_id === entry.id),
        timeEntries: allTime.filter((row) => row.project_id === entry.id),
      });
    }
  }

  const project = bundles[0]?.project ?? null;
  const milestones = bundles[0]?.milestones ?? [];
  const team = bundles[0]?.team ?? [];
  const timeEntries = bundles[0]?.timeEntries ?? [];

  const allOpportunities = z.array(OpportunitySchema).parse(opportunities.data ?? []);

  return {
    account: PortalAccountSchema.parse(account.data),
    opportunities: allOpportunities,
    opportunity: allOpportunities[0] ?? null,
    resources: z.array(ResourceSchema).parse(resources.data ?? []),
    intake: z.array(IntakeItemSchema).parse(intake.data ?? []),
    timeEntries,
    offers: z.array(OfferSchema).parse(offers.data ?? []),
    documents: z.array(DocumentSchema).parse(documents.data ?? []),
    candidates: z.array(CandidateSchema).parse(candidates.data ?? []),
    projects: bundles,
    project,
    milestones,
    team,
    klepkaTeam: z.array(AccountTeamMemberSchema).parse(klepkaTeam.data ?? []),
    feedback: z.array(FeedbackSchema).parse(feedback.data ?? []),
    activity: z.array(ActivitySchema).parse(activity.data ?? []),
  };
}

/**
 * The shared public-holiday calendar (migration 0042). RLS decides visibility: staff always see it,
 * clients only once their account is qualified — so a client with no access simply gets an empty
 * list. Returns holidays on or after `from` (defaults to today), soonest first.
 */
export async function loadPublicHolidays(from?: string): Promise<PublicHoliday[]> {
  const fromDate = from ?? new Date().toISOString().slice(0, 10);
  const { data, error } = await getSupabase()
    .from('portal_public_holidays')
    .select('id, name, holiday_date, description, country, created_at, updated_at')
    .gte('holiday_date', fromDate)
    .order('holiday_date');
  if (error) throw new Error(error.message);
  return z.array(PublicHolidaySchema).parse(data ?? []);
}

/**
 * The client's billing invoices (0048) with their per-reporter summary lines. RLS returns only the
 * signed-in client's own account and only invoices that have been 'sent', so no account filter is
 * needed here. Newest month first.
 */
export async function listMyBillingInvoices(): Promise<BillingInvoice[]> {
  const { data, error } = await getSupabase()
    .from('portal_billing_invoices')
    .select(
      'id, account_id, project_id, period, currency, total_hours, total_amount, status, computed_at, created_at, document_id, ' +
        'project:portal_projects!portal_billing_invoices_project_id_fkey(id, name), ' +
        'document:portal_documents!portal_billing_invoices_document_id_fkey(id, name, file_url, drive_web_link, drive_file_id), ' +
        'lines:portal_billing_invoice_lines(id, invoice_id, reporter_id, hours, rate, amount, ' +
        'reporter:portal_users!portal_billing_invoice_lines_reporter_id_fkey(id, full_name))',
    )
    .order('period', { ascending: false });
  if (error) throw new Error(error.message);
  return z.array(BillingInvoiceSchema).parse(data ?? []);
}

/**
 * The client confirms (or revokes) a sent invoice — the sent ↔ client_approved toggle. The RPC
 * enforces that only the client's own sent/client-approved invoice can move, and never to 'paid'
 * (that stays the admin's confirmation).
 */
export async function clientApproveBillingInvoice(id: string, approve: boolean): Promise<void> {
  const { error } = await getSupabase().rpc('portal_client_approve_billing_invoice', {
    p_id: id,
    p_approve: approve,
  });
  if (error) throw new Error(error.message);
}

/**
 * The approved worklogs behind one of the client's monthly invoices. Mirrors
 * adminListBillingInvoiceEntries but under client RLS (which already exposes only approved logs of
 * the client's own account). Only the client-facing reporter is shown, never the internal employee.
 */
export async function listMyBillingInvoiceEntries(projectId: string, period: string): Promise<TimeEntry[]> {
  // Month bounds from local date parts (never toISOString, which would shift the month in +offset TZs).
  const startDate = new Date(`${period.slice(0, 7)}-01T00:00:00`);
  const monthStart = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  const start = monthStart(startDate);
  const nextMonth = monthStart(new Date(startDate.getFullYear(), startDate.getMonth() + 1, 1));
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

/**
 * Trims an internally-loaded snapshot down to what a client actually sees. Used by the admin
 * "View as client" preview, where the data is fetched with internal RLS (so it includes drafts,
 * unpublished and internal-only rows) — this re-applies the client-facing visibility rules so the
 * preview matches the real portal instead of leaking internal state during a demo.
 */
export function filterSnapshotForClient(snapshot: PortalSnapshot): PortalSnapshot {
  const offers = snapshot.offers.filter((offer) => offer.status !== 'draft');
  const documents = snapshot.documents.filter((doc) => doc.status !== 'draft');
  const resources = snapshot.resources.filter((resource) => resource.published);
  const activity = snapshot.activity.filter((entry) => entry.client_visible);
  // Intake is hidden until the team publishes its opportunity's checklist (RLS enforces the same
  // for real clients; this keeps the admin "View as client" preview honest).
  const publishedOppIds = new Set(
    snapshot.opportunities.filter((opp) => opp.intake_published).map((opp) => opp.id),
  );
  const intake = snapshot.intake.filter((item) => publishedOppIds.has(item.opportunity_id));
  const projects = snapshot.projects
    .filter((bundle) => bundle.project.published)
    .map((bundle) => ({
      ...bundle,
      timeEntries: bundle.timeEntries.filter((entry) => entry.approved),
    }));
  const first = projects[0];

  return {
    ...snapshot,
    account: { ...snapshot.account, internal_notes: '' },
    offers,
    documents,
    resources,
    activity,
    intake,
    projects,
    project: first?.project ?? null,
    milestones: first?.milestones ?? [],
    team: first?.team ?? [],
    timeEntries: first?.timeEntries ?? [],
  };
}

export async function respondToOffer(
  offerId: string,
  decision: 'accepted' | 'changes_requested',
  note?: string,
): Promise<void> {
  const { error } = await getSupabase().rpc('portal_respond_to_offer', {
    p_offer: offerId,
    p_decision: decision,
    p_note: note ?? null,
  });
  if (error) throw new Error(error.message);
}

/** Client confirms or declines a proposed candidate; the admin side reflects the new status. */
export async function decideCandidate(
  candidateId: string,
  decision: 'confirmed' | 'declined',
  note?: string,
): Promise<void> {
  const { error } = await getSupabase().rpc('portal_decide_candidate', {
    p_candidate: candidateId,
    p_decision: decision,
    p_note: note ?? null,
  });
  if (error) throw new Error(error.message);
}

export async function approveMilestone(milestoneId: string): Promise<void> {
  const { error } = await getSupabase().rpc('portal_approve_milestone', { p_milestone: milestoneId });
  if (error) throw new Error(error.message);
}

/**
 * Approved leave of Klepka staff who are visible members of one of the account's projects (migration
 * 0058). The RPC scopes to the caller's account, so it never leaks staff outside the client's projects.
 */
export async function loadMyTeamTimeOff(): Promise<TeamTimeOff[]> {
  const { data, error } = await getSupabase().rpc('portal_my_team_time_off');
  if (error) throw new Error(error.message);
  return z.array(TeamTimeOffSchema).parse(data ?? []);
}

/**
 * Client acknowledges a leave and/or requests a replacement for a specific project (only allowed for
 * leave > 2 days). The response is stored per (leave, project), so each project is confirmed on its own.
 */
export async function respondTeamTimeOff(
  timeOffId: string,
  projectId: string,
  approve: boolean,
  requestReplacement: boolean,
): Promise<void> {
  const { error } = await getSupabase().rpc('portal_client_respond_time_off', {
    p_time_off: timeOffId,
    p_project: projectId,
    p_approve: approve,
    p_request_replacement: requestReplacement,
  });
  if (error) throw new Error(error.message);
}

export async function listFeedbackTargets() {
  const { data, error } = await getSupabase().rpc('portal_feedback_targets');
  if (error) throw new Error(error.message);
  return z.array(FeedbackTargetSchema).parse(data ?? []);
}

export async function submitFeedback(input: {
  rating: number;
  comment: string;
  aboutUserId: string | null;
  isUrgent: boolean;
  isPublic?: boolean;
  context?: string | null;
}): Promise<void> {
  const { error } = await getSupabase().rpc('portal_submit_feedback', {
    p_rating: input.rating,
    p_comment: input.comment,
    p_about_user: input.aboutUserId,
    p_is_urgent: input.isUrgent,
    p_context: input.context ?? null,
    p_is_public: input.isPublic ?? false,
  });
  if (error) throw new Error(error.message);
}

/** Average rating + count per staff member, keyed by user id. Empty when nobody has feedback. */
export async function loadStaffRatings(userIds: string[]): Promise<Map<string, StaffRating>> {
  if (userIds.length === 0) return new Map();
  const { data, error } = await getSupabase().rpc('portal_staff_feedback_summary', { p_user_ids: userIds });
  if (error) throw new Error(error.message);
  const parsed = z.array(StaffRatingSchema).parse(data ?? []);
  return new Map(parsed.map((row) => [row.user_id, row]));
}

/* ----------------------------------------------------------------- products */

const ENTITY_TABLE: Record<ProductEntity, { table: string; column: string }> = {
  account: { table: 'portal_account_products', column: 'account_id' },
  opportunity: { table: 'portal_opportunity_products', column: 'opportunity_id' },
  project: { table: 'portal_project_products', column: 'project_id' },
};

/** The full product catalog, name-sorted. Pending (client-created) products are included. */
export async function listProducts(): Promise<Product[]> {
  const { data, error } = await getSupabase()
    .from('portal_products')
    .select('id, name, description, status, created_by, created_at')
    .order('name');
  if (error) throw new Error(error.message);
  return z.array(ProductSchema).parse(data ?? []);
}

/** Create a product (or reuse an existing same-named one). Client creations are 'pending'. */
export async function createProduct(name: string, description?: string | null): Promise<Product> {
  const { data, error } = await getSupabase().rpc('portal_create_product', {
    p_name: name,
    p_description: description ?? null,
  });
  if (error) throw new Error(error.message);
  return ProductSchema.parse(data);
}

/** Replace the product set on an account / opportunity / project (client-safe RPC). */
export async function setEntityProducts(entity: ProductEntity, id: string, productIds: string[]): Promise<void> {
  const { error } = await getSupabase().rpc('portal_set_products', {
    p_entity: entity,
    p_entity_id: id,
    p_product_ids: productIds,
  });
  if (error) throw new Error(error.message);
}

/** The products tagged on one account / opportunity / project. */
export async function listEntityProducts(entity: ProductEntity, id: string): Promise<Product[]> {
  const { table, column } = ENTITY_TABLE[entity];
  const { data, error } = await getSupabase()
    .from(table)
    .select('product:portal_products(id, name, description, status, created_by, created_at)')
    .eq(column, id);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as { product: unknown }[];
  return z.array(ProductSchema).parse(rows.map((row) => row.product).filter(Boolean));
}

/**
 * Products in scope on an account through its non-Lost opportunities and its projects, excluding any
 * the account already tags directly. Read-only "inherited" set shown alongside the account's own.
 */
export async function listAccountInheritedProducts(accountId: string): Promise<Product[]> {
  const { data, error } = await getSupabase().rpc('portal_account_inherited_products', { p_account: accountId });
  if (error) throw new Error(error.message);
  return z.array(ProductSchema).parse(data ?? []);
}

/** Skills (owned products) for the given staff, grouped by user id. */
export async function listUserProducts(userIds: string[]): Promise<Map<string, Product[]>> {
  if (userIds.length === 0) return new Map();
  const { data, error } = await getSupabase()
    .from('portal_user_products')
    .select('user_id, product:portal_products(id, name, description, status, created_by, created_at)')
    .in('user_id', userIds);
  if (error) throw new Error(error.message);
  const map = new Map<string, Product[]>();
  for (const row of (data ?? []) as { user_id: string; product: unknown }[]) {
    if (!row.product) continue;
    const product = ProductSchema.parse(row.product);
    const list = map.get(row.user_id) ?? [];
    list.push(product);
    map.set(row.user_id, list);
  }
  return map;
}

/** Approved, anonymised public reviews about the given staff, grouped by user id. */
export async function loadPublicReviews(userIds: string[]): Promise<Map<string, PublicReview[]>> {
  if (userIds.length === 0) return new Map();
  const { data, error } = await getSupabase().rpc('portal_staff_public_reviews', { p_user_ids: userIds });
  if (error) throw new Error(error.message);
  const parsed = z.array(PublicReviewSchema).parse(data ?? []);
  const map = new Map<string, PublicReview[]>();
  for (const review of parsed) {
    const list = map.get(review.about_user_id) ?? [];
    list.push(review);
    map.set(review.about_user_id, list);
  }
  return map;
}

export async function updateIntakeItem(
  itemId: string,
  status: 'in_progress' | 'submitted',
  note?: string,
  dueDate?: string | null,
): Promise<void> {
  const { error } = await getSupabase().rpc('portal_update_intake_item', {
    p_item: itemId,
    p_status: status,
    p_note: note ?? null,
    p_due_date: dueDate ?? null,
  });
  if (error) throw new Error(error.message);
}

export async function markActivityRead(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await getSupabase().rpc('portal_mark_activity_read', { p_ids: ids });
  if (error) throw new Error(error.message);
}

/* --------------------------------------------------------------- worklogs */

const ProjectForUserSchema = z.object({ id: z.guid(), name: z.string(), account_name: z.string() });
export type ProjectForUser = z.infer<typeof ProjectForUserSchema>;

/** The projects a staff member is staffed on — for the Log hours widget's project picker. */
export async function listProjectsForUser(userId: string): Promise<ProjectForUser[]> {
  const { data, error } = await getSupabase().rpc('portal_projects_for_user', { p_user: userId });
  if (error) throw new Error(error.message);
  return z.array(ProjectForUserSchema).parse(data ?? []);
}

/**
 * Log a worklog (staff only). The RPC enforces that non-admins can only log for themselves and can't
 * approve; `user_id`/`approved` are ignored for them (migration 0038).
 */
export async function logHours(input: {
  projectId: string;
  userId: string | null;
  entryDate: string | null;
  description: string;
  billingHours: number | null;
  actualHours: number | null;
  approved: boolean;
  milestoneId?: string | null;
  /** Client-facing reporter; omit to credit the log to the employee (migration 0041). */
  reporterId?: string | null;
}): Promise<void> {
  const { error } = await getSupabase().rpc('portal_log_hours', {
    p_project: input.projectId,
    p_user: input.userId,
    p_entry_date: input.entryDate,
    p_description: input.description,
    p_billing_hours: input.billingHours,
    p_actual_hours: input.actualHours,
    p_approved: input.approved,
    // Only pass a milestone when one was actually picked. Sending it unconditionally forces Postgres
    // to resolve the newer milestone-aware signature; omitting it lets the call fall back to the
    // milestone-less signature, so logging still works if the milestone migration isn't applied yet.
    ...(input.milestoneId ? { p_milestone: input.milestoneId } : {}),
    // Likewise only pass a reporter when it differs from the employee — otherwise the RPC defaults
    // it to the employee, and the call still resolves against pre-0041 signatures.
    ...(input.reporterId ? { p_reporter: input.reporterId } : {}),
  });
  if (error) throw new Error(error.message);
}

/* ------------------------------------------------------------- dashboard layout */

/**
 * A client's personal dashboard arrangement: widget order, which widgets they've hidden, and each
 * widget's chosen size (`w` = grid columns 1–3, `h` = 1 normal / 2 tall). Widgets missing from
 * `sizes` fall back to their built-in default size.
 */
export interface DashboardLayout {
  order: string[];
  hidden: string[];
  sizes?: Record<string, { w: number; h: number }>;
}

const DashboardLayoutSchema = z.object({
  order: z.array(z.string()).catch([]),
  hidden: z.array(z.string()).catch([]),
  sizes: z.record(z.string(), z.object({ w: z.number(), h: z.number() })).catch({}),
});

/** The caller's saved dashboard layout, or null when they haven't customised it yet. */
export async function getDashboardLayout(): Promise<DashboardLayout | null> {
  const { data, error } = await getSupabase().rpc('portal_get_dashboard_layout');
  if (error) throw new Error(error.message);
  if (data == null) return null;
  const parsed = DashboardLayoutSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
}

/** Persist (or, with null, clear) the caller's dashboard layout. */
export async function setDashboardLayout(layout: DashboardLayout | null): Promise<void> {
  const { error } = await getSupabase().rpc('portal_set_dashboard_layout', { p_layout: layout });
  if (error) throw new Error(error.message);
}

export async function inviteTeammate(input: {
  email: string;
  fullName: string;
  role: 'client_admin' | 'client_collaborator';
  modules: string[];
}): Promise<void> {
  const { error } = await getSupabase().rpc('portal_invite_teammate', {
    p_email: input.email,
    p_full_name: input.fullName,
    p_role: input.role,
    p_modules: input.modules,
  });
  if (error) throw new Error(error.message);
}

export async function listAccountUsers(accountId: string): Promise<PortalUser[]> {
  const { data, error } = await getSupabase()
    .from('portal_users')
    .select('id, auth_user_id, email, full_name, role, account_id, module_access, title, status, last_login_at, created_at')
    .eq('account_id', accountId)
    .order('created_at');
  if (error) throw new Error(error.message);
  return z.array(PortalUserSchema).parse(data ?? []);
}

/**
 * Uploads a client-side document, then records it via the RPC (storage path is tenant-scoped).
 * Pass `intakeItemId` to tag the file to a Discovery checklist item — it then lands in the
 * account's "01 Discovery" Drive folder and shows under that item on the Information gathering page.
 */
export async function uploadClientDocument(
  accountId: string,
  file: File,
  name: string,
  options?: { intakeItemId?: string; opportunityId?: string; folderKey?: string },
): Promise<void> {
  const supabase = getSupabase();
  const extension = file.name.split('.').pop()?.toLowerCase() || 'bin';
  const path = `${accountId}/${crypto.randomUUID()}.${extension}`;

  const { error: uploadError } = await supabase.storage.from('portal-documents').upload(path, file, {
    contentType: file.type || undefined,
  });
  if (uploadError) throw new Error(uploadError.message);

  const docType = 'reference';
  const { data: created, error } = await supabase.rpc('portal_register_document', {
    p_name: name || file.name,
    p_file_url: path,
    p_doc_type: docType,
    p_intake_item: options?.intakeItemId ?? null,
  });
  if (error) throw new Error(error.message);

  // Move the file to Google Drive and make Drive its home (server repoints file_url and drops the
  // temp bucket copy). Best-effort: if Drive isn't configured or the push fails, the file stays in
  // Supabase Storage — the document is already registered, so nothing is lost.
  const documentId = (created as { id?: string } | null)?.id;
  if (documentId) {
    try {
      await driveUploadFromStorage({
        accountId,
        opportunityId: options?.opportunityId,
        storagePath: path,
        folderKey: options?.folderKey ?? driveFolderForDocType(docType),
        name: name || file.name,
        documentId,
      });
    } catch (cause) {
      if (!(cause instanceof DriveNotConfiguredError)) {
        console.warn('Drive push failed — kept the file in Supabase Storage:', cause);
      }
    }
  }
}

/** Portal documents live in a private bucket — hand out short-lived signed URLs on demand. */
export async function getDocumentUrl(filePath: string): Promise<string> {
  if (/^https?:\/\//.test(filePath)) return filePath;
  const { data, error } = await getSupabase().storage
    .from('portal-documents')
    .createSignedUrl(filePath, 60 * 10);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}
