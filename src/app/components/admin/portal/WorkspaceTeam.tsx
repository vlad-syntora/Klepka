import React from 'react';
import { toast } from 'sonner';
import { UserPlus, X } from 'lucide-react';
import { useAsync } from '@/app/hooks/use-async';
import {
  adminAddAccountTeamMember,
  adminListAccountTeam,
  adminListCandidates,
  adminListInternalUsers,
  adminListOpportunities,
  adminListProjectTeam,
  adminListProjects,
  adminRemoveAccountTeamMember,
  adminSetAccountTeamPublic,
} from '@/app/lib/portal-admin-api';
import {
  CANDIDATE_STATUS_LABELS,
  ROLE_LABELS,
  type Candidate,
  type Opportunity,
  type PortalAccount,
  type Project,
} from '@/app/lib/portal-types';
import { initialsOf, prettyName } from '@/app/lib/portal-format';
import {
  Cell,
  EmptyState,
  ErrorNote,
  Field,
  InfoNote,
  PortalButton,
  PortalCard,
  PortalSpinner,
  PortalTable,
  Row,
  StatusTag,
  inputClass,
  toneFor,
} from '@/app/components/portal/PortalUi';

const TEAM_ROLES = ['Pre-sale', 'Sales Engineer', 'Solution Architect', 'Account Executive', 'Delivery Lead'];

interface SectionPerson {
  id: string;
  name: string;
  subtitle: string | null;
  email: string | null;
  photoUrl: string | null;
  status?: Candidate['status'] | null;
}

