import React from 'react';
import { toast } from 'sonner';
import { CalendarPlus, Check, ChevronDown, Search } from 'lucide-react';
import { useAsync } from '@/app/hooks/use-async';
import { usePortalUser } from '@/app/hooks/use-portal-user';
import {
  adminGetFinanceSettings,
  adminListAllSalaries,
  adminListSalaries,
  adminOpenSalaryMonth,
  adminPaySalary,
  adminSetSalaryStatus,
  salaryPeriod,
  type PaymentInput,
} from '@/app/lib/portal-admin-api';
import { formatMoney, prettyName } from '@/app/lib/portal-format';
import { PayDialog } from '@/app/components/portal/PayDialog';
import {
  SALARY_STATUSES,
  SALARY_STATUS_LABELS,
  type Salary,
  type SalaryStatus,
} from '@/app/lib/portal-types';
import { SalaryTable, totalsByCurrency } from '@/app/components/portal/SalaryList';
import { cn } from '@/app/components/ui/utils';
import {
  EmptyState,
  ErrorNote,
  InfoNote,
  PortalButton,
  PortalCard,
  PortalSpinner,
  StatTile,
  inputClass,
} from '@/app/components/portal/PortalUi';

// The month picker uses the native YYYY-MM value; the API keys salaries by the first-of-month date.
function currentMonthValue(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

// 'month' lists a single selected month; 'all' spans every month, so the list can be filtered across
// periods (each row then shows its own month + year).
type Scope = 'month' | 'all';

type StatusOption = { value: SalaryStatus | 'all'; label: string };

// A compact, fully themed status picklist. We avoid a native <select> here because its open menu is
// rendered by the OS (a large, un-stylable popover) — this keeps the trigger and menu short and on-brand.
const StatusFilterMenu: React.FC<{
  value: SalaryStatus | 'all';
  options: StatusOption[];
  onChange: (value: SalaryStatus | 'all') => void;
}> = ({ value, options, onChange }) => {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  const current = options.find((option) => option.value === value) ?? options[0];

  React.useEffect(() => {
    if (!open) return;
    const onDocClick = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex h-8 items-center gap-1.5 rounded-lg border border-border-color bg-card px-2.5 text-xs text-foreground transition-colors hover:border-violet"
      >
        <span className="whitespace-nowrap">{current.label}</span>
        <ChevronDown className={cn('h-3.5 w-3.5 shrink-0 text-grey transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <ul
          role="listbox"
          className="absolute left-0 z-20 mt-1 min-w-full overflow-hidden rounded-lg border border-border-color bg-card py-1 text-xs shadow-lg"
        >
          {options.map((option) => (
            <li key={option.value}>
              <button
                type="button"
                role="option"
                aria-selected={option.value === value}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className={cn(
                  'flex w-full items-center justify-between gap-3 whitespace-nowrap px-3 py-1.5 text-left transition-colors hover:bg-off-white',
                  option.value === value ? 'font-medium text-violet' : 'text-foreground',
                )}
              >
                {option.label}
                {option.value === value && <Check className="h-3.5 w-3.5 shrink-0" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export const AdminPortalSalaries: React.FC = () => {
  const { user } = usePortalUser();
  const isAdmin = user?.role === 'portal_admin';

  const [month, setMonth] = React.useState(currentMonthValue());
  const [scope, setScope] = React.useState<Scope>('month');
  const [statusFilter, setStatusFilter] = React.useState<SalaryStatus | 'all'>('all');
  const [query, setQuery] = React.useState('');
  const [opening, setOpening] = React.useState(false);

  // Base currency for the "mark paid" popup's FX conversion (migration 0056).
  const settings = useAsync(() => adminGetFinanceSettings(), []);
  const baseCurrency = settings.data?.base_currency ?? 'USD';
  // The salary being marked paid, if the pay popup is open.
  const [payTarget, setPayTarget] = React.useState<Salary | null>(null);
  const [paying, setPaying] = React.useState(false);

  const statusOptions: StatusOption[] = [
    { value: 'all', label: 'All statuses' },
    ...SALARY_STATUSES.map((status) => ({ value: status, label: SALARY_STATUS_LABELS[status] })),
  ];

  const period = salaryPeriod(`${month}-01T00:00:00`);
  const salaries = useAsync(
    () => (scope === 'all' ? adminListAllSalaries() : adminListSalaries(period)),
    [scope, period],
  );

  // Client-side filters over the loaded set (employee name + status).
  const needle = query.trim().toLowerCase();
  const rows = (salaries.data ?? []).filter((salary) => {
    if (statusFilter !== 'all' && salary.status !== statusFilter) return false;
    if (needle && !(salary.user ? prettyName(salary.user.full_name) : '').toLowerCase().includes(needle)) return false;
    return true;
  });
  const totals = totalsByCurrency(rows);

  const openMonth = async () => {
    setOpening(true);
    try {
      await adminOpenSalaryMonth(period);
      toast.success('Month opened — every active employee now has a salary row.');
      await salaries.reload();
    } catch (cause) {
      toast.error('Could not open the month', { description: cause instanceof Error ? cause.message : undefined });
    } finally {
      setOpening(false);
    }
  };

  const setStatus = async (salary: Salary, status: SalaryStatus) => {
    // Marking paid captures the actual amount + FX in a popup, then records it as an expense (0056).
    if (status === 'paid') {
      setPayTarget(salary);
      return;
    }
    try {
      await adminSetSalaryStatus(salary.id, status);
      await salaries.reload();
    } catch (cause) {
      toast.error('Could not update status', { description: cause instanceof Error ? cause.message : undefined });
    }
  };

  const confirmPay = async (payment: PaymentInput) => {
    if (!payTarget) return;
    setPaying(true);
    try {
      await adminPaySalary(payTarget.id, payment);
      toast.success('Salary marked paid and recorded as an expense.');
      setPayTarget(null);
      await salaries.reload();
    } catch (cause) {
      toast.error('Could not record the payment', { description: cause instanceof Error ? cause.message : undefined });
    } finally {
      setPaying(false);
    }
  };

  if (!isAdmin) {
    return <ErrorNote>Salaries are restricted to portal administrators.</ErrorNote>;
  }

  return (
    <div className="space-y-3">
      <PortalCard
        title="Salaries"
        description="Monthly pay per employee, from actual hours logged where they are the employee — using the rate frozen on each log."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="month"
              className={`${inputClass} w-auto py-1.5 text-xs`}
              value={month}
              onChange={(event) => setMonth(event.target.value || currentMonthValue())}
            />
            <PortalButton className="whitespace-nowrap" disabled={opening} onClick={openMonth}>
              <CalendarPlus className="h-4 w-4 shrink-0" /> {opening ? 'Opening…' : 'Open month'}
            </PortalButton>
          </div>
        }
      >
        {/* Filters on a single compact row: scope (this month vs all months), status, employee search. */}
        <div className="mb-3 flex flex-wrap items-stretch gap-1.5">
          <div className="flex h-8 shrink-0 overflow-hidden rounded-lg border border-border-color text-xs font-medium">
            {(['month', 'all'] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setScope(value)}
                className={cn(
                  'px-2.5 transition-colors',
                  scope === value ? 'bg-violet text-white' : 'text-grey hover:text-violet',
                )}
              >
                {value === 'month' ? 'This month' : 'All months'}
              </button>
            ))}
          </div>
          <StatusFilterMenu value={statusFilter} options={statusOptions} onChange={setStatusFilter} />
          <div className="relative h-8 shrink-0">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-grey" />
            <input
              type="search"
              placeholder="Search employee…"
              className={`${inputClass} h-8 w-40 py-0 pl-7 pr-2.5 text-xs`}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
        </div>

        {totals.length > 0 && (
          <div className="mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile label={scope === 'all' ? 'Salary rows' : 'Employees'} value={rows.length} />
            {totals.map((entry) => (
              <StatTile
                key={entry.currency}
                label={`Payroll (${entry.currency})`}
                value={formatMoney(entry.amount, entry.currency)}
                hint={`${entry.hours} h`}
                tone="violet"
              />
            ))}
          </div>
        )}

        {salaries.loading ? (
          <PortalSpinner label="Loading salaries…" />
        ) : salaries.error ? (
          <ErrorNote>{salaries.error}</ErrorNote>
        ) : rows.length === 0 ? (
          <EmptyState
            title={salaries.data && salaries.data.length > 0 ? 'No salaries match these filters' : 'No salaries for this month yet'}
            description={
              salaries.data && salaries.data.length > 0
                ? 'Adjust the status filter or search to see more.'
                : 'Open the month to create a row for every active employee, or log hours to accrue them automatically.'
            }
          />
        ) : (
          <SalaryTable salaries={rows} showPeriod onStatus={setStatus} />
        )}

        <div className="mt-4">
          <InfoNote>
            A salary counts hours logged where the person is the <strong>Employee</strong> (not the client-facing
            reporter), by the log’s date. Each log is valued at the pay rate <strong>frozen when it was logged</strong>,
            so later rate changes only affect new logs. <strong>Expand a row</strong> to see every worklog that makes up
            the total. Marking a salary <strong>Paid</strong> freezes it — new or edited logs for that month no longer
            change it.
          </InfoNote>
        </div>
      </PortalCard>

      <PayDialog
        open={payTarget !== null}
        onClose={() => setPayTarget(null)}
        title="Mark salary paid"
        kind="expense"
        baseCurrency={baseCurrency}
        computedAmount={payTarget?.total_amount ?? 0}
        defaultCurrency={payTarget?.currency ?? baseCurrency}
        busy={paying}
        onSubmit={confirmPay}
      />
    </div>
  );
};
