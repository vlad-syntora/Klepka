import React from 'react';
import { toast } from 'sonner';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { Banknote, PiggyBank, Plus, Receipt, Trash2, TrendingUp } from 'lucide-react';
import {
  Bar,
  CartesianGrid,
  Cell as PieCell,
  ComposedChart,
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
import { usePortalUser } from '@/app/hooks/use-portal-user';
import {
  adminDeleteFinanceTransaction,
  adminGetFinanceSettings,
  adminListFinanceTransactions,
  adminListOverheadExpenses,
  adminRecordManualTransaction,
  type ManualTransactionInput,
} from '@/app/lib/portal-admin-api';
import { formatDate, formatMoney, formatMonth } from '@/app/lib/portal-format';
import type {
  FinanceTransaction,
  FinanceTransactionKind,
  FinanceTransactionSource,
} from '@/app/lib/portal-types';
import { cn } from '@/app/components/ui/utils';
import { ManualTransactionDialog } from '@/app/components/portal/ManualTransactionDialog';
import {
  Cell,
  CollapsibleCards,
  EmptyState,
  ErrorNote,
  InfoNote,
  PortalButton,
  PortalCard,
  PortalSpinner,
  PortalTable,
  Row,
  SortHeader,
  StatTile,
  StatusTag,
  useTableSort,
} from '@/app/components/portal/PortalUi';
import { AdminPortalSalaries } from './AdminPortalSalaries';
import { AdminPortalInvoices } from './AdminPortalInvoices';
import { AdminPortalOverhead } from './AdminPortalOverhead';

const TABS = [
  { key: 'overview', label: 'P&L', icon: TrendingUp },
  { key: 'overhead', label: 'Overhead', icon: PiggyBank },
  { key: 'salaries', label: 'Salaries', icon: Banknote },
  { key: 'invoices', label: 'Invoices', icon: Receipt },
] as const;

type TabKey = (typeof TABS)[number]['key'];
const TAB_KEYS = TABS.map((tab) => tab.key) as readonly TabKey[];

/** One month's realised income vs expenses (already normalised into the base currency). */
interface MonthRow {
  month: string; // YYYY-MM
  income: number;
  expense: number;
}

function monthlyRows(transactions: FinanceTransaction[]): MonthRow[] {
  const byMonth = new Map<string, MonthRow>();
  for (const tx of transactions) {
    const month = tx.occurred_on.slice(0, 7);
    const row = byMonth.get(month) ?? { month, income: 0, expense: 0 };
    if (tx.kind === 'income') row.income += tx.base_amount;
    else row.expense += tx.base_amount;
    byMonth.set(month, row);
  }
  return [...byMonth.values()].sort((a, b) => b.month.localeCompare(a.month));
}

// P&L chart palette (matches the theme tokens: portal-green / portal-amber / violet).
const CHART_INCOME = '#1E8E5A';
const CHART_EXPENSE = '#B8860B';
const CHART_NET = '#723D9C';

// A compact x-axis label for a YYYY-MM month key, e.g. "Jul 26".
const monthShort = (key: string): string => {
  const [year, month] = key.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
};

/** One point on the P&L charts: a month with its income, expense, net and cumulative net (all in base). */
interface ChartPoint {
  label: string;
  income: number;
  expense: number;
  net: number;
  cumulative: number;
}

// Chronological (oldest→newest) chart series with a running cumulative net, independent of table sort.
function chartPoints(rows: MonthRow[]): ChartPoint[] {
  let running = 0;
  return [...rows]
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((row) => {
      const net = row.income - row.expense;
      running += net;
      return {
        label: monthShort(row.month),
        income: Number(row.income.toFixed(2)),
        expense: Number(row.expense.toFixed(2)),
        net: Number(net.toFixed(2)),
        cumulative: Number(running.toFixed(2)),
      };
    });
}

/** One bar of a periodic income/expense/net report (quarters for QoQ, years for YoY), all in base. */
interface PeriodBar {
  label: string;
  income: number;
  expense: number;
  net: number;
}

// Round a bar's raw sums to cents and derive its net — shared by the quarterly/yearly aggregations.
function finalisePeriodBar(bar: PeriodBar): PeriodBar {
  const income = Number(bar.income.toFixed(2));
  const expense = Number(bar.expense.toFixed(2));
  return { label: bar.label, income, expense, net: Number((income - expense).toFixed(2)) };
}

// Income/expense/net grouped by quarter for a single calendar year (always all four quarters, Q1→Q4).
function quarterlyBars(transactions: FinanceTransaction[], year: number): PeriodBar[] {
  const bars: PeriodBar[] = [1, 2, 3, 4].map((q) => ({ label: `Q${q}`, income: 0, expense: 0, net: 0 }));
  for (const tx of transactions) {
    const [y, m] = tx.occurred_on.split('-').map(Number);
    if (y !== year) continue;
    const bar = bars[Math.floor((m - 1) / 3)];
    if (tx.kind === 'income') bar.income += tx.base_amount;
    else bar.expense += tx.base_amount;
  }
  return bars.map(finalisePeriodBar);
}

// Income/expense/net grouped by calendar year, oldest→newest (year-over-year).
function yearlyBars(transactions: FinanceTransaction[]): PeriodBar[] {
  const byYear = new Map<string, PeriodBar>();
  for (const tx of transactions) {
    const year = tx.occurred_on.slice(0, 4);
    const bar = byYear.get(year) ?? { label: year, income: 0, expense: 0, net: 0 };
    if (tx.kind === 'income') bar.income += tx.base_amount;
    else bar.expense += tx.base_amount;
    byYear.set(year, bar);
  }
  return [...byYear.values()].map(finalisePeriodBar).sort((a, b) => a.label.localeCompare(b.label));
}

// The "type" a transaction rolls up under in the breakdown reports: salaries and invoices are grouped
// as a whole, while a manual entry uses its description (the fixed-cost name, or "Other" when blank).
function txCategory(tx: FinanceTransaction): string {
  if (tx.source_type === 'salary') return 'Salaries';
  if (tx.source_type === 'invoice') return 'Invoices';
  return tx.note?.trim() || 'Other';
}

/** One slice of an expense/income breakdown pie: a category with its total in the base currency. */
interface BreakdownSlice {
  name: string;
  value: number;
}

// Total base-currency amount per category for one kind (expense or income), largest first.
function breakdown(transactions: FinanceTransaction[], kind: FinanceTransactionKind): BreakdownSlice[] {
  const byCategory = new Map<string, number>();
  for (const tx of transactions) {
    if (tx.kind !== kind) continue;
    byCategory.set(txCategory(tx), (byCategory.get(txCategory(tx)) ?? 0) + tx.base_amount);
  }
  return [...byCategory.entries()]
    .map(([name, value]) => ({ name, value: Number(value.toFixed(2)) }))
    .sort((a, b) => b.value - a.value);
}

// Slice palette for the breakdown pies — the portal accents plus a few distinct hues for long tails.
const PIE_COLORS = ['#723D9C', '#1E8E5A', '#B8860B', '#C0392B', '#2E86C1', '#16A085', '#D35400', '#7F7B82'];

// A titled cell in the charts grid — keeps every chart the same height and header style.
const ChartFrame: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div>
    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-grey">{title}</div>
    {children}
  </div>
);

