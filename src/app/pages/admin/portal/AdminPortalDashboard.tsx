import React from 'react';
import {
  Bar,
  BarChart,
  Cell as RechartsCell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useAsync } from '@/app/hooks/use-async';
import { usePortalUser } from '@/app/hooks/use-portal-user';
import {
  adminListAccountTeam,
  adminListFeedback,
  adminListMilestones,
  adminListProjectTeam,
  adminListProjects,
  adminListTimeEntries,
  adminListAccounts,
  adminListPublicHolidays,
} from '@/app/lib/portal-admin-api';
import { formatDate, prettyName } from '@/app/lib/portal-format';
import {
  bucketKey,
  bucketLabel,
  periodStart,
  PERIODS,
  todayIso,
  type Period,
} from '@/app/lib/portal-period';
import {
  MILESTONE_STATUS_LABELS,
  type AccountTeamMember,
  type Milestone,
  type PortalAccount,
  type Project,
  type ProjectTeamMember,
  type TimeEntry,
} from '@/app/lib/portal-types';
import { MySalaryWidget } from '@/app/components/portal/MySalaryWidget';
import { LogHoursButton } from '@/app/components/portal/LogHoursButton';
import { MyTimeOffWidget } from '@/app/components/portal/MyTimeOffWidget';
import { PublicHolidaysWidget } from '@/app/components/portal/PublicHolidaysWidget';
import { EmployeeAnalyticsPanel } from '@/app/components/admin/portal/EmployeeAnalyticsPanel';
import { ProjectAnalyticsPanel } from '@/app/components/admin/portal/ProjectAnalyticsPanel';
import { CompanyOverviewPanel } from '@/app/components/admin/portal/CompanyOverviewPanel';
import { FinancePnlOverview } from './AdminPortalFinance';
import {
  Cell,
  CollapsibleCards,
  EmptyState,
  ErrorNote,
  IconDateButton,
  PortalCard,
  PortalSpinner,
  PortalTable,
  Row,
  SortHeader,
  Stars,
  StatTile,
  StatusTag,
  toneFor,
  useTableSort,
} from '@/app/components/portal/PortalUi';
import { cn } from '@/app/components/ui/utils';

// Slice colours for the donut (violet family + accents).
const DONUT_COLORS = ['#6D28D9', '#8B5CF6', '#A78BFA', '#C4B5FD', '#7C3AED', '#5B21B6', '#DDD6FE'];

interface ProjectBundle {
  project: Project;
  accountName: string;
  team: ProjectTeamMember[];
  entries: TimeEntry[];
  milestones: Milestone[];
}

// One logged-hours line rendered in the list view.
interface HoursListRow {
  id: string;
  description: string;
  projectName: string;
  hoursValue: number;
  entry_date: string;
}

// The list-mode counterpart to the charts: the same records as a table, sortable by any column
// (click a header to toggle asc/desc), newest first by default. Lives in its own component so the
// sort hook isn't called after the dashboard's early returns.
const HoursListView: React.FC<{ rows: HoursListRow[] }> = ({ rows }) => {
  const { sorted, sort, toggle } = useTableSort(
    rows,
    {
      description: (row) => row.description || 'Delivery work',
      project: (row) => row.projectName,
      hours: (row) => row.hoursValue,
      date: (row) => row.entry_date,
    },
    { key: 'date', dir: 'desc' },
  );
  return (
    <PortalTable
      head={[
        <SortHeader key="description" label="Description" sortKey="description" sort={sort} onSort={toggle} />,
        <SortHeader key="project" label="Project" sortKey="project" sort={sort} onSort={toggle} />,
        <SortHeader key="hours" label="Actual hours" sortKey="hours" sort={sort} onSort={toggle} />,
        <SortHeader key="date" label="Date" sortKey="date" sort={sort} onSort={toggle} />,
      ]}
    >
      {sorted.map((entry) => (
        <Row key={entry.id}>
          <Cell className="font-medium">{entry.description || 'Delivery work'}</Cell>
          <Cell className="text-grey">{entry.projectName}</Cell>
          <Cell className="whitespace-nowrap text-right font-medium">{entry.hoursValue.toFixed(1)} h</Cell>
          <Cell className="whitespace-nowrap text-grey">{formatDate(entry.entry_date)}</Cell>
        </Row>
      ))}
    </PortalTable>
  );
};