// A read-only staffing group (a project's team, or an opportunity's confirmed candidates), styled
// like the client's "Your Klepka team" widget. Renders nothing when the group has no members.
const TeamSection: React.FC<{ title: string; people: SectionPerson[] }> = ({ title, people }) => {
  if (people.length === 0) return null;
  return (
    <div>
      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-grey">
        {title}
        <span className="ml-1.5 font-normal normal-case text-grey/70">({people.length})</span>
      </div>
      <ul className="divide-y divide-border-color">
        {people.map((person) => (
          <li key={person.id} className="flex items-center gap-3 py-2.5">
            {person.photoUrl ? (
              <img src={person.photoUrl} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
            ) : (
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-portal-tint text-xs font-semibold text-violet">
                {initialsOf(person.name)}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{prettyName(person.name)}</div>
              {person.subtitle && <div className="truncate text-xs text-grey">{person.subtitle}</div>}
            </div>
            {person.status && (
              <StatusTag tone={toneFor(person.status)}>{CANDIDATE_STATUS_LABELS[person.status]}</StatusTag>
            )}
            {person.email && <div className="hidden shrink-0 text-xs text-grey sm:block">{person.email}</div>}
          </li>
        ))}
      </ul>
    </div>
  );
};

const ProjectTeamSection: React.FC<{ project: Project }> = ({ project }) => {
  const team = useAsync(() => adminListProjectTeam(project.id), [project.id]);
  const people: SectionPerson[] = (team.data ?? [])
    .filter((member) => member.user)
    .map((member) => ({
      id: member.user!.id,
      name: member.user!.full_name,
      subtitle: member.user!.title ?? member.project_role,
      email: member.user!.email,
      photoUrl: member.user!.photo_url ?? null,
    }));
  return <TeamSection title={project.name} people={people} />;
};

const OpportunityTeamSection: React.FC<{ opportunity: Opportunity; hideDeclined?: boolean }> = ({
  opportunity,
  hideDeclined = false,
}) => {
  const candidates = useAsync(() => adminListCandidates(opportunity.id), [opportunity.id]);
  // Show every proposed candidate with its current status (confirmed / declined / awaiting review),
  // so staff see where each opportunity's staffing stands at a glance. Implementers don't see
  // declined members.
  const people: SectionPerson[] = (candidates.data ?? [])
    .filter((candidate) => candidate.user && (!hideDeclined || candidate.status !== 'declined'))
    .map((candidate) => ({
      id: candidate.user!.id,
      name: candidate.user!.full_name,
      subtitle: candidate.title ?? candidate.user!.title,
      email: candidate.user!.email,
      photoUrl: candidate.user!.photo_url ?? null,
      status: candidate.status,
    }));
  return <TeamSection title={opportunity.name} people={people} />;
};

export const WorkspaceTeam: React.FC<{ account: PortalAccount; canEdit?: boolean }> = ({
  account,
  canEdit = true,
}) => {
  const team = useAsync(() => adminListAccountTeam(account.id), [account.id]);
  const staff = useAsync(() => adminListInternalUsers(), []);
  const projects = useAsync(() => adminListProjects(account.id), [account.id]);
  const opportunities = useAsync(() => adminListOpportunities(account.id), [account.id]);
  const [userId, setUserId] = React.useState('');
  const [teamRole, setTeamRole] = React.useState(TEAM_ROLES[0]);
  const [isPublic, setIsPublic] = React.useState(true);
  const [busy, setBusy] = React.useState(false);

  const members = team.data ?? [];
  const onTeam = new Set(members.map((member) => member.user_id));
  const candidates = (staff.data ?? []).filter((person) => !onTeam.has(person.id));

  const add = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!userId) {
      toast.error('Pick a team member.');
      return;
    }
    setBusy(true);
    try {
      await adminAddAccountTeamMember({ account_id: account.id, user_id: userId, team_role: teamRole, is_public: isPublic });
      setUserId('');
      await team.reload();
    } catch (cause) {
      toast.error('Could not add', { description: cause instanceof Error ? cause.message : undefined });
    } finally {
      setBusy(false);
    }
  };

  const togglePublic = async (id: string, next: boolean) => {
    try {
      await adminSetAccountTeamPublic(id, next);
      await team.reload();
    } catch (cause) {
      toast.error('Could not update', { description: cause instanceof Error ? cause.message : undefined });
    }
  };

  const remove = async (id: string, name: string) => {
    if (!window.confirm(`Remove ${name} from this account's team?`)) return;
    try {
      await adminRemoveAccountTeamMember(id);
      await team.reload();
    } catch (cause) {
      toast.error('Could not remove', { description: cause instanceof Error ? cause.message : undefined });
    }
  };

  if (team.loading) return <PortalSpinner />;
  if (team.error) return <ErrorNote>{team.error}</ErrorNote>;

  return (
    <PortalCard
      title="Klepka team"
      description="Internal staff working this account before and through the sale. Only members marked “Public” are shown to the client and can receive feedback."
    >
      {canEdit && (
      <form onSubmit={add} className="mb-4 rounded-lg border border-border-color bg-off-white p-4">
        <div className="grid gap-3 sm:grid-cols-[2fr_1fr_auto]">
          <Field label="Team member">
            <select className={inputClass} value={userId} onChange={(event) => setUserId(event.target.value)}>
              <option value="">Select…</option>
              {candidates.map((person) => (
                <option key={person.id} value={person.id}>
                  {prettyName(person.full_name)} — {ROLE_LABELS[person.role]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="On this account as">
            <select className={inputClass} value={teamRole} onChange={(event) => setTeamRole(event.target.value)}>
              {TEAM_ROLES.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </Field>
          <div className="flex items-end">
            <PortalButton type="submit" disabled={busy || candidates.length === 0}>
              <UserPlus className="h-4 w-4" /> Add
            </PortalButton>
          </div>
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm text-grey">
          <input
            type="checkbox"
            checked={isPublic}
            onChange={(event) => setIsPublic(event.target.checked)}
            className="h-4 w-4 accent-[color:var(--violet)]"
          />
          Public member — show on the client’s “Your Klepka team” and allow feedback about them
        </label>
      </form>
      )}

      {members.length === 0 ? (
        <EmptyState title="No one assigned yet" description="Add the pre-sale team working this lead." />
      ) : (
        <PortalTable head={['Name', 'On account as', 'Email', 'Public', ...(canEdit ? [''] : [])]}>
          {members.map((member) => (
            <Row key={member.id}>
              <Cell>
                <div className="font-medium">{member.user ? prettyName(member.user.full_name) : '—'}</div>
                {member.user?.title && <div className="text-xs text-grey">{member.user.title}</div>}
              </Cell>
              <Cell>
                <StatusTag tone="violet">{member.team_role}</StatusTag>
              </Cell>
              <Cell className="text-grey">{member.user?.email ?? '—'}</Cell>
              <Cell>
                {canEdit ? (
                  <label className="flex items-center gap-2 text-xs text-grey" title="Show this person to the client">
                    <input
                      type="checkbox"
                      checked={member.is_public ?? true}
                      onChange={(event) => togglePublic(member.id, event.target.checked)}
                      className="h-4 w-4 accent-[color:var(--violet)]"
                    />
                    {(member.is_public ?? true) ? 'Shown' : 'Hidden'}
                  </label>
                ) : (
                  <span className="text-xs text-grey">{(member.is_public ?? true) ? 'Shown' : 'Hidden'}</span>
                )}
              </Cell>
              {canEdit && (
                <Cell className="text-right">
                  <PortalButton
                    variant="ghost"
                    onClick={() => remove(member.id, member.user ? prettyName(member.user.full_name) : 'this person')}
                    aria-label="Remove"
                  >
                    <X className="h-4 w-4" />
                  </PortalButton>
                </Cell>
              )}
            </Row>
          ))}
        </PortalTable>
      )}

      {/* Read-only staffing beyond pre-sale: one group per project and per opportunity that has a
          team, mirroring the client's "Your Klepka team" layout. Each hides itself when empty. */}
      {((projects.data ?? []).length > 0 || (opportunities.data ?? []).length > 0) && (
        <div className="mt-4 space-y-4 border-t border-border-color pt-4">
          {(projects.data ?? []).map((project) => (
            <ProjectTeamSection key={project.id} project={project} />
          ))}
          {(opportunities.data ?? []).map((opportunity) => (
            <OpportunityTeamSection key={opportunity.id} opportunity={opportunity} hideDeclined={!canEdit} />
          ))}
        </div>
      )}

      {canEdit && candidates.length === 0 && staff.data && (
        <InfoNote>Everyone on staff is already on this account. Add more internal users under Client portal → Team.</InfoNote>
      )}
    </PortalCard>
  );
};
