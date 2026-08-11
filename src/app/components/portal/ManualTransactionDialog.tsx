import React from 'react';
import { formatMoney } from '@/app/lib/portal-format';
import { PAY_CURRENCIES, type FinanceTransactionKind } from '@/app/lib/portal-types';
import type { ManualTransactionInput } from '@/app/lib/portal-admin-api';
import { Field, InfoNote, PortalButton, PortalModal, inputClass } from '@/app/components/portal/PortalUi';
import { cn } from '@/app/components/ui/utils';

function todayValue(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/**
 * Add a standalone expense or income to the finance ledger (migration 0057) — one-off money with no
 * planned salary/invoice behind it (bank fees, a refund, misc revenue). Same currency + manual-FX capture
 * as PayDialog, plus an expense/income toggle and a required description (there is no source to name it).
 */
export const ManualTransactionDialog: React.FC<{
  open: boolean;
  onClose: () => void;
  baseCurrency: string;
  busy?: boolean;
  /** Fixed-cost names offered as Description suggestions for expenses (free text still allowed). */
  expenseNames?: string[];
  onSubmit: (input: ManualTransactionInput) => void;
}> = ({ open, onClose, baseCurrency, busy, expenseNames, onSubmit }) => {
  const [kind, setKind] = React.useState<FinanceTransactionKind>('expense');
  const [amount, setAmount] = React.useState('');
  const [currency, setCurrency] = React.useState(baseCurrency);
  const [fxRate, setFxRate] = React.useState('1');
  const [occurredOn, setOccurredOn] = React.useState(todayValue());
  const [note, setNote] = React.useState('');

  // Re-seed the form each time the dialog opens.
  React.useEffect(() => {
    if (!open) return;
    setKind('expense');
    setAmount('');
    setCurrency(baseCurrency);
    setFxRate('1');
    setOccurredOn(todayValue());
    setNote('');
  }, [open, baseCurrency]);

  // Deduped fixed-cost names, shown as a datalist so an expense can be picked from them or freely typed.
  const expenseSuggestions = React.useMemo(
    () => [...new Set((expenseNames ?? []).map((name) => name.trim()).filter(Boolean))],
    [expenseNames],
  );
  const showSuggestions = kind === 'expense' && expenseSuggestions.length > 0;

  // The base currency may sit outside the usual pay list — always offer it as an option.
  const currencyOptions = React.useMemo(() => {
    const base = baseCurrency.toUpperCase();
    return PAY_CURRENCIES.includes(base as (typeof PAY_CURRENCIES)[number])
      ? PAY_CURRENCIES
      : [base, ...PAY_CURRENCIES];
  }, [baseCurrency]);

  const amountNum = Number(amount);
  const fxNum = Number(fxRate);
  const sameAsBase = currency.trim().toUpperCase() === baseCurrency.toUpperCase();
  const baseAmount = Number.isFinite(amountNum) && Number.isFinite(fxNum) ? amountNum * fxNum : 0;
  const canSubmit =
    Number.isFinite(amountNum) &&
    amountNum > 0 &&
    Number.isFinite(fxNum) &&
    fxNum > 0 &&
    Boolean(occurredOn) &&
    note.trim().length > 0;

  const submit = () => {
    if (!canSubmit) return;
    onSubmit({
      kind,
      amount: amountNum,
      currency: currency.trim().toUpperCase() || baseCurrency,
      fx_rate: fxNum,
      occurred_on: occurredOn,
      note: note.trim(),
    });
  };

  return (
    <PortalModal
      open={open}
      onClose={onClose}
      title="Add transaction"
      description={`A one-off expense or income with no salary or invoice behind it, converted into ${baseCurrency}.`}
      className="max-w-md"
    >
      <div className="space-y-3">
        <Field label="Type">
          <div className="flex overflow-hidden rounded-lg border border-border-color text-sm font-medium">
            {(['expense', 'income'] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setKind(value)}
                className={cn(
                  'flex-1 px-3 py-2 capitalize transition-colors',
                  kind === value
                    ? value === 'income'
                      ? 'bg-portal-green text-white'
                      : 'bg-portal-amber text-white'
                    : 'text-grey hover:text-foreground',
                )}
              >
                {value}
              </button>
            ))}
          </div>
        </Field>

        <Field
          label="Description"
          hint={
            showSuggestions
              ? 'Required — pick a fixed cost or type your own.'
              : 'Required — what this transaction is for.'
          }
        >
          <input
            className={inputClass}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Bank fees, refund, grant…"
            list={showSuggestions ? 'manual-expense-descriptions' : undefined}
            autoFocus
          />
          {showSuggestions && (
            <datalist id="manual-expense-descriptions">
              {expenseSuggestions.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          )}
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Amount">
            <input
              type="number"
              className={inputClass}
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </Field>
          <Field label="Currency">
            <select
              className={inputClass}
              value={currency}
              onChange={(event) => {
                const next = event.target.value;
                setCurrency(next);
                setFxRate(next.toUpperCase() === baseCurrency.toUpperCase() ? '1' : fxRate === '1' ? '' : fxRate);
              }}
            >
              {currencyOptions.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field
          label={`FX rate → ${baseCurrency}`}
          hint={sameAsBase ? 'Same as base — leave 1.' : `1 ${currency.trim().toUpperCase() || '?'} = this many ${baseCurrency}.`}
        >
          <input
            type="number"
            step="0.0001"
            className={inputClass}
            value={fxRate}
            onChange={(event) => setFxRate(event.target.value)}
          />
        </Field>

        <Field label="Date">
          <input
            type="date"
            className={inputClass}
            value={occurredOn}
            onChange={(event) => setOccurredOn(event.target.value)}
          />
        </Field>

        <InfoNote>
          Records as a{kind === 'income' ? 'n income' : 'n expense'} of {formatMoney(baseAmount, baseCurrency)} in{' '}
          {baseCurrency}
          {!sameAsBase && Number.isFinite(amountNum) && amountNum > 0 && (
            <> ({formatMoney(amountNum, currency.trim().toUpperCase() || baseCurrency)} × {fxRate || '—'})</>
          )}
          .
        </InfoNote>

        <div className="flex gap-2 pt-1">
          <PortalButton disabled={busy || !canSubmit} onClick={submit}>
            {busy ? 'Saving…' : 'Add transaction'}
          </PortalButton>
          <PortalButton variant="ghost" type="button" onClick={onClose}>
            Cancel
          </PortalButton>
        </div>
      </div>
    </PortalModal>
  );
};
