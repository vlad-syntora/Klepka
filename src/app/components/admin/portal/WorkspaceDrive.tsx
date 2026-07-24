import React from 'react';
import { toast } from 'sonner';
import { ExternalLink, FolderPlus, RefreshCw, Users } from 'lucide-react';
import {
  DriveNotConfiguredError,
  driveListFiles,
  driveProvision,
  driveShareWithAccount,
  type DriveFile,
} from '@/app/lib/portal-admin-api';
import { formatDate } from '@/app/lib/portal-format';
import type { PortalAccount } from '@/app/lib/portal-types';
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

// Mirrors the SUBFOLDERS map in api/google/drive.ts. Phase-aligned, numbered for sort order.
const FOLDERS: { key: string; label: string }[] = [
  { key: '00_onboarding', label: '00 Onboarding' },
  { key: '01_discovery', label: '01 Discovery' },
  { key: '02_proposal', label: '02 Proposal' },
  { key: '03_contracts', label: '03 Contracts' },
  { key: '04_invoices', label: '04 Invoices' },
  { key: '05_delivery', label: '05 Delivery' },
];

const isFolder = (file: DriveFile) => file.mimeType === 'application/vnd.google-apps.folder';

export const WorkspaceDrive: React.FC<{ account: PortalAccount; onChange: () => void }> = ({
  account,
  onChange,
}) => {
  const provisioned = Boolean(account.drive_folder_id);
  const [busy, setBusy] = React.useState<null | 'provision' | 'share'>(null);
  const [notConfigured, setNotConfigured] = React.useState(false);
  const [activeKey, setActiveKey] = React.useState<string>(FOLDERS[0].key);
  const [files, setFiles] = React.useState<DriveFile[]>([]);
  const [loadingFiles, setLoadingFiles] = React.useState(false);

  const loadFiles = React.useCallback(
    async (key: string) => {
      if (!provisioned) return;
      setLoadingFiles(true);
      try {
        setFiles(await driveListFiles(account.id, key));
      } catch (cause) {
        if (cause instanceof DriveNotConfiguredError) setNotConfigured(true);
        else toast.error('Could not list files', { description: cause instanceof Error ? cause.message : undefined });
        setFiles([]);
      } finally {
        setLoadingFiles(false);
      }
    },
    [account.id, provisioned],
  );

  React.useEffect(() => {
    void loadFiles(activeKey);
  }, [loadFiles, activeKey]);

  const provision = async () => {
    setBusy('provision');
    try {
      await driveProvision(account.id);
      toast.success(provisioned ? 'Folder tree checked.' : 'Drive folders created.');
      onChange();
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
      description="Phase-aligned folders in the Klepka Clients Shared Drive."
      action={
        <>
          {account.drive_web_link && (
            <a href={account.drive_web_link} target="_blank" rel="noreferrer">
              <PortalButton variant="secondary">
                <ExternalLink className="h-4 w-4" /> Open in Drive
              </PortalButton>
            </a>
          )}
          {provisioned && (
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
      {!provisioned ? (
        <EmptyState
          title="No Drive folders yet"
          description="Create the folder tree to store this account's presentations, discovery notes, contracts and invoices."
        />
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-1.5">
            {FOLDERS.map((folder) => (
              <button
                key={folder.key}
                onClick={() => setActiveKey(folder.key)}
                className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                  activeKey === folder.key
                    ? 'bg-[color:var(--violet)] text-white'
                    : 'bg-off-white text-grey hover:text-foreground'
                }`}
              >
                {folder.label}
              </button>
            ))}
          </div>

          {loadingFiles ? (
            <PortalSpinner label="Reading folder…" />
          ) : files.length === 0 ? (
            <EmptyState title="Empty folder" description="Files added here — in Drive or via the portal — show up in this list." />
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
                      <a href={file.webViewLink} target="_blank" rel="noreferrer" className="text-violet hover:underline">
                        Open
                      </a>
                    )}
                  </Cell>
                </Row>
              ))}
            </PortalTable>
          )}
        </div>
      )}
    </PortalCard>
  );
};
