import React from 'react';
import { toast } from 'sonner';
import { ChevronDown, ChevronRight, Pencil, Plus, Trash2, UserMinus, UserPlus } from 'lucide-react';
import { useAsync } from '@/app/hooks/use-async';
import { usePortalUser } from '@/app/hooks/use-portal-user';
import {
  adminCreateTeam,
  adminDeleteTeam,
  adminListTeams,
  adminListUsers,
  adminUpdateTeam,
  adminUpdateUser,
} from '@/app/lib/portal-admin-api';
import { prettyName } from '@/app/lib/portal-format';
import { isImplementer, isInternalRole, ROLE_LABELS, type PortalTeam, type PortalUser } from '@/app/lib/portal-types';
import {
  EmptyState,
  ErrorNote,
  Field,
  InfoNote,
  PortalButton,
  PortalCard,
  PortalModal,
  PortalSpinner,
  StatusTag,
  inputClass,
} from '@/app/components/portal/PortalUi';

interface EditState {
  id?: string;
  name: string;
  lead_id: string;
  pm_id: string;
}

const emptyEdit = (): EditState => ({ name: '', lead_id: '', pm_id: '' });

/**
 * Employee team management (migration 0047) — portal-admin only. Admins create teams, add/remove
 * members (portal_users.team_id) and assign a team lead + project manager (any internal staff). The
 * structure feeds future per-team reporting; RLS also restricts every write to admins.
 *
 * Rendered as the "Teams" tab of the Users & Teams page (AdminPortalTeam) — the tab bar supplies the
 * heading, so this panel starts straight at its description + actions.
 */
