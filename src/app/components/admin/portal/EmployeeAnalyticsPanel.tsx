import React from 'react';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  LabelList,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useAsync } from '@/app/hooks/use-async';
import {
  adminGetFinanceSettings,
  adminListAccounts,
  adminListCandidates,
  adminListFeedback,
  adminListInternalUsers,
  adminListOpportunities,
  adminListProjectTeam,
  adminListProjects,
  adminListTimeEntries,
  adminListTeams,
} from '@/app/lib/portal-admin-api';
import { formatMoney, prettyName } from '@/app/lib/portal-format';
import {
  groupBucketKey,
  groupBucketLabel,
  GRANULARITIES,
  todayIso,
  type Granularity,
} from '@/app/lib/portal-period';
import {
  ROLE_LABELS,
  type Candidate,
  type Feedback,
  type PortalTeam,
  type PortalUser,
  type ProjectStatus,
  type ProjectTeamMember,
  type TimeEntry,
} from '@/app/lib/portal-types';
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
  StatTile,
  useTableSort,
} from '@/app/components/portal/PortalUi';
import { cn } from '@/app/components/ui/utils';

// Chart palette — violet family for primary series, plus semantic accents for money/decisions.
const REVENUE_COLOR = '#6D28D9';
const COST_COLOR = '#F59E0B';
const MARGIN_COLOR = '#EC4899';
const ACCEPT_RATE_COLOR = '#6D28D9';
const CANDIDATE_COLORS: Record<string, string> = {
  Confirmed: '#10B981',
  Declined: '#EF4444',
  Proposed: '#94A3B8',
};
// Cycling palette for per-group series (e.g. one stacked bar per team on the activity trend).
const GROUP_PALETTE = ['#7C3AED', '#F59E0B', '#EC4899', '#10B981', '#3B82F6', '#EF4444', '#14B8A6', '#A855F7', '#84CC16', '#F97316'];

// One global grouping dimension drives every chart: role, job title, team or individual staffer.
type GroupBy = 'role' | 'title' | 'team' | 'user';
const GROUP_BYS: { key: GroupBy; label: string }[] = [
  { key: 'role', label: 'By role' },
  { key: 'title', label: 'By job title' },
  { key: 'team', label: 'By team' },
  { key: 'user', label: 'By user' },
];

// One project's worklogs alongside the roster that carries the billing (client) + pay (cost) rates.
// `status` lets the "active projects per employee" chart count only in-flight engagements.
interface ProjectData {
  status: ProjectStatus;
  team: ProjectTeamMember[];
  entries: TimeEntry[];
}

// Running per-employee tallies accumulated across every project's worklogs in range.
interface EmployeeAgg {
  userId: string;
  worked: number; // actual hours worked
  billed: number; // billable hours (client-charged)
  approved: number; // approved hours
  cost: number; // Σ worked × frozen pay rate
  revenue: number; // Σ billed × reporter's client rate
}

const emptyAgg = (userId: string): EmployeeAgg => ({
  userId,
  worked: 0,
  billed: 0,
  approved: 0,
  cost: 0,
  revenue: 0,
});

const num = (value: number | string | null | undefined): number => {
  const n = typeof value === 'string' ? Number(value) : value ?? 0;
  return Number.isFinite(n) ? (n as number) : 0;
};

// When a group's bar is split into one stacked segment per time bucket, ramp the fill opacity from
// faint (oldest period) to solid (newest) so the stack reads chronologically while keeping the
// metric's base colour (violet = revenue, amber = cost, etc.).
const rampOpacity = (i: number, n: number): number => (n <= 1 ? 1 : 0.4 + (0.6 * i) / (n - 1));

// Charts that split each bar by period carry too many series for the default legend (one per
// metric × period). This compact legend names just the metrics and states the shading direction.
const TimeSplitLegend: React.FC<{ items: { label: string; color: string }[]; gran: Granularity }> = ({
  items,
  gran,
}) => (
  <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 pt-1 text-[11px] text-grey">
    {items.map((it) => (
      <span key={it.label} className="inline-flex items-center gap-1">
        <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: it.color }} />
        {it.label}
      </span>
    ))}
    <span className="text-grey/70">· shaded light→dark by {gran}</span>
  </div>
);

/**
 * Company-wide employee KPI analytics — portal-admin only (rendered as the Dashboard "Analytics" tab).
 * Money is derived straight from the worklogs as the user directed: cost = actual hours × the pay rate
 * frozen on each log; revenue = billable hours × the reporter's client (billing) rate on the project
 * roster. Profit = revenue − cost; margin = profit ÷ revenue. A single top control groups every chart
 * by role, job title, team or individual, with an optional within-group filter to compare specific
 * groups; period filter applies throughout. Also surfaces candidate confirm/decline outcomes.
 */
