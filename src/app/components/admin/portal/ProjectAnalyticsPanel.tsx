import React from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell as RechartsCell,
  ComposedChart,
  LabelList,
  Legend,
  Line,
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
  adminListProjectTeam,
  adminListProjects,
  adminListTimeEntries,
} from '@/app/lib/portal-admin-api';
import { formatMoney } from '@/app/lib/portal-format';
import { todayIso } from '@/app/lib/portal-period';
import {
  LIFECYCLE_LABELS,
  PROJECT_STATUS_LABELS,
  projectStatusTone,
  type Lifecycle,
  type PortalAccount,
  type Project,
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
  StatusTag,
  useTableSort,
} from '@/app/components/portal/PortalUi';

// Money palette shared with the employee KPI panel (violet = revenue, amber = cost, pink = margin).
const REVENUE_COLOR = '#6D28D9';
const COST_COLOR = '#F59E0B';
const MARGIN_COLOR = '#EC4899';
// Violet ramp for the lead-stage funnel; the terminal outcomes get semantic colours.
const STAGE_COLORS = ['#C4B5FD', '#A78BFA', '#8B5CF6', '#6D28D9'];
const CONVERTED_COLOR = '#10B981';
const LOST_COLOR = '#EF4444';
const STOPPED_COLOR = '#F59E0B';
const INPROGRESS_COLOR = '#94A3B8';
// Cycling palette for the project status donut.
const STATUS_COLORS: Record<ProjectStatus, string> = {
  planned: '#94A3B8',
  active: '#6D28D9',
  on_hold: '#F59E0B',
  complete: '#10B981',
};

// The linear pre-sale → delivery path a lead travels; stopped/lost are terminal and sit outside it.
const LINEAR_STAGES: Lifecycle[] = ['lead', 'qualified', 'proposal_sent', 'live'];

// Cap the per-project bar charts so a large portfolio stays legible; the full list lives in the table.
const TOP_N = 12;

const num = (value: number | string | null | undefined): number => {
  const n = typeof value === 'string' ? Number(value) : value ?? 0;
  return Number.isFinite(n) ? (n as number) : 0;
};

// One project with the roster (carries billing + pay rates) and worklogs needed to value it.
interface ProjBundle {
  project: Project;
  accountName: string;
  team: ProjectTeamMember[];
  entries: TimeEntry[];
}

// A fully-derived per-project row: profitability (over the selected range) + engaged headcount.
interface ProjectRow {
  id: string;
  name: string;
  accountName: string;
  status: ProjectStatus;
  revenue: number;
  cost: number;
  profit: number;
  margin: number | null;
  worked: number;
  engaged: number;
}

/**
 * Company-wide project analytics — portal-admin only. Answers: how many projects and at what status;
 * how leads convert through the lifecycle stages; how many leads were lost vs converted to a live
 * project; per-project profitability (worklog money basis, same as the employee KPI panel); and how
 * many employees are engaged per project. Lead/stage/headcount cards are a live snapshot; the money
 * cards honour the From/To range (empty From = all history).
 */