export const TeamsPanel: React.FC = () => {
  const { user } = usePortalUser();
  const isAdmin = user?.role === 'portal_admin';
  const implementer = user ? isImplementer(user.role) : false;
  // Only admins mutate; Implementers get the same page read-only for delivery visibility.
  const canManage = isAdmin;

  const teams = useAsync(() => adminListTeams(), []);
  const users = useAsync(() => adminListUsers(), []);
  const [edit, setEdit] = React.useState<EditState | null>(null);
  const [busy, setBusy] = React.useState(false);
  // Teams collapse individually; ids present here are expanded. Default (empty) = all collapsed.
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());
  const toggleExpanded = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const reloadAll = () => Promise.all([teams.reload(), users.reload()]);

  const internal = React.useMemo(
    () =>
      (users.data ?? [])
        .filter((u) => isInternalRole(u.role))
        .sort((a, b) => prettyName(a.full_name).localeCompare(prettyName(b.full_name))),
    [users.data],
  );
  const membersOf = (teamId: string) => internal.filter((u) => u.team_id === teamId);
  const unassigned = internal.filter((u) => !u.team_id);
  const nameOf = (id: string | null) => {
    if (!id) return '—';
    const person = internal.find((u) => u.id === id);
    return person ? prettyName(person.full_name) : '—';
  };

  const saveTeam = async () => {
    if (!edit) return;
    if (!edit.name.trim()) {
      toast.error('Give the team a name.');
      return;
    }
    setBusy(true);
    try {
      const patch = { name: edit.name.trim(), lead_id: edit.lead_id || null, pm_id: edit.pm_id || null };
      if (edit.id) {
        await adminUpdateTeam(edit.id, patch);
        toast.success('Team updated.');
      } else {
        await adminCreateTeam(patch);
        toast.success('Team created.');
      }
      setEdit(null);
      await teams.reload();
    } catch (cause) {
      toast.error('Could not save', { description: cause instanceof Error ? cause.message : undefined });
    } finally {
      setBusy(false);
    }
  };

  const removeTeam = async (team: PortalTeam) => {
    if (!window.confirm(`Delete "${team.name}"? Its members will become unassigned.`)) return;
    try {
      await adminDeleteTeam(team.id);
      await reloadAll();
    } catch (cause) {
      toast.error('Could not delete', { description: cause instanceof Error ? cause.message : undefined });
    }
  };

  // Inline lead/PM assignment, and adding/removing members — all patch a single row then reload.
  const setRole = async (team: PortalTeam, field: 'lead_id' | 'pm_id', value: string) => {
    try {
      await adminUpdateTeam(team.id, { [field]: value || null });
      await teams.reload();
    } catch (cause) {
      toast.error('Could not update', { description: cause instanceof Error ? cause.message : undefined });
    }
  };
  const setMemberTeam = async (member: PortalUser, teamId: string | null) => {
    try {
      await adminUpdateUser(member.id, { team_id: teamId });
      await users.reload();
    } catch (cause) {
      toast.error('Could not update', { description: cause instanceof Error ? cause.message : undefined });
    }
  };

  if (!isAdmin && !implementer) {
    return <ErrorNote>Teams are restricted to portal administrators.</ErrorNote>;
  }
  if (teams.loading || users.loading) return <PortalSpinner label="Loading teams…" />;
  if (teams.error) return <ErrorNote>{teams.error}</ErrorNote>;
  if (users.error) return <ErrorNote>{users.error}</ErrorNote>;

  const staffOptions = (placeholder: string) => (
    <>
      <option value="">{placeholder}</option>
      {internal.map((u) => (
        <option key={u.id} value={u.id}>
          {prettyName(u.full_name)}
          {u.title ? ` · ${u.title}` : ` · ${ROLE_LABELS[u.role]}`}
        </option>
      ))}
    </>
  );

  const list = teams.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-grey">
          Group employees into teams with a lead and a project manager. Used to roll up reporting per team.
        </p>
        {canManage && (
          <PortalButton onClick={() => setEdit(emptyEdit())}>
            <Plus className="h-4 w-4" /> Add team
          </PortalButton>
        )}
      </div>

      <InfoNote>
        {canManage ? (
          <>
            A person belongs to one team. The <strong>Lead</strong> and <strong>Project manager</strong> are
            references to any internal staff — assigning someone one of those roles does not make them a member.
          </>
        ) : (
          <>You can view the team structure, leads and project managers, but not change it.</>
        )}
      </InfoNote>

      {list.length === 0 ? (
        <EmptyState title="No teams yet" description="Create your first team to start grouping employees." />
      ) : (
        list.map((team) => {
          const members = membersOf(team.id);
          const isCollapsed = !expanded.has(team.id);
          return (
            <PortalCard
              key={team.id}
              title={team.name}
              description={`${members.length} ${members.length === 1 ? 'member' : 'members'}`}
              action={
                <>
                  <PortalButton
                    variant="ghost"
                    onClick={() => toggleExpanded(team.id)}
                    aria-label={isCollapsed ? 'Expand team' : 'Collapse team'}
                    aria-expanded={!isCollapsed}
                  >
                    {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </PortalButton>
                  {canManage && (
                    <>
                      <PortalButton
                        variant="ghost"
                        onClick={() =>
                          setEdit({ id: team.id, name: team.name, lead_id: team.lead_id ?? '', pm_id: team.pm_id ?? '' })
                        }
                        aria-label="Rename team"
                      >
                        <Pencil className="h-4 w-4" />
                      </PortalButton>
                      <PortalButton variant="ghost" onClick={() => removeTeam(team)} aria-label="Delete team">
                        <Trash2 className="h-4 w-4" />
                      </PortalButton>
                    </>
                  )}
                </>
              }
            >
              {!isCollapsed && (
              <>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Team lead" hint={team.lead_id ? undefined : 'Not assigned'}>
                  {canManage ? (
                    <select
                      className={inputClass}
                      value={team.lead_id ?? ''}
                      onChange={(event) => setRole(team, 'lead_id', event.target.value)}
                    >
                      {staffOptions('— None —')}
                    </select>
                  ) : (
                    <p className="text-sm font-medium text-foreground">{nameOf(team.lead_id)}</p>
                  )}
                </Field>
                <Field label="Project manager" hint={team.pm_id ? undefined : 'Not assigned'}>
                  {canManage ? (
                    <select
                      className={inputClass}
                      value={team.pm_id ?? ''}
                      onChange={(event) => setRole(team, 'pm_id', event.target.value)}
                    >
                      {staffOptions('— None —')}
                    </select>
                  ) : (
                    <p className="text-sm font-medium text-foreground">{nameOf(team.pm_id)}</p>
                  )}
                </Field>
              </div>

              <div className="mt-4">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <h3 className="text-sm font-medium text-foreground">Members</h3>
                  {canManage && (
                    <AddMemberControl
                      candidates={unassigned}
                      onAdd={(member) => setMemberTeam(member, team.id)}
                    />
                  )}
                </div>
                {members.length === 0 ? (
                  <p className="text-xs text-grey">
                    {canManage ? 'No members yet. Add employees from the picker above.' : 'No members yet.'}
                  </p>
                ) : (
                  <ul className="divide-y divide-border-color rounded-lg border border-border-color">
                    {members.map((member) => (
                      <li key={member.id} className="flex items-center justify-between gap-3 px-3 py-2">
                        <span className="min-w-0">
                          <span className="font-medium">{prettyName(member.full_name)}</span>
                          <span className="ml-2 text-xs text-grey">{member.title || ROLE_LABELS[member.role]}</span>
                          {team.lead_id === member.id && (
                            <StatusTag tone="violet" className="ml-2">
                              Lead
                            </StatusTag>
                          )}
                          {team.pm_id === member.id && (
                            <StatusTag tone="violet" className="ml-2">
                              PM
                            </StatusTag>
                          )}
                        </span>
                        {canManage && (
                          <PortalButton
                            variant="ghost"
                            className="shrink-0 text-xs"
                            onClick={() => setMemberTeam(member, null)}
                            aria-label={`Remove ${prettyName(member.full_name)} from team`}
                          >
                            <UserMinus className="h-4 w-4" /> Remove
                          </PortalButton>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              </>
              )}
            </PortalCard>
          );
        })
      )}

      {edit && canManage && (
        <PortalModal
          open
          onClose={() => setEdit(null)}
          title={edit.id ? 'Edit team' : 'Add team'}
          description="Only portal admins can manage teams."
          className="max-w-md"
        >
          <div className="space-y-3">
            <Field label="Team name">
              <input
                className={inputClass}
                value={edit.name}
                onChange={(event) => setEdit({ ...edit, name: event.target.value })}
                autoFocus
              />
            </Field>
            <Field label="Team lead" hint="Optional — any internal staff.">
              <select
                className={inputClass}
                value={edit.lead_id}
                onChange={(event) => setEdit({ ...edit, lead_id: event.target.value })}
              >
                {staffOptions('— None —')}
              </select>
            </Field>
            <Field label="Project manager" hint="Optional — any internal staff.">
              <select
                className={inputClass}
                value={edit.pm_id}
                onChange={(event) => setEdit({ ...edit, pm_id: event.target.value })}
              >
                {staffOptions('— None —')}
              </select>
            </Field>
            <div className="flex gap-2 pt-1">
              <PortalButton disabled={busy} onClick={saveTeam}>
                {busy ? 'Saving…' : edit.id ? 'Save' : 'Create team'}
              </PortalButton>
              <PortalButton variant="ghost" type="button" onClick={() => setEdit(null)}>
                Cancel
              </PortalButton>
            </div>
          </div>
        </PortalModal>
      )}
    </div>
  );
};

// A "pick an employee to add" select. Only unassigned staff appear; picking one adds them and resets.
const AddMemberControl: React.FC<{
  candidates: PortalUser[];
  onAdd: (member: PortalUser) => void;
}> = ({ candidates, onAdd }) => {
  if (candidates.length === 0) {
    return <span className="text-xs text-grey">All staff are assigned to a team.</span>;
  }
  return (
    <label className="flex items-center gap-1.5 text-xs text-grey">
      <UserPlus className="h-3.5 w-3.5 shrink-0" />
      <select
        className={`${inputClass} w-auto py-1 text-xs`}
        value=""
        onChange={(event) => {
          const member = candidates.find((c) => c.id === event.target.value);
          if (member) onAdd(member);
        }}
      >
        <option value="">Add member…</option>
        {candidates.map((c) => (
          <option key={c.id} value={c.id}>
            {prettyName(c.full_name)}
          </option>
        ))}
      </select>
    </label>
  );
};
