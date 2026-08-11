import React from 'react';
import { Check, ChevronDown, ChevronRight, RotateCcw } from 'lucide-react';
import { adminListSalaryEntries } from '@/app/lib/portal-admin-api';
import { formatDate, formatMonth, formatMoney, prettyName } from '@/app/lib/portal-format';
import { SALARY_STATUS_LABELS, type Salary, type SalaryStatus, type TimeEntry } from '@/app/lib/portal-types';
import {
  Cell,
  ErrorNote,
  PortalButton,
  PortalSpinner,
  PortalTable,
  Row,
  SortHeader,
  StatusTag,
  useTableSort,
  type Tone,
} from './PortalUi';

// open = still accruing (neutral); approved = signed off (amber); paid = frozen (green).
export const STATUS_TONE: Record<SalaryStatus, Tone> = { open: 'grey', approved: 'amber', paid: 'green' };

// The hours a log contributes to salary: actual worked, falling back to billed hours (matches the
// portal_recompute_salary sum in migration 0044). Its line value is those hours × the frozen rate.
const countedHours = (entry: TimeEntry): number => entry.actual_hours ?? entry.hours ?? 0;

// A salary total can mix currencies across employees, so group the sum per currency.
export function totalsByCurrency(salaries: Salary[]): { currency: string; hours: number; amount: number }[] {
  const map = new Map<string, { currency: string; hours: number; amount: number }>();
  for (const salary of salaries) {
    const entry = map.get(salary.currency) ?? { currency: salary.currency, hours: 0, amount: 0 };
    entry.hours += salary.total_hours;
    entry.amount += salary.total_amount;
    map.set(salary.currency, entry);
  }
  return [...map.values()];
}

