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
import type { ProjectBundle } from '@/app/lib/portal-types';
import { formatDate } from '@/app/lib/portal-format';
import { HoursBudget } from '@/app/components/portal/HoursBudget';
import {
  Cell,
  CollapsibleCards,
  EmptyState,
  IconDateButton,
  PortalCard,
  PortalTable,
  Row,
  SortHeader,
  inputClass,
  useTableSort,
} from '@/app/components/portal/PortalUi';
import { cn } from '@/app/components/ui/utils';

// Calendar quick-ranges; `all` clears the lower bound. Mirrors the admin dashboard's Reports section.
type Period = 'day' | 'week' | 'month' | 'quarter' | 'year' | 'all';
const PERIODS: { key: Period; label: string }[] = [
  { key: 'day', label: 'Day' },
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
  { key: 'quarter', label: 'Quarter' },
  { key: 'year', label: 'Year' },
  { key: 'all', label: 'All' },
];

const iso = (date: Date): string => {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
};

// First day (inclusive) of the current calendar period. `all` has no lower bound.
const periodStart = (period: Period): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  switch (period) {
    case 'day':
      return iso(now);
    case 'week': {
      const day = now.getDay();
      const diff = (day + 6) % 7;
      return iso(new Date(year, month, now.getDate() - diff));
    }
    case 'month':
      return iso(new Date(year, month, 1));
    case 'quarter':
      return iso(new Date(year, Math.floor(month / 3) * 3, 1));
    case 'year':
      return iso(new Date(year, 0, 1));
    default:
      return '';
  }
};

// Bucket an entry date to the bar x-axis at a granularity that suits the range: day for short
// ranges, week-start for a quarter, month for a year / all.
const bucketKey = (dateStr: string, period: Period): string => {
  if (period === 'year' || period === 'all') return dateStr.slice(0, 7); // YYYY-MM
  if (period === 'quarter') {
    const d = new Date(`${dateStr}T00:00:00`);
    const diff = (d.getDay() + 6) % 7;
    return iso(new Date(d.getFullYear(), d.getMonth(), d.getDate() - diff));
  }
  return dateStr; // YYYY-MM-DD
};

