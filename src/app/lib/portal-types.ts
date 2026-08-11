import { z } from 'zod';

// Numeric columns come back from PostgREST as strings; normalise them once here.
const numeric = z.union([z.number(), z.string()]).transform((value) => Number(value));
// Same, but keeps SQL NULL as null instead of coercing it to 0.
const numericNullable = z.union([z.number(), z.string()]).transform((value) => Number(value)).nullable();

export const PortalRoleSchema = z.enum([
  'prospect',
  'client_admin',
  'client_collaborator',
  'sales_rep',
  'delivery_lead',
  'ops_finance',
  'implementor',
  'portal_admin',
]);
export type PortalRole = z.infer<typeof PortalRoleSchema>;

export const INTERNAL_ROLES: PortalRole[] = [
  'sales_rep',
  'delivery_lead',
  'ops_finance',
  'implementor',
  'portal_admin',
];
export const CLIENT_ROLES: PortalRole[] = ['prospect', 'client_admin', 'client_collaborator'];

// Implementers are staff, but account-scoped and with no finance access (migration 0009). Use
// this where a role gate means "trusted with every account / with finance", not just "employee".
export function isFinanceRestrictedRole(role: PortalRole): boolean {
  return role === 'implementor';
}

// The delivery-only Implementer role. A single named predicate for the many UI gates that hide
// content/products/pipeline management, account admin and worklog approval from this role.
export function isImplementer(role: PortalRole): boolean {
  return role === 'implementor';
}

// Who may approve worklogs (sign off logged hours). Implementers can log and edit their own
// unapproved hours but never approve — every other internal role can. Mirrors the delivery gate.
export function canApproveWorklogs(role: PortalRole): boolean {
  return role !== 'implementor';
}

// Finance/payments visibility (migration 0010). Internally only Sales Rep, Ops/Finance and
// Portal Admin see payments; client_admin sees their own account's. Mirrors the SQL rule in
// portal_can_view_module so the UI hides what RLS would return empty anyway.
export function canViewPayments(role: PortalRole): boolean {
  return role === 'client_admin' || role === 'sales_rep' || role === 'ops_finance' || role === 'portal_admin';
}

// Implementers are a limited delivery role (migration 0025): no pipeline (opportunities/offers),
// no finance, and they can't edit account settings. Mirrors the SQL rules so the admin UI hides
// what RLS would otherwise reject or return empty.
export function canViewPipeline(role: PortalRole): boolean {
  return role !== 'implementor';
}
export function canEditAccounts(role: PortalRole): boolean {
  return role !== 'implementor';
}

export const ROLE_LABELS: Record<PortalRole, string> = {
  prospect: 'Prospect',
  client_admin: 'Client Admin',
  client_collaborator: 'Client Collaborator',
  sales_rep: 'Sales Rep',
  delivery_lead: 'Delivery Lead',
  ops_finance: 'Ops / Finance Admin',
  implementor: 'Implementer',
  portal_admin: 'Portal Admin',
};

export function isInternalRole(role: PortalRole): boolean {
  return INTERNAL_ROLES.includes(role);
}

// Who may edit the Sales Process Settings defaults: Portal Admin, Sales Rep, Delivery Lead and
// Ops/Finance — every internal role except Implementer. Mirrors the SQL portal_is_internal()
// predicate (which, unlike TS INTERNAL_ROLES, already excludes implementer) that gates the writes.
export function canManageSalesSettings(role: PortalRole): boolean {
  return isInternalRole(role) && role !== 'implementor';
}

export const PORTAL_MODULES = [
  'pipeline',
  'calls',
  'documents',
  'payments',
  'project',
  'feedback',
] as const;
export type PortalModule = (typeof PORTAL_MODULES)[number];

export const MODULE_LABELS: Record<PortalModule, string> = {
  pipeline: 'Pipeline & Offers',
  calls: 'Calls & Meetings',
  documents: 'Contracts & Documents',
  payments: 'Payments & Invoicing',
  project: 'Project Tracker',
  feedback: 'Team Feedback',
};

export const PortalUserSchema = z.object({
  id: z.guid(),
  auth_user_id: z.guid().nullable(),
  email: z.string(),
  full_name: z.string(),
  role: PortalRoleSchema,
  account_id: z.guid().nullable(),
  module_access: z.array(z.string()),
  title: z.string().nullable(),
  // 'disabled' is a legacy value migrated to 'inactive' in 0011; kept here only so old rows parse.
  status: z.enum(['inactive', 'invited', 'active', 'disabled']),
  last_login_at: z.string().nullable(),
  calendly_url: z.string().nullable().optional(),
  photo_url: z.string().nullable().optional(),
  // Finance (0044): an internal employee's default hourly cost rate + currency. Admin-only; seeds the
  // pay rate on offer lines and project team members.
  pay_rate: numericNullable.optional().default(null),
  pay_currency: z.string().optional().default('USD'),
  // Teams (0047): the internal employee's team, or null when unassigned. Admin-managed; never sent to
  // the client snapshot.
  team_id: z.guid().nullable().optional().default(null),
  // Overhead (0055): does this person count toward the company's overhead headcount (the divisor and
  // the per-seat multiplier)? Admin-managed; only meaningful for internal staff.
  counts_for_overhead: z.boolean().optional().default(true),
  created_at: z.string(),
});
export type PortalUser = z.infer<typeof PortalUserSchema>;