// One salary row that expands to reveal the individual worklogs it was computed from. Logs load
// lazily on first expand so the month view stays cheap when nothing is drilled into. The status
// action buttons appear only when `onStatus` is given (admin); the "My Salary" page omits them.
const SalaryRow: React.FC<{
  salary: Salary;
  showPeriod?: boolean;
  onStatus?: (salary: Salary, status: SalaryStatus) => void;
}> = ({ salary, showPeriod, onStatus }) => {
  const [expanded, setExpanded] = React.useState(false);
  const [entries, setEntries] = React.useState<TimeEntry[] | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Columns: Employee, [Period], Hours, Amount, Status, [actions]. The expanded logs row spans them.
  const colSpan = 4 + (showPeriod ? 1 : 0) + (onStatus ? 1 : 0);

  const toggle = async () => {
    const next = !expanded;
    setExpanded(next);
    if (next && entries === null && !loading) {
      setLoading(true);
      setError(null);
      try {
        setEntries(await adminListSalaryEntries(salary.user_id, salary.period));
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Could not load logs.');
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <>
      <Row>
        <Cell className="font-medium">
          <button type="button" onClick={toggle} className="flex items-center gap-2 text-left" aria-expanded={expanded}>
            {expanded ? (
              <ChevronDown className="h-4 w-4 shrink-0 text-grey" />
            ) : (
              <ChevronRight className="h-4 w-4 shrink-0 text-grey" />
            )}
            <span>
              {salary.user ? prettyName(salary.user.full_name) : '—'}
              {salary.user?.title && <span className="block text-xs text-grey">{salary.user.title}</span>}
            </span>
          </button>
        </Cell>
        {showPeriod && <Cell className="whitespace-nowrap text-grey">{formatMonth(salary.period)}</Cell>}
        <Cell className="whitespace-nowrap text-grey">{salary.total_hours} h</Cell>
        <Cell className="whitespace-nowrap font-semibold">{formatMoney(salary.total_amount, salary.currency)}</Cell>
        <Cell>
          <StatusTag tone={STATUS_TONE[salary.status]}>{SALARY_STATUS_LABELS[salary.status]}</StatusTag>
        </Cell>
        {onStatus && (
          <Cell className="text-right">
            <div className="flex justify-end gap-1">
              {/* open → approved → paid, with a way back while it isn't paid. Recompute freezes once a
                  salary is marked paid, so "paid" is the terminal, final state. */}
              {salary.status === 'open' && (
                <PortalButton variant="secondary" onClick={() => onStatus(salary, 'approved')}>
                  <Check className="h-4 w-4" /> Approve
                </PortalButton>
              )}
              {salary.status === 'approved' && (
                <>
                  <PortalButton onClick={() => onStatus(salary, 'paid')}>Mark paid</PortalButton>
                  <PortalButton variant="ghost" onClick={() => onStatus(salary, 'open')} aria-label="Reopen">
                    <RotateCcw className="h-4 w-4" />
                  </PortalButton>
                </>
              )}
              {salary.status === 'paid' && (
                <PortalButton variant="ghost" onClick={() => onStatus(salary, 'approved')}>
                  Reopen
                </PortalButton>
              )}
            </div>
          </Cell>
        )}
      </Row>
      {expanded && (
        <Row className="hover:bg-transparent">
          <Cell colSpan={colSpan} className="bg-portal-tint/40 py-3">
            {loading ? (
              <PortalSpinner label="Loading logs…" />
            ) : error ? (
              <ErrorNote>{error}</ErrorNote>
            ) : !entries || entries.length === 0 ? (
              <p className="text-xs text-grey">No logs contributed to this salary yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-xs">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wide text-grey">
                      <th className="py-1.5 pr-3 font-semibold">Date</th>
                      <th className="py-1.5 pr-3 font-semibold">Project</th>
                      <th className="py-1.5 pr-3 font-semibold">Work</th>
                      <th className="py-1.5 pr-3 text-right font-semibold">Hours</th>
                      <th className="py-1.5 pr-3 text-right font-semibold">Rate</th>
                      <th className="py-1.5 text-right font-semibold">Line</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((entry) => {
                      const hours = countedHours(entry);
                      const rate = entry.pay_rate ?? 0;
                      return (
                        <tr key={entry.id} className="border-t border-border-color/60">
                          <td className="whitespace-nowrap py-1.5 pr-3 text-grey">{formatDate(entry.entry_date)}</td>
                          <td className="py-1.5 pr-3">{entry.project?.name ?? '—'}</td>
                          <td className="py-1.5 pr-3">{entry.description}</td>
                          <td className="whitespace-nowrap py-1.5 pr-3 text-right">{hours} h</td>
                          <td className="whitespace-nowrap py-1.5 pr-3 text-right text-grey">
                            {formatMoney(rate, salary.currency)}
                          </td>
                          <td className="whitespace-nowrap py-1.5 text-right font-medium">
                            {formatMoney(hours * rate, salary.currency)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Cell>
        </Row>
      )}
    </>
  );
};

/**
 * The salary table shared by the admin Salaries page and the per-employee "My Salary" page. Each row
 * expands to the worklogs behind it. Pass `showPeriod` to add a month + year column (for multi-month
 * views) and `onStatus` to enable the admin open → approved → paid actions.
 */
export const SalaryTable: React.FC<{
  salaries: Salary[];
  showPeriod?: boolean;
  onStatus?: (salary: Salary, status: SalaryStatus) => void;
}> = ({ salaries, showPeriod, onStatus }) => {
  const { sorted, sort, toggle } = useTableSort(salaries, {
    employee: (salary) => (salary.user ? prettyName(salary.user.full_name) : ''),
    period: (salary) => salary.period,
    hours: (salary) => salary.total_hours,
    amount: (salary) => salary.total_amount,
    status: (salary) => salary.status,
  });
  const head = [
    <SortHeader key="employee" label="Employee" sortKey="employee" sort={sort} onSort={toggle} />,
    ...(showPeriod
      ? [<SortHeader key="period" label="Period" sortKey="period" sort={sort} onSort={toggle} />]
      : []),
    <SortHeader key="hours" label="Hours" sortKey="hours" sort={sort} onSort={toggle} />,
    <SortHeader key="amount" label="Amount" sortKey="amount" sort={sort} onSort={toggle} />,
    <SortHeader key="status" label="Status" sortKey="status" sort={sort} onSort={toggle} />,
    ...(onStatus ? [''] : []),
  ];
  return (
    <PortalTable head={head}>
      {sorted.map((salary) => (
        <SalaryRow key={salary.id} salary={salary} showPeriod={showPeriod} onStatus={onStatus} />
      ))}
    </PortalTable>
  );
};
