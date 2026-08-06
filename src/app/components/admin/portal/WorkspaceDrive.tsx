import React from 'react';
import { toast } from 'sonner';
import { ExternalLink, FolderPlus, RefreshCw, Users } from 'lucide-react';
import { useAsync } from '@/app/hooks/use-async';
import {
  DriveNotConfiguredError,
  adminListOpportunities,
  driveListFiles,
  driveProvision,
  driveProvisionOpportunity,
  driveShareWithAccount,
  type DriveFile,
} from '@/app/lib/portal-admin-api';
import { formatDate } from '@/app/lib/portal-format';
import type { Opportunity, PortalAccount } from '@/app/lib/portal-types';
import {
  Cell,
  EmptyState,
  InfoNote,
  PortalButton,
  PortalCard,
  PortalSpinner,
  PortalTable,
  Row,
  StatusTag,
} from '@/app/components/portal/PortalUi';
import { cn } from '@/app/components/ui/utils';

// The Drive tree is split across two levels (mirrors api/google/drive.ts):
//   • the account root holds only onboarding material, plus each opportunity's folder;
//   • every deal-specific folder lives UNDER the opportunity it belongs to.
// The `''` key means "the folder root itself" — listing it shows its subfolders and loose files.
const ACCOUNT_FOLDERS: { key: string; label: string }[] = [
  { key: '', label: 'Account root' },
  { key: '00_onboarding', label: '00 Onboarding' },
];
const OPP_FOLDERS: { key: string; label: string }[] = [
  { key: '', label: 'Opportunity root' },
  { key: '01_discovery', label: '01 Discovery' },
  { key: '02_proposal', label: '02 Proposal' },
  { key: '03_contracts', label: '03 Contracts' },
  { key: '04_invoices', label: '04 Invoices' },
  { key: '05_delivery', label: '05 Delivery' },
  { key: '06_candidates', label: '06 Candidates (CVs)' },
];

const isFolder = (file: DriveFile) => file.mimeType === 'application/vnd.google-apps.folder';

