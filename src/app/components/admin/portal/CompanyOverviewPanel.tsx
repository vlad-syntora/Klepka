import React from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell as RechartsCell,
  LabelList,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useAsync } from '@/app/hooks/use-async';
import {
  adminGetFinanceSettings,
  adminListAccounts,
  adminListFeedback,
  adminListFinanceTransactions,
  adminListInternalUsers,
  adminListProjectTeam,
  adminListProjects,
  adminListTeams,
  adminListTimeEntries,
} from '@/app/lib/portal-admin-api';
import { formatMoney, prettyName } from '@/app/lib/portal-format';
import { todayIso } from '@/app/lib/portal-period';
import {
  type Feedback,
  type FinanceTransaction,
  type FinanceTransactionKind,
  type Lifecycle,
  type PortalAccount,
  type PortalTeam,
  type PortalUser,
  type Project,
  type ProjectTeamMember,
  type TimeEntry,
} from '@/app/lib/portal-types';
import {
  CollapsibleCards,
  EmptyState,
  ErrorNote,
  IconDateButton,
  PortalCard,
  PortalSpinner,
  StatTile,
} from '@/app/components/portal/PortalUi';

// Money palette (matches the finance P&L + KPI panels: green = income, amber = expense, violet = net).
const INCOME_COLOR = '#1E8E5A';
const EXPENSE_COLOR = '#B8860B';
const NET_COLOR = '#723D9C';
const FEEDBACK_COLOR = '#6D28D9';
// Distinct hues so stacked employee segments stay separable; cycles for large rosters.
const ENTITY_PALETTE = [
  '#6D28D9', '#F59E0B', '#EC4899', '#10B981', '#3B82F6', '#EF4444', '#14B8A6', '#A855F7',
  '#84CC16', '#F97316', '#0EA5E9', '#DB2777', '#65A30D', '#CA8A04', '#8B5CF6', '#DC2626',
  '#0D9488', '#7C3AED', '#D97706', '#059669',
];
// Slice palette for the breakdown donuts (portal accents + a few hues for long tails).
const PIE_COLORS = ['#723D9C', '#1E8E5A', '#B8860B', '#C0392B', '#2E86C1', '#16A085', '#D35400', '#7F7B82'];
// Cap the per-project stacked chart so a large portfolio stays legible.
const TOP_PROJECTS = 12;

const num = (value: number | string | null | undefined): number => {
  const n = typeof value === 'string' ? Number(value) : value ?? 0;
  return Number.isFinite(n) ? (n as number) : 0;
};

// One project with the roster (carries billing + pay rates) and worklogs needed to value it.
interface ProjBundle {
  project: Project;
  team: ProjectTeamMember[];
  entries: TimeEntry[];
}

// ---- Finance breakdown / period helpers (mirror the finance P&L page, kept local so the panel is
// self-contained). Amounts are already normalised into the base currency (base_amount). -------------

// The "type" a transaction rolls up under: salaries/invoices group as a whole; a manual entry uses its
// description (or "Other" when blank).
const txCategory = (tx: FinanceTransaction): string => {
  if (tx.source_type === 'salary') return 'Salaries';
  if (tx.source_type === 'invoice') return 'Invoices';
  return tx.note?.trim() || 'Other';
};

interface BreakdownSlice {
  name: string;
  value: number;
}

// Total base-currency amount per category for one kind (expense or income), largest first.
const breakdown = (transactions: FinanceTransaction[], kind: FinanceTransactionKind): BreakdownSlice[] => {
  const byCategory = new Map<string, number>();
  for (const tx of transactions) {
    if (tx.kind !== kind) continue;
    byCategory.set(txCategory(tx), (byCategory.get(txCategory(tx)) ?? 0) + tx.base_amount);
  }
  return [...byCategory.entries()]
    .map(([name, value]) => ({ name, value: Number(value.toFixed(2)) }))
    .sort((a, b) => b.value - a.value);
};

interface PeriodBar {
  label: string;
  income: number;
  expense: number;
  net: number;
}

const finalisePeriodBar = (bar: PeriodBar): PeriodBar => {
  const income = Number(bar.income.toFixed(2));
  const expense = Number(bar.expense.toFixed(2));
  return { label: bar.label, income, expense, net: Number((income - expense).toFixed(2)) };
};

