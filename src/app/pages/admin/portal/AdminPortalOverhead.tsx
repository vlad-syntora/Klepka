import React from 'react';
import { toast } from 'sonner';
import { PiggyBank, Pencil, Plus, Trash2 } from 'lucide-react';
import { useAsync } from '@/app/hooks/use-async';
import { usePortalUser } from '@/app/hooks/use-portal-user';
import {
  adminCreateOverheadExpense,
  adminDeleteOverheadExpense,
  adminGetFinanceSettings,
  adminListOverheadExpenses,
  adminListUsers,
  adminUpdateFinanceSettings,
  adminUpdateOverheadExpense,
  adminUpdateUser,
} from '@/app/lib/portal-admin-api';
import { formatMoney, prettyName } from '@/app/lib/portal-format';
import {
  OVERHEAD_CADENCE_LABELS,
  OVERHEAD_CADENCES,
  OVERHEAD_SCOPE_LABELS,
  OVERHEAD_SCOPES,
  PAY_CURRENCIES,
  ROLE_LABELS,
  isInternalRole,
  overheadMonthlyBase,
  type OverheadCadence,
  type OverheadExpense,
  type OverheadScope,
  type PortalUser,
} from '@/app/lib/portal-types';
import {
  Cell,
  EmptyState,
  ErrorNote,
  Field,
  InfoNote,
  PortalButton,
  PortalCard,
  PortalModal,
  PortalSpinner,
  PortalTable,
  Row,
  SortHeader,
  StatTile,
  StatusTag,
  inputClass,
  useTableSort,
} from '@/app/components/portal/PortalUi';

interface ExpenseEdit {
  id?: string;
  name: string;
  category: string;
  note: string;
  amount: string;
  currency: string;
  fx_rate: string;
  cadence: OverheadCadence;
  amortize_months: string;
  scope: OverheadScope;
  active: boolean;
}

const emptyExpense = (baseCurrency: string): ExpenseEdit => ({
  name: '',
  category: '',
  note: '',
  amount: '',
  currency: baseCurrency,
  fx_rate: '1',
  cadence: 'monthly',
  amortize_months: '12',
  scope: 'company',
  active: true,
});

// A per-hour rate reads better with cents always shown (e.g. $6.00, not $6).
const formatRate = (amount: number, currency: string): string =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);

/**
 * Company overhead (migration 0055) — the company's fixed running costs and the minimum per-hour markup
 * they imply. Admin-only (RLS enforces it too); never shown to clients. All the math runs here on the
 * loaded expenses + counted headcount:
 *   total → per employee → markup/hour across the [high … low] monthly-hours band (the min safe markup
 *   is the figure at the LOW hours end — fewer billable hours means each must carry more overhead).
 */
