import React from 'react';
import { Link } from 'react-router-dom';
import { Banknote, ChevronDown } from 'lucide-react';
import { listMySalaries, salaryPeriod } from '@/app/lib/portal-admin-api';
import { formatMoney, formatMonth } from '@/app/lib/portal-format';
import { SALARY_STATUS_LABELS, type Salary } from '@/app/lib/portal-types';
import { STATUS_TONE, totalsByCurrency } from './SalaryList';
import { cn } from '@/app/components/ui/utils';
import { ErrorNote, PortalSpinner, StatTile, StatusTag } from './PortalUi';

/**
 * A compact salary panel for the signed-in staffer's dashboard: their own pay for the current month
 * plus recent months, in whatever status the rows are (open/approved/paid — never filtered). It is
 * deliberately NOT wired to the dashboard's remembered CollapsibleCards — it holds its own open state,
 * so it starts collapsed on every page load and loads its data lazily only once someone expands it.
 * Reads are scoped to the caller by the self-read RLS policy (migration 0046).
 */
export const MySalaryWidget: React.FC<{ userId: string }> = ({ userId }) => {
  const period = salaryPeriod(new Date());
  const [open, setOpen] = React.useState(false);
  const [salaries, setSalaries] = React.useState<Salary[] | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next && salaries === null && !loading) {
      setLoading(true);
      setError(null);
      try {
        setSalaries(await listMySalaries(userId));
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Could not load your salary.');
      } finally {
        setLoading(false);
      }
    }
  };

  const rows = salaries ?? [];
  const thisMonth = rows.find((salary) => salary.period === period) ?? null;
  const totals = totalsByCurrency(rows);

  return (
    <section className="rounded-xl border border-border-color bg-card shadow-sm">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
      >
        <span className="flex min-w-0 items-center gap-2">
          <Banknote className="h-4 w-4 shrink-0 text-violet" />
          <span className="truncate text-[15px] font-semibold text-violet">My salary</span>
          <span className="text-xs text-grey">{formatMonth(period)}</span>
        </span>
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-grey transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="border-t border-border-color px-5 py-4">
          {loading ? (
            <PortalSpinner label="Loading your salary…" />
          ) : error ? (
            <ErrorNote>{error}</ErrorNote>
          ) : rows.length === 0 ? (
            <p className="text-xs text-grey">
              No salary yet. Once a month is opened and you log hours, your pay shows up here.{' '}
              <Link to="/admin/portal/my-salary" className="font-medium text-violet hover:underline">
                My Salary →
              </Link>
            </p>
          ) : (
            <div className="space-y-3">
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <StatTile
                  label="This month"
                  value={thisMonth ? formatMoney(thisMonth.total_amount, thisMonth.currency) : '—'}
                  hint={thisMonth ? `${thisMonth.total_hours} h · ${SALARY_STATUS_LABELS[thisMonth.status]}` : 'Not opened yet'}
                  tone="violet"
                />
                {totals.map((entry) => (
                  <StatTile
                    key={entry.currency}
                    label={`Total (${entry.currency})`}
                    value={formatMoney(entry.amount, entry.currency)}
                    hint={`${entry.hours} h · all months`}
                  />
                ))}
              </div>
              <ul className="divide-y divide-border-color">
                {rows.map((salary) => (
                  <li key={salary.id} className="flex items-center justify-between gap-3 py-2">
                    <span className="min-w-0 truncate text-sm font-medium">{formatMonth(salary.period)}</span>
                    <span className="flex shrink-0 items-center gap-3">
                      <span className="text-xs text-grey">{salary.total_hours} h</span>
                      <span className="text-sm font-semibold">{formatMoney(salary.total_amount, salary.currency)}</span>
                      <StatusTag tone={STATUS_TONE[salary.status]}>{SALARY_STATUS_LABELS[salary.status]}</StatusTag>
                    </span>
                  </li>
                ))}
              </ul>
              <Link
                to="/admin/portal/my-salary"
                className="inline-block text-xs font-medium text-violet hover:underline"
              >
                View my salary →
              </Link>
            </div>
          )}
        </div>
      )}
    </section>
  );
};