// Income/expense/net grouped by quarter for a single calendar year (always all four quarters).
const quarterlyBars = (transactions: FinanceTransaction[], year: number): PeriodBar[] => {
  const bars: PeriodBar[] = [1, 2, 3, 4].map((q) => ({ label: `Q${q}`, income: 0, expense: 0, net: 0 }));
  for (const tx of transactions) {
    const [y, m] = tx.occurred_on.split('-').map(Number);
    if (y !== year) continue;
    const bar = bars[Math.floor((m - 1) / 3)];
    if (tx.kind === 'income') bar.income += tx.base_amount;
    else bar.expense += tx.base_amount;
  }
  return bars.map(finalisePeriodBar);
};

// Income/expense/net grouped by calendar year, oldest→newest (year-over-year).
const yearlyBars = (transactions: FinanceTransaction[]): PeriodBar[] => {
  const byYear = new Map<string, PeriodBar>();
  for (const tx of transactions) {
    const year = tx.occurred_on.slice(0, 4);
    const bar = byYear.get(year) ?? { label: year, income: 0, expense: 0, net: 0 };
    if (tx.kind === 'income') bar.income += tx.base_amount;
    else bar.expense += tx.base_amount;
    byYear.set(year, bar);
  }
  return [...byYear.values()].map(finalisePeriodBar).sort((a, b) => a.label.localeCompare(b.label));
};