const bucketLabel = (key: string): string => {
  if (key.length === 7) {
    const [y, m] = key.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
  }
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const DONUT_COLORS = ['#6D28D9', '#8B5CF6', '#A78BFA', '#C4B5FD', '#7C3AED', '#5B21B6', '#DDD6FE'];

/**
 * Client-facing "Reports" section: charts of *approved* hours across the account's projects — hours
 * by date (bar) and hours per project (donut) — with calendar-range presets, two date-icon filters
 * and a project picker. One collapsible section that remembers its open/closed state.
 */
export const ClientHoursReport: React.FC<{ projects: ProjectBundle[] }> = ({ projects }) => {
  const [period, setPeriod] = React.useState<Period>('all');
  const [fromDate, setFromDate] = React.useState('');
  const [toDate, setToDate] = React.useState('');
  const [projectId, setProjectId] = React.useState('');
  const [view, setView] = React.useState<'charts' | 'list'>('charts');

  const today = iso(new Date());

  // Only approved hours, tagged with their project so the donut and picker can group by project.
  const approved = React.useMemo(
    () =>
      projects.flatMap((bundle) =>
        bundle.timeEntries
          .filter((entry) => entry.approved)
          .map((entry) => ({
            entry_date: entry.entry_date,
            hours: entry.hours,
            description: entry.description,
            projectId: bundle.project.id,
            projectName: bundle.project.name,
          })),
      ),
    [projects],
  );

  const rangeFrom = fromDate || periodStart(period);
  const rangeTo = toDate || today;
  const rangeEntries = approved.filter(
    (entry) =>
      (!projectId || entry.projectId === projectId) &&
      (!rangeFrom || entry.entry_date >= rangeFrom) &&
      (!rangeTo || entry.entry_date <= rangeTo),
  );

  const byBucket = new Map<string, number>();
  for (const entry of rangeEntries) {
    const key = bucketKey(entry.entry_date, period);
    byBucket.set(key, (byBucket.get(key) ?? 0) + entry.hours);
  }
  const barData = [...byBucket.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, hours]) => ({ label: bucketLabel(key), hours: Number(hours.toFixed(2)) }));

  const byProject = new Map<string, number>();
  for (const entry of rangeEntries) {
    byProject.set(entry.projectName, (byProject.get(entry.projectName) ?? 0) + entry.hours);
  }
  const donutData = [...byProject.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({ name, value: Number(value.toFixed(2)) }));

  const totalHours = rangeEntries.reduce((sum, entry) => sum + entry.hours, 0);

  // Per-project budget draw-down (moved up from the former Hours widget). Consumption is absolute —
  // it counts every approved hour on the project, independent of the current range/project filter —
  // so the bank bar always reflects true remaining hours. Only projects with a budget are shown,
  // and the current project filter narrows the list.
  const budgetProjects = projects
    .filter(
      (bundle) =>
        (!projectId || bundle.project.id === projectId) &&
        (bundle.project.bank_hours != null || bundle.project.notify_hours != null),
    )
    .map((bundle) => ({
      id: bundle.project.id,
      name: bundle.project.name,
      bank: bundle.project.bank_hours,
      notify: bundle.project.notify_hours,
      used: bundle.timeEntries.filter((entry) => entry.approved).reduce((sum, entry) => sum + entry.hours, 0),
    }));

  // Headline figure + budget bars, shown at the top of the card body.
  const summary = (
    <div className="mb-4 border-b border-border-color pb-4">
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-semibold text-violet">{totalHours.toFixed(1)}</span>
        <span className="text-sm text-grey">
          approved billing hours{rangeEntries.length > 0 ? ` · ${rangeEntries.length} entries` : ''}
        </span>
      </div>
      {budgetProjects.length > 0 && (
        <div className="mt-3 space-y-3">
          {budgetProjects.map((project) => (
            <div key={project.id}>
              {projects.length > 1 && <div className="mb-1 text-xs font-medium text-grey">{project.name}</div>}
              <HoursBudget bank={project.bank} notify={project.notify} used={project.used} />
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // Filters live in the card header (wrapping as needed): view toggle, range presets, the two date
  // icons, then the project picker.
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
      {projects.length > 1 && (
        <select
          className={`${inputClass} w-auto max-w-[11rem] shrink-0 truncate py-1 text-xs`}
          value={projectId}
          onChange={(event) => setProjectId(event.target.value)}
          aria-label="Filter by project"
        >
          <option value="">All projects</option>
          {projects.map((bundle) => (
            <option key={bundle.project.id} value={bundle.project.id}>
              {bundle.project.name}
            </option>
          ))}
        </select>
      )}
    </div>
  );

  // Same records the charts aggregate, as a table — sortable by any column (click a header to
  // toggle asc/desc), newest first by default. A stable id per row keeps React keys tied to the row.
  const listRows = rangeEntries.map((entry, index) => ({ id: String(index), ...entry }));
  const list = useTableSort(
    listRows,
    {
      description: (row) => row.description || 'Delivery work',
      project: (row) => row.projectName,
      hours: (row) => row.hours,
      date: (row) => row.entry_date,
    },
    { key: 'date', dir: 'desc' },
  );
  const listView = (
    <PortalTable
      head={[
        <SortHeader key="description" label="Description" sortKey="description" sort={list.sort} onSort={list.toggle} />,
        <SortHeader key="project" label="Project" sortKey="project" sort={list.sort} onSort={list.toggle} />,
        <SortHeader key="hours" label="Actual hours" sortKey="hours" sort={list.sort} onSort={list.toggle} />,
        <SortHeader key="date" label="Date" sortKey="date" sort={list.sort} onSort={list.toggle} />,
      ]}
    >
      {list.sorted.map((entry) => (
        <Row key={entry.id}>
          <Cell className="font-medium">{entry.description || 'Delivery work'}</Cell>
          <Cell className="text-grey">{entry.projectName}</Cell>
          <Cell className="whitespace-nowrap text-right font-medium">{entry.hours.toFixed(1)} h</Cell>
          <Cell className="whitespace-nowrap text-grey">{formatDate(entry.entry_date)}</Cell>
        </Row>
      ))}
    </PortalTable>
  );

  return (
    <CollapsibleCards scope="client-reports" defaultOpen>
      <PortalCard
        title="Reports"
        description={`${totalHours.toFixed(1)} approved billing hours`}
        action={filters}
      >
        {summary}
        {view === 'list' ? (
          rangeEntries.length === 0 ? (
            <EmptyState title="No approved hours in this range" />
          ) : (
            listView
          )
        ) : (
        <div className="grid gap-6 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-grey">Hours by date</div>
            {barData.length === 0 ? (
              <EmptyState title="No approved hours in this range" />
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
              <EmptyState title="No approved hours in this range" />
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
    </CollapsibleCards>
  );
};
