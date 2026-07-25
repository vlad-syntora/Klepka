import React from 'react';
import { toast } from 'sonner';
import { UserPlus } from 'lucide-react';
import { useAsync } from '@/app/hooks/use-async';
import {
  adminCreateUser,
  adminDeleteUser,
  adminListAccountUsers,
  adminListAccounts,
  adminListUsers,
  adminUpdateUser,
  portalInviteUser,
} from '@/app/lib/portal-admin-api';
import { notifyInviteResult } from '@/app/lib/invite-feedback';
import { formatRelative, prettyName } from '@/app/lib/portal-format';
import {
  CLIENT_ROLES,
  type PortalAccount,
  type PortalUser,
} from '@/app/lib/portal-types';
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
  inputClass,
} from '@/app/components/portal/PortalUi';
import { UserStatusControl } from '@/app/components/admin/portal/UserStatusControl';

export const WorkspaceUsers: React.FC<{ account: PortalAccount }> = ({ account }) => {
  const users = useAsync(() => adminListAccountUsers(account.id), [account.id]);
  const directory = useAsync(() => adminListUsers(), []);
  const accounts = useAsync(() => adminListAccounts(), []);
  const [showInvite, setShowInvite] = React.useState(false);
  const [mode, setMode] = React.useState<'new' | 'existing'>('new');
  const [fullName, setFullName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [existingUserId, setExistingUserId] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  const accountName = new Map((accounts.data ?? []).map((item) => [item.id, item.name]));
  // Existing client contacts living on other accounts. A client row is bound to one account,
  // so adding one here moves them off their current account.
  const existingCandidates = (directory.data ?? []).filter(
    (person) =>
      person.account_id && person.account_id !== account.id && CLIENT_ROLES.includes(person.role),
  );

  // Save → creates the client as Inactive (no access). Send invite → also provisions their
  // sign-in and emails the invitation (status Invited).
  const saveNew = async (sendInvite: boolean) => {
    if (!fullName.trim() || !email.trim()) {
      toast.error('Name and email are required.');
      return;
    }
    setBusy(true);
    try {
      const created = await adminCreateUser({
        email: email.trim(),
        full_name: fullName.trim(),
        role: 'client_admin',
        account_id: account.id,
        module_access: [],
        title: null,
      });
      if (sendInvite) {
        notifyInviteResult(await portalInviteUser(created.id), created.email);
      } else {
        toast.success('Saved as Inactive — invite them any time from the status column.');
      }
      setFullName('');
      setEmail('');
      setShowInvite(false);
      await users.reload();
    } catch (cause) {
      toast.error('Could not save', { description: cause instanceof Error ? cause.message : undefined });
    } finally {
      setBusy(false);
    }
  };

  const addExisting = async () => {
    if (!existingUserId) {
      toast.error('Pick a person.');
      return;
    }
    const picked = existingCandidates.find((person) => person.id === existingUserId);
    const from = picked?.account_id ? accountName.get(picked.account_id) : null;
    if (from && !window.confirm(`${prettyName(picked?.full_name)} is currently on “${from}”. Move them to “${account.name}”?`)) {
      return;
    }
    setBusy(true);
    try {
      await adminUpdateUser(existingUserId, {
        account_id: account.id,
        role: 'client_admin',
        module_access: [],
      });
      toast.success('Client added to this account.');
      setExistingUserId('');
      setShowInvite(false);
      await users.reload();
      await directory.reload();
    } catch (cause) {
      toast.error('Could not add', { description: cause instanceof Error ? cause.message : undefined });
    } finally {
      setBusy(false);
    }
  };

  const remove = async (user: PortalUser) => {
    if (!window.confirm(`Remove ${prettyName(user.full_name)} from this account?`)) return;
    try {
      await adminDeleteUser(user.id);
      await users.reload();
    } catch (cause) {
      toast.error('Could not remove', { description: cause instanceof Error ? cause.message : undefined });
    }
  };

  if (users.loading) return <PortalSpinner />;
  if (users.error) return <ErrorNote>{users.error}</ErrorNote>;

  return (
    <div className="space-y-5">
      <PortalCard
        title="Customer portal users"
        description="Internal-only tab — the client never sees this list."
        action={
          <PortalButton onClick={() => setShowInvite((open) => !open)}>
            <UserPlus className="h-4 w-4" /> Add user
          </PortalButton>
        }
      >
        {showInvite && (
          <form
            onSubmit={(event) => event.preventDefault()}
            className="mb-4 space-y-3 rounded-lg border border-border-color bg-off-white p-4"
          >
            <div className="inline-flex rounded-lg border border-border-color p-0.5 text-sm">
              {(['new', 'existing'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setMode(value)}
                  className={`rounded-md px-3 py-1 transition-colors ${
                    mode === value ? 'bg-[color:var(--violet)] text-white' : 'text-grey hover:text-foreground'
                  }`}
                >
                  {value === 'new' ? 'New person' : 'Existing person'}
                </button>
              ))}
            </div>

            <div className="grid gap-3 sm:grid-cols-4">
              {mode === 'new' ? (
                <>
                  <Field label="Full name">
                    <input className={inputClass} value={fullName} onChange={(event) => setFullName(event.target.value)} required />
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
                </>
              ) : (
                <Field label="Person" className="sm:col-span-2" hint="An existing client contact from another account.">
                  <select
                    className={inputClass}
                    value={existingUserId}
                    onChange={(event) => setExistingUserId(event.target.value)}
                    required
                  >
                    <option value="">Select…</option>
                    {existingCandidates.map((person) => (
                      <option key={person.id} value={person.id}>
                        {prettyName(person.full_name)} — {person.email}
                        {person.account_id ? ` (${accountName.get(person.account_id) ?? 'other account'})` : ''}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
              <div className="flex flex-wrap items-end gap-2">
                {mode === 'new' ? (
                  <>
                    <PortalButton type="button" variant="secondary" disabled={busy} onClick={() => saveNew(false)}>
                      {busy ? 'Saving…' : 'Save'}
                    </PortalButton>
                    <PortalButton type="button" disabled={busy} onClick={() => saveNew(true)}>
                      <UserPlus className="h-4 w-4" /> {busy ? 'Working…' : 'Send invite'}
                    </PortalButton>
                  </>
                ) : (
                  <PortalButton type="button" disabled={busy} onClick={addExisting}>
                    {busy ? 'Saving…' : 'Add to account'}
                  </PortalButton>
                )}
              </div>
            </div>

            {mode === 'existing' && existingCandidates.length === 0 && (
              <p className="text-sm text-grey">No client contacts on other accounts to pull from.</p>
            )}
          </form>
        )}

        {(users.data ?? []).length === 0 ? (
          <EmptyState title="No portal users on this account yet" />
        ) : (
          <PortalTable head={['Name', 'Email', 'Status', 'Last login', '']}>
            {(users.data ?? []).map((user) => (
              <Row key={user.id}>
                <Cell className="font-medium">{prettyName(user.full_name)}</Cell>
                <Cell className="text-grey">{user.email}</Cell>
                <Cell>
                  <UserStatusControl user={user} onChanged={() => users.reload()} />
                </Cell>
                <Cell className="whitespace-nowrap text-grey">{formatRelative(user.last_login_at)}</Cell>
                <Cell className="whitespace-nowrap text-right">
                  <PortalButton variant="ghost" onClick={() => remove(user)}>
                    Delete
                  </PortalButton>
                </Cell>
              </Row>
            ))}
          </PortalTable>
        )}
      </PortalCard>

      <InfoNote>
        Inviting someone here creates their portal profile — no password is issued. They open the portal and either
        continue with the Google account for that address, or have a one-time sign-in link emailed to it. Anyone whose
        address is not on this list sees “no portal access yet”.
      </InfoNote>
    </div>
  );
};