export const AdminPortalOverhead: React.FC = () => {
  const { user } = usePortalUser();
  const isAdmin = user?.role === 'portal_admin';

  const expenses = useAsync(() => adminListOverheadExpenses(), []);
  const settings = useAsync(() => adminGetFinanceSettings(), []);
  const users = useAsync(() => adminListUsers(), []);

  const [edit, setEdit] = React.useState<ExpenseEdit | null>(null);
  const [busy, setBusy] = React.useState(false);

  // Local, editable copy of the finance settings (seeded once loaded).
  const [baseCurrency, setBaseCurrency] = React.useState('');
  const [hoursLow, setHoursLow] = React.useState('');
  const [hoursHigh, setHoursHigh] = React.useState('');
  const [savingSettings, setSavingSettings] = React.useState(false);

  React.useEffect(() => {
    if (settings.data) {
      setBaseCurrency(settings.data.base_currency);
      setHoursLow(String(settings.data.overhead_hours_low));
      setHoursHigh(String(settings.data.overhead_hours_high));
    }
  }, [settings.data]);

  // Raw lists for the sortable tables, derived before the guards so the sort hooks always run. The seat
  // count used to sort the per-seat "Monthly" figures matches the post-guard math (active internal staff).
  const expenseRows = expenses.data ?? [];
  const activeInternal = (users.data ?? [])
    .filter((u) => u.account_id === null && isInternalRole(u.role) && u.status === 'active')
    .sort((a, b) => a.full_name.localeCompare(b.full_name));
  const seatCountForSort = activeInternal.length;

  const costSort = useTableSort(expenseRows, {
    name: (expense) => expense.name,
    amount: (expense) => expense.amount * expense.fx_rate,
    cadence: (expense) => expense.cadence,
    scope: (expense) => expense.scope,
    monthly: (expense) => overheadMonthlyBase(expense, seatCountForSort),
  });
  const staffSort = useTableSort(
    activeInternal,
    {
      employee: (person) => prettyName(person.full_name),
      role: (person) => ROLE_LABELS[person.role],
      covers: (person) => (person.counts_for_overhead ? 1 : 0),
    },
    { key: 'employee', dir: 'asc' },
  );

  if (!isAdmin) {
    return <ErrorNote>Overhead is restricted to portal administrators.</ErrorNote>;
  }

  if (expenses.loading || settings.loading || users.loading) {
    return <PortalSpinner label="Loading overhead…" />;
  }
  const loadError = expenses.error || settings.error || users.error;
  if (loadError) return <ErrorNote>{loadError}</ErrorNote>;

  const base = settings.data!.base_currency;
  const rows = expenses.data ?? [];
  const allUsers = users.data ?? [];

  // Internal staff only. Two distinct headcounts:
  //   • seats — everyone ACTIVE consumes licenses, so per-seat costs scale with them (counted or not).
  //   • covered — only active staff with counts_for_overhead cover the overhead, so they're the divisor.
  // A non-covering active employee still adds seat cost that the covering ones must absorb.
  const internal = allUsers
    .filter((u) => u.account_id === null && isInternalRole(u.role))
    .sort((a, b) => a.full_name.localeCompare(b.full_name));
  const active = internal.filter((u) => u.status === 'active');
  const covered = active.filter((u) => u.counts_for_overhead);
  const seatCount = active.length;
  const coveredCount = covered.length;

  const activeExpenses = rows.filter((expense) => expense.active);
  const monthlyOf = (expense: OverheadExpense) => overheadMonthlyBase(expense, seatCount);
  const companyMonthly = activeExpenses.filter((e) => e.scope === 'company').reduce((sum, e) => sum + monthlyOf(e), 0);
  const perSeatMonthly = activeExpenses.filter((e) => e.scope === 'per_seat').reduce((sum, e) => sum + monthlyOf(e), 0);
  const totalMonthly = companyMonthly + perSeatMonthly;

  const perEmployee = coveredCount > 0 ? totalMonthly / coveredCount : 0;
  const low = Number(settings.data!.overhead_hours_low) || 0;
  const high = Number(settings.data!.overhead_hours_high) || 0;
  // Fewer hours → higher markup, so the min-safe markup is at the LOW hours end.
  const markupMin = low > 0 ? perEmployee / low : 0; // minimum safe (low hours)
  const markupAtHigh = high > 0 ? perEmployee / high : 0; // lower bound (high hours)

  // Optional: express the markup as a % of the average pay rate of covering staff who have one set.
  const withRate = covered.filter((u) => u.pay_rate && u.pay_rate > 0);
  const avgPayRate = withRate.length > 0 ? withRate.reduce((sum, u) => sum + (u.pay_rate ?? 0), 0) / withRate.length : 0;
  const markupPct = avgPayRate > 0 ? (markupMin / avgPayRate) * 100 : 0;

  const saveExpense = async () => {
    if (!edit) return;
    const amount = Number(edit.amount);
    const fx = Number(edit.fx_rate);
    if (!edit.name.trim() || !Number.isFinite(amount) || amount <= 0) {
      toast.error('Give the cost a name and a positive amount.');
      return;
    }
    if (!Number.isFinite(fx) || fx <= 0) {
      toast.error('FX rate must be a positive number (use 1 if already in the base currency).');
      return;
    }
    const amortize = edit.cadence === 'one_off' ? Number(edit.amortize_months) : null;
    if (edit.cadence === 'one_off' && (!Number.isFinite(amortize as number) || (amortize as number) <= 0)) {
      toast.error('Set how many months to spread the one-off cost over.');
      return;
    }
    setBusy(true);
    try {
      const payload = {
        name: edit.name.trim(),
        category: edit.category.trim() || null,
        note: edit.note.trim() || null,
        amount,
        currency: edit.currency.trim().toUpperCase() || base,
        fx_rate: fx,
        cadence: edit.cadence,
        amortize_months: amortize,
        scope: edit.scope,
        active: edit.active,
      };
      if (edit.id) await adminUpdateOverheadExpense(edit.id, payload);
      else await adminCreateOverheadExpense(payload);
      toast.success(edit.id ? 'Cost updated.' : 'Cost added.');
      setEdit(null);
      await expenses.reload();
    } catch (cause) {
      toast.error('Could not save', { description: cause instanceof Error ? cause.message : undefined });
    } finally {
      setBusy(false);
    }
  };

  const removeExpense = async (expense: OverheadExpense) => {
    if (!window.confirm(`Delete "${expense.name}"?`)) return;
    try {
      await adminDeleteOverheadExpense(expense.id);
      await expenses.reload();
    } catch (cause) {
      toast.error('Could not delete', { description: cause instanceof Error ? cause.message : undefined });
    }
  };

  const saveSettings = async () => {
    const lowN = Number(hoursLow);
    const highN = Number(hoursHigh);
    if (!baseCurrency.trim()) {
      toast.error('Set a base currency.');
      return;
    }
    if (!Number.isFinite(lowN) || !Number.isFinite(highN) || lowN <= 0 || highN <= 0) {
      toast.error('Hours must be positive numbers.');
      return;
    }
    if (lowN > highN) {
      toast.error('Low hours can’t be greater than high hours.');
      return;
    }
    setSavingSettings(true);
    try {
      await adminUpdateFinanceSettings({
        base_currency: baseCurrency.trim().toUpperCase(),
        overhead_hours_low: lowN,
        overhead_hours_high: highN,
      });
      toast.success('Settings saved.');
      await settings.reload();
    } catch (cause) {
      toast.error('Could not save settings', { description: cause instanceof Error ? cause.message : undefined });
    } finally {
      setSavingSettings(false);
    }
  };

  const toggleCounted = async (person: PortalUser) => {
    try {
      await adminUpdateUser(person.id, { counts_for_overhead: !person.counts_for_overhead });
      await users.reload();
    } catch (cause) {
      toast.error('Could not update', { description: cause instanceof Error ? cause.message : undefined });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="flex items-center gap-2 text-xl font-semibold text-violet">
            <PiggyBank className="h-5 w-5" /> Overhead
          </h1>
          <p className="text-sm text-grey">
            The company’s fixed monthly costs and the minimum markup each billable hour must carry to cover them.
            Admin-only — never shown to clients.
          </p>
        </div>
        <PortalButton onClick={() => setEdit(emptyExpense(base))}>
          <Plus className="h-4 w-4" /> Add cost
        </PortalButton>
      </div>

      {/* Headline result */}
      <PortalCard
        title="Required markup per hour"
        description={`${seatCount} active ${seatCount === 1 ? 'seat' : 'seats'} consume costs; ${coveredCount} cover them at ${low}–${high} billable hours/month each.`}
      >
        {coveredCount === 0 ? (
          <InfoNote>
            No one covers overhead yet. Tick at least one active internal employee below (Counted = covers costs) so
            the total can be shared out.
          </InfoNote>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatTile label="Total overhead / month" value={formatMoney(totalMonthly, base)} tone="violet" />
              <StatTile label="Per covering employee / month" value={formatMoney(perEmployee, base)} />
              <StatTile
                label="Min markup / hour"
                value={formatRate(markupMin, base)}
                tone="amber"
                hint={`safe at ${low} h/month`}
              />
              <StatTile
                label="Markup / hour at full load"
                value={formatRate(markupAtHigh, base)}
                hint={`at ${high} h/month`}
              />
            </div>
            <p className="mt-3 text-sm text-grey">
              Add at least{' '}
              <span className="font-semibold text-foreground">{formatRate(markupMin, base)}/hour</span> on top of each
              person’s cost rate to cover overhead
              {avgPayRate > 0 && (
                <>
                  {' '}
                  (≈ <span className="font-medium text-foreground">{markupPct.toFixed(0)}%</span> of the average{' '}
                  {formatMoney(avgPayRate, base)}/h pay rate)
                </>
              )}
              . Range: {formatRate(markupAtHigh, base)}–{formatRate(markupMin, base)}/hour depending on utilisation.
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-grey">
              <StatusTag tone="grey">Company-wide: {formatMoney(companyMonthly, base)}/mo</StatusTag>
              <StatusTag tone="grey">Per-seat ({seatCount}): {formatMoney(perSeatMonthly, base)}/mo</StatusTag>
              <StatusTag tone="grey">Covered by {coveredCount} of {seatCount}</StatusTag>
            </div>
          </>
        )}
      </PortalCard>

      {/* Settings */}
      <PortalCard title="Settings" description="Base currency and the assumed billable-hours band per person.">
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Base currency" className="w-32">
            <select
              className={inputClass}
              value={baseCurrency}
              onChange={(event) => setBaseCurrency(event.target.value)}
            >
              {PAY_CURRENCIES.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Hours / month (low)" className="w-40">
            <input
              type="number"
              className={inputClass}
              value={hoursLow}
              onChange={(event) => setHoursLow(event.target.value)}
            />
          </Field>
          <Field label="Hours / month (high)" className="w-40">
            <input
              type="number"
              className={inputClass}
              value={hoursHigh}
              onChange={(event) => setHoursHigh(event.target.value)}
            />
          </Field>
          <PortalButton disabled={savingSettings} onClick={saveSettings}>
            {savingSettings ? 'Saving…' : 'Save settings'}
          </PortalButton>
        </div>
      </PortalCard>

      {/* Expenses */}
      <PortalCard title="Fixed costs" description="Subscriptions, vendors and other recurring spend. Toggle off to exclude.">
        {rows.length === 0 ? (
          <EmptyState title="No costs yet" description="Add your first fixed cost to start the calculation." />
        ) : (
          <PortalTable
            head={[
              <SortHeader key="cost" label="Cost" sortKey="name" sort={costSort.sort} onSort={costSort.toggle} />,
              <SortHeader key="amount" label="Amount" sortKey="amount" sort={costSort.sort} onSort={costSort.toggle} />,
              <SortHeader key="cadence" label="Cadence" sortKey="cadence" sort={costSort.sort} onSort={costSort.toggle} />,
              <SortHeader key="scope" label="Scope" sortKey="scope" sort={costSort.sort} onSort={costSort.toggle} />,
              <SortHeader key="monthly" label={`Monthly (${base})`} sortKey="monthly" sort={costSort.sort} onSort={costSort.toggle} />,
              'Active',
              '',
            ]}
          >
            {costSort.sorted.map((expense) => {
              const monthly = monthlyOf(expense);
              const nativeAmount = formatMoney(expense.amount, expense.currency);
              return (
                <Row key={expense.id} className={expense.active ? undefined : 'opacity-50'}>
                  <Cell>
                    <div className="font-medium">{expense.name}</div>
                    {expense.category && <div className="text-xs text-grey">{expense.category}</div>}
                  </Cell>
                  <Cell className="whitespace-nowrap">
                    {nativeAmount}
                    {expense.currency !== base && (
                      <div className="text-xs text-grey">× {expense.fx_rate} → {base}</div>
                    )}
                  </Cell>
                  <Cell className="whitespace-nowrap text-grey">
                    {OVERHEAD_CADENCE_LABELS[expense.cadence]}
                    {expense.cadence === 'one_off' && expense.amortize_months
                      ? ` / ${expense.amortize_months}mo`
                      : ''}
                  </Cell>
                  <Cell>
                    <StatusTag tone={expense.scope === 'per_seat' ? 'violet' : 'grey'}>
                      {OVERHEAD_SCOPE_LABELS[expense.scope]}
                    </StatusTag>
                  </Cell>
                  <Cell className="whitespace-nowrap font-medium">{formatMoney(monthly, base)}</Cell>
                  <Cell>
                    <input
                      type="checkbox"
                      checked={expense.active}
                      onChange={async () => {
                        try {
                          await adminUpdateOverheadExpense(expense.id, { active: !expense.active });
                          await expenses.reload();
                        } catch (cause) {
                          toast.error('Could not update', {
                            description: cause instanceof Error ? cause.message : undefined,
                          });
                        }
                      }}
                      aria-label={`Toggle ${expense.name}`}
                    />
                  </Cell>
                  <Cell className="text-right">
                    <div className="flex justify-end gap-1">
                      <PortalButton
                        variant="ghost"
                        onClick={() =>
                          setEdit({
                            id: expense.id,
                            name: expense.name,
                            category: expense.category ?? '',
                            note: expense.note ?? '',
                            amount: String(expense.amount),
                            currency: expense.currency,
                            fx_rate: String(expense.fx_rate),
                            cadence: expense.cadence,
                            amortize_months: expense.amortize_months ? String(expense.amortize_months) : '12',
                            scope: expense.scope,
                            active: expense.active,
                          })
                        }
                        aria-label="Edit cost"
                      >
                        <Pencil className="h-4 w-4" />
                      </PortalButton>
                      <PortalButton variant="ghost" onClick={() => removeExpense(expense)} aria-label="Delete cost">
                        <Trash2 className="h-4 w-4" />
                      </PortalButton>
                    </div>
                  </Cell>
                </Row>
              );
            })}
          </PortalTable>
        )}
      </PortalCard>

      {/* Headcount */}
      <PortalCard
        title="Employees"
        description="Every active employee consumes a seat. “Covers costs” marks the ones who carry the overhead — untick anyone who doesn’t earn it back (they still cost a seat)."
      >
        {active.length === 0 ? (
          <EmptyState title="No active internal staff" />
        ) : (
          <PortalTable
            head={[
              <SortHeader key="employee" label="Employee" sortKey="employee" sort={staffSort.sort} onSort={staffSort.toggle} />,
              <SortHeader key="role" label="Role" sortKey="role" sort={staffSort.sort} onSort={staffSort.toggle} />,
              'Status',
              <SortHeader key="covers" label="Covers costs" sortKey="covers" sort={staffSort.sort} onSort={staffSort.toggle} />,
            ]}
          >
            {staffSort.sorted.map((person) => (
              <Row key={person.id}>
                <Cell className="font-medium">{prettyName(person.full_name)}</Cell>
                <Cell className="text-grey">{ROLE_LABELS[person.role]}</Cell>
                <Cell>
                  <StatusTag tone="green">Active — seat</StatusTag>
                </Cell>
                <Cell>
                  <label className="flex items-center gap-2 text-xs text-grey">
                    <input
                      type="checkbox"
                      checked={person.counts_for_overhead}
                      onChange={() => toggleCounted(person)}
                      aria-label={`Covers costs: ${prettyName(person.full_name)}`}
                    />
                    {person.counts_for_overhead ? 'Covers costs' : 'Consumes only'}
                  </label>
                </Cell>
              </Row>
            ))}
          </PortalTable>
        )}
      </PortalCard>

      {edit && (
        <PortalModal
          open
          onClose={() => setEdit(null)}
          title={edit.id ? 'Edit cost' : 'Add cost'}
          description="A fixed running cost. Enter it in its own currency with an FX rate into the base currency."
          className="max-w-lg"
        >
          <div className="space-y-3">
            <Field label="Name">
              <input
                className={inputClass}
                value={edit.name}
                onChange={(event) => setEdit({ ...edit, name: event.target.value })}
                placeholder="Google Workspace"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Amount">
                <input
                  type="number"
                  className={inputClass}
                  value={edit.amount}
                  onChange={(event) => setEdit({ ...edit, amount: event.target.value })}
                />
              </Field>
              <Field label="Currency">
                <select
                  className={inputClass}
                  value={edit.currency}
                  onChange={(event) => setEdit({ ...edit, currency: event.target.value })}
                >
                  {PAY_CURRENCIES.map((code) => (
                    <option key={code} value={code}>
                      {code}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Field
              label={`FX rate → ${base}`}
              hint={edit.currency.trim().toUpperCase() === base ? 'Same as base — leave 1.' : `1 ${edit.currency.trim().toUpperCase() || '?'} = this many ${base}.`}
            >
              <input
                type="number"
                step="0.0001"
                className={inputClass}
                value={edit.fx_rate}
                onChange={(event) => setEdit({ ...edit, fx_rate: event.target.value })}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Cadence">
                <select
                  className={inputClass}
                  value={edit.cadence}
                  onChange={(event) => setEdit({ ...edit, cadence: event.target.value as OverheadCadence })}
                >
                  {OVERHEAD_CADENCES.map((cadence) => (
                    <option key={cadence} value={cadence}>
                      {OVERHEAD_CADENCE_LABELS[cadence]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Scope">
                <select
                  className={inputClass}
                  value={edit.scope}
                  onChange={(event) => setEdit({ ...edit, scope: event.target.value as OverheadScope })}
                >
                  {OVERHEAD_SCOPES.map((scope) => (
                    <option key={scope} value={scope}>
                      {OVERHEAD_SCOPE_LABELS[scope]}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            {edit.cadence === 'one_off' && (
              <Field label="Spread over (months)" hint="A one-off cost is amortised across this many months.">
                <input
                  type="number"
                  className={inputClass}
                  value={edit.amortize_months}
                  onChange={(event) => setEdit({ ...edit, amortize_months: event.target.value })}
                />
              </Field>
            )}
            <Field label="Category" hint="Optional grouping tag (e.g. software, vendor).">
              <input
                className={inputClass}
                value={edit.category}
                onChange={(event) => setEdit({ ...edit, category: event.target.value })}
              />
            </Field>
            <Field label="Note" hint="Optional.">
              <input
                className={inputClass}
                value={edit.note}
                onChange={(event) => setEdit({ ...edit, note: event.target.value })}
              />
            </Field>
            <label className="flex items-center gap-2 text-sm text-grey">
              <input
                type="checkbox"
                checked={edit.active}
                onChange={(event) => setEdit({ ...edit, active: event.target.checked })}
              />
              Active (counts toward the total)
            </label>
            <div className="flex gap-2 pt-1">
              <PortalButton disabled={busy} onClick={saveExpense}>
                {busy ? 'Saving…' : 'Save'}
              </PortalButton>
              <PortalButton variant="ghost" type="button" onClick={() => setEdit(null)}>
                Cancel
              </PortalButton>
            </div>
          </div>
        </PortalModal>
      )}
    </div>
  );
};