export const WorkspaceDrive: React.FC<{ account: PortalAccount; onChange: () => void }> = ({
  account,
  onChange,
}) => {
  const opportunities = useAsync(() => adminListOpportunities(account.id), [account.id]);
  const opps = opportunities.data ?? [];

  // Scope selects which folder tree we browse: the account root, or one opportunity's tree.
  const [scopeId, setScopeId] = React.useState<'account' | string>('account');
  const selectedOpp: Opportunity | null =
    scopeId === 'account' ? null : opps.find((entry) => entry.id === scopeId) ?? null;
  // Fall back to the account scope if the selected opportunity vanishes (e.g. was deleted).
  const scope = scopeId !== 'account' && !selectedOpp ? 'account' : scopeId;

  const folders = scope === 'account' ? ACCOUNT_FOLDERS : OPP_FOLDERS;
  const provisioned = scope === 'account' ? Boolean(account.drive_folder_id) : Boolean(selectedOpp?.drive_folder_id);
  const webLink = scope === 'account' ? account.drive_web_link : selectedOpp?.drive_web_link ?? null;

  const [busy, setBusy] = React.useState<null | 'provision' | 'share'>(null);
  const [notConfigured, setNotConfigured] = React.useState(false);
  const [activeKey, setActiveKey] = React.useState<string>('');
  const [files, setFiles] = React.useState<DriveFile[]>([]);
  const [loadingFiles, setLoadingFiles] = React.useState(false);

  // Switching scope resets to that tree's root folder.
  React.useEffect(() => {
    setActiveKey('');
  }, [scope]);

  const loadFiles = React.useCallback(
    async (key: string) => {
      if (!provisioned) {
        setFiles([]);
        return;
      }
      setLoadingFiles(true);
      try {
        setFiles(await driveListFiles(account.id, key || undefined, selectedOpp?.id));
      } catch (cause) {
        if (cause instanceof DriveNotConfiguredError) setNotConfigured(true);
        else toast.error('Could not list files', { description: cause instanceof Error ? cause.message : undefined });
        setFiles([]);
      } finally {
        setLoadingFiles(false);
      }
    },
    [account.id, provisioned, selectedOpp?.id],
  );

  React.useEffect(() => {
    void loadFiles(activeKey);
  }, [loadFiles, activeKey]);

  const provision = async () => {
    setBusy('provision');
    try {
      if (scope === 'account') {
        await driveProvision(account.id);
      } else if (selectedOpp) {
        await driveProvisionOpportunity(account.id, selectedOpp.id);
      }
      toast.success(provisioned ? 'Folder tree checked.' : 'Drive folders created.');
      onChange();
      await opportunities.reload();
      await loadFiles(activeKey);
    } catch (cause) {
      if (cause instanceof DriveNotConfiguredError) setNotConfigured(true);
      else toast.error('Could not create folders', { description: cause instanceof Error ? cause.message : undefined });
    } finally {
      setBusy(null);
    }
  };

  const share = async () => {
    setBusy('share');
    try {
      const { shared, skipped } = await driveShareWithAccount(account.id);
      toast.success(`Shared with ${shared.length} ${shared.length === 1 ? 'person' : 'people'}.`, {
        description: skipped.length ? `Skipped (not a Google account): ${skipped.join(', ')}` : undefined,
      });
    } catch (cause) {
      if (cause instanceof DriveNotConfiguredError) setNotConfigured(true);
      else toast.error('Could not sync sharing', { description: cause instanceof Error ? cause.message : undefined });
    } finally {
      setBusy(null);
    }
  };

  if (notConfigured) {
    return (
      <PortalCard title="Google Drive" description="File workspace for this account.">
        <InfoNote>
          Drive isn’t connected yet. Add <strong>GOOGLE_OAUTH_CLIENT_ID</strong>,{' '}
          <strong>GOOGLE_OAUTH_CLIENT_SECRET</strong>, <strong>GOOGLE_OAUTH_REFRESH_TOKEN</strong> and{' '}
          <strong>GOOGLE_DRIVE_ROOT_FOLDER_ID</strong> in Vercel, then reload. See PORTAL.md → Google Drive.
        </InfoNote>
      </PortalCard>
    );
  }

  return (
    <PortalCard
      title="Google Drive"
      description="The account root holds onboarding material; each opportunity carries its own deal folders."
      action={
        <>
          {webLink && (
            <a href={webLink} target="_blank" rel="noreferrer">
              <PortalButton variant="secondary">
                <ExternalLink className="h-4 w-4" /> Open in Drive
              </PortalButton>
            </a>
          )}
          {scope === 'account' && provisioned && (
            <PortalButton variant="secondary" onClick={share} disabled={busy !== null}>
              <Users className="h-4 w-4" /> {busy === 'share' ? 'Syncing…' : 'Sync sharing'}
            </PortalButton>
          )}
          <PortalButton onClick={provision} disabled={busy !== null}>
            {provisioned ? <RefreshCw className="h-4 w-4" /> : <FolderPlus className="h-4 w-4" />}
            {busy === 'provision' ? 'Working…' : provisioned ? 'Repair tree' : 'Create folders'}
          </PortalButton>
        </>
      }
    >
      <div className="space-y-2">
        {/* Scope switcher: the account root, or any one opportunity's folder tree. */}
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setScopeId('account')}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm transition-colors',
              scope === 'account'
                ? 'bg-[color:var(--violet)] text-white'
                : 'bg-off-white text-grey hover:text-foreground',
            )}
          >
            Account
          </button>
          {opps.map((opp) => (
            <button
              key={opp.id}
              onClick={() => setScopeId(opp.id)}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm transition-colors',
                scope === opp.id
                  ? 'bg-[color:var(--violet)] text-white'
                  : 'bg-off-white text-grey hover:text-foreground',
              )}
            >
              {opp.name}
            </button>
          ))}
        </div>

        {!provisioned ? (
          <EmptyState
            title={scope === 'account' ? 'No account folders yet' : 'No folders for this opportunity yet'}
            description={
              scope === 'account'
                ? "Create the folder tree to store this account's onboarding material."
                : 'Create this opportunity’s folder tree (Discovery, Proposal, Contracts, Invoices, Delivery, Candidates).'
            }
          />
        ) : (
          <>
            <div className="flex flex-wrap gap-1.5 border-t border-border-color pt-3">
              {folders.map((folder) => (
                <button
                  key={folder.key || 'root'}
                  onClick={() => setActiveKey(folder.key)}
                  className={cn(
                    'rounded-md px-3 py-1.5 text-sm transition-colors',
                    activeKey === folder.key
                      ? 'bg-[color:var(--violet)] text-white'
                      : 'bg-off-white text-grey hover:text-foreground',
                  )}
                >
                  {folder.label}
                </button>
              ))}
            </div>

            {loadingFiles ? (
              <PortalSpinner label="Reading folder…" />
            ) : files.length === 0 ? (
              <EmptyState
                title="Empty folder"
                description="Files added here — in Drive or via the portal — show up in this list."
              />
            ) : (
              <PortalTable head={['Name', 'Modified', '']}>
                {files.map((file) => (
                  <Row key={file.id}>
                    <Cell>
                      <span className="font-medium">{file.name}</span>{' '}
                      {isFolder(file) && <StatusTag tone="grey">folder</StatusTag>}
                    </Cell>
                    <Cell className="whitespace-nowrap text-grey">
                      {file.modifiedTime ? formatDate(file.modifiedTime) : '—'}
                    </Cell>
                    <Cell className="text-right">
                      {file.webViewLink && (
                        <a
                          href={file.webViewLink}
                          target="_blank"
                          rel="noreferrer"
                          className="text-violet hover:underline"
                        >
                          Open
                        </a>
                      )}
                    </Cell>
                  </Row>
                ))}
              </PortalTable>
            )}
          </>
        )}
      </div>
    </PortalCard>
  );
};
