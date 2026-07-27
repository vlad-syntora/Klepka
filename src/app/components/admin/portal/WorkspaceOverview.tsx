import React from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';
import { useAsync } from '@/app/hooks/use-async';
import {
  DriveNotConfiguredError,
  adminDeleteAccount,
  adminListActivity,
  adminListInternalUsers,
  adminUpdateAccount,
  driveRenameFolder,
} from '@/app/lib/portal-admin-api';
import { WorkspaceTeam } from '@/app/components/admin/portal/WorkspaceTeam';
import { formatDateTime, prettyName } from '@/app/lib/portal-format';
import {
  ACCOUNT_SOURCES,
  HEALTH_LABELS,
  LIFECYCLE_LABELS,
  LIFECYCLE_STAGES,
  type Health,
  type Lifecycle,
  type PortalAccount,
} from '@/app/lib/portal-types';
import {
  EmptyState,
  ErrorNote,
  Field,
  InfoNote,
  PortalButton,
  PortalCard,
  PortalSpinner,
  StatusTag,
  humanize,
  inputClass,
} from '@/app/components/portal/PortalUi';

export const WorkspaceOverview: React.FC<{
  account: PortalAccount;
  onChange: () => Promise<void>;
  /** Implementers get a read-only view — they may see the account but not edit it. */
  canEdit?: boolean;
}> = ({ account, onChange, canEdit = true }) => {
  const navigate = useNavigate();
  const owners = useAsync(() => adminListInternalUsers(), []);
  const activity = useAsync(() => adminListActivity(account.id), [account.id]);
  const [name, setName] = React.useState(account.name);
  const [notes, setNotes] = React.useState(account.internal_notes);
  const [logo, setLogo] = React.useState(account.logo_url ?? '');
  const [sourceSubtype, setSourceSubtype] = React.useState(account.source_subtype ?? '');
  const [busy, setBusy] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  React.useEffect(() => setName(account.name), [account.name]);
  React.useEffect(() => setNotes(account.internal_notes), [account.internal_notes]);
  React.useEffect(() => setLogo(account.logo_url ?? ''), [account.logo_url]);
  React.useEffect(() => setSourceSubtype(account.source_subtype ?? ''), [account.source_subtype]);

  const saveName = async () => {
    const next = name.trim();
    if (!next) {
      setName(account.name); // names can't be blank — revert an empty edit
      return;
    }
    if (next === account.name) return;

    setBusy(true);
    try {
      await adminUpdateAccount(account.id, { name: next });

      // Keep the account's Drive root folder named after the account. Best-effort: an
      // unconfigured Drive or a transient error must not undo the rename that already landed.
      if (account.drive_folder_id) {
        try {
          await driveRenameFolder(account.id);
        } catch (cause) {
          if (!(cause instanceof DriveNotConfiguredError)) {
            toast.warning('Account renamed, but its Drive folder was not — rename it in Drive manually.', {
              description: cause instanceof Error ? cause.message : undefined,
            });
          }
        }
      }

      toast.success('Account renamed.');
      await onChange();
    } catch (cause) {
      // Leave the typed value in place so a rejected name (e.g. a duplicate) can be corrected.
      toast.error('Rename failed', { description: cause instanceof Error ? cause.message : undefined });
    } finally {
      setBusy(false);
    }
  };

  const saveLogo = () => {
    if (logo.trim() !== (account.logo_url ?? '')) patch({ logo_url: logo.trim() || null }, 'Account icon updated.');
  };

  const saveSourceSubtype = () => {
    if (sourceSubtype.trim() !== (account.source_subtype ?? ''))
      patch({ source_subtype: sourceSubtype.trim() || null }, 'Source detail updated.');
  };

  const patch = async (values: Parameters<typeof adminUpdateAccount>[1], message: string) => {
    setBusy(true);
    try {
      await adminUpdateAccount(account.id, values);
      toast.success(message);
      await onChange();
    } catch (cause) {
      toast.error('Update failed', { description: cause instanceof Error ? cause.message : undefined });
    } finally {
      setBusy(false);
    }
  };

  const deleteAccount = async () => {
    // Type-to-confirm: deletion cascades to every user, offer, document, invoice and project.
    const typed = window.prompt(`This permanently deletes “${account.name}” and all its data.\nType the account name to confirm:`);
    if (typed === null) return;
    if (typed.trim() !== account.name) {
      toast.error('Name did not match — nothing was deleted.');
      return;
    }
    setDeleting(true);
    try {
      await adminDeleteAccount(account.id);
      toast.success(`“${account.name}” deleted.`);
      navigate('/admin/portal/accounts');
    } catch (cause) {
      toast.error('Could not delete', { description: cause instanceof Error ? cause.message : undefined });
      setDeleting(false);
    }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <div className="space-y-5 lg:col-span-2">
        {!canEdit && (
          <InfoNote>Your role can view this account but not change its settings.</InfoNote>
        )}
        <PortalCard title="Snapshot" description="Stage changes are reflected in the client's portal immediately.">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Account name" className="sm:col-span-3" hint="Must be unique — renaming is blocked if another account already uses the name.">
              <input
                className={inputClass}
                value={name}
                disabled={busy || !canEdit}
                onChange={(event) => setName(event.target.value)}
                onBlur={saveName}
              />
            </Field>
            <Field label="Account icon (URL)" className="sm:col-span-3" hint="Shown as the account avatar in the client portal.">
              <div className="relative">
                <input
                  type="url"
                  className={`${inputClass} pr-12`}
                  value={logo}
                  disabled={busy || !canEdit}
                  placeholder="https://…/logo.png"
                  onChange={(event) => setLogo(event.target.value)}
                  onBlur={saveLogo}
                />
                {logo ? (
                  <img
                    src={logo}
                    alt=""
                    className="absolute right-2 top-1/2 h-8 w-8 -translate-y-1/2 rounded-full object-cover"
                  />
                ) : (
                  <span className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-portal-tint text-xs font-semibold text-violet">
                    {account.name.slice(0, 2).toUpperCase()}
                  </span>
                )}
              </div>
            </Field>
            <Field label="Lifecycle stage">
              <select
                className={inputClass}
                value={account.lifecycle}
                disabled={busy || !canEdit}
                onChange={(event) =>
                  patch({ lifecycle: event.target.value as Lifecycle }, 'Stage updated — the client sees it now.')
                }
              >
                {LIFECYCLE_STAGES.map((stage) => (
                  <option key={stage} value={stage}>
                    {LIFECYCLE_LABELS[stage]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Health">
              <select
                className={inputClass}
                value={account.health}
                disabled={busy || !canEdit}
                onChange={(event) => patch({ health: event.target.value as Health }, 'Health updated.')}
              >
                {(Object.keys(HEALTH_LABELS) as Health[]).map((health) => (
                  <option key={health} value={health}>
                    {HEALTH_LABELS[health]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Account owner">
              <select
                className={inputClass}
                value={account.owner_id ?? ''}
                disabled={busy || !canEdit || owners.loading}
                onChange={(event) => patch({ owner_id: event.target.value || null }, 'Owner reassigned.')}
              >
                <option value="">Unassigned</option>
                {(owners.data ?? []).map((owner) => (
                  <option key={owner.id} value={owner.id}>
                    {prettyName(owner.full_name)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Source">
              <select
                className={inputClass}
                value={account.source ?? ''}
                disabled={busy || !canEdit}
                onChange={(event) => patch({ source: event.target.value || null }, 'Source updated.')}
              >
                <option value="">—</option>
                {ACCOUNT_SOURCES.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Source subtype" className="sm:col-span-2" hint="e.g. referrer, event or partner name.">
              <input
                className={inputClass}
                value={sourceSubtype}
                disabled={busy || !canEdit}
                onChange={(event) => setSourceSubtype(event.target.value)}
                onBlur={saveSourceSubtype}
              />
            </Field>
          </div>
        </PortalCard>

        <PortalCard
          title="Internal notes"
          description="Never shown to the client."
          action={
            <PortalButton
              disabled={busy || !canEdit || notes === account.internal_notes}
              onClick={() => patch({ internal_notes: notes }, 'Notes saved.')}
            >
              Save notes
            </PortalButton>
          }
        >
          <textarea
            rows={5}
            className={inputClass}
            value={notes}
            disabled={busy || !canEdit}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Context for whoever picks this account up next…"
          />
        </PortalCard>

        <WorkspaceTeam account={account} />

        {canEdit && (
          <PortalCard title="Danger zone" description="Deleting an account cannot be undone.">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-grey">
                Removes this account and every user, offer, document, invoice and project attached to it. Drive files are
                left in place.
              </p>
              <PortalButton variant="danger" onClick={deleteAccount} disabled={deleting}>
                <Trash2 className="h-4 w-4" /> {deleting ? 'Deleting…' : 'Delete account'}
              </PortalButton>
            </div>
          </PortalCard>
        )}
      </div>

      <PortalCard title="Activity log" alwaysOpen>
        {activity.loading ? (
          <PortalSpinner />
        ) : activity.error ? (
          <ErrorNote>{activity.error}</ErrorNote>
        ) : (activity.data ?? []).length === 0 ? (
          <EmptyState title="No activity yet" />
        ) : (
          <ul className="space-y-3">
            {(activity.data ?? []).map((entry) => (
              <li key={entry.id} className="text-sm">
                <div className="flex items-center gap-2">
                  <StatusTag tone="violet">{humanize(entry.category)}</StatusTag>
                  {!entry.client_visible && <StatusTag tone="grey">Internal</StatusTag>}
                </div>
                <div className="mt-1 font-medium">{entry.title}</div>
                {entry.detail && <div className="text-grey">{entry.detail}</div>}
                <div className="text-xs text-grey">{formatDateTime(entry.created_at)}</div>
              </li>
            ))}
          </ul>
        )}
      </PortalCard>
    </div>
  );
};
