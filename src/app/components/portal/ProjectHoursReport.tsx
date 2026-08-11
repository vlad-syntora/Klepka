import React from 'react';
import { formatDate, prettyName } from '@/app/lib/portal-format';
import { HoursBudget } from '@/app/components/portal/HoursBudget';
import type { Milestone, Project, TimeEntry } from '@/app/lib/portal-types';
import { Cell, EmptyState, IconDateButton, PortalCard, PortalTable, Row, inputClass } from '@/app/components/portal/PortalUi';
import { cn } from '@/app/components/ui/utils';

// Calendar-based quick ranges the client can jump to. `all` clears the bounds.
type Period = 'day' | 'week' | 'month' | 'quarter' | 'year' | 'all';
const PERIODS: { key: Period; label: string }[] = [
  { key: 'day', label: 'D' },
  { key: 'week', label: 'W' },
  { key: 'month', label: 'M' },
  { key: 'quarter', label: 'Q' },
  { key: 'year', label: 'Y' },
  { key: 'all', label: 'All' },
];

const iso = (date: Date): string => {
  // Local-date ISO (avoids the UTC shift toISOString() would introduce near midnight).
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
};

// The first day (inclusive) of the current calendar period, as an ISO date. `all` has no lower bound.
const periodStart = (period: Period): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  switch (period) {
    case 'day':
      return iso(now);
    case 'week': {
      const day = now.getDay(); // 0 = Sun
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

/**
 * Client-facing hours report for one project, rendered as its own "Hours" card so the filters can
 * live compactly in the card header alongside the title. Shows only *approved* entries, valued by
 * their billing hours: a single summary bar, then the individual log lines (title, date, reporter,
 * milestone, hours). The internal employee is never shown — only the client-facing reporter.
 */
export const ProjectHoursReport: React.FC<{
  project: Project;
  milestones: Milestone[];
  timeEntries: TimeEntry[];
  className?: string;
  description?: React.ReactNode;
  /** Extra header control rendered after the filters (e.g. a project switcher on the dashboard). */
  action?: React.ReactNode;
}> = ({ project, milestones, timeEntries, className, description, action }) => {
  const [period, setPeriod] = React.useState<Period>('all');
  const [fromDate, setFromDate] = React.useState('');
  const [toDate, setToDate] = React.useState('');
  const [milestoneId, setMilestoneId] = React.useState('');
  const [reporterId, setReporterId] = React.useState('');

  // Only approved entries count; the client budget draws down against billing hours (`hours`).
  const approvedEntries = React.useMemo(() => timeEntries.filter((entry) => entry.approved), [timeEntries]);

  // Reporters (`user` is aliased to the reporter on the client snapshot) seen across approved entries.
  const reporters = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const entry of approvedEntries) {
      if (entry.user) map.set(entry.user.id, entry.user.full_name);
    }
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  }, [approvedEntries]);

  const applyPeriod = (next: Period) => {
    setPeriod(next);
    setFromDate(periodStart(next));
    setToDate('');
  };

  const filtered = approvedEntries.filter(
    (entry) =>
      (!fromDate || entry.entry_date >= fromDate) &&
      (!toDate || entry.entry_date <= toDate) &&
      (!milestoneId || entry.milestone_id === milestoneId) &&
      (!reporterId || entry.user?.id === reporterId),
  );

  const totalHours = filtered.reduce((sum, entry) => sum + (entry.hours ?? 0), 0);
  // Budget draw-down is absolute (all approved hours), independent of the current filter.
  const usedAll = approvedEntries.reduce((sum, entry) => sum + (entry.hours ?? 0), 0);
  // The bank of hours is a *monthly* limit, so the budget bar draws down only this calendar month's
  // approved billing hours (independent of the range/reporter/milestone filters above). The YYYY-MM
  // prefix is built from the local date so it matches the client's own timezone.
  const monthPrefix = iso(new Date()).slice(0, 7);
  const usedThisMonth = approvedEntries
    .filter((entry) => entry.entry_date.startsWith(monthPrefix))
    .reduce((sum, entry) => sum + (entry.hours ?? 0), 0);

  const milestoneName = (id: string | null) =>
    milestones.find((milestone) => milestone.id === id)?.name ?? 'Unassigned';

  const hasBudget = project.bank_hours != null || project.notify_hours != null;
  const compact = `${inputClass} w-auto max-w-[11rem] shrink-0 truncate px-2 py-1 text-xs`;
  const filtersActive = Boolean(fromDate || toDate || milestoneId || reporterId);
  const summaryPct = usedAll > 0 ? Math.min(100, (totalHours / usedAll) * 100) : 0;

  // Compact filter cluster that lives in the card header, next to the "Hours" title.
  const filters = (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      <div className="flex overflow-hidden rounded-md border border-border-color text-[11px] font-medium">
        {PERIODS.map((entry) => (
          <button
            key={entry.key}
            type="button"
            onClick={() => applyPeriod(entry.key)}
            title={entry.key === 'all' ? 'All time' : `This ${entry.key}`}
            className={cn(
              'px-2 py-1 transition-colors',
              !fromDate && !toDate && period === entry.key ? 'bg-violet text-white' : 'text-grey hover:text-violet',
            )}
          >
            {entry.label}
          </button>
        ))}
      </div>
      <IconDateButton
        label="From date"
        value={fromDate}
        onChange={(value) => {
          setFromDate(value);
          setPeriod('all');
        }}
      />
      <IconDateButton
        label="To date"
        value={toDate}
        onChange={(value) => {
          setToDate(value);
          setPeriod('all');
        }}
      />
      {milestones.length > 0 && (
        <select className={compact} value={milestoneId} onChange={(event) => setMilestoneId(event.target.value)} title="Milestone">
          <option value="">All milestones</option>
          {milestones.map((milestone) => (
            <option key={milestone.id} value={milestone.id}>
              {milestone.name}
            </option>
          ))}
        </select>
      )}
      {reporters.length > 1 && (
        <select className={compact} value={reporterId} onChange={(event) => setReporterId(event.target.value)} title="Reporter">
          <option value="">All reporters</option>
          {reporters.map((reporter) => (
            <option key={reporter.id} value={reporter.id}>
              {prettyName(reporter.name)}
            </option>
          ))}
        </select>
      )}
      {filtersActive && (
        <button
          type="button"
          onClick={() => {
            setFromDate('');
            setToDate('');
            setMilestoneId('');
            setReporterId('');
            setPeriod('all');
          }}
          className="px-1.5 py-1 text-xs font-medium text-violet hover:underline"
        >
          Clear
        </button>
      )}
    </div>
  );

  const empty = approvedEntries.length === 0 && !hasBudget;

  return (
    <PortalCard
      className={className}
      title="Hours"
      description={description}
      action={
        empty ? (
          action
        ) : (
          <div className="flex flex-wrap items-center justify-end gap-2">
            {filters}
            {action}
          </div>
        )
      }
    >
      {empty ? (
        <EmptyState title="No approved hours yet" description="Approved worklogs will appear here." />
      ) : (
        <div className="space-y-4">
          {/* One total summary: the headline number, then a single bar (budget draw-down when a
              budget is set, else the filtered hours as a share of all approved hours). */}
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-semibold text-violet">{totalHours.toFixed(1)}</span>
              <span className="text-sm text-grey">
                approved billing hours{filtered.length > 0 ? ` · ${filtered.length} entries` : ''}
              </span>
            </div>
            {hasBudget ? (
              <div className="mt-2">
                <HoursBudget
                  bank={project.bank_hours}
                  notify={project.notify_hours}
                  used={usedThisMonth}
                  label="This month"
                />
              </div>
            ) : (
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-border-color">
                <div className="h-full rounded-full bg-violet" style={{ width: `${summaryPct}%` }} />
              </div>
            )}
          </div>

          {/* Individual log lines: title, date, reporter, milestone (when assigned) and hours. */}
          {filtered.length === 0 ? (
            <EmptyState title="No approved hours in this range" />
          ) : (
            <PortalTable head={['Title', 'Date', 'Reporter', 'Milestone', 'Hours']}>
              {filtered.slice(0, 100).map((entry) => (
                <Row key={entry.id}>
                  <Cell className="font-medium">{entry.description || 'Delivery work'}</Cell>
                  <Cell className="whitespace-nowrap text-grey">{formatDate(entry.entry_date)}</Cell>
                  <Cell className="whitespace-nowrap text-grey">
                    {entry.user ? prettyName(entry.user.full_name) : '—'}
                  </Cell>
                  <Cell className="text-grey">{entry.milestone_id ? milestoneName(entry.milestone_id) : '—'}</Cell>
                  <Cell className="whitespace-nowrap text-right font-medium">
                    {entry.hours != null ? `${entry.hours.toFixed(1)} h` : '—'}
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