export const EmployeeAnalyticsPanel: React.FC = () => {
  const [grouping, setGrouping] = React.useState<Granularity>('month');
  const [fromDate, setFromDate] = React.useState('');
  const [toDate, setToDate] = React.useState('');
  const [groupBy, setGroupBy] = React.useState<GroupBy>('team');
  const [selectedGroups, setSelectedGroups] = React.useState<string[]>([]);

  const data = useAsync(async () => {
    const [users, teams, accounts, settings] = await Promise.all([
      adminListInternalUsers(),
      adminListTeams(),
      adminListAccounts(),
      adminGetFinanceSettings().catch(() => null),
    ]);

    const projectLists = await Promise.all(accounts.map((a) => adminListProjects(a.id).catch(() => [])));
    const projects = projectLists.flat();
    const projectData: ProjectData[] = await Promise.all(
      projects.map(async (p) => ({
        status: p.status,
        team: await adminListProjectTeam(p.id).catch(() => [] as ProjectTeamMember[]),
        entries: await adminListTimeEntries(p.id).catch(() => [] as TimeEntry[]),
      })),
    );

    const oppLists = await Promise.all(accounts.map((a) => adminListOpportunities(a.id).catch(() => [])));
    const opportunities = oppLists.flat();
    const candidateLists = await Promise.all(
      opportunities.map((o) => adminListCandidates(o.id).catch(() => [] as Candidate[])),
    );
    const candidates = candidateLists.flat();

    const feedback = await adminListFeedback().catch(() => [] as Feedback[]);

    return {
      users,
      teams,
      projectData,
      candidates,
      feedback,
      baseCurrency: settings?.base_currency ?? 'USD',
    };
  }, []);

  if (data.loading) return <PortalSpinner label="Loading analytics…" />;
  if (data.error) return <ErrorNote>{data.error}</ErrorNote>;

  const users: PortalUser[] = data.data?.users ?? [];
  const teams: PortalTeam[] = data.data?.teams ?? [];
  const projectData: ProjectData[] = data.data?.projectData ?? [];
  const candidates: Candidate[] = data.data?.candidates ?? [];
  const feedback: Feedback[] = data.data?.feedback ?? [];
  const base = data.data?.baseCurrency ?? 'USD';

  const userById = new Map(users.map((u) => [u.id, u]));
  const teamNameById = new Map(teams.map((t) => [t.id, t.name]));

  // One grouping key per user, shared by every chart so the top control drives all of them.
  const groupKeyForUser = (u: PortalUser | undefined): string => {
    if (!u) return '—';
    if (groupBy === 'user') return prettyName(u.full_name);
    if (groupBy === 'title') return u.title || '—';
    if (groupBy === 'team') return u.team_id ? teamNameById.get(u.team_id) ?? 'Unassigned' : 'Unassigned';
    return ROLE_LABELS[u.role];
  };

  // Optional within-group filter: pick specific groups to compare. Empty selection = every group.
  const groupOptions = [...new Set(users.map((u) => groupKeyForUser(u)))].sort((a, b) => a.localeCompare(b));
  const isGroupIncluded = (key: string): boolean => selectedGroups.length === 0 || selectedGroups.includes(key);
  const userIncluded = (userId: string): boolean => isGroupIncluded(groupKeyForUser(userById.get(userId)));
  const toggleGroup = (key: string): void =>
    setSelectedGroups((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  // Date window comes solely from the From/To pickers (empty From = no lower bound, i.e. all history;
  // empty To = up to today). The Day/Week/Month/Quarter/Year control below is a grouping granularity,
  // not a range preset — it only decides how the time-series x-axis is bucketed.
  const today = todayIso();
  const rangeFrom = fromDate;
  const rangeTo = toDate || today;
  const inRange = (date: string | null | undefined): boolean =>
    !!date && (!rangeFrom || date >= rangeFrom) && (!rangeTo || date <= rangeTo);

  // ---- Per-employee aggregation over every project's in-range worklogs ------------------------------
  const aggByUser = new Map<string, EmployeeAgg>();
  // Time buckets for the activity trend, split by the active grouping dimension: bucketKey → group → worked hours.
  const trend = new Map<string, Map<string, number>>();
  // Revenue/cost per group per time bucket, so the "KPI by group" bars can stack by period: group → bucketKey → money.
  const groupTime = new Map<string, Map<string, { revenue: number; cost: number }>>();

  for (const { team, entries } of projectData) {
    const billingRateByUser = new Map<string, number>();
    const payRateByUser = new Map<string, number>();
    for (const member of team) {
      if (!member.user_id) continue;
      if (member.rate != null) {
        // `rate` means an hourly billing rate for T&M but a monthly fixed sum for fixed-price roles;
        // reduce the fixed-price sum to an effective hourly rate (sum ÷ monthly hours) so multiplying
        // by logged hours doesn't massively inflate revenue. Mirrors WorkspaceProject's display math.
        const monthlyHours = num(member.monthly_hours);
        const billingRate =
          member.billing_type === 'fixed_price' && monthlyHours > 0
            ? num(member.rate) / monthlyHours
            : num(member.rate);
        billingRateByUser.set(member.user_id, billingRate);
      }
      if (member.pay_rate != null) payRateByUser.set(member.user_id, num(member.pay_rate));
    }

    for (const entry of entries) {
      if (!inRange(entry.entry_date)) continue;
      const employeeId = entry.user_id ?? entry.reporter_id ?? null;
      if (!employeeId) continue;
      // Honour the within-group compare filter across the KPIs, grouped chart and time trend.
      if (!userIncluded(employeeId)) continue;

      const worked = num(entry.actual_hours ?? entry.hours);
      const billed = num(entry.hours);
      const costRate = entry.pay_rate != null ? num(entry.pay_rate) : payRateByUser.get(employeeId) ?? 0;
      const reporterId = entry.reporter_id ?? employeeId;
      const billingRate = billingRateByUser.get(reporterId) ?? billingRateByUser.get(employeeId) ?? 0;
      const cost = worked * costRate;
      const revenue = billed * billingRate;

      // Time bucket + group key are shared by the activity trend and the per-period money split below.
      const key = groupBucketKey(entry.entry_date, grouping);
      const groupKey = groupKeyForUser(userById.get(employeeId));

      // Attribute to the internal employee who did the work; skip logs whose employee isn't staff.
      if (userById.has(employeeId)) {
        const agg = aggByUser.get(employeeId) ?? emptyAgg(employeeId);
        agg.worked += worked;
        agg.billed += billed;
        agg.approved += entry.approved ? worked : 0;
        agg.cost += cost;
        agg.revenue += revenue;
        aggByUser.set(employeeId, agg);

        // Revenue/cost per group per period → lets each "KPI by group" bar stack by time bucket.
        const gt = groupTime.get(groupKey) ?? new Map<string, { revenue: number; cost: number }>();
        const cell = gt.get(key) ?? { revenue: 0, cost: 0 };
        cell.revenue += revenue;
        cell.cost += cost;
        gt.set(key, cell);
        groupTime.set(groupKey, gt);
      }

      // Bucket worked hours by time × the active group so the activity trend splits per group.
      const bucket = trend.get(key) ?? new Map<string, number>();
      bucket.set(groupKey, (bucket.get(groupKey) ?? 0) + worked);
      trend.set(key, bucket);
    }
  }

  // ---- Active projects per employee (live snapshot, not date-ranged) -------------------------------
  // How many in-flight (status 'active') projects each staffer is on the roster of. Honours the
  // within-group compare filter so it lines up with the other charts; distinct per project.
  const activeCountByUser = new Map<string, number>();
  for (const { status, team } of projectData) {
    if (status !== 'active') continue;
    const seen = new Set<string>();
    for (const member of team) {
      if (!member.active || !member.user_id || seen.has(member.user_id)) continue;
      if (!userById.has(member.user_id) || !userIncluded(member.user_id)) continue;
      seen.add(member.user_id);
      activeCountByUser.set(member.user_id, (activeCountByUser.get(member.user_id) ?? 0) + 1);
    }
  }
  const activeProjectData = [...activeCountByUser.entries()]
    .map(([userId, count]) => ({ name: prettyName(userById.get(userId)?.full_name ?? '—'), count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  // Average feedback rating per employee (all-time — feedback carries no reliable dated period here).
  const ratingByUser = new Map<string, { sum: number; count: number }>();
  for (const f of feedback) {
    if (!f.about_user_id) continue;
    const r = ratingByUser.get(f.about_user_id) ?? { sum: 0, count: 0 };
    r.sum += f.rating;
    r.count += 1;
    ratingByUser.set(f.about_user_id, r);
  }

  // Per-employee KPI rows (only staff who logged something in range).
  const employeeRows = [...aggByUser.values()]
    .map((agg) => {
      const user = userById.get(agg.userId);
      const profit = agg.revenue - agg.cost;
      const margin = agg.revenue > 0 ? (profit / agg.revenue) * 100 : null;
      const utilization = agg.worked > 0 ? (agg.billed / agg.worked) * 100 : null;
      const rating = ratingByUser.get(agg.userId);
      return {
        userId: agg.userId,
        name: user ? prettyName(user.full_name) : '—',
        role: user ? ROLE_LABELS[user.role] : '—',
        title: user?.title || '—',
        team: user?.team_id ? teamNameById.get(user.team_id) ?? 'Unassigned' : 'Unassigned',
        worked: agg.worked,
        billed: agg.billed,
        approved: agg.approved,
        cost: agg.cost,
        revenue: agg.revenue,
        profit,
        margin,
        utilization,
        rating: rating ? rating.sum / rating.count : null,
      };
    })
    .sort((a, b) => b.profit - a.profit);

  // ---- Company totals ------------------------------------------------------------------------------
  const totalRevenue = employeeRows.reduce((s, r) => s + r.revenue, 0);
  const totalCost = employeeRows.reduce((s, r) => s + r.cost, 0);
  const totalProfit = totalRevenue - totalCost;
  const companyMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : null;
  const totalWorked = employeeRows.reduce((s, r) => s + r.worked, 0);

  // ---- Grouped KPI (role / title / team / user) ----------------------------------------------------
  const groupKeyOf = (row: (typeof employeeRows)[number]): string =>
    groupKeyForUser(userById.get(row.userId));
  const groupMap = new Map<string, { revenue: number; cost: number; worked: number; headcount: number }>();
  for (const row of employeeRows) {
    const key = groupKeyOf(row);
    const g = groupMap.get(key) ?? { revenue: 0, cost: 0, worked: 0, headcount: 0 };
    g.revenue += row.revenue;
    g.cost += row.cost;
    g.worked += row.worked;
    g.headcount += 1;
    groupMap.set(key, g);
  }
  // Distinct time buckets present across all groups, chronologically — the stack order for every bar.
  const kpiBuckets = [...new Set([...groupTime.values()].flatMap((m) => [...m.keys()]))].sort((a, b) =>
    a.localeCompare(b),
  );
  const groupData = [...groupMap.entries()]
    .sort((a, b) => b[1].revenue - a[1].revenue)
    .map(([name, g]) => {
      // Aggregate columns (margin on the % axis) plus one revenue/cost field per period for the stacks.
      const row: Record<string, string | number> = {
        name,
        margin: g.revenue > 0 ? Number((((g.revenue - g.cost) / g.revenue) * 100).toFixed(1)) : 0,
      };
      const gt = groupTime.get(name);
      for (const key of kpiBuckets) {
        const cell = gt?.get(key);
        row[`rev__${key}`] = Number((cell?.revenue ?? 0).toFixed(2));
        row[`cost__${key}`] = Number((cell?.cost ?? 0).toFixed(2));
      }
      return row;
    });

  // ---- Trend series (worked hours over time, split by the active group) ----------------------------
  // The series list is the distinct groups present, ordered by total hours so the biggest stacks first.
  const trendGroupTotals = new Map<string, number>();
  for (const bucket of trend.values()) {
    for (const [g, hours] of bucket) trendGroupTotals.set(g, (trendGroupTotals.get(g) ?? 0) + hours);
  }
  const trendGroups = [...trendGroupTotals.entries()].sort((a, b) => b[1] - a[1]).map(([g]) => g);
  const trendData = [...trend.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, bucket]) => {
      const row: Record<string, string | number> = { label: groupBucketLabel(key) };
      for (const g of trendGroups) row[g] = Number((bucket.get(g) ?? 0).toFixed(1));
      return row;
    });

  // ---- Candidate confirm / decline -----------------------------------------------------------------
  // Candidates group by the same global dimension; fall back to the embedded staffer when they aren't
  // in the internal users list.
  const candidateGroupKeyOf = (c: Candidate): string => {
    const u = userById.get(c.user_id);
    if (u) return groupKeyForUser(u);
    if (groupBy === 'user') return c.user?.full_name ? prettyName(c.user.full_name) : '—';
    if (groupBy === 'title') return c.user?.title || c.title || '—';
    return '—';
  };
  // Decisions are dated on decided_at; proposed candidates fall back to created_at for the range. The
  // within-group compare filter applies here too.
  const rangeCandidates = candidates.filter(
    (c) =>
      (c.status === 'proposed'
        ? inRange(c.created_at.slice(0, 10))
        : inRange((c.decided_at ?? c.created_at).slice(0, 10))) && isGroupIncluded(candidateGroupKeyOf(c)),
  );
  const confirmedCount = rangeCandidates.filter((c) => c.status === 'confirmed').length;
  const declinedCount = rangeCandidates.filter((c) => c.status === 'declined').length;
  const decidedCount = confirmedCount + declinedCount;
  const acceptRate = decidedCount > 0 ? Math.round((confirmedCount / decidedCount) * 100) : null;
  const candidateGroupMap = new Map<string, { confirmed: number; declined: number; proposed: number }>();
  // Same counts split by time bucket, so each group's outcome bar can stack by period.
  const candidateTime = new Map<string, Map<string, { confirmed: number; declined: number; proposed: number }>>();
  for (const c of rangeCandidates) {
    const key = candidateGroupKeyOf(c);
    const statusKey = c.status === 'confirmed' ? 'confirmed' : c.status === 'declined' ? 'declined' : 'proposed';
    const g = candidateGroupMap.get(key) ?? { confirmed: 0, declined: 0, proposed: 0 };
    g[statusKey] += 1;
    candidateGroupMap.set(key, g);

    // Proposed candidates are dated on created_at; decided ones on decided_at (falling back to created_at).
    const cdate = (c.status === 'proposed' ? c.created_at : c.decided_at ?? c.created_at).slice(0, 10);
    const bkey = groupBucketKey(cdate, grouping);
    const ct = candidateTime.get(key) ?? new Map<string, { confirmed: number; declined: number; proposed: number }>();
    const cell = ct.get(bkey) ?? { confirmed: 0, declined: 0, proposed: 0 };
    cell[statusKey] += 1;
    ct.set(bkey, cell);
    candidateTime.set(key, ct);
  }
  const candidateBuckets = [...new Set([...candidateTime.values()].flatMap((m) => [...m.keys()]))].sort((a, b) =>
    a.localeCompare(b),
  );
  const candidateGroupData = [...candidateGroupMap.entries()]
    .map(([name, g]) => {
      const decided = g.confirmed + g.declined;
      const row: Record<string, string | number> = {
        name,
        total: g.confirmed + g.declined + g.proposed,
        acceptRate: decided > 0 ? Number(((g.confirmed / decided) * 100).toFixed(1)) : 0,
      };
      const ct = candidateTime.get(name);
      for (const key of candidateBuckets) {
        const cell = ct?.get(key);
        row[`conf__${key}`] = cell?.confirmed ?? 0;
        row[`dec__${key}`] = cell?.declined ?? 0;
        row[`prop__${key}`] = cell?.proposed ?? 0;
      }
      return row;
    })
    .sort((a, b) => (b.total as number) - (a.total as number));

  const moneyTip = (value: number) => formatMoney(value, base);

  // Compact filter cluster: the time-grouping granularity (buckets the x-axis) + the custom from/to
  // date window. Granularity is independent of the window — picking one never clears the dates.
  const filters = (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-[11px] font-medium text-grey">Group by:</span>
      <div className="flex overflow-hidden rounded-md border border-border-color text-[11px] font-medium">
        {GRANULARITIES.map((entry) => (
          <button
            key={entry.key}
            type="button"
            onClick={() => setGrouping(entry.key)}
            className={cn(
              'px-2 py-1 transition-colors',
              grouping === entry.key ? 'bg-violet text-white' : 'text-grey hover:text-violet',
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
        <h2 className="text-lg font-semibold text-violet">Employee KPIs</h2>
        <p className="text-sm text-grey">
          Delivery, profitability and hiring outcomes across the company. Money uses each log's pay rate and
          the reporter's client rate (base {base}). Admin-only.
        </p>
      </div>

      {/* Single filter row: period + dates, grouping dimension, and the within-group compare chips —
          together they drive every chart and KPI below. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {filters}
        <div className="flex overflow-hidden rounded-md border border-border-color text-[11px] font-medium">
          {GROUP_BYS.map((g) => (
            <button
              key={g.key}
              type="button"
              onClick={() => {
                setGroupBy(g.key);
                setSelectedGroups([]);
              }}
              className={cn(
                'px-2.5 py-1 transition-colors',
                groupBy === g.key ? 'bg-violet text-white' : 'text-grey hover:text-violet',
              )}
            >
              {g.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <span className="text-[11px] text-grey">Compare:</span>
          {groupOptions.map((opt) => {
            const active = selectedGroups.includes(opt);
            return (
              <button
                key={opt}
                type="button"
                onClick={() => toggleGroup(opt)}
                className={cn(
                  'rounded-full border px-2 py-0.5 text-[11px] transition-colors',
                  active
                    ? 'border-violet bg-violet text-white'
                    : 'border-border-color text-grey hover:border-violet hover:text-violet',
                )}
              >
                {opt}
              </button>
            );
          })}
          {selectedGroups.length > 0 ? (
            <button
              type="button"
              onClick={() => setSelectedGroups([])}
              className="px-1 text-[11px] text-violet hover:underline"
            >
              Clear ({selectedGroups.length})
            </button>
          ) : (
            <span className="text-[11px] text-grey/70">all</span>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatTile label="Revenue" value={formatMoney(totalRevenue, base)} tone="violet" />
        <StatTile label="Cost" value={formatMoney(totalCost, base)} tone="amber" />
        <StatTile label="Profit" value={formatMoney(totalProfit, base)} tone={totalProfit >= 0 ? 'green' : 'red'} />
        <StatTile
          label="Margin"
          value={companyMargin != null ? `${companyMargin.toFixed(1)}%` : '—'}
          tone={companyMargin != null && companyMargin >= 0 ? 'green' : 'red'}
        />
        <StatTile label="Hours worked" value={`${totalWorked.toFixed(0)} h`} />
        <StatTile
          label="Candidate accept rate"
          value={acceptRate != null ? `${acceptRate}%` : '—'}
          hint={decidedCount > 0 ? `${confirmedCount}/${decidedCount} decided` : 'No decisions'}
          tone="violet"
        />
      </div>

      {/* Each report collapses independently and remembers its open/closed state across visits. */}
      <CollapsibleCards scope="employee-analytics" defaultOpen>
      {/* KPI grouped by the chosen dimension: revenue and cost columns, each split into a stacked
          segment per time bucket (shaded light→dark), plus the aggregate margin% on the right axis. */}
      <PortalCard title="KPI by group" description="Revenue and cost per group, stacked by period; margin overall.">
        {groupData.length === 0 ? (
          <EmptyState title="No logged work in this range" />
        ) : (
          <div style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={groupData} margin={{ top: 8, right: 8, bottom: 8, left: -8 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-12} textAnchor="end" height={50} />
                <YAxis yAxisId="money" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="pct" orientation="right" tick={{ fontSize: 11 }} unit="%" />
                <Tooltip
                  formatter={(value: number, name: string) =>
                    name.startsWith('Margin') ? [`${value}%`, name] : [moneyTip(value), name]
                  }
                />
                <Legend
                  content={() => (
                    <TimeSplitLegend
                      items={[
                        { label: 'Revenue', color: REVENUE_COLOR },
                        { label: 'Cost', color: COST_COLOR },
                        { label: 'Margin', color: MARGIN_COLOR },
                      ]}
                      gran={grouping}
                    />
                  )}
                />
                {kpiBuckets.map((key, i) => (
                  <Bar
                    key={`rev-${key}`}
                    yAxisId="money"
                    dataKey={`rev__${key}`}
                    name={`Revenue · ${groupBucketLabel(key)}`}
                    stackId="rev"
                    fill={REVENUE_COLOR}
                    fillOpacity={rampOpacity(i, kpiBuckets.length)}
                    stroke="#fff"
                    strokeWidth={0.5}
                    radius={i === kpiBuckets.length - 1 ? [4, 4, 0, 0] : undefined}
                  />
                ))}
                {kpiBuckets.map((key, i) => (
                  <Bar
                    key={`cost-${key}`}
                    yAxisId="money"
                    dataKey={`cost__${key}`}
                    name={`Cost · ${groupBucketLabel(key)}`}
                    stackId="cost"
                    fill={COST_COLOR}
                    fillOpacity={rampOpacity(i, kpiBuckets.length)}
                    stroke="#fff"
                    strokeWidth={0.5}
                    radius={i === kpiBuckets.length - 1 ? [4, 4, 0, 0] : undefined}
                  />
                ))}
                <Bar yAxisId="pct" dataKey="margin" name="Margin" fill={MARGIN_COLOR} radius={[4, 4, 0, 0]}>
                  <LabelList
                    dataKey="margin"
                    position="insideTop"
                    fill="#fff"
                    fontSize={10}
                    formatter={(value: number) => `${value}%`}
                  />
                </Bar>
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </PortalCard>

      {/* Activity over time — worked hours per period, stacked by the active grouping dimension. */}
      <PortalCard
        title="Activity over time"
        description={`Worked hours by period, split ${GROUP_BYS.find((g) => g.key === groupBy)?.label.toLowerCase() ?? ''}.`}
      >
        {trendData.length === 0 ? (
          <EmptyState title="No hours in this range" />
        ) : (
          <div style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={trendData} margin={{ top: 8, right: 8, bottom: 8, left: -16 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip formatter={(value: number, name: string) => [`${value} h`, name]} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {trendGroups.map((g, i) => (
                  <Bar
                    key={g}
                    dataKey={g}
                    name={g}
                    stackId="hours"
                    fill={GROUP_PALETTE[i % GROUP_PALETTE.length]}
                    radius={i === trendGroups.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                  />
                ))}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </PortalCard>

      {/* How many in-flight projects each staffer is engaged on — a live staffing-load snapshot
          (independent of the date range; top 20 by count). */}
      <PortalCard title="Active projects per employee" description="In-flight (active) projects each staffer is on the roster of.">
        {activeProjectData.length === 0 ? (
          <EmptyState title="No one on an active project" />
        ) : (
          <div style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={activeProjectData} margin={{ top: 8, right: 8, bottom: 8, left: -16 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-12} textAnchor="end" height={60} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip formatter={(value: number) => [`${value}`, 'Active projects']} />
                <Bar dataKey="count" name="Active projects" fill={REVENUE_COLOR} radius={[4, 4, 0, 0]}>
                  <LabelList dataKey="count" position="top" fontSize={10} fill="#6D28D9" />
                </Bar>
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </PortalCard>

      {/* Candidate confirm / decline outcomes grouped by the global dimension, with the accept-rate line. */}
      <PortalCard
        title="Candidate outcomes"
        description={
          acceptRate != null ? `${acceptRate}% confirmed of decided overall` : 'Confirm vs decline by group'
        }
      >
        {candidateGroupData.length === 0 ? (
          <EmptyState title="No candidates in this range" />
        ) : (
          <div style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={candidateGroupData} margin={{ top: 8, right: 8, bottom: 8, left: -16 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-12} textAnchor="end" height={50} />
                <YAxis yAxisId="count" tick={{ fontSize: 11 }} allowDecimals={false} />
                <YAxis yAxisId="pct" orientation="right" tick={{ fontSize: 11 }} unit="%" domain={[0, 100]} />
                <Tooltip
                  formatter={(value: number, name: string) =>
                    name.startsWith('Accept rate') ? [`${value}%`, name] : [`${value}`, name]
                  }
                />
                <Legend
                  content={() => (
                    <TimeSplitLegend
                      items={[
                        { label: 'Confirmed', color: CANDIDATE_COLORS.Confirmed },
                        { label: 'Declined', color: CANDIDATE_COLORS.Declined },
                        { label: 'Proposed', color: CANDIDATE_COLORS.Proposed },
                        { label: 'Accept rate', color: ACCEPT_RATE_COLOR },
                      ]}
                      gran={grouping}
                    />
                  )}
                />
                {candidateBuckets.map((key, i) => (
                  <Bar
                    key={`conf-${key}`}
                    yAxisId="count"
                    dataKey={`conf__${key}`}
                    name={`Confirmed · ${groupBucketLabel(key)}`}
                    stackId="confirmed"
                    fill={CANDIDATE_COLORS.Confirmed}
                    fillOpacity={rampOpacity(i, candidateBuckets.length)}
                    stroke="#fff"
                    strokeWidth={0.5}
                    radius={i === candidateBuckets.length - 1 ? [4, 4, 0, 0] : undefined}
                  />
                ))}
                {candidateBuckets.map((key, i) => (
                  <Bar
                    key={`dec-${key}`}
                    yAxisId="count"
                    dataKey={`dec__${key}`}
                    name={`Declined · ${groupBucketLabel(key)}`}
                    stackId="declined"
                    fill={CANDIDATE_COLORS.Declined}
                    fillOpacity={rampOpacity(i, candidateBuckets.length)}
                    stroke="#fff"
                    strokeWidth={0.5}
                    radius={i === candidateBuckets.length - 1 ? [4, 4, 0, 0] : undefined}
                  />
                ))}
                {candidateBuckets.map((key, i) => (
                  <Bar
                    key={`prop-${key}`}
                    yAxisId="count"
                    dataKey={`prop__${key}`}
                    name={`Proposed · ${groupBucketLabel(key)}`}
                    stackId="proposed"
                    fill={CANDIDATE_COLORS.Proposed}
                    fillOpacity={rampOpacity(i, candidateBuckets.length)}
                    stroke="#fff"
                    strokeWidth={0.5}
                    radius={i === candidateBuckets.length - 1 ? [4, 4, 0, 0] : undefined}
                  />
                ))}
                <Line
                  yAxisId="pct"
                  type="monotone"
                  dataKey="acceptRate"
                  name="Accept rate"
                  stroke={ACCEPT_RATE_COLOR}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </PortalCard>

      {/* Full per-employee leaderboard, sortable by any KPI. */}
      <PortalCard title="Employee leaderboard" description="Every staffer who logged work in range.">
        {employeeRows.length === 0 ? (
          <EmptyState title="No logged work in this range" />
        ) : (
          <KpiLeaderboard rows={employeeRows} base={base} />
        )}
      </PortalCard>
      </CollapsibleCards>
    </div>
  );
};

type LeaderboardRow = {
  userId: string;
  name: string;
  role: string;
  title: string;
  team: string;
  worked: number;
  billed: number;
  cost: number;
  revenue: number;
  profit: number;
  margin: number | null;
  utilization: number | null;
  rating: number | null;
};

// The KPI table lives in its own component so its sort hook isn't called after the panel's early
// returns (loading/error).
const KpiLeaderboard: React.FC<{ rows: LeaderboardRow[]; base: string }> = ({ rows, base }) => {
  const { sorted, sort, toggle } = useTableSort(
    rows,
    {
      name: (r) => r.name.toLowerCase(),
      role: (r) => r.role,
      team: (r) => r.team,
      worked: (r) => r.worked,
      utilization: (r) => r.utilization ?? -1,
      revenue: (r) => r.revenue,
      cost: (r) => r.cost,
      profit: (r) => r.profit,
      margin: (r) => r.margin ?? -1,
      rating: (r) => r.rating ?? -1,
    },
    { key: 'profit', dir: 'desc' },
  );

  return (
    <PortalTable
      className="[&_th]:px-3 [&_td]:px-3"
      head={[
        <SortHeader key="name" label="Employee" sortKey="name" sort={sort} onSort={toggle} />,
        <SortHeader key="role" label="Role" sortKey="role" sort={sort} onSort={toggle} />,
        <SortHeader key="team" label="Team" sortKey="team" sort={sort} onSort={toggle} />,
        <SortHeader key="worked" label="Hours" sortKey="worked" sort={sort} onSort={toggle} />,
        <SortHeader key="utilization" label="Utilization" sortKey="utilization" sort={sort} onSort={toggle} />,
        <SortHeader key="revenue" label={`Revenue (${base})`} sortKey="revenue" sort={sort} onSort={toggle} />,
        <SortHeader key="cost" label={`Cost (${base})`} sortKey="cost" sort={sort} onSort={toggle} />,
        <SortHeader key="profit" label={`Profit (${base})`} sortKey="profit" sort={sort} onSort={toggle} />,
        <SortHeader key="margin" label="Margin" sortKey="margin" sort={sort} onSort={toggle} />,
        <SortHeader key="rating" label="Rating" sortKey="rating" sort={sort} onSort={toggle} />,
      ]}
    >
      {sorted.map((r) => (
        <Row key={r.userId}>
          <Cell className="whitespace-nowrap">
            <div className="font-medium">{r.name}</div>
            {r.title !== '—' && <div className="text-xs text-grey">{r.title}</div>}
          </Cell>
          <Cell className="whitespace-nowrap text-grey">{r.role}</Cell>
          <Cell className="whitespace-nowrap text-grey">{r.team}</Cell>
          <Cell className="whitespace-nowrap text-right">{r.worked.toFixed(1)} h</Cell>
          <Cell className="whitespace-nowrap text-right text-grey">
            {r.utilization != null ? `${r.utilization.toFixed(0)}%` : '—'}
          </Cell>
          <Cell className="whitespace-nowrap text-right text-violet">{formatMoney(r.revenue, base)}</Cell>
          <Cell className="whitespace-nowrap text-right text-portal-amber">{formatMoney(r.cost, base)}</Cell>
          <Cell
            className={cn(
              'whitespace-nowrap text-right font-medium',
              r.profit >= 0 ? 'text-portal-green' : 'text-portal-red',
            )}
          >
            {formatMoney(r.profit, base)}
          </Cell>
          <Cell className="whitespace-nowrap text-right">
            {r.margin != null ? `${r.margin.toFixed(0)}%` : '—'}
          </Cell>
          <Cell className="whitespace-nowrap text-right text-grey">
            {r.rating != null ? r.rating.toFixed(1) : '—'}
          </Cell>
        </Row>
      ))}
    </PortalTable>
  );
};