// A grouped income / expenses / net bar chart for a periodic report (quarters or years).
const PeriodBars: React.FC<{ data: PeriodBar[]; base: string; emptyLabel: string }> = ({ data, base, emptyLabel }) => {
  const hasData = data.some((bar) => bar.income !== 0 || bar.expense !== 0);
  if (!hasData) {
    return <div style={{ height: 280 }} className="flex items-center justify-center text-xs text-grey">{emptyLabel}</div>;
  }
  return (
    <div style={{ height: 280 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: -8 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} width={64} />
          <Tooltip formatter={(value: number, name: string) => [formatMoney(value, base), name]} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="income" name="Income" fill={INCOME_COLOR} radius={[4, 4, 0, 0]} />
          <Bar dataKey="expense" name="Expenses" fill={EXPENSE_COLOR} radius={[4, 4, 0, 0]} />
          <Bar dataKey="net" name="Net" fill={NET_COLOR} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

// A donut of category totals for the expense/income breakdowns.
const BreakdownPie: React.FC<{ data: BreakdownSlice[]; base: string; emptyLabel: string }> = ({ data, base, emptyLabel }) => {
  if (data.length === 0) {
    return <div style={{ height: 280 }} className="flex items-center justify-center text-xs text-grey">{emptyLabel}</div>;
  }
  return (
    <div style={{ height: 280 }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={2}>
            {data.map((slice, index) => (
              <RechartsCell key={slice.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(value: number, name: string) => [formatMoney(value, base), name]} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

// A compact tooltip for the stacked-by-employee charts: only the non-zero segments (largest first)
// plus the column total. The default recharts tooltip would list every employee series (mostly zeros).
const StackTooltip =
  (format: (v: number) => string) =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ({ active, payload, label }: any): React.ReactElement | null => {
    if (!active || !payload) return null;
    const items = payload
      .filter((p: { value?: number }) => (p.value ?? 0) > 0)
      .sort((a: { value: number }, b: { value: number }) => b.value - a.value);
    if (items.length === 0) return null;
    const total = items.reduce((sum: number, p: { value: number }) => sum + p.value, 0);
    return (
      <div className="max-w-xs rounded-md border border-border-color bg-white p-2 text-[11px] shadow-md">
        <div className="mb-1 font-semibold text-foreground">
          {label} · {format(total)}
        </div>
        <ul className="space-y-0.5">
          {items.slice(0, 12).map((p: { name: string; value: number; color: string }) => (
            <li key={p.name} className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 shrink-0 rounded-sm" style={{ background: p.color }} />
              <span className="truncate text-grey">{p.name}</span>
              <span className="ml-auto font-medium text-foreground">{format(p.value)}</span>
            </li>
          ))}
          {items.length > 12 && <li className="text-grey/70">+{items.length - 12} more…</li>}
        </ul>
      </div>
    );
  };

// One column of a stacked-by-entity chart: a label plus a value per series key (missing = 0).
type StackRow = Record<string, string | number>;

// A stacked bar chart whose segments are individual employees (one Bar per series key). Used for both
// "profit by team" and "hours by project" — same shape, different value/format.
const StackedEntityChart: React.FC<{
  data: StackRow[];
  seriesKeys: string[];
  seriesName: (key: string) => string;
  format: (v: number) => string;
}> = ({ data, seriesKeys, seriesName, format }) => (
  <div style={{ height: 340 }}>
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: -8 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
        <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-12} textAnchor="end" height={60} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip content={StackTooltip(format)} />
        {seriesKeys.map((key, i) => (
          <Bar
            key={key}
            dataKey={key}
            name={seriesName(key)}
            stackId="stack"
            fill={ENTITY_PALETTE[i % ENTITY_PALETTE.length]}
            radius={i === seriesKeys.length - 1 ? [4, 4, 0, 0] : undefined}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  </div>
);

/**
 * Company productivity overview — portal-admin only. A single executive view stitching together the
 * highlights the individual analytics tabs go deep on: realised finance (income / expenses / net,
 * QoQ · YoY, by-type breakdowns), worklog profitability (project profits, profit per team split by
 * employee, hours per project split by employee), pipeline conversion (converted & win rate) and
 * feedback. The From/To range scopes the worklog charts, finance income/expenses/net and the by-type
 * breakdowns; QoQ/YoY are calendar aggregates over all history and pipeline / active-project figures are
 * a live snapshot.
 */
export const CompanyOverviewPanel: React.FC = () => {
  const [fromDate, setFromDate] = React.useState('');
  const [toDate, setToDate] = React.useState('');

  const data = useAsync(async () => {
    const [accounts, users, teams, feedback, transactions, settings] = await Promise.all([
      adminListAccounts(),
      adminListInternalUsers(),
      adminListTeams(),
      adminListFeedback().catch(() => [] as Feedback[]),
      adminListFinanceTransactions().catch(() => [] as FinanceTransaction[]),
      adminGetFinanceSettings().catch(() => null),
    ]);

    const projectLists = await Promise.all(accounts.map((a) => adminListProjects(a.id).catch(() => [] as Project[])));
    const projects = projectLists.flat();
    const bundles: ProjBundle[] = await Promise.all(
      projects.map(async (project) => ({
        project,
        team: await adminListProjectTeam(project.id).catch(() => [] as ProjectTeamMember[]),
        entries: await adminListTimeEntries(project.id).catch(() => [] as TimeEntry[]),
      })),
    );

    return { accounts, users, teams, feedback, transactions, bundles, baseCurrency: settings?.base_currency ?? 'USD' };
  }, []);

  if (data.loading) return <PortalSpinner label="Loading company overview…" />;
  if (data.error) return <ErrorNote>{data.error}</ErrorNote>;

  const accounts: PortalAccount[] = data.data?.accounts ?? [];
  const users: PortalUser[] = data.data?.users ?? [];
  const teams: PortalTeam[] = data.data?.teams ?? [];
  const feedback: Feedback[] = data.data?.feedback ?? [];
  const transactions: FinanceTransaction[] = data.data?.transactions ?? [];
  const bundles: ProjBundle[] = data.data?.bundles ?? [];
  const base = data.data?.baseCurrency ?? 'USD';

  const userById = new Map(users.map((u) => [u.id, u]));
  const teamNameById = new Map(teams.map((t) => [t.id, t.name]));

  // The From/To window scopes worklogs, finance transactions and feedback (empty From = no lower bound).
  const today = todayIso();
  const rangeFrom = fromDate;
  const rangeTo = toDate || today;
  const inRange = (date: string | null | undefined): boolean =>
    !!date && (!rangeFrom || date >= rangeFrom) && (!rangeTo || date <= rangeTo);

  // ---- Pipeline conversion (live snapshot, not date-ranged) ----------------------------------------
  const countByLifecycle = (lc: Lifecycle) => accounts.filter((a) => a.lifecycle === lc).length;
  const converted = countByLifecycle('live');
  const lost = countByLifecycle('lost');
  const decided = converted + lost;
  const totalLeads = accounts.length;
  const winRate = decided > 0 ? Math.round((converted / decided) * 100) : null;
  const convertedRate = totalLeads > 0 ? Math.round((converted / totalLeads) * 100) : null;

  // ---- Worklog profitability: per-employee profit + per-project-per-employee hours (over range) -----
  const profitByUser = new Map<string, number>(); // Σ (revenue − cost) attributed to the employee
  const projectHours: { projectId: string; name: string; total: number; byUser: Map<string, number> }[] = [];
  let totalWorklogRevenue = 0;
  let totalWorklogCost = 0;
  let activeProjects = 0;

  for (const { project, team, entries } of bundles) {
    if (project.status === 'active') activeProjects += 1;

    // Rates come off the roster: `rate` is hourly for T&M but a monthly fixed sum for fixed-price roles,
    // so reduce the latter to an effective hourly rate. Mirrors the KPI / project analytics panels.
    const billingRateByUser = new Map<string, number>();
    const payRateByUser = new Map<string, number>();
    for (const member of team) {
      if (!member.user_id) continue;
      if (member.rate != null) {
        const monthlyHours = num(member.monthly_hours);
        const billingRate =
          member.billing_type === 'fixed_price' && monthlyHours > 0 ? num(member.rate) / monthlyHours : num(member.rate);
        billingRateByUser.set(member.user_id, billingRate);
      }
      if (member.pay_rate != null) payRateByUser.set(member.user_id, num(member.pay_rate));
    }

    const hoursByUser = new Map<string, number>();
    let projTotalHours = 0;
    for (const entry of entries) {
      if (!inRange(entry.entry_date)) continue;
      const employeeId = entry.user_id ?? entry.reporter_id ?? null;
      if (!employeeId) continue;
      const worked = num(entry.actual_hours ?? entry.hours);
      const billed = num(entry.hours);
      const costRate = entry.pay_rate != null ? num(entry.pay_rate) : payRateByUser.get(employeeId) ?? 0;
      const reporterId = entry.reporter_id ?? employeeId;
      const billingRate = billingRateByUser.get(reporterId) ?? billingRateByUser.get(employeeId) ?? 0;
      const cost = worked * costRate;
      const revenue = billed * billingRate;

      totalWorklogRevenue += revenue;
      totalWorklogCost += cost;
      // Attribute profit + hours to internal staff only (skip logs whose employee isn't in the roster list).
      if (userById.has(employeeId)) {
        profitByUser.set(employeeId, (profitByUser.get(employeeId) ?? 0) + (revenue - cost));
        hoursByUser.set(employeeId, (hoursByUser.get(employeeId) ?? 0) + worked);
        projTotalHours += worked;
      }
    }
    if (projTotalHours > 0) {
      projectHours.push({ projectId: project.id, name: project.name, total: projTotalHours, byUser: hoursByUser });
    }
  }

  const totalProjectProfit = totalWorklogRevenue - totalWorklogCost;

  // ---- Profit per team, stacked by employee --------------------------------------------------------
  // Each employee belongs to at most one team; their profit lands only in that team's column, so the
  // union of employees forms the stack series (non-zero in exactly one bar each).
  const teamKeyFor = (u: PortalUser | undefined): string =>
    u?.team_id ? teamNameById.get(u.team_id) ?? 'Unassigned' : 'Unassigned';
  const teamProfitRows = new Map<string, StackRow>();
  const teamSeries = new Set<string>();
  for (const [userId, profit] of profitByUser) {
    if (profit <= 0) continue; // stacked bars can't render negative contributions meaningfully
    const user = userById.get(userId);
    const teamKey = teamKeyFor(user);
    const row = teamProfitRows.get(teamKey) ?? { name: teamKey };
    row[userId] = Number((num(row[userId]) + profit).toFixed(2));
    teamProfitRows.set(teamKey, row);
    teamSeries.add(userId);
  }
  const teamProfitData = [...teamProfitRows.values()].sort(
    (a, b) => rowTotal(b, teamSeries) - rowTotal(a, teamSeries),
  );
  const teamSeriesKeys = [...teamSeries].sort(
    (a, b) => (profitByUser.get(b) ?? 0) - (profitByUser.get(a) ?? 0),
  );

  // ---- Hours per project, stacked by employee (top projects by hours) ------------------------------
  const topProjects = [...projectHours].sort((a, b) => b.total - a.total).slice(0, TOP_PROJECTS);
  const projectSeries = new Set<string>();
  for (const proj of topProjects) for (const userId of proj.byUser.keys()) projectSeries.add(userId);
  const projectHoursData: StackRow[] = topProjects.map((proj) => {
    const row: StackRow = { name: proj.name };
    for (const [userId, hours] of proj.byUser) row[userId] = Number(hours.toFixed(1));
    return row;
  });
  const projectSeriesKeys = [...projectSeries].sort((a, b) => (profitByUser.get(b) ?? 0) - (profitByUser.get(a) ?? 0));
  const employeeName = (userId: string): string => prettyName(userById.get(userId)?.full_name ?? '—');

  // ---- Finance (income / expenses / net over range; breakdowns over range; QoQ/YoY over all time) ---
  const rangedTx = transactions.filter((tx) => inRange(tx.occurred_on));
  const income = rangedTx.filter((tx) => tx.kind === 'income').reduce((s, tx) => s + tx.base_amount, 0);
  const expenses = rangedTx.filter((tx) => tx.kind === 'expense').reduce((s, tx) => s + tx.base_amount, 0);
  const net = income - expenses;
  const expenseBreakdown = breakdown(rangedTx, 'expense');
  const incomeBreakdown = breakdown(rangedTx, 'income');
  const currentYear = new Date().getFullYear();
  const quarterBars = quarterlyBars(transactions, currentYear);
  const yearBars = yearlyBars(transactions);

  // ---- Feedback analytics (over range, by created_at) ----------------------------------------------
  const rangedFeedback = feedback.filter((f) => inRange(f.created_at.slice(0, 10)));
  const feedbackCount = rangedFeedback.length;
  const avgRating = feedbackCount > 0 ? rangedFeedback.reduce((s, f) => s + f.rating, 0) / feedbackCount : null;
  const urgentCount = rangedFeedback.filter((f) => f.is_urgent).length;
  const resolvedCount = rangedFeedback.filter((f) => f.status === 'resolved').length;
  const resolvedRate = feedbackCount > 0 ? Math.round((resolvedCount / feedbackCount) * 100) : null;
  const ratingDist = [1, 2, 3, 4, 5].map((star) => ({
    star: `${star}★`,
    count: rangedFeedback.filter((f) => Math.round(f.rating) === star).length,
  }));

  const moneyTip = (value: number) => formatMoney(value, base);
  const hoursTip = (value: number) => `${value.toFixed(1)} h`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="text-lg font-semibold text-violet">Company overview</h2>
        <p className="text-sm text-grey">
          Company productivity at a glance (base {base}). The range scopes the worklog charts, income/expenses/net
          and by-type breakdowns; QoQ/YoY span all history and conversion / active-project figures are a live
          snapshot. Admin-only.
        </p>
      </div>

      {/* Range — scopes worklog charts, finance income/expenses/net and feedback. */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] font-medium text-grey">Range:</span>
        <IconDateButton label="From date" value={fromDate} onChange={setFromDate} />
        <IconDateButton label="To date" value={toDate} onChange={setToDate} />
        {(fromDate || toDate) && (
          <button
            type="button"
            onClick={() => {
              setFromDate('');
              setToDate('');
            }}
            className="px-1 text-[11px] text-violet hover:underline"
          >
            Clear
          </button>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label={`Income (${base})`} value={formatMoney(income, base)} tone="green" />
        <StatTile label={`Expenses (${base})`} value={formatMoney(expenses, base)} tone="amber" />
        <StatTile label={`Net (${base})`} value={formatMoney(net, base)} tone={net >= 0 ? 'violet' : 'red'} />
        <StatTile
          label="Project profits"
          value={formatMoney(totalProjectProfit, base)}
          tone={totalProjectProfit >= 0 ? 'green' : 'red'}
          hint="worklog basis"
        />
        <StatTile label="Active projects" value={activeProjects} tone="violet" />
        <StatTile
          label="Converted rate"
          value={convertedRate != null ? `${convertedRate}%` : '—'}
          hint={`${converted}/${totalLeads} leads`}
        />
        <StatTile
          label="Win rate"
          value={winRate != null ? `${winRate}%` : '—'}
          tone="violet"
          hint={decided > 0 ? `${converted}/${decided} decided` : 'No decisions'}
        />
        <StatTile
          label="Avg feedback"
          value={avgRating != null ? `${avgRating.toFixed(1)}/5` : '—'}
          tone="green"
          hint={`${feedbackCount} received`}
        />
      </div>

      <CollapsibleCards scope="company-overview" defaultOpen>
        {/* Profit per team, split by the employees who generated it (worklog basis, over range). */}
        <PortalCard
          title="Team profitability by employee"
          description="Each employee's profit contribution (revenue − cost), stacked per team. Hover for the split."
        >
          {teamProfitData.length === 0 ? (
            <EmptyState title="No positive-profit work in this range" />
          ) : (
            <StackedEntityChart data={teamProfitData} seriesKeys={teamSeriesKeys} seriesName={employeeName} format={moneyTip} />
          )}
        </PortalCard>

        {/* Worked hours per project, split by the employees who logged them (top projects by hours). */}
        <PortalCard
          title="Project hours by employee"
          description={`Worked hours per project, stacked by employee (top ${TOP_PROJECTS} by hours).`}
        >
          {projectHoursData.length === 0 ? (
            <EmptyState title="No logged work in this range" />
          ) : (
            <StackedEntityChart
              data={projectHoursData}
              seriesKeys={projectSeriesKeys}
              seriesName={employeeName}
              format={hoursTip}
            />
          )}
        </PortalCard>

        <div className="grid gap-4 lg:grid-cols-2">
          <PortalCard title={`Quarterly (QoQ · ${currentYear})`} description="Income, expenses and net by quarter this year.">
            <PeriodBars data={quarterBars} base={base} emptyLabel={`No transactions in ${currentYear}.`} />
          </PortalCard>
          <PortalCard title="Yearly (YoY)" description="Income, expenses and net by calendar year.">
            <PeriodBars data={yearBars} base={base} emptyLabel="No transactions yet." />
          </PortalCard>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <PortalCard title="Expenses by type" description="Where the money goes (salaries, invoices, fixed costs).">
            <BreakdownPie data={expenseBreakdown} base={base} emptyLabel="No expenses in range." />
          </PortalCard>
          <PortalCard title="Income by type" description="Where the money comes from.">
            <BreakdownPie data={incomeBreakdown} base={base} emptyLabel="No income in range." />
          </PortalCard>
        </div>

        {/* Client feedback — rating distribution plus headline stats. */}
        <PortalCard
          title="Feedback analytics"
          description={
            avgRating != null
              ? `${avgRating.toFixed(1)}/5 average over ${feedbackCount} · ${resolvedRate}% resolved`
              : 'Client feedback ratings and resolution.'
          }
        >
          {feedbackCount === 0 ? (
            <EmptyState title="No feedback in this range" />
          ) : (
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="grid grid-cols-2 gap-3 lg:col-span-1">
                <StatTile label="Feedback" value={feedbackCount} />
                <StatTile label="Avg rating" value={avgRating != null ? `${avgRating.toFixed(1)}/5` : '—'} tone="green" />
                <StatTile label="Urgent" value={urgentCount} tone={urgentCount > 0 ? 'red' : 'green'} />
                <StatTile label="Resolved" value={resolvedRate != null ? `${resolvedRate}%` : '—'} tone="violet" />
              </div>
              <div className="lg:col-span-2">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-grey">Rating distribution</div>
                <div style={{ height: 240 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={ratingDist} margin={{ top: 8, right: 8, bottom: 8, left: -16 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                      <XAxis dataKey="star" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                      <Tooltip formatter={(value: number) => [`${value}`, 'Feedback']} />
                      <Bar dataKey="count" name="Feedback" fill={FEEDBACK_COLOR} radius={[4, 4, 0, 0]}>
                        <LabelList dataKey="count" position="top" fontSize={10} fill="#6D28D9" />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}
        </PortalCard>
      </CollapsibleCards>
    </div>
  );
};

// Sum a stacked row's numeric series values (ignores the `name` label) — used to order the columns.
function rowTotal(row: StackRow, keys: Set<string>): number {
  let total = 0;
  for (const key of keys) total += num(row[key]);
  return total;
}