/**
 * Delivery-focused admin home. Everything is scoped to the signed-in staffer: accounts/projects they
 * are a team member of, and hours they logged as the employee. Includes a quick Log Hours action and
 * two charts (hours by date, hours per project) with a shared calendar-range filter.
 */
const PersonalDashboard: React.FC = () => {
  const { user } = usePortalUser();
  const me = user?.id ?? '';

  const [period, setPeriod] = React.useState<Period>('month');
  const [fromDate, setFromDate] = React.useState('');
  const [toDate, setToDate] = React.useState('');
  const [view, setView] = React.useState<'charts' | 'list'>('charts');

  const data = useAsync(async () => {
    const accounts = await adminListAccounts();
    const nameById = new Map(accounts.map((account) => [account.id, account.name]));
    const teamLists = await Promise.all(accounts.map((account) => adminListAccountTeam(account.id).catch(() => [] as AccountTeamMember[])));
    const accountTeamById = new Map(accounts.map((account, index) => [account.id, teamLists[index]]));
    const projectLists = await Promise.all(accounts.map((account) => adminListProjects(account.id).catch(() => [] as Project[])));
    const projects = projectLists.flat();
    const bundles: ProjectBundle[] = await Promise.all(
      projects.map(async (project) => ({
        project,
        accountName: nameById.get(project.account_id) ?? '—',
        team: await adminListProjectTeam(project.id).catch(() => [] as ProjectTeamMember[]),
        entries: await adminListTimeEntries(project.id).catch(() => [] as TimeEntry[]),
        milestones: await adminListMilestones(project.id).catch(() => [] as Milestone[]),
      })),
    );
    return { accounts, accountTeamById, bundles };
  }, []);

  const feedback = useAsync(() => adminListFeedback(), []);
  const holidays = useAsync(() => adminListPublicHolidays(), []);

  if (data.loading) return <PortalSpinner label="Loading dashboard…" />;
  if (data.error) return <ErrorNote>{data.error}</ErrorNote>;

  const accounts = data.data?.accounts ?? [];
  const accountTeamById = data.data?.accountTeamById ?? new Map<string, AccountTeamMember[]>();
  const bundles = data.data?.bundles ?? [];

  // Membership: a project I'm on the team of; an account I own, am on the team of, or run a project on.
  const projectMember = (bundle: ProjectBundle) => bundle.team.some((member) => member.user_id === me);
  const accountMember = (account: PortalAccount) =>
    account.owner_id === me ||
    (accountTeamById.get(account.id) ?? []).some((member) => member.user_id === me) ||
    bundles.some((bundle) => bundle.project.account_id === account.id && projectMember(bundle));

  const myAccounts = accounts.filter(
    (account) => accountMember(account) && account.lifecycle !== 'stopped' && account.lifecycle !== 'lost',
  );
  const myProjects = bundles.filter((bundle) => projectMember(bundle) && bundle.project.status !== 'complete');

  // Hours I logged as the employee.
  const myEntries = bundles.flatMap((bundle) =>
    bundle.entries
      .filter((entry) => entry.user_id === me)
      .map((entry) => ({ ...entry, projectName: bundle.project.name })),
  );

  const month = todayIso().slice(0, 7);
  const monthMine = myEntries.filter((entry) => entry.entry_date.startsWith(month));
  const approvedHours = monthMine.filter((entry) => entry.approved).reduce((sum, entry) => sum + (entry.hours ?? 0), 0);
  const pendingHours = monthMine.filter((entry) => !entry.approved).reduce((sum, entry) => sum + (entry.hours ?? 0), 0);

  const today = todayIso();
  const upcoming = bundles
    .filter((bundle) => projectMember(bundle))
    .flatMap((bundle) =>
      bundle.milestones
        .filter(
          (milestone) =>
            milestone.due_date != null &&
            milestone.due_date >= today &&
            milestone.status !== 'approved' &&
            milestone.status !== 'complete',
        )
        .map((milestone) => ({ milestone, project: bundle.project, accountName: bundle.accountName })),
    )
    .sort((a, b) => (a.milestone.due_date ?? '').localeCompare(b.milestone.due_date ?? ''))
    .slice(0, 8);

  // Chart range: custom from/to override the period preset.
  const rangeFrom = fromDate || periodStart(period);
  const rangeTo = toDate || today;
  const rangeEntries = myEntries.filter(
    (entry) => (!rangeFrom || entry.entry_date >= rangeFrom) && (!rangeTo || entry.entry_date <= rangeTo),
  );

  // Bar chart: hours by date bucket.
  const byBucket = new Map<string, number>();
  for (const entry of rangeEntries) {
    const key = bucketKey(entry.entry_date, period);
    byBucket.set(key, (byBucket.get(key) ?? 0) + (entry.hours ?? 0));
  }
  const barData = [...byBucket.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, hours]) => ({ label: bucketLabel(key), hours: Number(hours.toFixed(2)) }));

  // Donut: hours per project.
  const byProject = new Map<string, number>();
  for (const entry of rangeEntries) byProject.set(entry.projectName, (byProject.get(entry.projectName) ?? 0) + (entry.hours ?? 0));
  const donutData = [...byProject.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({ name, value: Number(value.toFixed(2)) }));

  const myFeedback = (feedback.data ?? []).filter((entry) => entry.about_user_id === me);
  const myAvg =
    myFeedback.length > 0 ? (myFeedback.reduce((sum, entry) => sum + entry.rating, 0) / myFeedback.length).toFixed(1) : '—';
  const recentFeedback = [...myFeedback].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 4);

  // Compact filter cluster for the Reports header: view toggle + range presets + two date icons.
  const filters = (
    <div className="flex flex-wrap items-center gap-1.5">
      <div className="flex overflow-hidden rounded-md border border-border-color text-[11px] font-medium">
        {(['charts', 'list'] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => setView(mode)}
            className={cn(
              'px-2 py-1 capitalize transition-colors',
              view === mode ? 'bg-violet text-white' : 'text-grey hover:text-violet',
            )}
          >
            {mode}
          </button>
        ))}
      </div>
      <div className="flex overflow-hidden rounded-md border border-border-color text-[11px] font-medium">
        {PERIODS.map((entry) => (
          <button
            key={entry.key}
            type="button"
            onClick={() => {
              setPeriod(entry.key);
              setFromDate('');
              setToDate('');
            }}
            className={cn(
              'px-2 py-1 transition-colors',
              !fromDate && !toDate && period === entry.key ? 'bg-violet text-white' : 'text-grey hover:text-violet',
            )}
          >
            {entry.label}
          </button>
        ))}
      </div>
      <IconDateButton label="From date" value={fromDate} onChange={setFromDate} />
      <IconDateButton label="To date" value={toDate} onChange={setToDate} />
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 className="text-xl font-semibold text-violet">
          Welcome back{user ? `, ${prettyName(user.full_name).split(' ')[0]}` : ''}
        </h1>
        <p className="text-sm text-grey">Your delivery at a glance.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="My accounts" value={myAccounts.length} />
        <StatTile label="Projects" value={myProjects.length} />
        <StatTile label="Approved this month" value={`${approvedHours.toFixed(1)} h`} tone="green" />
        <StatTile
          label="Pending approval"
          value={`${pendingHours.toFixed(1)} h`}
          tone={pendingHours > 0 ? 'amber' : 'green'}
        />
      </div>

      {/* The signed-in staffer's own pay at a glance (any status). Kept outside CollapsibleCards with
          its own state so it starts collapsed on every visit (finance shouldn't linger open). */}
      {me && <MySalaryWidget userId={me} />}

      {/* Every card below is collapsible and remembers its open/closed state (scoped to this
          dashboard). Reports keeps its Log Hours action and filters visible in the header. */}
      <CollapsibleCards scope="admin-dashboard" defaultOpen>
        <PortalCard
          title="Reports"
          description="Your logged hours."
          keepActionWhenCollapsed
          action={({ open }) => (
            <div className="flex flex-wrap items-center justify-end gap-2">
              {open && filters}
              <LogHoursButton variant="secondary" onLogged={() => data.reload()} />
            </div>
          )}
        >
          {view === 'list' ? (
            rangeEntries.length === 0 ? (
              <EmptyState title="No hours in this range" />
            ) : (
              <HoursListView
                rows={rangeEntries.map((entry) => ({
                  id: entry.id,
                  description: entry.description,
                  projectName: entry.projectName,
                  hoursValue: entry.actual_hours ?? entry.hours ?? 0,
                  entry_date: entry.entry_date,
                }))}
              />
            )
          ) : (
          <div className="grid gap-6 lg:grid-cols-5">
            <div className="lg:col-span-3">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-grey">Hours by date</div>
              {barData.length === 0 ? (
                <EmptyState title="No hours in this range" />
              ) : (
                <div style={{ height: 240 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={barData} margin={{ top: 8, right: 8, bottom: 8, left: -16 }}>
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                      <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                      <Tooltip formatter={(value: number) => [`${value} h`, 'Hours']} />
                      <Bar dataKey="hours" fill="#6D28D9" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
            <div className="lg:col-span-2">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-grey">Hours per project</div>
              {donutData.length === 0 ? (
                <EmptyState title="No hours in this range" />
              ) : (
                <div style={{ height: 240 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={donutData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius="55%"
                        outerRadius="85%"
                        stroke="none"
                      >
                        {donutData.map((entry, index) => (
                          <RechartsCell key={entry.name} fill={DONUT_COLORS[index % DONUT_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => [`${value} h`, 'Hours']} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>
          )}
        </PortalCard>

      <div className="grid gap-4 lg:grid-cols-3">
        <PortalCard title="Upcoming milestones" description="On your projects, soonest first." className="lg:col-span-2">
          {upcoming.length === 0 ? (
            <EmptyState title="Nothing due" description="No open milestones with a due date ahead." />
          ) : (
            <ul className="divide-y divide-border-color">
              {upcoming.map(({ milestone, project, accountName }) => (
                <li key={milestone.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{milestone.name}</div>
                    <div className="truncate text-xs text-grey">
                      {accountName} · {project.name}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <StatusTag tone={toneFor(milestone.status)}>{MILESTONE_STATUS_LABELS[milestone.status]}</StatusTag>
                    <span className="whitespace-nowrap text-xs text-grey">{formatDate(milestone.due_date)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </PortalCard>

        <PortalCard title="Feedback about me" description={myFeedback.length > 0 ? `Average ${myAvg}/5` : undefined}>
          {feedback.loading ? (
            <PortalSpinner />
          ) : recentFeedback.length === 0 ? (
            <EmptyState title="No feedback yet" />
          ) : (
            <ul className="space-y-3">
              {recentFeedback.map((entry) => (
                <li key={entry.id} className="text-sm">
                  <div className="flex items-center gap-2">
                    <Stars value={entry.rating} size={14} />
                    <span className="text-xs text-grey">{formatDate(entry.created_at)}</span>
                  </div>
                  {entry.comment && <p className="mt-1 line-clamp-3 text-grey">{entry.comment}</p>}
                </li>
              ))}
            </ul>
          )}
        </PortalCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <MyTimeOffWidget />
        </div>
        <PublicHolidaysWidget holidays={holidays.data ?? []} />
      </div>
      </CollapsibleCards>
    </div>
  );
};

/**
 * Admin home shell. Portal admins get a tabbed view: the personal delivery dashboard (default) plus a
 * company-wide employee KPI analytics tab. Everyone else sees just the personal dashboard — the
 * analytics tab is admin-only (RLS also restricts the data it reads).
 */
export const AdminPortalDashboard: React.FC = () => {
  const { user } = usePortalUser();
  const isAdmin = user?.role === 'portal_admin';
  const [tab, setTab] = React.useState<'home' | 'company' | 'analytics' | 'projects' | 'pnl'>('home');

  if (!isAdmin) return <PersonalDashboard />;

  const tabs: { key: 'home' | 'company' | 'analytics' | 'projects' | 'pnl'; label: string }[] = [
    { key: 'home', label: 'Dashboard' },
    { key: 'company', label: 'Company' },
    { key: 'analytics', label: 'User KPI' },
    { key: 'projects', label: 'Project Analytics' },
    { key: 'pnl', label: 'P&L' },
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

      {/* Mount the heavier panels only when their tab is active — each fans out its own company-wide
          fetch (analytics: worklogs across all projects; P&L: the finance ledger). */}
      {tab === 'home' && <PersonalDashboard />}
      {tab === 'company' && <CompanyOverviewPanel />}
      {tab === 'analytics' && <EmployeeAnalyticsPanel />}
      {tab === 'projects' && <ProjectAnalyticsPanel />}
      {tab === 'pnl' && <FinancePnlOverview />}
    </div>
  );
};
