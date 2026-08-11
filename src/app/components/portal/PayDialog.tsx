import React from 'react';
import { formatMoney } from '@/app/lib/portal-format';
import { PAY_CURRENCIES } from '@/app/lib/portal-types';
import type { PaymentInput } from '@/app/lib/portal-admin-api';
import { Field, InfoNote, PortalButton, PortalModal, inputClass } from '@/app/components/portal/PortalUi';

function todayValue(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/**
 * The "mark as paid" popup shared by the Salaries and Invoices tabs (migration 0056). Captures the
 * EXACT amount paid/received in its own currency with a manual FX rate into the base currency (same
 * pattern as overhead), plus the payment date and an optional note. Shows a live base-currency preview.
 * The computed total is offered as the default amount; the admin confirms or overrides it.
 */
export const PayDialog: React.FC<{
  open: boolean;
  onClose: () => void;
  /** Modal title, e.g. "Mark salary paid" / "Mark invoice paid". */
  title: string;
  /** Whether the recorded amount is money out (expense) or in (income) — tunes the copy only. */
  kind: 'expense' | 'income';
  baseCurrency: string;
  /** The computed reference total, pre-filled as the amount and shown for comparison. */
  computedAmount: number;
  /** The source's own currency — the default currency for the payment. */
  defaultCurrency: string;
  busy?: boolean;
  onSubmit: (payment: PaymentInput) => void;
}> = ({ open, onClose, title, kind, baseCurrency, computedAmount, defaultCurrency, busy, onSubmit }) => {
  const [amount, setAmount] = React.useState('');
  const [currency, setCurrency] = React.useState(defaultCurrency);
  const [fxRate, setFxRate] = React.useState('1');
  const [occurredOn, setOccurredOn] = React.useState(todayValue());
  const [note, setNote] = React.useState('');

  // Re-seed the form each time the dialog opens for a different source.
  React.useEffect(() => {
    if (!open) return;
    setAmount(computedAmount > 0 ? String(computedAmount) : '');
    setCurrency(defaultCurrency);
    setFxRate(defaultCurrency.toUpperCase() === baseCurrency.toUpperCase() ? '1' : '');
    setOccurredOn(todayValue());
    setNote('');
  }, [open, computedAmount, defaultCurrency, baseCurrency]);

  const amountNum = Number(amount);
  const fxNum = Number(fxRate);
  const sameAsBase = currency.trim().toUpperCase() === baseCurrency.toUpperCase();
  const baseAmount = Number.isFinite(amountNum) && Number.isFinite(fxNum) ? amountNum * fxNum : 0;
  const canSubmit =
    Number.isFinite(amountNum) && amountNum > 0 && Number.isFinite(fxNum) && fxNum > 0 && Boolean(occurredOn);

  const submit = () => {
    if (!canSubmit) return;
    onSubmit({
      amount: amountNum,
      currency: currency.trim().toUpperCase() || baseCurrency,
      fx_rate: fxNum,
      occurred_on: occurredOn,
      note: note.trim() || null,
    });
  };

  return (
    <PortalModal
      open={open}
      onClose={onClose}
      title={title}
      description={`Record the exact amount ${kind === 'expense' ? 'paid' : 'received'}, converted into ${baseCurrency}.`}
      className="max-w-md"
    >
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Amount" hint={computedAmount > 0 ? `Computed: ${formatMoney(computedAmount, defaultCurrency)}` : undefined}>
            <input
              type="number"
              className={inputClass}
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              autoFocus
            />
          </Field>
          <Field label="Currency">
            <select
              className={inputClass}
              value={currency}
              onChange={(event) => {
                const next = event.target.value;
                setCurrency(next);
                // Snap the rate to 1 when it matches the base; clear it otherwise so it must be entered.
                setFxRate(next.toUpperCase() === baseCurrency.toUpperCase() ? '1' : fxRate === '1' ? '' : fxRate);
              }}
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

        <Field label="Payment date">
          <input
            type="date"
            className={inputClass}
            value={occurredOn}
            onChange={(event) => setOccurredOn(event.target.value)}
          />
        </Field>

        <Field label="Note" hint="Optional — a reference for this payment.">
          <input
            className={inputClass}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Bank ref, method…"
          />
        </Field>

        <InfoNote>
          Records as {formatMoney(baseAmount, baseCurrency)} in {baseCurrency}
          {!sameAsBase && Number.isFinite(amountNum) && amountNum > 0 && (
            <> ({formatMoney(amountNum, currency.trim().toUpperCase() || baseCurrency)} × {fxRate || '—'})</>
          )}
          .
        </InfoNote>

        <div className="flex gap-2 pt-1">
          <PortalButton disabled={busy || !canSubmit} onClick={submit}>
            {busy ? 'Saving…' : 'Confirm payment'}
          </PortalButton>
          <PortalButton variant="ghost" type="button" onClick={onClose}>
            Cancel
          </PortalButton>
        </div>
      </div>
    </PortalModal>
  );
};