// A donut of category totals for the expense/income breakdowns; shows a placeholder when the kind is empty.
const BreakdownPie: React.FC<{ data: BreakdownSlice[]; base: string; emptyLabel: string }> = ({
  data,
  base,
  emptyLabel,
}) => {
  if (data.length === 0) {
    return (
      <div style={{ height: 260 }} className="flex items-center justify-center text-xs text-grey">
        {emptyLabel}
      </div>
    );
  }
  return (
    <div style={{ height: 260 }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={90}
            paddingAngle={2}
          >
            {data.map((slice, index) => (
              <PieCell key={slice.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(value: number, name: string) => [formatMoney(value, base), name]} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

// A grouped income / expenses / net bar chart for a periodic report (quarters or years). Net is drawn as
// its own bar so it can dip below zero; shows a placeholder when the period has no activity.
const PeriodBars: React.FC<{ data: PeriodBar[]; base: string; emptyLabel: string }> = ({
  data,
  base,
  emptyLabel,
}) => {
  const hasData = data.some((bar) => bar.income !== 0 || bar.expense !== 0);
  if (!hasData) {
    return (
      <div style={{ height: 260 }} className="flex items-center justify-center text-xs text-grey">
        {emptyLabel}
      </div>
    );
  }
  return (
    <div style={{ height: 260 }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: -8 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} width={64} />
          <Tooltip formatter={(value: number, name: string) => [formatMoney(value, base), name]} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="income" name="Income" fill={CHART_INCOME} radius={[4, 4, 0, 0]} />
          <Bar dataKey="expense" name="Expenses" fill={CHART_EXPENSE} radius={[4, 4, 0, 0]} />
          <Bar dataKey="net" name="Net" fill={CHART_NET} radius={[4, 4, 0, 0]} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};

/**
 * The P&L / Overview tab — realised income vs expenses by month, from the finance ledger (0056).
 * Exported so the admin Dashboard can surface the same panel as a "P&L" tab (self-contained: it loads
 * its own data and is admin-gated by both callers).
 */
export const FinancePnlOverview: React.FC = () => {
  const transactions = useAsync(() => adminListFinanceTransactions(), []);
  const settings = useAsync(() => adminGetFinanceSettings(), []);
  // Fixed-cost names feed the "Add transaction" Description suggestions (expenses). Non-critical, so it
  // never blocks the P&L below — an empty list just means no suggestions yet.
  const overhead = useAsync(() => adminListOverheadExpenses(), []);

  // Add / delete state for standalone (manual) ledger entries (0057).
  const [adding, setAdding] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  // The P&L can be read as charts (trend at a glance) or the sortable list (exact figures).
  const [view, setView] = React.useState<'charts' | 'list'>('charts');
  // Report filters: a month range (inclusive) and a source-type narrowing. All P&L figures, charts,
  // breakdowns and the manual table below reflect these.
  const [fromMonth, setFromMonth] = React.useState('');
  const [toMonth, setToMonth] = React.useState('');
  const [sourceFilter, setSourceFilter] = React.useState<'all' | FinanceTransactionSource>('all');

  const base = settings.data?.base_currency ?? 'USD';

  // Derived rows are computed before the loading guards (empty until data resolves) so the sort hooks
  // below always run in the same order on every render.
  const all = transactions.data ?? [];
  const filtered = all.filter((tx) => {
    const month = tx.occurred_on.slice(0, 7);
    if (fromMonth && month < fromMonth) return false;
    if (toMonth && month > toMonth) return false;
    if (sourceFilter !== 'all' && tx.source_type !== sourceFilter) return false;
    return true;
  });
  const filtersActive = Boolean(fromMonth || toMonth || sourceFilter !== 'all');
  const monthRows = monthlyRows(filtered);
  const manual = filtered.filter((tx) => tx.source_type === 'manual');

  // Sortable P&L (defaults to newest month) and manual-ledger (defaults to newest entry) tables.
  const monthly = useTableSort(
    monthRows,
    {
      month: (r) => r.month,
      income: (r) => r.income,
      expense: (r) => r.expense,
      net: (r) => r.income - r.expense,
    },
    { key: 'month', dir: 'desc' },
  );
  const manualSort = useTableSort(
    manual,
    {
      date: (tx) => tx.occurred_on,
      type: (tx) => tx.kind,
      note: (tx) => tx.note ?? '',
      base: (tx) => tx.base_amount,
    },
    { key: 'date', dir: 'desc' },
  );

  const addTransaction = async (input: ManualTransactionInput) => {
    setSaving(true);
    try {
      await adminRecordManualTransaction(input);
      toast.success(`${input.kind === 'income' ? 'Income' : 'Expense'} recorded.`);
      setAdding(false);
      await transactions.reload();
    } catch (cause) {
      toast.error('Could not record the transaction', {
        description: cause instanceof Error ? cause.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  const deleteTransaction = async (tx: FinanceTransaction) => {
    if (!window.confirm('Delete this transaction? This cannot be undone.')) return;
    setDeletingId(tx.id);
    try {
      await adminDeleteFinanceTransaction(tx.id);
      toast.success('Transaction deleted.');
      await transactions.reload();
    } catch (cause) {
      toast.error('Could not delete the transaction', {
        description: cause instanceof Error ? cause.message : undefined,
      });
    } finally {
      setDeletingId(null);
    }
  };

  if (transactions.loading || settings.loading) {
    return <PortalSpinner label="Loading P&L…" />;
  }
  const loadError = transactions.error || settings.error;
  if (loadError) return <ErrorNote>{loadError}</ErrorNote>;

  const totalIncome = monthRows.reduce((sum, r) => sum + r.income, 0);
  const totalExpense = monthRows.reduce((sum, r) => sum + r.expense, 0);
  const net = totalIncome - totalExpense;
  const chartData = chartPoints(monthRows);
  const currentYear = new Date().getFullYear();
  const quarterBars = quarterlyBars(filtered, currentYear);
  const yearBars = yearlyBars(filtered);
  const expenseBreakdown = breakdown(filtered, 'expense');
  const incomeBreakdown = breakdown(filtered, 'income');

  return (
    <div className="space-y-4">
      <PortalCard
        title="Profit & loss"
        description={`Realised income and expenses, in ${base}. From paid salaries and invoices, plus any transactions you add here.`}
        action={({ open }) => (
          <div className="flex flex-wrap items-center justify-end gap-2">
            {open && (
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
            )}
            <PortalButton className="whitespace-nowrap" onClick={() => setAdding(true)}>
              <Plus className="h-4 w-4 shrink-0" /> Add transaction
            </PortalButton>
          </div>
        )}
        keepActionWhenCollapsed
      >
        <div className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border border-border-color bg-portal-tint/30 px-3 py-2.5">
          <label className="flex flex-col gap-1 text-[11px] font-medium text-grey">
            From
            <input
              type="month"
              value={fromMonth}
              max={toMonth || undefined}
              onChange={(event) => setFromMonth(event.target.value)}
              className="rounded-md border border-border-color bg-white px-2 py-1 text-sm text-foreground"
            />
          </label>
          <label className="flex flex-col gap-1 text-[11px] font-medium text-grey">
            To
            <input
              type="month"
              value={toMonth}
              min={fromMonth || undefined}
              onChange={(event) => setToMonth(event.target.value)}
              className="rounded-md border border-border-color bg-white px-2 py-1 text-sm text-foreground"
            />
          </label>
          <label className="flex flex-col gap-1 text-[11px] font-medium text-grey">
            Source
            <select
              value={sourceFilter}
              onChange={(event) => setSourceFilter(event.target.value as 'all' | FinanceTransactionSource)}
              className="rounded-md border border-border-color bg-white px-2 py-1 text-sm text-foreground"
            >
              <option value="all">All sources</option>
              <option value="salary">Salaries</option>
              <option value="invoice">Invoices</option>
              <option value="manual">Manual</option>
            </select>
          </label>
          {filtersActive && (
            <button
              type="button"
              onClick={() => {
                setFromMonth('');
                setToMonth('');
                setSourceFilter('all');
              }}
              className="ml-auto text-xs font-medium text-violet hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>

        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <StatTile label={`Income (${base})`} value={formatMoney(totalIncome, base)} tone="green" />
          <StatTile label={`Expenses (${base})`} value={formatMoney(totalExpense, base)} tone="amber" />
          <StatTile
            label={`Net (${base})`}
            value={formatMoney(net, base)}
            tone={net >= 0 ? 'violet' : 'red'}
          />
        </div>

        {monthRows.length === 0 ? (
          <EmptyState
            title={filtersActive ? 'No transactions match these filters' : 'No transactions yet'}
            description={
              filtersActive
                ? 'Try widening the month range or choosing a different source.'
                : 'Mark a salary or invoice paid, or add a transaction, to record your first expense or income.'
            }
          />
        ) : view === 'charts' ? (
          <div className="grid gap-6 lg:grid-cols-2">
            <ChartFrame title="Income vs expenses by month">
              <div style={{ height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} margin={{ top: 8, right: 8, bottom: 8, left: -8 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 11 }} width={64} />
                    <Tooltip formatter={(value: number, name: string) => [formatMoney(value, base), name]} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="income" name="Income" fill={CHART_INCOME} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="expense" name="Expenses" fill={CHART_EXPENSE} radius={[4, 4, 0, 0]} />
                    <Line
                      type="monotone"
                      dataKey="net"
                      name="Net"
                      stroke={CHART_NET}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </ChartFrame>
            <ChartFrame title="Cumulative net">
              <div style={{ height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} margin={{ top: 8, right: 8, bottom: 8, left: -8 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 11 }} width={64} />
                    <Tooltip formatter={(value: number) => [formatMoney(value, base), 'Cumulative net']} />
                    <Line
                      type="monotone"
                      dataKey="cumulative"
                      name="Cumulative net"
                      stroke={CHART_NET}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </ChartFrame>
            <ChartFrame title={`Quarterly (QoQ · ${currentYear})`}>
              <PeriodBars
                data={quarterBars}
                base={base}
                emptyLabel={`No transactions in ${currentYear}.`}
              />
            </ChartFrame>
            <ChartFrame title="Yearly (YoY)">
              <PeriodBars data={yearBars} base={base} emptyLabel="No transactions yet." />
            </ChartFrame>
            <ChartFrame title="Expenses by type">
              <BreakdownPie data={expenseBreakdown} base={base} emptyLabel="No expenses in range." />
            </ChartFrame>
            <ChartFrame title="Income by type">
              <BreakdownPie data={incomeBreakdown} base={base} emptyLabel="No income in range." />
            </ChartFrame>
          </div>
        ) : (
          <PortalTable
            head={[
              <SortHeader key="month" label="Month" sortKey="month" sort={monthly.sort} onSort={monthly.toggle} />,
              <SortHeader key="income" label={`Income (${base})`} sortKey="income" sort={monthly.sort} onSort={monthly.toggle} />,
              <SortHeader key="expense" label={`Expenses (${base})`} sortKey="expense" sort={monthly.sort} onSort={monthly.toggle} />,
              <SortHeader key="net" label={`Net (${base})`} sortKey="net" sort={monthly.sort} onSort={monthly.toggle} />,
            ]}
          >
            {monthly.sorted.map((row) => {
              const rowNet = row.income - row.expense;
              return (
                <Row key={row.month}>
                  <Cell className="font-medium">{formatMonth(row.month)}</Cell>
                  <Cell className="whitespace-nowrap text-portal-green">{formatMoney(row.income, base)}</Cell>
                  <Cell className="whitespace-nowrap text-portal-amber">{formatMoney(row.expense, base)}</Cell>
                  <Cell className={cn('whitespace-nowrap font-medium', rowNet < 0 && 'text-portal-red')}>
                    {formatMoney(rowNet, base)}
                  </Cell>
                </Row>
              );
            })}
          </PortalTable>
        )}

        <div className="mt-4">
          <InfoNote>
            Figures are the <strong>actual</strong> amounts paid/received (which may differ from the computed
            salary/invoice totals), each converted into {base} at the FX rate entered when it was recorded.
          </InfoNote>
        </div>
      </PortalCard>

      {/* Standalone entries an admin added by hand (0057) — the only rows deletable from here; salary and
          invoice transactions are managed by reverting them off 'paid' on their own tabs. Collapsible and
          collapsed by default (state persisted per the CollapsibleCards scope). */}
      <CollapsibleCards scope="finance-pl" defaultOpen={false}>
      <PortalCard
        title="Manual transactions"
        description="One-off expenses and income you added directly, not from a salary or invoice."
      >
        {manual.length === 0 ? (
          <EmptyState
            title="No manual transactions"
            description="Use “Add transaction” above to record a one-off expense or income."
          />
        ) : (
          <PortalTable
            head={[
              <SortHeader key="date" label="Date" sortKey="date" sort={manualSort.sort} onSort={manualSort.toggle} />,
              <SortHeader key="type" label="Type" sortKey="type" sort={manualSort.sort} onSort={manualSort.toggle} />,
              <SortHeader key="desc" label="Description" sortKey="note" sort={manualSort.sort} onSort={manualSort.toggle} />,
              'Amount',
              <SortHeader key="base" label={`In ${base}`} sortKey="base" sort={manualSort.sort} onSort={manualSort.toggle} />,
              '',
            ]}
          >
            {manualSort.sorted.map((tx) => (
              <Row key={tx.id}>
                <Cell className="whitespace-nowrap">{formatDate(tx.occurred_on)}</Cell>
                <Cell>
                  <StatusTag tone={tx.kind === 'income' ? 'green' : 'amber'}>
                    {tx.kind === 'income' ? 'Income' : 'Expense'}
                  </StatusTag>
                </Cell>
                <Cell>{tx.note ?? '—'}</Cell>
                <Cell className="whitespace-nowrap">{formatMoney(tx.amount, tx.currency)}</Cell>
                <Cell
                  className={cn(
                    'whitespace-nowrap font-medium',
                    tx.kind === 'income' ? 'text-portal-green' : 'text-portal-amber',
                  )}
                >
                  {formatMoney(tx.base_amount, tx.base_currency)}
                </Cell>
                <Cell className="text-right">
                  <PortalButton
                    variant="ghost"
                    className="px-2"
                    aria-label="Delete transaction"
                    disabled={deletingId === tx.id}
                    onClick={() => deleteTransaction(tx)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </PortalButton>
                </Cell>
              </Row>
            ))}
          </PortalTable>
        )}
      </PortalCard>
      </CollapsibleCards>

      <ManualTransactionDialog
        open={adding}
        onClose={() => setAdding(false)}
        baseCurrency={base}
        busy={saving}
        expenseNames={(overhead.data ?? []).map((expense) => expense.name)}
        onSubmit={addTransaction}
      />
    </div>
  );
};

/**
 * Financial accounting hub (migration 0056) — consolidates the three finance pages into tabs and adds a
 * P&L overview. Admin-only; the child pages each enforce their own admin guard and data loading. The
 * active tab lives in the URL (/admin/portal/finance/:tab) so it is linkable and the old routes redirect
 * straight to their tab.
 */
export const AdminPortalFinance: React.FC = () => {
  const { user } = usePortalUser();
  const isAdmin = user?.role === 'portal_admin';
  const navigate = useNavigate();
  const { tab } = useParams<{ tab: string }>();

  if (!isAdmin) {
    return <ErrorNote>Finance is restricted to portal administrators.</ErrorNote>;
  }

  // An unknown/absent tab falls back to the overview.
  const active: TabKey = (TAB_KEYS as readonly string[]).includes(tab ?? '') ? (tab as TabKey) : 'overview';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 className="text-xl font-semibold text-violet">Financial accounting</h1>
        <p className="text-sm text-grey">
          Company income, expenses and profitability. Admin-only — never shown to clients.
        </p>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-border-color">
        {TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => navigate(`/admin/portal/finance/${item.key}`)}
            className={cn(
              '-mb-px flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
              active === item.key
                ? 'border-violet text-violet'
                : 'border-transparent text-grey hover:text-foreground',
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </button>
        ))}
      </div>

      {active === 'overview' && <FinancePnlOverview />}
      {active === 'overhead' && <AdminPortalOverhead />}
      {active === 'salaries' && <AdminPortalSalaries />}
      {active === 'invoices' && <AdminPortalInvoices />}
    </div>
  );
};

/** Redirect a bare /admin/portal/finance to the default (overview) tab. */
export const AdminPortalFinanceIndexRedirect: React.FC = () => (
  <Navigate to="/admin/portal/finance/overview" replace />
);
