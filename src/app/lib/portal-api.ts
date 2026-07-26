import { z } from 'zod';
import { getSupabase } from '@/app/lib/supabase';
import {
  AccountTeamMemberSchema,
  ActivitySchema,
  CandidateSchema,
  DocumentSchema,
  FeedbackSchema,
  FeedbackTargetSchema,
  InvoiceSchema,
  IntakeItemSchema,
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
  type MeetingType,
  type PortalSnapshot,
  type PortalUser,
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
    meetings,
    documents,
    invoices,
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
        .select('id, account_id, name, stage, amount, close_date, updated_at')
        .eq('account_id', accountId)
        .order('updated_at', { ascending: false }),
      supabase
        .from('portal_offers')
        .select(
          'id, account_id, opportunity_id, version, title, summary, status, total, currency, expires_on, pdf_url, change_note, client_note, sent_at, responded_at, created_at, items:portal_offer_items(id, offer_id, position, name, detail, amount)',
        )
        .eq('account_id', accountId)
        .order('version', { ascending: false }),
      supabase
        .from('portal_meetings')
        .select(
          'id, account_id, title, meeting_type, starts_at, duration_minutes, status, host_user_id, attendees, location_url, notes, host:portal_users!portal_meetings_host_user_id_fkey(id, full_name)',
        )
        .eq('account_id', accountId)
        .order('starts_at', { ascending: false }),
      supabase
        .from('portal_documents')
        .select(
          'id, account_id, name, doc_type, status, version, file_url, drive_web_link, drive_file_id, signers, signed_at, opportunity_id, related_offer_id, related_project_id, intake_item_id, uploaded_by_client, updated_at',
        )
        .eq('account_id', accountId)
        .order('updated_at', { ascending: false }),
      supabase
        .from('portal_invoices')
        .select(
          'id, account_id, project_id, milestone_id, number, description, amount, currency, due_date, due_label, status, issued_at, paid_at, invoice_url, position',
        )
        .eq('account_id', accountId)
        .order('position'),
      supabase
        .from('portal_projects')
        .select(
          'id, account_id, opportunity_id, name, summary, health, status, start_date, target_date, published, created_at',
        )
        .eq('account_id', accountId)
        .order('created_at', { ascending: false }),
      supabase
        .from('portal_feedback')
        .select(
          'id, account_id, project_id, about_user_id, submitted_by, rating, comment, context, is_urgent, status, response, responded_at, created_at, about:portal_users!portal_feedback_about_user_id_fkey(id, full_name)',
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
          'id, account_id, name, description, owner_side, status, due_date, position, client_note, review_note, submitted_at, reviewed_at',
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
          'id, account_id, user_id, title, cv_url, hourly_rate, status, client_note, decided_at, decided_by, created_at, updated_at, user:portal_users!portal_candidates_user_id_fkey(id, full_name, title, email, photo_url)',
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
        .select('id, project_id, name, description, due_date, status, percent_complete, position, approved_at')
        .in('project_id', projectIds)
        .order('position'),
      supabase
        .from('portal_project_team')
        .select(
          'id, project_id, user_id, project_role, assigned_at, active, is_public, user:portal_users!portal_project_team_user_id_fkey(id, full_name, title, email, calendly_url, photo_url)',
        )
        .in('project_id', projectIds)
        .eq('active', true)
        .eq('is_public', true),
      supabase
        .from('portal_time_entries')
        .select(
          'id, project_id, milestone_id, user_id, entry_date, hours, description, billable, visible_to_client, user:portal_users!portal_time_entries_user_id_fkey(id, full_name)',
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
    meetings: z.array(MeetingSchema).parse(meetings.data ?? []),
    documents: z.array(DocumentSchema).parse(documents.data ?? []),
    invoices: z.array(InvoiceSchema).parse(invoices.data ?? []),
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
  const projects = snapshot.projects
    .filter((bundle) => bundle.project.published)
    .map((bundle) => ({
      ...bundle,
      timeEntries: bundle.timeEntries.filter((entry) => entry.visible_to_client),
    }));
  const first = projects[0];

  return {
    ...snapshot,
    account: { ...snapshot.account, internal_notes: '' },
    offers,
    documents,
    resources,
    activity,
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

export async function requestMeeting(input: {
  title: string;
  meetingType: MeetingType;
  startsAt: string;
  durationMinutes: number;
}): Promise<void> {
  const { error } = await getSupabase().rpc('portal_request_meeting', {
    p_title: input.title,
    p_meeting_type: input.meetingType,
    p_starts_at: input.startsAt,
    p_duration_minutes: input.durationMinutes,
  });
  if (error) throw new Error(error.message);
}

export async function cancelMeeting(meetingId: string): Promise<void> {
  const { error } = await getSupabase().rpc('portal_cancel_meeting', { p_meeting: meetingId });
  if (error) throw new Error(error.message);
}

export async function approveMilestone(milestoneId: string): Promise<void> {
  const { error } = await getSupabase().rpc('portal_approve_milestone', { p_milestone: milestoneId });
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
  context?: string | null;
}): Promise<void> {
  const { error } = await getSupabase().rpc('portal_submit_feedback', {
    p_rating: input.rating,
    p_comment: input.comment,
    p_about_user: input.aboutUserId,
    p_is_urgent: input.isUrgent,
    p_context: input.context ?? null,
  });
  if (error) throw new Error(error.message);
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
  options?: { intakeItemId?: string; folderKey?: string },
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