// A team of internal staff (migration 0047) with an optional lead + project manager. Members are
// portal_users whose team_id points here; lead/pm are references only (need not be members).
export const PortalTeamSchema = z.object({
  id: z.guid(),
  name: z.string(),
  lead_id: z.guid().nullable(),
  pm_id: z.guid().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  lead: z.object({ id: z.guid(), full_name: z.string() }).nullable().optional(),
  pm: z.object({ id: z.guid(), full_name: z.string() }).nullable().optional(),
});
export type PortalTeam = z.infer<typeof PortalTeamSchema>;

// Company overhead (migration 0055) — a fixed running cost used to derive the per-hour markup that
// covers the company. Multi-currency: base = amount × fx_rate. one_off costs spread over amortize_months;
// per_seat costs are multiplied by the counted headcount.
export const OVERHEAD_CADENCES = ['monthly', 'quarterly', 'annual', 'one_off'] as const;
export type OverheadCadence = (typeof OVERHEAD_CADENCES)[number];
export const OVERHEAD_CADENCE_LABELS: Record<OverheadCadence, string> = {
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  annual: 'Annual',
  one_off: 'One-off',
};
// How many months each cadence spans — the divisor that normalises a cost to a monthly figure.
// one_off is special (it uses the row's amortize_months) and is intentionally absent here.
export const OVERHEAD_CADENCE_MONTHS: Record<Exclude<OverheadCadence, 'one_off'>, number> = {
  monthly: 1,
  quarterly: 3,
  annual: 12,
};

export const OVERHEAD_SCOPES = ['company', 'per_seat'] as const;
export type OverheadScope = (typeof OVERHEAD_SCOPES)[number];
export const OVERHEAD_SCOPE_LABELS: Record<OverheadScope, string> = {
  company: 'Whole company',
  per_seat: 'Per person',
};

