import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { ChevronRight, FolderOpen } from 'lucide-react';
import { adminGetAccount } from '@/app/lib/portal-admin-api';
import { usePortalUser } from '@/app/hooks/use-portal-user';
import { HEALTH_LABELS, LIFECYCLE_LABELS, canViewPayments, type PortalAccount } from '@/app/lib/portal-types';
import { CollapsibleCards, ErrorNote, PortalSpinner, StatusTag, toneFor } from '@/app/components/portal/PortalUi';
import { cn } from '@/app/components/ui/utils';
import { prettyName } from '@/app/lib/portal-format';
import { WorkspaceOverview } from '@/app/components/admin/portal/WorkspaceOverview';
import { WorkspaceResources } from '@/app/components/admin/portal/WorkspaceResources';
import { WorkspaceIntake } from '@/app/components/admin/portal/WorkspaceIntake';
import { WorkspacePipeline } from '@/app/components/admin/portal/WorkspacePipeline';
import { WorkspaceDocuments } from '@/app/components/admin/portal/WorkspaceDocuments';
import { WorkspaceDrive } from '@/app/components/admin/portal/WorkspaceDrive';
import { WorkspacePayments } from '@/app/components/admin/portal/WorkspacePayments';
import { WorkspaceProject } from '@/app/components/admin/portal/WorkspaceProject';
import { WorkspaceFeedback } from '@/app/components/admin/portal/WorkspaceFeedback';
import { WorkspaceUsers } from '@/app/components/admin/portal/WorkspaceUsers';

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'resources', label: 'Getting started' },
  { key: 'intake', label: 'Information gathering' },
  { key: 'pipeline', label: 'Pipeline & Offers' },
  { key: 'documents', label: 'Contracts & Documents' },
  { key: 'payments', label: 'Payments' },
  { key: 'project', label: 'Project' },
  { key: 'feedback', label: 'Feedback' },
  { key: 'users', label: 'Users & Access' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

export const AdminAccountWorkspace: React.FC = () => {
  const { id = '' } = useParams();
  const { user } = usePortalUser();
  const [account, setAccount] = React.useState<PortalAccount | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [tab, setTab] = React.useState<TabKey>('overview');

  // Payments are for Sales Rep / Ops-Finance / Portal Admin only — drop the tab for everyone else
  // (RLS also blocks the data). Show it while the user is still loading to avoid a flash-hide.
  const showPayments = user ? canViewPayments(user.role) : true;
  const tabs = showPayments ? TABS : TABS.filter((entry) => entry.key !== 'payments');

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
    <div className="space-y-5">
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
        {account.drive_web_link && (
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

      <CollapsibleCards>
        {tab === 'overview' && <WorkspaceOverview account={account} onChange={load} />}
        {tab === 'resources' && <WorkspaceResources account={account} />}
        {tab === 'intake' && <WorkspaceIntake account={account} />}
        {tab === 'pipeline' && <WorkspacePipeline account={account} onChange={load} />}
        {tab === 'documents' && (
          <div className="space-y-5">
            <WorkspaceDrive account={account} onChange={load} />
            <WorkspaceDocuments account={account} />
          </div>
        )}
        {tab === 'payments' && showPayments && <WorkspacePayments account={account} />}
        {tab === 'project' && <WorkspaceProject account={account} />}
        {tab === 'feedback' && <WorkspaceFeedback account={account} />}
        {tab === 'users' && <WorkspaceUsers account={account} />}
      </CollapsibleCards>
    </div>
  );
};
