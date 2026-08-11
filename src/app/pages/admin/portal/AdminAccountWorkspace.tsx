import React from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ChevronRight, Eye, FolderOpen } from 'lucide-react';
import { adminGetAccount } from '@/app/lib/portal-admin-api';
import { usePortalUser } from '@/app/hooks/use-portal-user';
import {
  HEALTH_LABELS,
  LIFECYCLE_LABELS,
  canEditAccounts,
  canViewPipeline,
  type PortalAccount,
} from '@/app/lib/portal-types';
import { CollapsibleCards, ErrorNote, PortalSpinner, StatusTag, toneFor } from '@/app/components/portal/PortalUi';
import { cn } from '@/app/components/ui/utils';
import { prettyName } from '@/app/lib/portal-format';
import { WorkspaceOverview } from '@/app/components/admin/portal/WorkspaceOverview';
import { WorkspacePipeline } from '@/app/components/admin/portal/WorkspacePipeline';
import { WorkspaceDocuments } from '@/app/components/admin/portal/WorkspaceDocuments';
import { WorkspaceDrive } from '@/app/components/admin/portal/WorkspaceDrive';
import { WorkspaceProject } from '@/app/components/admin/portal/WorkspaceProject';
import { WorkspaceFeedback } from '@/app/components/admin/portal/WorkspaceFeedback';
import { WorkspaceUsers } from '@/app/components/admin/portal/WorkspaceUsers';

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'pipeline', label: 'Pipeline & Offers' },
  { key: 'project', label: 'Project' },
  { key: 'documents', label: 'Contracts & Documents' },
  { key: 'users', label: 'Users & Access' },
  { key: 'feedback', label: 'Feedback' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

export const AdminAccountWorkspace: React.FC = () => {
  const { id = '' } = useParams();
  const { user } = usePortalUser();
  const [account, setAccount] = React.useState<PortalAccount | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  // The active tab lives in the URL (?tab=…) so a refresh — or a shared link — lands on the same tab.
  const [searchParams, setSearchParams] = useSearchParams();

  // Role-gated tabs (RLS also blocks the data). Implementers lose Pipeline & Offers. Everything is
  // shown while the user is still loading to avoid a flash-hide.
  const showPipeline = user ? canViewPipeline(user.role) : true;
  const canEdit = user ? canEditAccounts(user.role) : true;
  // Implementers (canEdit === false) also lose the Contracts & Documents tab.
  const tabs = TABS.filter(
    (entry) =>
      (entry.key !== 'pipeline' || showPipeline) &&
      (entry.key !== 'documents' || canEdit),
  );

  // Read the tab from the URL, falling back to Overview when it's missing or not allowed for this role.
  const tabParam = searchParams.get('tab');
  const tab: TabKey = tabParam && tabs.some((entry) => entry.key === tabParam) ? (tabParam as TabKey) : 'overview';
  const setTab = (next: TabKey) =>
    setSearchParams(
      (prev) => {
        prev.set('tab', next);
        return prev;
      },
      { replace: true },
    );

  const load = React.useCallback(async () => {
    try {
      setError(null);
      setAccount(await adminGetAccount(id));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load this account.');
    }
  }, [id]);

  React.useEffect(() => {
    void load();
  }, [load]);

  if (error) return <ErrorNote>{error}</ErrorNote>;
  if (!account) return <PortalSpinner label="Loading account…" />;

  return (
    <div className="space-y-2">
      <nav className="flex items-center gap-1 text-sm text-grey">
        <Link to="/admin/portal/accounts" className="hover:text-violet hover:underline">
          Accounts
        </Link>
        <ChevronRight className="h-4 w-4" />
        <span className="font-medium text-foreground">{account.name}</span>
      </nav>

      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold text-violet">{account.name}</h1>
        <StatusTag tone="violet">{LIFECYCLE_LABELS[account.lifecycle]}</StatusTag>
        <StatusTag tone={toneFor(account.health)}>{HEALTH_LABELS[account.health]}</StatusTag>
        <span className="text-sm text-grey">Owner: {account.owner ? prettyName(account.owner.full_name) : 'Unassigned'}</span>
        {/* View-as-client and the Drive folder link are hidden from the Implementer role. */}
        {canEdit && (
          <Link
            to={`/admin/portal/accounts/${account.id}/preview`}
            className="inline-flex items-center gap-1 text-sm text-violet hover:underline"
          >
            <Eye className="h-4 w-4" /> View as client
          </Link>
        )}
        {canEdit && account.drive_web_link && (
          <a
            href={account.drive_web_link}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-sm text-violet hover:underline"
          >
            <FolderOpen className="h-4 w-4" /> Drive folder
          </a>
        )}
      </div>

      <div className="-mb-px flex gap-1 overflow-x-auto border-b border-border-color">
        {tabs.map((entry) => (
          <button
            key={entry.key}
            onClick={() => setTab(entry.key)}
            className={cn(
              'whitespace-nowrap border-b-2 px-3 py-2.5 text-sm transition-colors',
              tab === entry.key
                ? 'border-violet font-medium text-violet'
                : 'border-transparent text-grey hover:text-foreground',
            )}
          >
            {entry.label}
          </button>
        ))}
      </div>

      <CollapsibleCards scope={`${account.id}:${tab}`}>
        {tab === 'overview' && <WorkspaceOverview account={account} onChange={load} canEdit={canEdit} />}
        {tab === 'pipeline' && showPipeline && <WorkspacePipeline account={account} onChange={load} />}
        {tab === 'documents' && (
          <div className="space-y-2">
            <WorkspaceDrive account={account} onChange={load} />
            <WorkspaceDocuments account={account} />
          </div>
        )}
        {tab === 'project' && <WorkspaceProject account={account} canEdit={canEdit} />}
        {tab === 'feedback' && <WorkspaceFeedback account={account} canRespond={canEdit} />}
        {tab === 'users' && <WorkspaceUsers account={account} canManage={canEdit} />}
      </CollapsibleCards>
    </div>
  );
};