export const ProjectAnalyticsPanel: React.FC = () => {
  const [fromDate, setFromDate] = React.useState('');
  const [toDate, setToDate] = React.useState('');

  const data = useAsync(async () => {
    const [accounts, settings] = await Promise.all([
      adminListAccounts(),
      adminGetFinanceSettings().catch(() => null),
    ]);
    const nameById = new Map(accounts.map((a) => [a.id, a.name]));
    const projectLists = await Promise.all(accounts.map((a) => adminListProjects(a.id).catch(() => [] as Project[])));
    const projects = projectLists.flat();
    const bundles: ProjBundle[] = await Promise.all(
      projects.map(async (project) => ({
        project,
        accountName: nameById.get(project.account_id) ?? '—',
        team: await adminListProjectTeam(project.id).catch(() => [] as ProjectTeamMember[]),
        entries: await adminListTimeEntries(project.id).catch(() => [] as TimeEntry[]),
      })),
    );
    return { accounts, bundles, baseCurrency: settings?.base_currency ?? 'USD' };
  }, []);

  if (data.loading) return <PortalSpinner label="Loading project analytics…" />;
  if (data.error) return <ErrorNote>{data.error}</ErrorNote>;

  const accounts: PortalAccount[] = data.data?.accounts ?? [];
  const bundles: ProjBundle[] = data.data?.bundles ?? [];
  const base = data.data?.baseCurrency ?? 'USD';

  // The From/To window scopes the profitability worklogs only (empty From = no lower bound).
  const today = todayIso();
  const rangeFrom = fromDate;
  const rangeTo = toDate || today;
  const inRange = (date: string | null | undefined): boolean =>
    !!date && (!rangeFrom || date >= rangeFrom) && (!rangeTo || date <= rangeTo);

  // ---- Lead lifecycle funnel + outcomes (live snapshot) --------------------------------------------
  const countByLifecycle = (lc: Lifecycle) => accounts.filter((a) => a.lifecycle === lc).length;
  const linIdx = (lc: Lifecycle) => LINEAR_STAGES.indexOf(lc);
  // Funnel: an account at a later stage has, by definition, passed through the earlier ones — so each
  // stage counts everyone at that stage or beyond on the linear path. Terminal (lost/stopped) accounts
  // sit outside this path and are shown separately in the outcomes donut.
  const funnelData = LINEAR_STAGES.map((stage, i) => {
    const reached = accounts.filter((a) => linIdx(a.lifecycle) >= i).length;
    return { stage: LIFECYCLE_LABELS[stage], reached };
  }).map((row, i, rows) => ({
    ...row,
    // Conversion from the previous stage — the drop-off between funnel steps.
    conversion: i === 0 || rows[i - 1].reached === 0 ? null : Math.round((row.reached / rows[i - 1].reached) * 100),
  }));

  const converted = countByLifecycle('live');
  const lost = countByLifecycle('lost');
  const stopped = countByLifecycle('stopped');
  const inProgress = countByLifecycle('lead') + countByLifecycle('qualified') + countByLifecycle('proposal_sent');
  const decided = converted + lost;
  const winRate = decided > 0 ? Math.round((converted / decided) * 100) : null;
  const outcomeData = [
    { name: 'Converted (live)', value: converted, color: CONVERTED_COLOR },
    { name: 'Lost', value: lost, color: LOST_COLOR },
    { name: 'Stopped', value: stopped, color: STOPPED_COLOR },
    { name: 'In progress', value: inProgress, color: INPROGRESS_COLOR },
  ].filter((slice) => slice.value > 0);

  // ---- Per-project profitability + engaged headcount ------------------------------------------------
  const projectRows: ProjectRow[] = bundles.map(({ project, accountName, team, entries }) => {
    // Rates come off the roster: `rate` is hourly for T&M but a monthly fixed sum for fixed-price roles,
    // so reduce the latter to an effective hourly rate. Mirrors the employee KPI panel's math.
    const billingRateByUser = new Map<string, number>();
    const payRateByUser = new Map<string, number>();
    for (const member of team) {
      if (!member.user_id) continue;
      if (member.rate != null) {
        const monthlyHours = num(member.monthly_hours);
        const billingRate =
          member.billing_type === 'fixed_price' && monthlyHours > 0
            ? num(member.rate) / monthlyHours
            : num(member.rate);
        billingRateByUser.set(member.user_id, billingRate);
      }
      if (member.pay_rate != null) payRateByUser.set(member.user_id, num(member.pay_rate));
    }

    let revenue = 0;
    let cost = 0;
    let worked = 0;
    for (const entry of entries) {
      if (!inRange(entry.entry_date)) continue;
      const employeeId = entry.user_id ?? entry.reporter_id ?? null;
      const w = num(entry.actual_hours ?? entry.hours);
      const billed = num(entry.hours);
      const costRate = entry.pay_rate != null ? num(entry.pay_rate) : employeeId ? payRateByUser.get(employeeId) ?? 0 : 0;
      const reporterId = entry.reporter_id ?? employeeId;
      const billingRate =
        (reporterId ? billingRateByUser.get(reporterId) : undefined) ??
        (employeeId ? billingRateByUser.get(employeeId) : undefined) ??
        0;
      cost += w * costRate;
      revenue += billed * billingRate;
      worked += w;
    }

    const engaged = new Set(team.filter((m) => m.active && m.user_id).map((m) => m.user_id)).size;
    return {
      id: project.id,
      name: project.name,
      accountName,
      status: project.status,
      revenue,
      cost,
      profit: revenue - cost,
      margin: revenue > 0 ? ((revenue - cost) / revenue) * 100 : null,
      worked,
      engaged,
    };
  });

  // ---- Project counts + company money totals -------------------------------------------------------
  const totalProjects = projectRows.length;
  const activeProjects = projectRows.filter((r) => r.status === 'active').length;
  const statusOrder: ProjectStatus[] = ['planned', 'active', 'on_hold', 'complete'];
  const statusData = statusOrder
    .map((status) => ({ name: PROJECT_STATUS_LABELS[status], status, value: projectRows.filter((r) => r.status === status).length }))
    .filter((slice) => slice.value > 0);

  const totalRevenue = projectRows.reduce((s, r) => s + r.revenue, 0);
  const totalCost = projectRows.reduce((s, r) => s + r.cost, 0);
  const totalProfit = totalRevenue - totalCost;

  // Engaged headcount: distinct staff across all active projects, plus the average team size.
  const activeEngaged = new Set(
    bundles
      .filter((b) => b.project.status === 'active')
      .flatMap((b) => b.team.filter((m) => m.active && m.user_id).map((m) => m.user_id as string)),
  ).size;
  const avgTeamSize =
    activeProjects > 0
      ? projectRows.filter((r) => r.status === 'active').reduce((s, r) => s + r.engaged, 0) / activeProjects
      : 0;

  // Top-N per-project chart series (drop projects with no money / no team so the axes stay useful).
  const profitTop = [...projectRows]
    .filter((r) => r.revenue !== 0 || r.cost !== 0)
    .sort((a, b) => b.profit - a.profit)
    .slice(0, TOP_N)
    .map((r) => ({
      name: r.name,
      revenue: Number(r.revenue.toFixed(2)),
      cost: Number(r.cost.toFixed(2)),
      margin: r.margin != null ? Number(r.margin.toFixed(1)) : 0,
    }));
  const engagedTop = [...projectRows]
    .filter((r) => r.engaged > 0)
    .sort((a, b) => b.engaged - a.engaged)
    .slice(0, TOP_N)
    .map((r) => ({ name: r.name, engaged: r.engaged }));

  const moneyTip = (value: number) => formatMoney(value, base);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="text-lg font-semibold text-violet">Project analytics</h2>
        <p className="text-sm text-grey">
          Pipeline, conversion, profitability and staffing across every account. Money uses each log's pay rate
          and the reporter's client rate (base {base}); the From/To range scopes the money cards only. Admin-only.
        </p>
      </div>

      {/* Date window — profitability worklogs only; the lead funnel, outcomes and headcount are a live snapshot. */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] font-medium text-grey">Money range:</span>
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatTile label="Projects" value={totalProjects} tone="violet" />
        <StatTile label="Active projects" value={activeProjects} />
        <StatTile label="Leads" value={accounts.length} />
        <StatTile label="Converted" value={converted} tone="green" hint={`${lost} lost`} />
        <StatTile label="Win rate" value={winRate != null ? `${winRate}%` : '—'} tone="violet" hint={decided > 0 ? `${converted}/${decided} decided` : 'No decisions'} />
        <StatTile
          label="Profit"
          value={formatMoney(totalProfit, base)}
          tone={totalProfit >= 0 ? 'green' : 'red'}
          hint={`${formatMoney(totalRevenue, base)} rev`}
        />
      </div>

      <CollapsibleCards scope="project-analytics" defaultOpen>
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Lead lifecycle funnel — how far leads progress toward a live project. */}
          <PortalCard title="Lead-to-stage funnel" description="Accounts reaching each lifecycle stage; % is step conversion.">
            {funnelData[0].reached === 0 ? (
              <EmptyState title="No leads on the linear path" description="Lost/stopped accounts appear in Lead outcomes." />
            ) : (
              <div style={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={funnelData} margin={{ top: 8, right: 8, bottom: 8, left: -16 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                    <XAxis dataKey="stage" tick={{ fontSize: 11 }} interval={0} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip
                      formatter={(value: number, name: string) =>
                        name === 'reached' ? [`${value}`, 'Accounts'] : [`${value}`, name]
                      }
                    />
                    <Bar dataKey="reached" name="Accounts" radius={[4, 4, 0, 0]}>
                      {funnelData.map((row, i) => (
                        <RechartsCell key={row.stage} fill={STAGE_COLORS[i % STAGE_COLORS.length]} />
                      ))}
                      <LabelList
                        dataKey="conversion"
                        position="top"
                        fontSize={10}
                        fill="#6D28D9"
                        formatter={(value: number | null) => (value == null ? '' : `${value}%`)}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </PortalCard>

          {/* Lost vs converted — the terminal outcome split, with win rate. */}
          <PortalCard
            title="Lead outcomes"
            description={winRate != null ? `${winRate}% won of decided (converted vs lost)` : 'Converted vs lost vs in-progress'}
          >
            {outcomeData.length === 0 ? (
              <EmptyState title="No leads yet" />
            ) : (
              <div style={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={outcomeData} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="85%" stroke="none">
                      {outcomeData.map((slice) => (
                        <RechartsCell key={slice.name} fill={slice.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number, name: string) => [`${value}`, name]} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </PortalCard>
        </div>

        {/* Per-project profitability over the selected range — revenue/cost bars + margin line. */}
        <PortalCard title="Project profitability" description={`Revenue, cost and margin per project (top ${TOP_N} by profit).`}>
          {profitTop.length === 0 ? (
            <EmptyState title="No logged work in this range" />
          ) : (
            <div style={{ height: 320 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={profitTop} margin={{ top: 8, right: 8, bottom: 8, left: -8 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-12} textAnchor="end" height={60} />
                  <YAxis yAxisId="money" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="pct" orientation="right" tick={{ fontSize: 11 }} unit="%" />
                  <Tooltip
                    formatter={(value: number, name: string) =>
                      name === 'Margin' ? [`${value}%`, name] : [moneyTip(value), name]
                    }
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar yAxisId="money" dataKey="revenue" name="Revenue" fill={REVENUE_COLOR} radius={[4, 4, 0, 0]} />
                  <Bar yAxisId="money" dataKey="cost" name="Cost" fill={COST_COLOR} radius={[4, 4, 0, 0]} />
                  <Line yAxisId="pct" type="monotone" dataKey="margin" name="Margin" stroke={MARGIN_COLOR} strokeWidth={2} dot={{ r: 3 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </PortalCard>

        <div className="grid gap-4 lg:grid-cols-2">
          {/* Projects by status — the "how many projects" split. */}
          <PortalCard title="Projects by status" description={`${totalProjects} projects · ${activeProjects} active`}>
            {statusData.length === 0 ? (
              <EmptyState title="No projects yet" />
            ) : (
              <div style={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={statusData} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="85%" stroke="none">
                      {statusData.map((slice) => (
                        <RechartsCell key={slice.status} fill={STATUS_COLORS[slice.status]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number, name: string) => [`${value}`, name]} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </PortalCard>

          {/* Employees engaged per project — staffing load, active projects first. */}
          <PortalCard
            title="Employees per project"
            description={`${activeEngaged} staff on active projects · avg ${avgTeamSize.toFixed(1)}/project`}
          >
            {engagedTop.length === 0 ? (
              <EmptyState title="No staffed projects" />
            ) : (
              <div style={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={engagedTop} margin={{ top: 8, right: 8, bottom: 8, left: -16 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-12} textAnchor="end" height={60} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip formatter={(value: number) => [`${value}`, 'Employees']} />
                    <Bar dataKey="engaged" name="Employees" fill={REVENUE_COLOR} radius={[4, 4, 0, 0]}>
                      <LabelList dataKey="engaged" position="top" fontSize={10} fill="#6D28D9" />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </PortalCard>
        </div>

        {/* Full per-project table — profitability + engaged headcount, sortable by any column. */}
        <PortalCard title="Projects" description="Every project with staffing and range profitability.">
          {projectRows.length === 0 ? (
            <EmptyState title="No projects yet" />
          ) : (
            <ProjectTable rows={projectRows} base={base} />
          )}
        </PortalCard>
      </CollapsibleCards>
    </div>
  );
};

// The project table lives in its own component so its sort hook isn't called after the panel's early
// returns (loading/error).
const ProjectTable: React.FC<{ rows: ProjectRow[]; base: string }> = ({ rows, base }) => {
  const { sorted, sort, toggle } = useTableSort(
    rows,
    {
      name: (r) => r.name.toLowerCase(),
      account: (r) => r.accountName.toLowerCase(),
      status: (r) => r.status,
      engaged: (r) => r.engaged,
      worked: (r) => r.worked,
      revenue: (r) => r.revenue,
      cost: (r) => r.cost,
      profit: (r) => r.profit,
      margin: (r) => r.margin ?? -1,
    },
    { key: 'profit', dir: 'desc' },
  );

  return (
    <PortalTable
      className="[&_th]:px-3 [&_td]:px-3"
      head={[
        <SortHeader key="name" label="Project" sortKey="name" sort={sort} onSort={toggle} />,
        <SortHeader key="account" label="Account" sortKey="account" sort={sort} onSort={toggle} />,
        <SortHeader key="status" label="Status" sortKey="status" sort={sort} onSort={toggle} />,
        <SortHeader key="engaged" label="Team" sortKey="engaged" sort={sort} onSort={toggle} />,
        <SortHeader key="worked" label="Hours" sortKey="worked" sort={sort} onSort={toggle} />,
        <SortHeader key="revenue" label={`Revenue (${base})`} sortKey="revenue" sort={sort} onSort={toggle} />,
        <SortHeader key="cost" label={`Cost (${base})`} sortKey="cost" sort={sort} onSort={toggle} />,
        <SortHeader key="profit" label={`Profit (${base})`} sortKey="profit" sort={sort} onSort={toggle} />,
        <SortHeader key="margin" label="Margin" sortKey="margin" sort={sort} onSort={toggle} />,
      ]}
    >
      {sorted.map((r) => (
        <Row key={r.id}>
          <Cell className="whitespace-nowrap font-medium">{r.name}</Cell>
          <Cell className="whitespace-nowrap text-grey">{r.accountName}</Cell>
          <Cell className="whitespace-nowrap">
            <StatusTag tone={projectStatusTone(r.status)}>{PROJECT_STATUS_LABELS[r.status]}</StatusTag>
          </Cell>
          <Cell className="whitespace-nowrap text-right">{r.engaged}</Cell>
          <Cell className="whitespace-nowrap text-right text-grey">{r.worked.toFixed(1)} h</Cell>
          <Cell className="whitespace-nowrap text-right text-violet">{formatMoney(r.revenue, base)}</Cell>
          <Cell className="whitespace-nowrap text-right text-portal-amber">{formatMoney(r.cost, base)}</Cell>
          <Cell className={`whitespace-nowrap text-right font-medium ${r.profit >= 0 ? 'text-portal-green' : 'text-portal-red'}`}>
            {formatMoney(r.profit, base)}
          </Cell>
          <Cell className="whitespace-nowrap text-right">{r.margin != null ? `${r.margin.toFixed(0)}%` : '—'}</Cell>
        </Row>
      ))}
    </PortalTable>
  );
};