export const OverheadExpenseSchema = z.object({
  id: z.guid(),
  name: z.string(),
  category: z.string().nullable(),
  note: z.string().nullable(),
  amount: numeric,
  currency: z.string(),
  fx_rate: numeric,
  cadence: z.enum(OVERHEAD_CADENCES),
  amortize_months: z.union([z.number(), z.string()]).transform((value) => Number(value)).nullable(),
  scope: z.enum(OVERHEAD_SCOPES),
  active: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type OverheadExpense = z.infer<typeof OverheadExpenseSchema>;

// Singleton finance settings (migration 0055): base reporting currency + the monthly billable-hours
// band the per-hour markup is derived against.
export const FinanceSettingsSchema = z.object({
  base_currency: z.string(),
  overhead_hours_low: numeric,
  overhead_hours_high: numeric,
});
export type FinanceSettings = z.infer<typeof FinanceSettingsSchema>;

// Normalise one expense to a monthly figure in the BASE currency. per_seat costs scale with the number
// of SEATS — i.e. everyone who consumes a license (all active staff), NOT only the ones who cover
// overhead. one_off costs are spread over amortize_months (falling back to 1). Inactive rows are the
// caller's concern to filter — this is a pure per-row calc.
export function overheadMonthlyBase(expense: OverheadExpense, seatCount: number): number {
  const base = expense.amount * expense.fx_rate;
  const months =
    expense.cadence === 'one_off'
      ? Math.max(expense.amortize_months ?? 1, 1)
      : OVERHEAD_CADENCE_MONTHS[expense.cadence];
  const monthly = base / months;
  return expense.scope === 'per_seat' ? monthly * seatCount : monthly;
}

// The manually settable statuses. 'inactive' = no portal access (default); 'invited' provisions an
// auth user and emails an invite (handled server-side); 'active' = signed-in, full access.
export type UserStatus = 'inactive' | 'invited' | 'active';
export const USER_STATUSES: UserStatus[] = ['inactive', 'invited', 'active'];
export const USER_STATUS_LABELS: Record<string, string> = {
  inactive: 'Inactive',
  invited: 'Invited',
  active: 'Active',
  disabled: 'Inactive',
};

export const LIFECYCLE_STAGES = [
  'lead',
  'qualified',
  'proposal_sent',
  'live',
  'stopped',
  'lost',
] as const;
export type Lifecycle = (typeof LIFECYCLE_STAGES)[number];

export const LIFECYCLE_LABELS: Record<Lifecycle, string> = {
  lead: 'Lead',
  qualified: 'Qualified',
  proposal_sent: 'Proposal Sent',
  live: 'Live',
  stopped: 'Stopped',
  lost: 'Lost',
};

export const HealthSchema = z.enum(['on_track', 'at_risk', 'delayed']);
export type Health = z.infer<typeof HealthSchema>;

export const HEALTH_LABELS: Record<Health, string> = {
  on_track: 'On Track',
  at_risk: 'At Risk',
  delayed: 'Delayed',
};

// Client-facing project lifecycle statuses and their display labels.
export type ProjectStatus = 'planned' | 'active' | 'on_hold' | 'complete';
export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  planned: 'Planned',
  active: 'Active',
  on_hold: 'On hold',
  complete: 'Complete',
};
// Tone for a project status badge: violet in flight, green done, amber paused, grey not started.
export const projectStatusTone = (status: ProjectStatus): 'violet' | 'green' | 'amber' | 'grey' => {
  switch (status) {
    case 'complete':
      return 'green';
    case 'on_hold':
      return 'amber';
    case 'active':
      return 'violet';
    default:
      return 'grey';
  }
};

// Project Type (migration 0035): set on the opportunity, carried onto its project. Nullable means
// "not picked yet". Only the Support type hides the milestone tracker.
export const PROJECT_TYPES = ['support', 'health_check', 'implementation'] as const;
export type ProjectType = (typeof PROJECT_TYPES)[number];

export const PROJECT_TYPE_LABELS: Record<ProjectType, string> = {
  support: 'Support',
  health_check: 'Health Check',
  implementation: 'Implementation',
};

// Milestones apply to every type except Support (a blank/not-yet-picked type keeps them).
export function projectUsesMilestones(type: ProjectType | null | undefined): boolean {
  return type !== 'support';
}

// Where an account came from. Picklist is UI-enforced (stored as free text), so options can be
// edited here without a migration.
export const ACCOUNT_SOURCES = [
  'Website',
  'Partner',
  'Internal Sales Team',
  'External Sales Team',
  'Event',
  'LinkedIn',
  'Other',
] as const;

export const PortalAccountSchema = z.object({
  id: z.guid(),
  name: z.string(),
  logo_url: z.string().nullable().optional(),
  source: z.string().nullable().optional(),
  source_subtype: z.string().nullable().optional(),
  industry: z.string().nullable(),
  lifecycle: z.enum(LIFECYCLE_STAGES),
  health: HealthSchema,
  owner_id: z.guid().nullable(),
  internal_notes: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  drive_folder_id: z.string().nullable().optional(),
  drive_web_link: z.string().nullable().optional(),
  drive_folders: z.record(z.string(), z.string()).catch({}).optional(),
  owner: z
    .object({
      id: z.guid(),
      full_name: z.string(),
      title: z.string().nullable(),
      email: z.string().optional(),
      calendly_url: z.string().nullable().optional(),
      photo_url: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
});
export type PortalAccount = z.infer<typeof PortalAccountSchema>;

// Client-facing stage labels, kept separate from the internal opportunity stage names
// (design doc §6.2).
export const OPPORTUNITY_STAGES = [
  'discovery',
  'solutioning',
  'proposal',
  'negotiation',
  'closed_won',
] as const;
export type OpportunityStage = (typeof OPPORTUNITY_STAGES)[number] | 'closed_lost';

export const STAGE_LABELS: Record<string, string> = {
  discovery: 'Discovery',
  solutioning: 'Solutioning',
  proposal: 'Proposal',
  negotiation: 'Negotiation',
  closed_won: 'Closed Won',
  closed_lost: 'Closed Lost',
};

export const OpportunitySchema = z.object({
  id: z.guid(),
  account_id: z.guid(),
  name: z.string(),
  stage: z.enum([...OPPORTUNITY_STAGES, 'closed_lost']),
  amount: numeric.nullable(),
  close_date: z.string().nullable(),
  // Optional hours budget carried onto this deal's offers and project (migration 0034).
  bank_hours: numericNullable.optional().default(null),
  notify_hours: numericNullable.optional().default(null),
  // Project Type carried onto the project on Closed Won / manual creation (migration 0035).
  project_type: z.enum(PROJECT_TYPES).nullable().optional().default(null),
  updated_at: z.string(),
  intake_published: z.boolean().optional(),
  drive_folder_id: z.string().nullable().optional(),
  drive_web_link: z.string().nullable().optional(),
  drive_folders: z.record(z.string(), z.string()).catch({}).optional(),
});
export type Opportunity = z.infer<typeof OpportunitySchema>;

export const OfferStatusSchema = z.enum([
  'draft',
  'sent',
  'accepted',
  'changes_requested',
  'expired',
  'superseded',
]);
export type OfferStatus = z.infer<typeof OfferStatusSchema>;

export const OFFER_STATUS_LABELS: Record<OfferStatus, string> = {
  draft: 'Draft',
  sent: 'Awaiting your response',
  accepted: 'Accepted',
  changes_requested: 'Changes requested',
  expired: 'Expired',
  superseded: 'Superseded',
};

export const OfferBillingTypeSchema = z.enum(['fixed_price', 'time_materials']);
export type OfferBillingType = z.infer<typeof OfferBillingTypeSchema>;

export const OFFER_BILLING_LABELS: Record<OfferBillingType, string> = {
  fixed_price: 'Fixed price',
  time_materials: 'Time & materials',
};

export const OfferItemSchema = z.object({
  id: z.guid(),
  offer_id: z.guid(),
  position: z.number(),
  name: z.string(),
  detail: z.string(),
  // Fixed-price line: the fixed sum charged per month for `monthly_hours` hours.
  // Time & materials line: the quoted hourly rate (T&M lines are purely hourly).
  amount: numeric,
  billing_type: OfferBillingTypeSchema.default('time_materials'),
  overtime_rate: numericNullable.optional().default(null),
  // Fixed-price only: hours per month covered by the fixed sum. The effective hourly rate is
  // derived (amount / monthly_hours) wherever it is displayed.
  monthly_hours: numericNullable.optional().default(null),
  // Finance (0044): the internal employee this line staffs and its pay/cost rate. Admin-only; the pay
  // rate defaults from the employee but is editable per offer, and both seed the project team member.
  employee_id: z.guid().nullable().optional().default(null),
  pay_rate: numericNullable.optional().default(null),
});
export type OfferItem = z.infer<typeof OfferItemSchema>;

export const OfferSchema = z.object({
  id: z.guid(),
  account_id: z.guid(),
  opportunity_id: z.guid().nullable(),
  version: z.number(),
  title: z.string(),
  summary: z.string(),
  status: OfferStatusSchema,
  total: numeric,
  currency: z.string(),
  expires_on: z.string().nullable(),
  pdf_url: z.string().nullable(),
  change_note: z.string().nullable(),
  client_note: z.string().nullable(),
  sent_at: z.string().nullable(),
  responded_at: z.string().nullable(),
  created_at: z.string(),
  // Hours budget prefilled from the opportunity, still editable per offer version (migration 0034).
  bank_hours: numericNullable.optional().default(null),
  notify_hours: numericNullable.optional().default(null),
  items: z.array(OfferItemSchema).optional().default([]),
});
export type Offer = z.infer<typeof OfferSchema>;

export const DOC_TYPES = [
  'contract',
  'msa',
  'sow',
  'nda',
  'proposal',
  'invoice',
  'deliverable',
  'reference',
  'other',
] as const;
export type DocType = (typeof DOC_TYPES)[number];

export const DOC_TYPE_LABELS: Record<DocType, string> = {
  contract: 'Contract',
  msa: 'MSA',
  sow: 'SOW',
  nda: 'NDA',
  proposal: 'Proposal',
  invoice: 'Invoice',
  deliverable: 'Deliverable',
  reference: 'Reference',
  other: 'Other',
};

export const DOC_STATUSES = [
  'draft',
  'not_sent',
  'sent',
  'awaiting_signature',
  'signed',
  'acknowledged',
  'superseded',
] as const;
export type DocStatus = (typeof DOC_STATUSES)[number];

export const DOC_STATUS_LABELS: Record<DocStatus, string> = {
  draft: 'Draft',
  not_sent: 'Not yet sent',
  sent: 'Sent',
  awaiting_signature: 'Signature required',
  signed: 'Signed',
  acknowledged: 'Received',
  superseded: 'Superseded',
};

export const DocumentSchema = z.object({
  id: z.guid(),
  account_id: z.guid(),
  name: z.string(),
  doc_type: z.enum(DOC_TYPES),
  status: z.enum(DOC_STATUSES),
  version: z.number(),
  file_url: z.string().nullable(),
  drive_web_link: z.string().nullable().optional(),
  drive_file_id: z.string().nullable().optional(),
  signers: z
    .array(z.object({ name: z.string(), email: z.string().optional(), signed: z.boolean().optional() }))
    .catch([]),
  signed_at: z.string().nullable(),
  opportunity_id: z.guid().nullable().optional(),
  related_offer_id: z.guid().nullable(),
  related_project_id: z.guid().nullable(),
  intake_item_id: z.guid().nullable().optional(),
  uploaded_by_client: z.boolean(),
  updated_at: z.string(),
});
export type PortalDocument = z.infer<typeof DocumentSchema>;

// A candidate is one of Klepka's own staff (a portal_users row) proposed to work an account, with
// a position title, CV link and optional hourly rate. Reviewed independently of the staffed team:
// 'proposed' → the client hasn't decided; 'confirmed'/'declined' are their call.
export const CANDIDATE_STATUSES = ['proposed', 'confirmed', 'declined'] as const;
export type CandidateStatus = (typeof CANDIDATE_STATUSES)[number];

export const CANDIDATE_STATUS_LABELS: Record<CandidateStatus, string> = {
  proposed: 'Awaiting your review',
  confirmed: 'Confirmed',
  declined: 'Declined',
};

export const CandidateSchema = z.object({
  id: z.guid(),
  account_id: z.guid(),
  opportunity_id: z.guid(),
  user_id: z.guid(),
  title: z.string().nullable(),
  cv_url: z.string().nullable(),
  hourly_rate: numeric.nullable(),
  status: z.enum(CANDIDATE_STATUSES),
  client_note: z.string().nullable(),
  decided_at: z.string().nullable(),
  decided_by: z.guid().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  user: z
    .object({
      id: z.guid(),
      full_name: z.string(),
      title: z.string().nullable(),
      email: z.string(),
      calendly_url: z.string().nullable().optional(),
      photo_url: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
});
export type Candidate = z.infer<typeof CandidateSchema>;

export const MILESTONE_STATUSES = [
  'not_started',
  'in_progress',
  'complete',
  'approved',
  'delayed',
] as const;
export type MilestoneStatus = (typeof MILESTONE_STATUSES)[number];

export const MILESTONE_STATUS_LABELS: Record<MilestoneStatus, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  complete: 'Awaiting your approval',
  approved: 'Approved',
  delayed: 'Delayed',
};

export const MilestoneSchema = z.object({
  id: z.guid(),
  project_id: z.guid(),
  name: z.string(),
  description: z.string(),
  start_date: z.string().nullable(),
  due_date: z.string().nullable(),
  status: z.enum(MILESTONE_STATUSES),
  percent_complete: z.number(),
  position: z.number(),
  approved_at: z.string().nullable(),
});
export type Milestone = z.infer<typeof MilestoneSchema>;

export const ProjectTeamMemberSchema = z.object({
  id: z.guid(),
  project_id: z.guid(),
  // Nullable since 0035: offer-derived roster rows carry a display_name instead of a linked user.
  user_id: z.guid().nullable(),
  display_name: z.string().nullable().optional(),
  project_role: z.string(),
  assigned_at: z.string(),
  active: z.boolean(),
  is_public: z.boolean().optional(),
  // Billing carried from the seeding offer line item (migration 0036). Admin-only — the client
  // roster never selects these, so they stay undefined on the client snapshot.
  billing_type: OfferBillingTypeSchema.nullable().optional().default(null),
  rate: numericNullable.optional().default(null),
  overtime_rate: numericNullable.optional().default(null),
  monthly_hours: numericNullable.optional().default(null),
  // Finance (0044): the internal pay/cost rate for this member — the source of truth salary reads.
  // Admin-only, like the billing columns above.
  pay_rate: numericNullable.optional().default(null),
  user: z
    .object({
      id: z.guid(),
      full_name: z.string(),
      title: z.string().nullable(),
      email: z.string(),
      calendly_url: z.string().nullable().optional(),
      photo_url: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
});
export type ProjectTeamMember = z.infer<typeof ProjectTeamMemberSchema>;

export const AccountTeamMemberSchema = z.object({
  id: z.guid(),
  account_id: z.guid(),
  user_id: z.guid(),
  team_role: z.string(),
  active: z.boolean(),
  is_public: z.boolean().optional(),
  added_at: z.string(),
  user: z
    .object({
      id: z.guid(),
      full_name: z.string(),
      title: z.string().nullable(),
      email: z.string(),
      calendly_url: z.string().nullable().optional(),
      photo_url: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
});
export type AccountTeamMember = z.infer<typeof AccountTeamMemberSchema>;

// A shared public-holiday entry (migration 0042). Global — not tied to an account.
export const PublicHolidaySchema = z.object({
  id: z.guid(),
  name: z.string(),
  holiday_date: z.string(),
  description: z.string(),
  country: z.string().nullable().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});
export type PublicHoliday = z.infer<typeof PublicHolidaySchema>;

// Employee time off (migration 0058). `kind` = vacation / sick leave; `status` is Klepka's INTERNAL
// sign-off (distinct from the client's per-account acknowledgement).
export const TIME_OFF_KINDS = ['vacation', 'sick'] as const;
export type TimeOffKind = (typeof TIME_OFF_KINDS)[number];
export const TIME_OFF_STATUSES = ['pending', 'approved', 'rejected'] as const;
export type TimeOffStatus = (typeof TIME_OFF_STATUSES)[number];

export const TimeOffSchema = z.object({
  id: z.guid(),
  user_id: z.guid(),
  kind: z.enum(TIME_OFF_KINDS),
  start_date: z.string(),
  end_date: z.string(),
  note: z.string(),
  status: z.enum(TIME_OFF_STATUSES),
  reviewed_by: z.guid().nullable().optional(),
  reviewed_at: z.string().nullable().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  // Embedded employee, for the admin list (own list omits it).
  user: z.object({ id: z.guid(), full_name: z.string() }).nullable().optional(),
});
export type TimeOff = z.infer<typeof TimeOffSchema>;

// One client's response to a leave (per account) — shown as badges on the admin Time Off page.
export const TimeOffResponseSchema = z.object({
  id: z.guid(),
  time_off_id: z.guid(),
  account_id: z.guid(),
  approved: z.boolean(),
  replacement_requested: z.boolean(),
  approved_at: z.string().nullable().optional(),
  replacement_requested_at: z.string().nullable().optional(),
});
export type TimeOffResponse = z.infer<typeof TimeOffResponseSchema>;

// A row of the client-facing team-availability feed (RPC portal_my_team_time_off). One row per
// (leave, shared project): the client confirms and requests a replacement per project (migration 0060).
export const TeamTimeOffSchema = z.object({
  id: z.guid(),
  project_id: z.guid(),
  project_name: z.string(),
  user_id: z.guid(),
  full_name: z.string(),
  kind: z.enum(TIME_OFF_KINDS),
  start_date: z.string(),
  end_date: z.string(),
  note: z.string(),
  days: z.number(),
  approved: z.boolean(),
  replacement_requested: z.boolean(),
});
export type TeamTimeOff = z.infer<typeof TeamTimeOffSchema>;

// A pending leave the signed-in staffer may approve (RPC portal_time_off_review_queue, 0060) — admins
// see everyone's, a team lead only their team's members'.
export const TimeOffReviewSchema = z.object({
  id: z.guid(),
  user_id: z.guid(),
  full_name: z.string(),
  team_name: z.string().nullable(),
  kind: z.enum(TIME_OFF_KINDS),
  start_date: z.string(),
  end_date: z.string(),
  note: z.string(),
  days: z.number(),
  status: z.enum(TIME_OFF_STATUSES),
});
export type TimeOffReview = z.infer<typeof TimeOffReviewSchema>;

// A client's replacement request for a leave, pinned to the exact project + client that asked (RPC
// portal_time_off_replacement_requests, 0060). Scoped to admin (all) / team lead (their team).
export const TimeOffReplacementSchema = z.object({
  id: z.guid(),
  user_id: z.guid(),
  full_name: z.string(),
  kind: z.enum(TIME_OFF_KINDS),
  start_date: z.string(),
  end_date: z.string(),
  days: z.number(),
  project_id: z.guid(),
  project_name: z.string(),
  account_id: z.guid(),
  account_name: z.string(),
  approved: z.boolean(),
  replacement_requested_at: z.string().nullable().optional(),
});
export type TimeOffReplacement = z.infer<typeof TimeOffReplacementSchema>;

// A row of the internal, staff-facing upcoming-leave feed (RPC portal_my_team_upcoming_time_off,
// migration 0059): my own leave (pending/approved) plus my teammates' approved leave. `is_me`
// distinguishes the two; a colleague's `note` is withheld server-side.
export const MyTeamTimeOffSchema = z.object({
  id: z.guid(),
  user_id: z.guid(),
  full_name: z.string(),
  kind: z.enum(TIME_OFF_KINDS),
  start_date: z.string(),
  end_date: z.string(),
  note: z.string(),
  days: z.number(),
  status: z.enum(TIME_OFF_STATUSES),
  is_me: z.boolean(),
});
export type MyTeamTimeOff = z.infer<typeof MyTeamTimeOffSchema>;

export const ProjectSchema = z.object({
  id: z.guid(),
  account_id: z.guid(),
  opportunity_id: z.guid().nullable(),
  name: z.string(),
  summary: z.string(),
  health: HealthSchema,
  status: z.enum(['planned', 'active', 'on_hold', 'complete']),
  start_date: z.string().nullable(),
  target_date: z.string().nullable(),
  published: z.boolean(),
  created_at: z.string(),
  // Hours budget carried from the opportunity, still editable per project (migration 0034).
  bank_hours: numericNullable.optional().default(null),
  notify_hours: numericNullable.optional().default(null),
  // Project Type (migration 0035); Support hides the milestone tracker.
  project_type: z.enum(PROJECT_TYPES).nullable().optional().default(null),
  drive_folder_id: z.string().nullable().optional(),
  drive_web_link: z.string().nullable().optional(),
  drive_folders: z.record(z.string(), z.string()).catch({}).optional(),
});
export type Project = z.infer<typeof ProjectSchema>;

export const FeedbackSchema = z.object({
  id: z.guid(),
  account_id: z.guid(),
  project_id: z.guid().nullable(),
  about_user_id: z.guid().nullable(),
  submitted_by: z.guid().nullable(),
  rating: z.number(),
  comment: z.string(),
  context: z.string().nullable(),
  is_urgent: z.boolean(),
  // Client consented to share publicly; only visible to other clients once staff approve it.
  is_public: z.boolean().optional().default(false),
  public_approved_at: z.string().nullable().optional(),
  status: z.enum(['new', 'acknowledged', 'resolved']),
  response: z.string().nullable(),
  responded_at: z.string().nullable(),
  created_at: z.string(),
  about: z.object({ id: z.guid(), full_name: z.string() }).nullable().optional(),
  submitter: z.object({ id: z.guid(), full_name: z.string() }).nullable().optional(),
  account: z.object({ id: z.guid(), name: z.string() }).nullable().optional(),
});
export type Feedback = z.infer<typeof FeedbackSchema>;

// Per-staff aggregate rating (portal_staff_feedback_summary) — average over all their feedback.
export const StaffRatingSchema = z.object({
  user_id: z.guid(),
  avg_rating: z.union([z.number(), z.string()]).transform((value) => Number(value)),
  rating_count: z.union([z.number(), z.string()]).transform((value) => Number(value)),
});
export type StaffRating = z.infer<typeof StaffRatingSchema>;

// An approved, anonymised public review about a staff member (portal_staff_public_reviews).
export const PublicReviewSchema = z.object({
  id: z.guid(),
  about_user_id: z.guid(),
  rating: z.number(),
  comment: z.string(),
  created_at: z.string(),
});
export type PublicReview = z.infer<typeof PublicReviewSchema>;

// A catalog product. Client-created products are 'pending' until a staffer approves them.
export const PRODUCT_STATUSES = ['pending', 'approved'] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

// One document (URL) carried by a product; each follows the product onto a client's Materials when
// the product is tagged (migration 0037 — several per product; 0028 allowed only one).
export const ProductDocumentSchema = z.object({
  name: z.string().nullable().optional(),
  url: z.string(),
});
export type ProductDocument = z.infer<typeof ProductDocumentSchema>;

export const ProductSchema = z.object({
  id: z.guid(),
  name: z.string(),
  description: z.string().nullable().optional(),
  status: z.enum(PRODUCT_STATUSES),
  // Documents that follow this product onto a client's Materials when it's tagged (0037). Rows that
  // don't request the column parse to [] via .catch.
  documents: z.array(ProductDocumentSchema).catch([]).optional().default([]),
  // Legacy single-document columns (0028), superseded by `documents`; kept so old queries still parse.
  document_url: z.string().nullable().optional(),
  document_name: z.string().nullable().optional(),
  created_by: z.guid().nullable().optional(),
  created_at: z.string().optional(),
});
export type Product = z.infer<typeof ProductSchema>;

// The three record types that carry products; staff skills use their own admin-only path.
export type ProductEntity = 'account' | 'opportunity' | 'project';

export const ACTIVITY_CATEGORIES = [
  'pipeline',
  'calls',
  'documents',
  'payments',
  'project',
  'feedback',
  'account',
] as const;
export type ActivityCategory = (typeof ACTIVITY_CATEGORIES)[number];

export const ActivitySchema = z.object({
  id: z.guid(),
  account_id: z.guid(),
  category: z.enum(ACTIVITY_CATEGORIES),
  title: z.string(),
  detail: z.string(),
  link: z.string().nullable(),
  client_visible: z.boolean(),
  read_by: z.array(z.string()),
  created_at: z.string(),
});
export type Activity = z.infer<typeof ActivitySchema>;

export const FeedbackTargetSchema = z.object({
  user_id: z.guid(),
  full_name: z.string(),
  project_role: z.string().nullable(),
});
export type FeedbackTarget = z.infer<typeof FeedbackTargetSchema>;

export const RESOURCE_KINDS = ['presentation', 'document', 'video', 'link', 'article'] as const;
export type ResourceKind = (typeof RESOURCE_KINDS)[number];

export const RESOURCE_KIND_LABELS: Record<ResourceKind, string> = {
  presentation: 'Presentation',
  document: 'Document',
  video: 'Video',
  link: 'Link',
  article: 'Article',
};

export const ResourceSchema = z.object({
  id: z.guid(),
  account_id: z.guid().nullable(),
  title: z.string(),
  description: z.string(),
  kind: z.enum(RESOURCE_KINDS),
  url: z.string().nullable(),
  file_path: z.string().nullable(),
  article_id: z.guid().nullable(),
  phase: z.enum(['onboarding', 'discovery', 'proposal', 'delivery', 'any']),
  position: z.number(),
  published: z.boolean(),
  // Set when this material was copied from a Sales-Process-Settings template (migration 0028).
  template_id: z.guid().nullable().optional(),
  article: z
    .object({ id: z.guid(), title: z.string(), slug: z.string(), excerpt: z.string() })
    .nullable()
    .optional(),
});
export type PortalResource = z.infer<typeof ResourceSchema>;

export const INTAKE_STATUSES = [
  'not_started',
  'in_progress',
  'submitted',
  'in_review',
  'approved',
  'blocked',
] as const;
export type IntakeStatus = (typeof INTAKE_STATUSES)[number];

export const INTAKE_STATUS_LABELS: Record<IntakeStatus, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  submitted: 'Submitted',
  in_review: 'In review',
  approved: 'Approved',
  blocked: 'Blocked',
};

export const IntakeItemSchema = z.object({
  id: z.guid(),
  account_id: z.guid(),
  opportunity_id: z.guid(),
  name: z.string(),
  description: z.string(),
  owner_side: z.enum(['client', 'klepka']),
  status: z.enum(INTAKE_STATUSES),
  due_date: z.string().nullable(),
  position: z.number(),
  client_note: z.string().nullable(),
  review_note: z.string().nullable(),
  submitted_at: z.string().nullable(),
  reviewed_at: z.string().nullable(),
});
export type IntakeItem = z.infer<typeof IntakeItemSchema>;

// --- Sales Process Settings templates (migration 0028) --------------------------------------

// A reusable onboarding-material template — copied into every new account's Materials on creation.
export const MaterialTemplateSchema = z.object({
  id: z.guid(),
  title: z.string(),
  description: z.string(),
  kind: z.enum(RESOURCE_KINDS),
  url: z.string().nullable(),
  file_path: z.string().nullable(),
  article_id: z.guid().nullable(),
  phase: z.enum(['onboarding', 'discovery', 'proposal', 'delivery', 'any']),
  position: z.number(),
});
export type MaterialTemplate = z.infer<typeof MaterialTemplateSchema>;

// A standard gathering-checklist item, copied into an opportunity's intake on demand.
export const IntakeTemplateSchema = z.object({
  id: z.guid(),
  name: z.string(),
  description: z.string(),
  owner_side: z.enum(['client', 'klepka']),
  position: z.number(),
});
export type IntakeTemplate = z.infer<typeof IntakeTemplateSchema>;

export const TimeEntrySchema = z.object({
  id: z.guid(),
  project_id: z.guid(),
  milestone_id: z.guid().nullable(),
  // Optional because the client snapshot deliberately omits the internal employee — it selects only
  // the reporter (aliased to `user`). The admin snapshot always includes it.
  user_id: z.guid().nullable().optional(),
  // Client-facing "reporter" — who the client sees credited with the work, which may differ from
  // the internal employee (`user_id`) who actually did it (migration 0041). Defaults to the employee.
  reporter_id: z.guid().nullable().optional().default(null),
  entry_date: z.string(),
  // `hours` is the billed figure the client budget draws down — optional since 0045, where a blank
  // marks non-billable work (actual hours only). `actual_hours` is what was worked (migration 0038).
  // `approved` is a manager sign-off (admin-only), and also gates client visibility since 0045.
  hours: numericNullable.optional().default(null),
  actual_hours: numericNullable.optional().default(null),
  approved: z.boolean().optional().default(false),
  // Finance (0044): the pay/cost rate frozen onto this worklog at log time. Salary sums it, so a later
  // rate change never rewrites already-logged pay. Admin-only.
  pay_rate: numericNullable.optional().default(null),
  description: z.string(),
  // Derived, non-computational analytics marker (0045): true when the log has billable hours.
  billable: z.boolean().optional().default(false),
  // The internal employee who did the work (admin snapshot). On the client snapshot this same key
  // is aliased to the reporter, so the client never sees the real employee.
  user: z.object({ id: z.guid(), full_name: z.string() }).nullable().optional(),
  // The client-facing reporter, embedded on the admin snapshot alongside `user`.
  reporter: z.object({ id: z.guid(), full_name: z.string() }).nullable().optional(),
  // The project the log belongs to — embedded on the salary drill-down so each contributing worklog
  // shows where the time went (finance, 0044).
  project: z.object({ id: z.guid(), name: z.string() }).nullable().optional(),
});
export type TimeEntry = z.infer<typeof TimeEntrySchema>;

// Finance (0044): a monthly salary per internal employee. open = accruing; approved = signed off;
// paid = frozen (recompute skips it). Admin-only.
export const SALARY_STATUSES = ['open', 'approved', 'paid'] as const;
export type SalaryStatus = (typeof SALARY_STATUSES)[number];
export const SALARY_STATUS_LABELS: Record<SalaryStatus, string> = {
  open: 'Open',
  approved: 'Approved',
  paid: 'Paid',
};

// Currencies offered for employee pay. Stored as free text, so this is just the picker's shortlist.
export const PAY_CURRENCIES = ['USD', 'EUR', 'GBP', 'UAH', 'PLN'] as const;

export const SalarySchema = z.object({
  id: z.guid(),
  user_id: z.guid(),
  // First day of the month the salary covers.
  period: z.string(),
  currency: z.string(),
  total_hours: numeric,
  total_amount: numeric,
  status: z.enum(SALARY_STATUSES),
  computed_at: z.string().nullable(),
  created_at: z.string(),
  // The employee, embedded for the admin list.
  user: z
    .object({ id: z.guid(), full_name: z.string(), title: z.string().nullable() })
    .nullable()
    .optional(),
});
export type Salary = z.infer<typeof SalarySchema>;

// Billing invoices (0048): the client-side mirror of salaries. One row per (project, month),
// summing APPROVED BILLABLE worklogs by the client-facing reporter, valued at that reporter's
// project billing rate. Lifecycle: open = accruing; approved = internal sign-off; sent = issued to
// the client (frozen); client_approved = the client confirmed it; paid = admin confirmed payment.
// The client sees everything from 'sent' onward. Admin manages open→approved→sent and the final
// 'paid'; the client toggles sent↔client_approved.
export const BILLING_INVOICE_STATUSES = ['open', 'approved', 'sent', 'client_approved', 'paid'] as const;
export type BillingInvoiceStatus = (typeof BILLING_INVOICE_STATUSES)[number];
export const BILLING_INVOICE_STATUS_LABELS: Record<BillingInvoiceStatus, string> = {
  open: 'Open',
  approved: 'Approved',
  sent: 'Sent',
  client_approved: 'Approved by client',
  paid: 'Paid',
};

// One per-reporter summary line of a billing invoice: billing hours × the frozen rate.
export const BillingInvoiceLineSchema = z.object({
  id: z.guid(),
  invoice_id: z.guid(),
  reporter_id: z.guid().nullable(),
  hours: numeric,
  rate: numericNullable.optional().default(null),
  amount: numeric,
  // The client-facing reporter, embedded for display.
  reporter: z.object({ id: z.guid(), full_name: z.string() }).nullable().optional(),
});
export type BillingInvoiceLine = z.infer<typeof BillingInvoiceLineSchema>;

export const BillingInvoiceSchema = z.object({
  id: z.guid(),
  account_id: z.guid(),
  project_id: z.guid(),
  // First day of the month the invoice covers.
  period: z.string(),
  currency: z.string(),
  total_hours: numeric,
  total_amount: numeric,
  status: z.enum(BILLING_INVOICE_STATUSES),
  computed_at: z.string().nullable(),
  created_at: z.string(),
  // Optional link to the issued invoice file (a portal_documents row in the 04_invoices folder).
  document_id: z.guid().nullable().optional(),
  // Embedded for the list views.
  project: z.object({ id: z.guid(), name: z.string() }).nullable().optional(),
  account: z.object({ id: z.guid(), name: z.string() }).nullable().optional(),
  // The attached invoice file, embedded for the view/download button (may be null if none/no access).
  document: z
    .object({
      id: z.guid(),
      name: z.string(),
      file_url: z.string().nullable(),
      drive_web_link: z.string().nullable().optional(),
      drive_file_id: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
  // The per-reporter summary lines.
  lines: z.array(BillingInvoiceLineSchema).optional().default([]),
});
export type BillingInvoice = z.infer<typeof BillingInvoiceSchema>;

// Finance transactions (0056): the unified realised-money ledger. One row per PAID source — an expense
// for a paid salary, income for a settled invoice — recorded in its own currency with a manual FX rate
// into the base currency (base_amount = amount × fx_rate). Admin-only; drives profitability analytics.
export const FINANCE_TRANSACTION_KINDS = ['expense', 'income'] as const;
export type FinanceTransactionKind = (typeof FINANCE_TRANSACTION_KINDS)[number];
// 'manual' rows are ad-hoc entries an admin adds directly (0057) — no salary/invoice behind them,
// so source_id is null for those.
export const FINANCE_TRANSACTION_SOURCES = ['salary', 'invoice', 'manual'] as const;
export type FinanceTransactionSource = (typeof FINANCE_TRANSACTION_SOURCES)[number];

export const FinanceTransactionSchema = z.object({
  id: z.guid(),
  kind: z.enum(FINANCE_TRANSACTION_KINDS),
  source_type: z.enum(FINANCE_TRANSACTION_SOURCES),
  source_id: z.guid().nullable(),
  amount: numeric,
  currency: z.string(),
  fx_rate: numeric,
  base_amount: numeric,
  base_currency: z.string(),
  // Payment date (YYYY-MM-DD).
  occurred_on: z.string(),
  note: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type FinanceTransaction = z.infer<typeof FinanceTransactionSchema>;

/** One project with the children the portal renders for it. */
export interface ProjectBundle {
  project: Project;
  milestones: Milestone[];
  team: ProjectTeamMember[];
  timeEntries: TimeEntry[];
}

/** Everything the client portal needs for one account, fetched in a single pass. */
export interface PortalSnapshot {
  account: PortalAccount;
  /** All of them — the sticky "ever won" unlock depends on the full history, not just the latest. */
  opportunities: Opportunity[];
  opportunity: Opportunity | null;
  resources: PortalResource[];
  intake: IntakeItem[];
  timeEntries: TimeEntry[];
  offers: Offer[];
  documents: PortalDocument[];
  /** People proposed to the client for review, separate from the staffed team. */
  candidates: Candidate[];
  /** Every project on the account, each with its own milestones/team/hours. */
  projects: ProjectBundle[];
  /** The first project — kept so single-project consumers keep working. */
  project: Project | null;
  milestones: Milestone[];
  team: ProjectTeamMember[];
  /** The account's Klepka people (pre-sale team), for direct Calendly booking. */
  klepkaTeam: AccountTeamMember[];
  feedback: Feedback[];
  activity: Activity[];
}
