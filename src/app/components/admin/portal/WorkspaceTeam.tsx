import React from 'react';
import { toast } from 'sonner';
import { UserPlus, X } from 'lucide-react';
import { useAsync } from '@/app/hooks/use-async';
import {
  adminAddAccountTeamMember,
  adminListAccountTeam,
  adminListInternalUsers,
  adminRemoveAccountTeamMember,
} from '@/app/lib/portal-admin-api';
import { ROLE_LABELS, type PortalAccount } from '@/app/lib/portal-types';
import { prettyName } from '@/app/lib/portal-format';
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
} from '@/app/components/portal/PortalUi';

const TEAM_ROLES = ['Pre-sale', 'Sales Engineer', 'Solution Architect', 'Account Executive', 'Delivery Lead'];

export const WorkspaceTeam: React.FC<{ account: PortalAccount }> = ({ account }) => {
  const team = useAsync(() => adminListAccountTeam(account.id), [account.id]);
  const staff = useAsync(() => adminListInternalUsers(), []);
  const [userId, setUserId] = React.useState('');
  const [teamRole, setTeamRole] = React.useState(TEAM_ROLES[0]);
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
      await adminAddAccountTeamMember({ account_id: account.id, user_id: userId, team_role: teamRole });
      setUserId('');
      await team.reload();
    } catch (cause) {
      toast.error('Could not add', { description: cause instanceof Error ? cause.message : undefined });
    } finally {
      setBusy(false);
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
      description="Internal staff working this account before and through the sale. Not shown to the client."
    >
      <form onSubmit={add} className="mb-4 grid gap-3 rounded-lg border border-border-color bg-off-white p-4 sm:grid-cols-[2fr_1fr_auto]">
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
      </form>

      {members.length === 0 ? (
        <EmptyState title="No one assigned yet" description="Add the pre-sale team working this lead." />
      ) : (
        <PortalTable head={['Name', 'On account as', 'Email', '']}>
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
              <Cell className="text-right">
                <PortalButton
                  variant="ghost"
                  onClick={() => remove(member.id, member.user ? prettyName(member.user.full_name) : 'this person')}
                  aria-label="Remove"
                >
                  <X className="h-4 w-4" />
                </PortalButton>
              </Cell>
            </Row>
          ))}
        </PortalTable>
      )}

      {candidates.length === 0 && staff.data && (
        <InfoNote>Everyone on staff is already on this account. Add more internal users under Client portal → Team.</InfoNote>
      )}
    </PortalCard>
  );
};
