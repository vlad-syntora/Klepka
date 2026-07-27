import React from 'react';
import { toast } from 'sonner';
import { UserPlus } from 'lucide-react';
import { usePortalData } from '@/app/hooks/use-portal-data';
import { usePortalUser } from '@/app/hooks/use-portal-user';
import { inviteTeammate, listAccountUsers } from '@/app/lib/portal-api';
import { formatRelative, prettyName } from '@/app/lib/portal-format';
import { type PortalUser } from '@/app/lib/portal-types';
import {
  Cell,
  Field,
  InfoNote,
  PortalButton,
  PortalCard,
  PortalTable,
  Row,
  StatusTag,
  humanize,
  inputClass,
  toneFor,
} from '@/app/components/portal/PortalUi';

export const PortalSettings: React.FC = () => {
  const { snapshot } = usePortalData();
  const { user } = usePortalUser();
  const [teammates, setTeammates] = React.useState<PortalUser[]>([]);
  const [showInvite, setShowInvite] = React.useState(false);
  const [email, setEmail] = React.useState('');
  const [fullName, setFullName] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  const accountId = snapshot?.account.id;

  const refresh = React.useCallback(() => {
    if (!accountId) return;
    listAccountUsers(accountId)
      .then(setTeammates)
      .catch(() => setTeammates([]));
  }, [accountId]);

  React.useEffect(refresh, [refresh]);

  if (!snapshot || !user) return null;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      await inviteTeammate({
        email: email.trim(),
        fullName: fullName.trim(),
        role: 'client_admin',
        modules: [],
      });
      toast.success('Invite recorded — your Klepka contact will send the login link.');
      setEmail('');
      setFullName('');
      setShowInvite(false);
      refresh();
    } catch (cause) {
      toast.error('Could not invite', { description: cause instanceof Error ? cause.message : undefined });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <PortalCard title="Account">
        <dl className="grid gap-4 sm:grid-cols-3 text-sm">
          <div>
            <dt className="text-xs uppercase tracking-wide text-grey">Company</dt>
            <dd className="mt-0.5 font-medium">{snapshot.account.name}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-grey">Industry</dt>
            <dd className="mt-0.5 font-medium">{snapshot.account.industry ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-grey">Klepka account owner</dt>
            <dd className="mt-0.5 font-medium">{snapshot.account.owner ? prettyName(snapshot.account.owner.full_name) : 'To be assigned'}</dd>
          </div>
        </dl>
      </PortalCard>

      <PortalCard
        title="Your team"
        description="Everyone from your company with portal access."
        action={
          <PortalButton variant="secondary" onClick={() => setShowInvite((open) => !open)}>
            <UserPlus className="h-4 w-4" /> Invite teammate
          </PortalButton>
        }
      >
        {showInvite && (
          <form onSubmit={submit} className="mb-4 space-y-3 rounded-lg border border-border-color bg-off-white p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Full name">
                <input
                  className={inputClass}
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  required
                />
              </Field>
              <Field label="Email">
                <input
                  type="email"
                  className={inputClass}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </Field>
            </div>

            <div className="flex gap-2">
              <PortalButton type="submit" disabled={busy}>
                {busy ? 'Sending…' : 'Send invite'}
              </PortalButton>
              <PortalButton variant="ghost" type="button" onClick={() => setShowInvite(false)}>
                Cancel
              </PortalButton>
            </div>
          </form>
        )}

        <PortalTable head={['Name', 'Email', 'Status', 'Last login']}>
          {teammates.map((teammate) => (
            <Row key={teammate.id}>
              <Cell className="font-medium">
                {prettyName(teammate.full_name)}
                {teammate.id === user.id && <span className="ml-2 text-xs text-grey">(you)</span>}
              </Cell>
              <Cell className="text-grey">{teammate.email}</Cell>
              <Cell>
                <StatusTag tone={toneFor(teammate.status)}>{humanize(teammate.status)}</StatusTag>
              </Cell>
              <Cell className="whitespace-nowrap text-grey">{formatRelative(teammate.last_login_at)}</Cell>
            </Row>
          ))}
        </PortalTable>
      </PortalCard>

      <InfoNote>
        Teammates you add here sign in with their own Google account — no password to share. Access is granted purely
        by email address, so double-check the spelling. Tell your Klepka team the moment someone leaves your project so
        their access can be revoked.
      </InfoNote>
    </div>
  );
};
