import type { Opportunity, PortalAccount, PortalRole } from '@/app/lib/portal-types';

/**
 * The portal is four different products depending on where the client is. This module is the
 * single source of truth for which one they get; it mirrors `portal_account_phase()` in
 * migration 0005 so the UI and the database never disagree.
 */
export type PortalPhase = 'onboarding' | 'discovery' | 'proposal' | 'delivery';

export const PHASE_LABELS: Record<PortalPhase, string> = {
  onboarding: 'Getting started',
  discovery: 'Information gathering',
  proposal: 'Proposal',
  delivery: 'Delivery',
};

export const PHASE_BLURB: Record<PortalPhase, string> = {
  onboarding: 'Get to know how we work, explore the material, and book an intro call.',
  discovery: 'We collect what we need to scope the work — your checklist is below.',
  proposal: 'Your proposal is ready to review, comment on and accept.',
  delivery: 'Milestones, hours, invoices and your project team, all in one place.',
};

/** Left-nav sections, a superset of the RLS-level modules. */
export type PortalSection =
  | 'start'
  | 'intake'
  | 'pipeline'
  | 'calls'
  | 'documents'
  | 'payments'
  | 'project'
  | 'feedback'
  | 'notifications'
  | 'settings';

/**
 * What each phase exposes. Cumulative on purpose — a client in Proposal keeps the onboarding
 * material and their intake checklist, they just gain the offer on top.
 */
export const PHASE_SECTIONS: Record<PortalPhase, PortalSection[]> = {
  onboarding: ['start', 'calls', 'documents', 'feedback', 'notifications', 'settings'],
  discovery: ['start', 'intake', 'calls', 'documents', 'feedback', 'notifications', 'settings'],
  proposal: ['start', 'intake', 'pipeline', 'calls', 'documents', 'feedback', 'notifications', 'settings'],
  delivery: [
    'start',
    'intake',
    'pipeline',
    'calls',
    'documents',
    'payments',
    'project',
    'feedback',
    'notifications',
    'settings',
  ],
};

/**
 * Once an account has ever won an opportunity it keeps the full portal for good — a later
 * open deal must not demote an existing client back to an onboarding experience.
 */
export function isUnlocked(account: PortalAccount, opportunities: Opportunity[]): boolean {
  if (['live', 'stopped'].includes(account.lifecycle)) return true;
  return opportunities.some((opportunity) => opportunity.stage === 'closed_won');
}

export function derivePhase(account: PortalAccount, opportunities: Opportunity[]): PortalPhase {
  if (isUnlocked(account, opportunities)) return 'delivery';
  switch (account.lifecycle) {
    case 'qualified':
      return 'discovery';
    case 'proposal_sent':
      return 'proposal';
    default:
      return 'onboarding';
  }
}

/** Role-based entitlement, unchanged from the permissions matrix (design doc §9). */
function roleAllows(role: PortalRole, section: PortalSection, moduleAccess: string[]): boolean {
  if (section === 'settings') return role === 'client_admin';
  if (role === 'client_admin') return true;
  if (role === 'prospect') return section !== 'payments';
  if (role === 'client_collaborator') {
    if (['start', 'intake', 'pipeline', 'calls', 'feedback', 'notifications'].includes(section)) return true;
    return moduleAccess.includes(section);
  }
  return true;
}

/**
 * Effective visibility = what the phase makes relevant ∩ what the role entitles them to.
 * Phase decides *when*, role decides *whether*.
 */
export function visibleSections(
  phase: PortalPhase,
  role: PortalRole,
  moduleAccess: string[],
): PortalSection[] {
  return PHASE_SECTIONS[phase].filter((section) => roleAllows(role, section, moduleAccess));
}

export function canSeeSection(
  phase: PortalPhase,
  role: PortalRole,
  moduleAccess: string[],
  section: PortalSection,
): boolean {
  return visibleSections(phase, role, moduleAccess).includes(section);
}
