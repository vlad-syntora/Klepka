import React from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import {
  DriveNotConfiguredError,
  adminCreateAccount,
  adminListAccounts,
  adminListInternalUsers,
  driveProvision,
} from '@/app/lib/portal-admin-api';
import { usePortalUser } from '@/app/hooks/use-portal-user';
import { formatRelative, prettyName } from '@/app/lib/portal-format';
import {
  ACCOUNT_SOURCES,
  HEALTH_LABELS,
  LIFECYCLE_LABELS,
  isImplementer,
  type PortalAccount,
  type PortalUser,
} from '@/app/lib/portal-types';
import {
  Cell,
  EmptyState,
  ErrorNote,
  Field,
  PortalButton,
  PortalCard,
  PortalModal,
  PortalSpinner,
  PortalTable,
  Row,
  SortHeader,
  StatusTag,
  inputClass,
  toneFor,
  useTableSort,
} from '@/app/components/portal/PortalUi';
import { ProjectAnalyticsPanel } from '@/app/components/admin/portal/ProjectAnalyticsPanel';
import { cn } from '@/app/components/ui/utils';

type Filter = 'all' | 'needs_attention' | 'pre_sale' | 'delivery';

const AccountsList: React.FC = () => {
  const navigate = useNavigate();
  const { user } = usePortalUser();
  const [accounts, setAccounts] = React.useState<PortalAccount[]>([]);
  const [owners, setOwners] = React.useState<PortalUser[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [filter, setFilter] = React.useState<Filter>('all');
  const [query, setQuery] = React.useState('');
  const [showCreate, setShowCreate] = React.useState(false);
  const [name, setName] = React.useState('');
  const [industry, setIndustry] = React.useState('');
  const [ownerId, setOwnerId] = React.useState('');
  const [logo, setLogo] = React.useState('');
  const [source, setSource] = React.useState('');
  const [sourceSubtype, setSourceSubtype] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  // The delivery-only Implementer role can browse accounts but not create them.
  const canCreate = user ? !isImplementer(user.role) : false;

  const load = React.useCallback(async () => {
    try {
      setError(null);
      const [accountRows, ownerRows] = await Promise.all([adminListAccounts(), adminListInternalUsers()]);
      setAccounts(accountRows);
      setOwners(ownerRows);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load accounts.');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  // New accounts default to the signed-in staffer as owner (they can still reassign before saving).
  React.useEffect(() => {
    if (user?.id) setOwnerId((current) => current || user.id);
  }, [user?.id]);

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      const account = await adminCreateAccount({
        name: name.trim(),
        industry: industry.trim() || null,
        owner_id: ownerId || null,
        logo_url: logo.trim() || null,
        source: source || null,
        source_subtype: sourceSubtype.trim() || null,
      });
      toast.success('Account created.');

      // Provision the Drive folder tree for the new lead. Best-effort: a missing Drive config
      // or a transient error must not block account creation — the Documents tab keeps a manual
      // "Create folders" button as the fallback.
      try {
        await driveProvision(account.id);
        toast.success('Drive folders created.');
      } catch (cause) {
        if (!(cause instanceof DriveNotConfiguredError)) {
          toast.warning('Account created, but Drive folders were not — create them from the Documents tab.', {
            description: cause instanceof Error ? cause.message : undefined,
          });
        }
      }

      navigate(`/admin/portal/accounts/${account.id}`);
    } catch (cause) {
      toast.error('Could not create the account', {
        description: cause instanceof Error ? cause.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  };

  const visible = accounts.filter((account) => {
    if (query && !account.name.toLowerCase().includes(query.toLowerCase())) return false;
    if (filter === 'needs_attention') return account.health !== 'on_track';
    if (filter === 'pre_sale') return ['lead', 'qualified', 'proposal_sent'].includes(account.lifecycle);
    if (filter === 'delivery') return ['live', 'stopped'].includes(account.lifecycle);
    return true;
  });

  const { sorted, sort, toggle } = useTableSort(visible, {
    account: (a) => a.name.toLowerCase(),
    stage: (a) => LIFECYCLE_LABELS[a.lifecycle],
    health: (a) => HEALTH_LABELS[a.health],
    owner: (a) => (a.owner ? prettyName(a.owner.full_name).toLowerCase() : null),
    updated: (a) => a.updated_at,
  });

  if (loading) return <PortalSpinner label="Loading accounts…" />;
  if (error) return <ErrorNote>{error}</ErrorNote>;

  return (
    <div className="space-y-2">
      <PortalCard
        title="Accounts"
        description={`${accounts.length} total · ${accounts.filter((a) => a.health !== 'on_track').length} need attention`}
        action={
          <>
            <input
              className={`${inputClass} w-44 py-1.5 text-xs`}
              placeholder="Search accounts…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <select
              className={`${inputClass} w-auto py-1.5 text-xs`}
              value={filter}
              onChange={(event) => setFilter(event.target.value as Filter)}
            >
              <option value="all">All accounts</option>
              <option value="needs_attention">Needs attention</option>
              <option value="pre_sale">Pre-sale</option>
              <option value="delivery">Delivery &amp; live</option>
            </select>
            {canCreate && (
              <PortalButton className="whitespace-nowrap" onClick={() => setShowCreate(true)}>
                <Plus className="h-4 w-4 shrink-0" /> New account
              </PortalButton>
            )}
          </>
        }
      >
        <PortalModal
          open={showCreate}
          onClose={() => setShowCreate(false)}
          title="New account"
          description="Create a lead and provision its Drive folders."
        >
          <form onSubmit={create} className="grid gap-3 sm:grid-cols-2">
            <Field label="Account name">
              <input className={inputClass} value={name} onChange={(event) => setName(event.target.value)} required />
            </Field>
            <Field label="Industry">
              <input className={inputClass} value={industry} onChange={(event) => setIndustry(event.target.value)} />
            </Field>
            <Field label="Owner">
              <select className={inputClass} value={ownerId} onChange={(event) => setOwnerId(event.target.value)}>
                <option value="">Unassigned</option>
                {owners.map((owner) => (
                  <option key={owner.id} value={owner.id}>
                    {prettyName(owner.full_name)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Source">
              <select className={inputClass} value={source} onChange={(event) => setSource(event.target.value)}>
                <option value="">—</option>
                {ACCOUNT_SOURCES.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Source subtype" hint="e.g. referrer, event or partner name.">
              <input
                className={inputClass}
                value={sourceSubtype}
                onChange={(event) => setSourceSubtype(event.target.value)}
              />
            </Field>
            <Field label="Logo URL" hint="Shown as the account icon.">
              <input
                type="url"
                className={inputClass}
                value={logo}
                onChange={(event) => setLogo(event.target.value)}
                placeholder="https://…/logo.png"
              />
            </Field>
            <div className="flex items-end gap-2 sm:col-span-2">
              <PortalButton type="submit" disabled={busy}>
                {busy ? 'Creating…' : 'Create'}
              </PortalButton>
              <PortalButton variant="ghost" type="button" onClick={() => setShowCreate(false)}>
                Cancel
              </PortalButton>
            </div>
          </form>
        </PortalModal>

        {visible.length === 0 ? (
          <EmptyState title="No accounts match" />
        ) : (
          <PortalTable
            head={[
              <SortHeader key="account" label="Account" sortKey="account" sort={sort} onSort={toggle} />,
              <SortHeader key="stage" label="Stage" sortKey="stage" sort={sort} onSort={toggle} />,
              <SortHeader key="health" label="Health" sortKey="health" sort={sort} onSort={toggle} />,
              <SortHeader key="owner" label="Owner" sortKey="owner" sort={sort} onSort={toggle} />,
              <SortHeader key="updated" label="Last update" sortKey="updated" sort={sort} onSort={toggle} />,
            ]}
          >
            {sorted.map((account) => (
              <Row key={account.id} onClick={() => navigate(`/admin/portal/accounts/${account.id}`)}>
                <Cell>
                  <div className="flex items-center gap-2.5">
                    {account.logo_url ? (
                      <img src={account.logo_url} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
                    ) : (
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-portal-tint text-xs font-semibold text-violet">
                        {account.name.slice(0, 2).toUpperCase()}
                      </span>
                    )}
                    <div className="min-w-0">
                      <div className="font-medium">{account.name}</div>
                      {account.industry && <div className="text-xs text-grey">{account.industry}</div>}
                    </div>
                  </div>
                </Cell>
                <Cell>
                  <StatusTag tone="violet">{LIFECYCLE_LABELS[account.lifecycle]}</StatusTag>
                </Cell>
                <Cell>
                  <StatusTag tone={toneFor(account.health)}>{HEALTH_LABELS[account.health]}</StatusTag>
                </Cell>
                <Cell className="text-grey">{account.owner ? prettyName(account.owner.full_name) : 'Unassigned'}</Cell>
                <Cell className="whitespace-nowrap text-grey">{formatRelative(account.updated_at)}</Cell>
              </Row>
            ))}
          </PortalTable>
        )}
      </PortalCard>
    </div>
  );
};

/**
 * Accounts page shell. Portal admins get a tabbed view: the accounts list (default) plus a company-wide
 * Project Analytics tab. Everyone else sees just the list — the analytics tab is admin-only (RLS also
 * restricts the data it reads). The analytics panel mounts lazily (only when its tab is active) because
 * it fans out a heavy company-wide fetch.
 */
export const AdminAccounts: React.FC = () => {
  const { user } = usePortalUser();
  const isAdmin = user?.role === 'portal_admin';
  const [tab, setTab] = React.useState<'list' | 'projects'>('list');

  if (!isAdmin) return <AccountsList />;

  const tabs: { key: 'list' | 'projects'; label: string }[] = [
    { key: 'list', label: 'Accounts' },
    { key: 'projects', label: 'Project Analytics' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex gap-1 border-b border-border-color">
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              'border-b-2 px-3 py-2.5 text-sm transition-colors',
              tab === key ? 'border-violet font-medium text-violet' : 'border-transparent text-grey hover:text-foreground',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'list' && <AccountsList />}
      {tab === 'projects' && <ProjectAnalyticsPanel />}
    </div>
  );
};
